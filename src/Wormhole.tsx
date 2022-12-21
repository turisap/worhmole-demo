import { FC, useEffect, useState } from "react";
import { SOL_PRIVATE_KEY } from "./constants";
import { useConnection } from "@solana/wallet-adapter-react";
import { Keypair } from "@solana/web3.js";
// @ts-ignore
import bs58 from "bs58";
import { finilizeTransfer, getSequence } from "./eth-to-sol";
import { sendFromSolanaToEthereum } from "./sol-to-eth";

export const Wormhole: FC = () => {
  const { connection } = useConnection();
  const solKeypair = Keypair.fromSecretKey(bs58.decode(SOL_PRIVATE_KEY));

  const onSendToSolana = async () => {
    const sequence = await getSequence(connection, solKeypair);

    void finilizeTransfer(sequence, connection, solKeypair);
  };

  const onSendToEthereum = () => {
    void sendFromSolanaToEthereum(connection);
  };

  return (
    <>
      <p>Wormhole</p>
      <div style={{ display: "grid", gridGap: "10px", width: "250px" }}>
        <button onClick={onSendToSolana} disabled={true}>
          SEND ETH to Solana
        </button>
        <button onClick={onSendToEthereum}>SEND ETH to Ethereum</button>
      </div>
    </>
  );
};

export default Wormhole;
