// @TODO tooling: CRA does not allow to import outside of src and cannot link from other repos (as well as trynspile with babel)
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { ethers } from "ethers";
import {
  ETH_CORE_BRIDGE_MAINNET,
  ETH_NODE_URL_MAINNET,
  ETH_PRIVATE_KEY,
  ETH_TOKEN_BRIDGE_MAINNET,
  WETH_MAINNET,
  SOLANA_CORE_BRIDGE_MAINNET,
  SOLANA_TOKEN_BRIDGE_MAINNET,
  WORMHOLE_RPC_HOST_MAINNET,
} from "./constants";
import {
  approveEth,
  CHAIN_ID_ETH,
  CHAIN_ID_SOLANA,
  getEmitterAddressEth,
  getForeignAssetSolana,
  getIsTransferCompletedSolana,
  getOriginalAssetEth,
  getSignedVAAWithRetry,
  parseSequenceFromLogEth,
  redeemOnSolana,
  transferFromEth,
  tryNativeToUint8Array,
} from "../../wormhole/sdk/js";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { parseEther } from "@ethersproject/units";
import { postVaaWithRetry } from "../../wormhole/sdk/js/lib/cjs/solana/sendAndConfirmPostVaa";
import { transferFromEthNative } from "@certusone/wormhole-sdk";

export const getSequence = async (
  connection: Connection,
  solKeypair: Keypair
) => {
  const provider = new ethers.providers.WebSocketProvider(ETH_NODE_URL_MAINNET);

  const ethSigner = new ethers.Wallet(ETH_PRIVATE_KEY, provider);

  const originalAsset = await getOriginalAssetEth(
    ETH_TOKEN_BRIDGE_MAINNET,
    provider,
    WETH_MAINNET,
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
  const amount = parseEther("0.000001");
  console.log("Amount to send", amount);
  // approve the bridge to spend tokens
  await approveEth(ETH_TOKEN_BRIDGE_MAINNET, WETH_MAINNET, ethSigner, amount);
  // // transfer tokens
  console.log("approved");
  const receipt = await transferFromEthNative(
    // const receipt = await transferFromEth(
    ETH_TOKEN_BRIDGE_MAINNET,
    ethSigner,
    // WETH_MAINNET,
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
