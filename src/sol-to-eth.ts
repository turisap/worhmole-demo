// @ts-ignore
import bs58 from "bs58";
import {
  CHAIN_ID_ETH,
  CHAIN_ID_SOLANA,
  getEmitterAddressSolana,
  getIsTransferCompletedEth,
  getSignedVAAWithRetry,
  parseSequenceFromLogSolana,
  redeemOnEth,
  transferFromSolana,
} from "@certusone/wormhole-sdk";
import { Connection, Keypair } from "@solana/web3.js";
import {
  SOL_PRIVATE_KEY,
  SOLANA_CORE_BRIDGE_MAINNET,
  SOLANA_TOKEN_BRIDGE_MAINNET,
  WETH_SOLANA_MAINNET,
  ETH_NODE_URL_MAINNET,
  ETH_PRIVATE_KEY,
  WORMHOLE_RPC_HOST_MAINNET,
  ETH_TOKEN_BRIDGE_MAINNET,
} from "./constants";
import { parseUnits } from "@ethersproject/units";
import { ethers, utils } from "ethers";

export const sendFromSolanaToEthereum = async (connection: Connection) => {
  const provider = new ethers.providers.WebSocketProvider(ETH_NODE_URL_MAINNET);
  const signer = new ethers.Wallet(ETH_PRIVATE_KEY, provider);
  const solKeypair = Keypair.fromSecretKey(bs58.decode(SOL_PRIVATE_KEY));
  const payerAddress = solKeypair.publicKey.toString();
  const fromAddress = "3AXNJsQ6FPwubsQcCdQPnyHGCbScMu7SpADZfZtKnpii";
  const amount = parseUnits("0.01", 8).toBigInt();
  const targetAddress =
    "0x000000000000000000000000fb0d21ab93d1c18d10322d64fc27c9632cde3b06";
  const originAddress =
    "0x000000000000000000000000C02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

  const transferingRequest = transferFromSolana(
    connection,
    SOLANA_CORE_BRIDGE_MAINNET,
    SOLANA_TOKEN_BRIDGE_MAINNET,
    payerAddress, // wallet address
    fromAddress, // token account
    WETH_SOLANA_MAINNET, // mint
    amount,
    utils.arrayify(targetAddress),
    CHAIN_ID_ETH,
    utils.arrayify(originAddress),
    CHAIN_ID_ETH
    // undefined,
    // feeParsed.toBigInt()
  );

  const sendTransaction = await transferingRequest;
  console.log("Prepared send tx:", sendTransaction);

  sendTransaction.partialSign(solKeypair);
  console.log("partially signed transaction");

  const txid = await connection.sendRawTransaction(sendTransaction.serialize());
  console.log("Transaction sent", txid);

  const confirmation = await connection.confirmTransaction(txid);
  console.log("transaction confirmed", confirmation);

  const info = await connection.getTransaction(txid);
  console.log("info", info);
  if (!info) {
    throw new Error("An error occurred while fetching the transaction info");
  }

  const sequence = parseSequenceFromLogSolana(info);
  console.log("sequence", sequence);

  const emitterAddress = await getEmitterAddressSolana(
    SOLANA_TOKEN_BRIDGE_MAINNET
  );
  console.log("emmitter address", emitterAddress);

  const vaa = await getSignedVAAWithRetry(
    [WORMHOLE_RPC_HOST_MAINNET],
    CHAIN_ID_SOLANA,
    emitterAddress,
    sequence
  );

  console.log("VAA", vaa);

  const completedOnEth = await getIsTransferCompletedEth(
    ETH_TOKEN_BRIDGE_MAINNET,
    provider,
    vaa.vaaBytes
  );

  console.log("Completed on ETH before redeem", completedOnEth);

  const redeemed = await redeemOnEth(
    ETH_TOKEN_BRIDGE_MAINNET,
    signer,
    vaa.vaaBytes
  );

  console.log("Redeemed:", redeemed);

  const redeemedAfterRedeem = await getIsTransferCompletedEth(
    ETH_TOKEN_BRIDGE_MAINNET,
    provider,
    vaa.vaaBytes
  );

  console.log("Redeemed after redeem", redeemedAfterRedeem);
};
