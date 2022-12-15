// @ts-ignore
import bs58 from "bs58";
import {
  ETH_CORE_BRIDGE_MAINNET,
  ETH_NODE_URL_MAINNET,
  ETH_PRIVATE_KEY,
  ETH_TOKEN_BRIDGE_MAINNET,
  ONE_INCH_MAINNET,
  // ONE_INCH_SOLANA_MAINNET,
  SOL_PRIVATE_KEY,
  SOLANA_CORE_BRIDGE_MAINNET,
  SOLANA_TOKEN_BRIDGE_MAINNET,
  WETH_SOLANA_MAINNET,
  WORMHOLE_RPC_HOST_MAINNET,
} from "./constants";
import {
  approveEth,
  CHAIN_ID_ETH,
  CHAIN_ID_SOLANA,
  getEmitterAddressEth,
  getForeignAssetEth,
  getForeignAssetSolana,
  getIsTransferCompletedSolana,
  getOriginalAssetEth,
  getSignedVAAWithRetry,
  hexToUint8Array,
  parseSequenceFromLogEth,
  redeemOnSolana,
  transferFromEth,
  tryNativeToHexString,
  tryNativeToUint8Array,
  transferFromSolana,
  getEmitterAddressSolana,
  parseSequenceFromLogSolana,
} from "@certusone/wormhole-sdk";
import { postVaaWithRetry } from "@certusone/wormhole-sdk/lib/cjs/solana/sendAndConfirmPostVaa";
import {
  Connection,
  Keypair,
  PublicKey,
  TokenAccountsFilter,
  Transaction,
} from "@solana/web3.js";
import { ethers } from "ethers";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { parseUnits } from "@ethersproject/units";

// @TODO tooling: CRA does not allow to import outside of src and cannot link from other repos (as well as trynspile with babel)
export const getSequence = async (
  connection: Connection,
  solKeypair: Keypair
) => {
  const provider = new ethers.providers.WebSocketProvider(ETH_NODE_URL_MAINNET);

  const ethSigner = new ethers.Wallet(ETH_PRIVATE_KEY, provider);

  const originalAsset = await getOriginalAssetEth(
    ETH_TOKEN_BRIDGE_MAINNET,

    provider,
    ONE_INCH_MAINNET,
    CHAIN_ID_ETH
  );

  console.log(originalAsset);

  let solanaMint = await getForeignAssetSolana(
    connection,
    SOLANA_TOKEN_BRIDGE_MAINNET,
    CHAIN_ID_ETH,
    originalAsset.assetAddress
  );

  console.log("Solana mint:", solanaMint);

  if (!solanaMint) {
    throw new Error("No Solana mint");
  }

  const solanaMintPubKey = new PublicKey(solanaMint);

  const recipient = await getAssociatedTokenAddress(
    solanaMintPubKey,
    solKeypair.publicKey
  );

  console.log("receipt", recipient);

  const associatedAddressInfo = await connection.getAccountInfo(recipient);

  console.log("associated token info", associatedAddressInfo);

  if (!associatedAddressInfo) {
    console.log("creating associated token account");
    const transaction = new Transaction().add(
      await createAssociatedTokenAccountInstruction(
        solKeypair.publicKey, // payer
        recipient,
        solKeypair.publicKey, // owner
        solanaMintPubKey
      )
    );
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = solKeypair.publicKey;
    // sign, send, and confirm transaction
    transaction.partialSign(solKeypair);
    const txid = await connection.sendRawTransaction(transaction.serialize());
    const confirmedTransaction = await connection.confirmTransaction(txid);
    console.log("Transaction  confirmation", confirmedTransaction);
  }
  const amount = parseUnits("1.0", 18);
  // const amount = parseEther("0.0001");
  console.log("Amount to send", amount);
  // approve the bridge to spend tokens
  await approveEth(
    ETH_TOKEN_BRIDGE_MAINNET,
    ONE_INCH_MAINNET,
    ethSigner,
    amount
  );
  // // transfer tokens
  console.log("approved");
  // const receipt = await transferFromEthNative(
  const receipt = await transferFromEth(
    ETH_TOKEN_BRIDGE_MAINNET,
    ethSigner,
    ONE_INCH_MAINNET,
    amount,
    CHAIN_ID_SOLANA,
    tryNativeToUint8Array(recipient.toString(), CHAIN_ID_SOLANA)
  );

  console.log("RECEIPT", receipt);

  const sequence = parseSequenceFromLogEth(receipt, ETH_CORE_BRIDGE_MAINNET);

  console.log(" sequence", sequence);

  return sequence;
};

export const finilizeTransfer = async (
  sequence: string,
  connection: Connection,
  solKeyPair: Keypair
) => {
  console.log("trying get VAA");
  const emitterAddress = getEmitterAddressEth(ETH_TOKEN_BRIDGE_MAINNET);

  console.log("emitter address", emitterAddress);

  const { vaaBytes: signedVAA } = await getSignedVAAWithRetry(
    [WORMHOLE_RPC_HOST_MAINNET],
    CHAIN_ID_ETH,
    emitterAddress,
    sequence
  );

  console.log("SIGNEDVAA");
  console.log(signedVAA);

  let maxFailures = 1;

  const postPromise = postVaaWithRetry(
    connection,
    async (transaction: Transaction) => {
      console.log("Signing transaction");
      transaction.partialSign(solKeyPair);
      console.log("Signed  transaction");
      return transaction;
    },
    SOLANA_CORE_BRIDGE_MAINNET,
    solKeyPair.publicKey.toString(),
    Buffer.from(signedVAA),
    maxFailures
  );

  const signature = await postPromise;

  console.log("signature");
  console.log(signature);

  // redeem tokens on solana
  console.log("awaited post promise");
  const transaction = await redeemOnSolana(
    connection,
    SOLANA_CORE_BRIDGE_MAINNET,
    SOLANA_TOKEN_BRIDGE_MAINNET,
    solKeyPair.publicKey.toString(),
    signedVAA
  );
  // sign, send, and confirm transaction
  console.log(" redeemed on solana tx");
  transaction.partialSign(solKeyPair);
  console.log("partially signed redeem tx");

  const txid = await connection.sendRawTransaction(transaction.serialize());
  console.log("sent raw tx");

  await connection.confirmTransaction(txid);
  console.log("confirmed");

  const confirmed = await getIsTransferCompletedSolana(
    SOLANA_TOKEN_BRIDGE_MAINNET,
    signedVAA,
    connection
  );

  console.log("CONFIRMED:", confirmed);
};

export const sendFromSolanaToEthereum = async (connection: Connection) => {
  const provider = new ethers.providers.WebSocketProvider(ETH_NODE_URL_MAINNET);
  const signer = new ethers.Wallet(ETH_PRIVATE_KEY, provider);
  const targetAddress = await signer.getAddress();
  console.log("target address", targetAddress);

  const solKeypair = Keypair.fromSecretKey(bs58.decode(SOL_PRIVATE_KEY));
  const payerAddress = solKeypair.publicKey.toString();
  console.log("sol signers", payerAddress);

  const fromAddress = (
    await getAssociatedTokenAddress(
      // new PublicKey(ONE_INCH_SOLANA_MAINNET),
      new PublicKey(WETH_SOLANA_MAINNET),
      solKeypair.publicKey
    )
  ).toString();

  console.log("from address on Solana", fromAddress);

  const tokenFilter: TokenAccountsFilter = {
    programId: TOKEN_PROGRAM_ID,
  };

  let results = await connection.getParsedTokenAccountsByOwner(
    solKeypair.publicKey,
    tokenFilter
  );

  console.log("owners accounts", results);

  let initialSolanaBalance: number = 0;
  for (const item of results.value) {
    const tokenInfo = item.account.data.parsed.info;
    const amount = tokenInfo.tokenAmount.uiAmount;
    if (tokenInfo.mint === WETH_SOLANA_MAINNET) {
      // if (tokenInfo.mint === ONE_INCH_SOLANA_MAINNET) {
      initialSolanaBalance = amount;
    }
  }
  console.log("token amount", initialSolanaBalance);

  // Get the initial wallet balance on Eth
  const originAssetHex = tryNativeToHexString(
    // ONE_INCH_SOLANA_MAINNET,
    WETH_SOLANA_MAINNET,
    CHAIN_ID_SOLANA
  );
  console.log(" original assetHex", originAssetHex);

  if (!originAssetHex) {
    throw new Error("originAssetHex is null");
  }

  const foreignAsset = await getForeignAssetEth(
    ETH_TOKEN_BRIDGE_MAINNET,
    provider,
    CHAIN_ID_SOLANA,
    hexToUint8Array(originAssetHex)
  );

  if (!foreignAsset) {
    throw new Error("foreignAsset is null");
  }
  console.log("foreign ethereum asset", foreignAsset);

  const amount = parseUnits("0.00001", 8).toBigInt();

  console.log("Amount to send", amount.toString());

  const transaction = await transferFromSolana(
    connection,
    SOLANA_CORE_BRIDGE_MAINNET,
    SOLANA_TOKEN_BRIDGE_MAINNET,
    payerAddress,
    fromAddress,
    // ONE_INCH_SOLANA_MAINNET,
    WETH_SOLANA_MAINNET,
    amount,
    tryNativeToUint8Array(targetAddress, CHAIN_ID_ETH),
    CHAIN_ID_ETH
  );

  console.log("assembled  transaction", transaction);

  transaction.partialSign(solKeypair);
  console.log("partially signed transaction");

  const txid = await connection.sendRawTransaction(transaction.serialize());
  console.log("sent transaction, txid:", txid);

  await connection.confirmTransaction(txid);
  console.log("confirmed transaction");

  const info = await connection.getTransaction(txid);
  if (!info) {
    throw new Error("An error occurred while fetching the transaction info");
  }

  const sequence = parseSequenceFromLogSolana(info);
  console.log(" sequence", sequence);

  const emitterAddress = await getEmitterAddressSolana(
    SOLANA_TOKEN_BRIDGE_MAINNET
  );
  console.log("emitter address", emitterAddress);

  const { vaaBytes: signedVAA } = await getSignedVAAWithRetry(
    [WORMHOLE_RPC_HOST_MAINNET],
    CHAIN_ID_SOLANA,
    emitterAddress,
    sequence
  );
  console.log("signed VAA", signedVAA);
};
