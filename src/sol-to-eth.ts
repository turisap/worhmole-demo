// @ts-ignore
import bs58 from "bs58";
import {
  ETH_NODE_URL_MAINNET,
  ETH_PRIVATE_KEY,
  ETH_TOKEN_BRIDGE_MAINNET,
  ONE_INCH_SOLANA_MAINNET,
  SOL_PRIVATE_KEY,
  SOLANA_CORE_BRIDGE_MAINNET,
  SOLANA_TOKEN_BRIDGE_MAINNET,
  WETH_SOLANA_MAINNET,
  WORMHOLE_RPC_HOST_MAINNET,
} from "./constants";
import {
  CHAIN_ID_ETH,
  CHAIN_ID_SOLANA,
  getEmitterAddressSolana,
  getForeignAssetEth,
  getSignedVAAWithRetry,
  hexToUint8Array,
  parseSequenceFromLogSolana,
  transferFromSolana,
  tryNativeToHexString,
  tryNativeToUint8Array,
  attestFromSolana,
} from "@certusone/wormhole-sdk";
import {
  Connection,
  Keypair,
  PublicKey,
  TokenAccountsFilter,
} from "@solana/web3.js";
import { ethers } from "ethers";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { parseUnits } from "@ethersproject/units";

export const sendFromSolanaToEthereum = async (connection: Connection) => {
  const provider = new ethers.providers.WebSocketProvider(ETH_NODE_URL_MAINNET);
  const signer = new ethers.Wallet(ETH_PRIVATE_KEY, provider);
  const targetAddress = await signer.getAddress();
  console.log("target address", targetAddress);

  const solKeypair = Keypair.fromSecretKey(bs58.decode(SOL_PRIVATE_KEY));
  const payerAddress = solKeypair.publicKey.toString();
  console.log("sol signer", payerAddress);

  // @TODO is not present in the bridge because you chose native sol
  const attestOnSolTx = await attestFromSolana(
    connection,
    SOLANA_CORE_BRIDGE_MAINNET,
    SOLANA_TOKEN_BRIDGE_MAINNET,
    payerAddress,
    ONE_INCH_SOLANA_MAINNET
  );

  console.log("assembled attesting tx");

  attestOnSolTx.partialSign(solKeypair);
  console.log("partially signed attesting tx");

  const attestTxId = await connection.sendRawTransaction(
    attestOnSolTx.serialize()
  );
  console.log("attest tx sent");

  await connection.confirmTransaction(attestTxId);
  console.log("attest tx confirmed");

  const attestTxInfo = await connection.getTransaction(attestTxId);
  if (!attestTxInfo) {
    throw new Error("An error occurred while fetching the transaction info");
  }

  return;

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
