// @ts-ignore
import bs58 from "bs58";
import {
  CHAIN_ID_ETH,
  CHAIN_ID_SOLANA,
  getEmitterAddressSolana,
  getIsTransferCompletedEth,
  getSignedVAAWithRetry,
  parseSequenceFromLogSolana,
  redeemOnEthNative,
  transferFromSolana,
} from "@certusone/wormhole-sdk";
import { Connection, Keypair } from "@solana/web3.js";
import {
  ETH_NODE_URL_MAINNET,
  ETH_PRIVATE_KEY,
  ETH_TOKEN_BRIDGE_MAINNET,
  SOL_PRIVATE_KEY,
  SOLANA_CORE_BRIDGE_MAINNET,
  SOLANA_TOKEN_BRIDGE_MAINNET,
  WETH_SOLANA_MAINNET,
  WORMHOLE_RPC_HOST_MAINNET,
} from "./constants";
import { parseUnits } from "@ethersproject/units";
import { ethers, utils } from "ethers";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export const sendFromSolanaToEthereum = async (connection: Connection) => {
  const provider = new ethers.providers.WebSocketProvider(ETH_NODE_URL_MAINNET);
  const signer = new ethers.Wallet(ETH_PRIVATE_KEY, provider);
  const solKeypair = Keypair.fromSecretKey(bs58.decode(SOL_PRIVATE_KEY));
  const payerAddress = solKeypair.publicKey.toString();
  const amount = parseUnits("0.0000001", 8).toBigInt();
  const targetAddress = utils.hexZeroPad(await signer.getAddress(), 32);
  const originAddress =
    "0x000000000000000000000000C02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

  const userAccounts = await connection.getParsedTokenAccountsByOwner(
    solKeypair.publicKey,
    {
      programId: TOKEN_PROGRAM_ID,
    }
  );

  const tokenAccount = userAccounts.value.find(
    (account) => account.account.data.parsed.info.mint === WETH_SOLANA_MAINNET
  );

  const fromAddress = tokenAccount?.pubkey.toString();

  if (!fromAddress) {
    throw new Error("Associated token account not found");
  }

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

  // const redeemed = await redeemOnEth(
  //   ETH_TOKEN_BRIDGE_MAINNET,
  //   signer,
  //   vaa.vaaBytes
  // );

  const redeemed = await redeemOnEthNative(
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
