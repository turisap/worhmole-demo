// @TODO tooling: CRA does not allow to import outside of src and cannot link from other repos (as well as trynspile with babel)
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { ethers } from "ethers";
import { Base64 } from "js-base64";
import {
  ETH_CORE_BRIDGE_TESTNENT,
  ETH_NODE_URL_TESTNET,
  WETH_TESTNET,
  ETH_TOKEN_BRIDGE_TESTNET,
  SOLANA_CORE_BRIDGE_DEVNET,
  SOLANA_TOKEN_BRIDGE_DEVNET,
  WORMHOLE_RPC_HOST_TESTNET,
  ETH_PRIVATE_KEY,

  // ETH_CORE_BRIDGE_MAINNET,
  // ETH_NODE_URL_MAINNET,
  // ETH_PRIVATE_KEY,
  // ETH_TOKEN_BRIDGE_MAINNET,
  // SOLANA_CORE_BRIDGE_MAINNET,
  // SOLANA_TOKEN_BRIDGE_MAINNET,
  // WETH_MAINNET,
  // WORMHOLE_RPC_HOST_MAINNET,
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
  const provider = new ethers.providers.WebSocketProvider(ETH_NODE_URL_TESTNET);

  const ethSigner = new ethers.Wallet(ETH_PRIVATE_KEY, provider);

  console.log(ethSigner.publicKey);

  const originalAsset = await getOriginalAssetEth(
    ETH_TOKEN_BRIDGE_TESTNET,
    provider,
    WETH_TESTNET,
    CHAIN_ID_ETH
  );

  console.log("original asset");
  console.log(originalAsset);

  let solanaMint = await getForeignAssetSolana(
    connection,
    SOLANA_TOKEN_BRIDGE_DEVNET,
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
  const amount = parseEther("0.0001");
  console.log("Amount to send", amount);
  // approve the bridge to spend tokens
  await approveEth(ETH_TOKEN_BRIDGE_TESTNET, WETH_TESTNET, ethSigner, amount);
  // // transfer tokens
  console.log("approved");
  const receipt = await transferFromEthNative(
    // const receipt = await transferFromEth(
    ETH_TOKEN_BRIDGE_TESTNET,
    ethSigner,
    // WETH_MAINNET,
    amount,
    CHAIN_ID_SOLANA,
    tryNativeToUint8Array(recipient.toString(), CHAIN_ID_SOLANA) // recipient will be our smart-contract, as in the smaple tx
  );

  console.log("RECEIPT", receipt);

  const sequence = parseSequenceFromLogEth(receipt, ETH_CORE_BRIDGE_TESTNENT);

  console.log(" sequence", sequence);

  return sequence;
};

export const finilizeTransfer = async (
  sequence: string,
  connection: Connection,
  solKeyPair: Keypair
) => {
  console.log("trying get VAA");
  const emitterAddress = getEmitterAddressEth(ETH_TOKEN_BRIDGE_TESTNET);

  console.log("emitter address", emitterAddress);
  console.log("sequence", sequence);

  const { vaaBytes: signedVAA } = await getSignedVAAWithRetry(
    [WORMHOLE_RPC_HOST_TESTNET],
    CHAIN_ID_ETH,
    emitterAddress,
    sequence
  );

  console.log("SIGNEDVAA");
  console.log(signedVAA);

  let maxFailures = 1;

  console.log("VAA bs64", Base64.fromUint8Array(signedVAA));

  const postPromise = postVaaWithRetry(
    connection,
    async (transaction: Transaction) => {
      console.log("Signing transaction");
      transaction.partialSign(solKeyPair);
      console.log("Signed  transaction");
      return transaction;
    },
    SOLANA_CORE_BRIDGE_DEVNET,
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
    SOLANA_CORE_BRIDGE_DEVNET,
    SOLANA_TOKEN_BRIDGE_DEVNET,
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
    SOLANA_TOKEN_BRIDGE_DEVNET,
    signedVAA,
    connection
  );

  console.log("CONFIRMED:", confirmed);
};
