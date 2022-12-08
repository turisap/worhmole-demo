import { FC, useEffect, useState } from "react";
import { SOL_PRIVATE_KEY } from "./constants";
import { useConnection } from "@solana/wallet-adapter-react";
import { Keypair } from "@solana/web3.js";
// @ts-ignore
import bs58 from "bs58";
import { finilizeTransfer, getSequence } from "./utils";

export const Wormhole: FC = () => {
  const [sequence, setSequence] = useState("");
  const { connection } = useConnection();
  const solKeypair = Keypair.fromSecretKey(bs58.decode(SOL_PRIVATE_KEY));

  const onClick = async () => {
    const sequence = await getSequence(connection, solKeypair);

    setSequence(sequence);
  };

  useEffect(() => {
    if (sequence) {
      void finilizeTransfer(sequence, connection, solKeypair);
    }
  }, [sequence]);

  return (
    <>
      <p>Wormhole</p>
      <button onClick={onClick}>SEND</button>
    </>
  );
};

export default Wormhole;
