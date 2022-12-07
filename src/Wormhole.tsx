import React, { FC } from "react";
import {
  attestFromEth,
  getEmitterAddressEth,
  getSignedVAA,
  parseSequenceFromLogEth,
} from "@certusone/wormhole-sdk";
import {
  ETH_BRIDGE_ADDRESS,
  ETH_NODE_URL,
  ETH_PRIVATE_KEY,
  ETH_TOKEN_BRIDGE_ADDRESS,
  TEST_ERC20,
  WORMHOLE_RPC_HOST,
} from "./constants";
import { ethers } from "ethers";

export const Wormhole: FC = () => {
  const onClick = async () => {
    const provider = new ethers.providers.WebSocketProvider(ETH_NODE_URL);
    const signer = new ethers.Wallet(ETH_PRIVATE_KEY, provider);
    const receipt = await attestFromEth(
      ETH_TOKEN_BRIDGE_ADDRESS,
      signer,
      TEST_ERC20
    );

    console.log(receipt);

    // Get the sequence number and emitter address required to fetch the signedVAA of our message
    const sequence = parseSequenceFromLogEth(receipt, ETH_BRIDGE_ADDRESS);
    const emitterAddress = getEmitterAddressEth(ETH_TOKEN_BRIDGE_ADDRESS);
    console.log(sequence, emitterAddress);

    // Fetch the signedVAA from the Wormhole Network (this may require retries while you wait for confirmation)
    // const signedResp = await getSignedVAA(
    //   WORMHOLE_RPC_HOST,
    //   2,
    //   emitterAddress,
    //   sequence
    // );
    //
    // console.log(signedResp);
  };

  return (
    <>
      <p>Wormhole</p>
      <button onClick={onClick}>SEND</button>
    </>
  );
};

export default Wormhole;
