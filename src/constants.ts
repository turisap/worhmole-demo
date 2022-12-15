// tokens ethereum
export const WETH_TESTNET = "0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6";
export const WETH_MAINNET = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
export const USDT_MAINNET = "0xdac17f958d2ee523a2206206994597c13d831ec7"; // found
export const ONE_INCH_MAINNET = "0x111111111117dC0aa78b770fA6A738034120C302";
export const WBTC_MAINNET = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"; // found
export const DAI_MAINNET = "0x6B175474E89094C44Da98b954EedeAC495271d0F"; // found

// tokens solana
export const WETH_SOLANA_MAINNET =
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs";
export const ONE_INCH_SOLANA_MAINNET =
  "AjkPkq3nsyDe1yKcbyZT7N4aK4Evv9om9tzhQD3wsRC";

// wormhole contracts mainnet
export const SOLANA_TOKEN_BRIDGE_MAINNET =
  "wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb";
export const SOLANA_CORE_BRIDGE_MAINNET =
  "worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth";
export const ETH_TOKEN_BRIDGE_MAINNET =
  "0x3ee18B2214AFF97000D974cf647E7C347E8fa585";
export const ETH_CORE_BRIDGE_MAINNET =
  "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B";

// wormhole contracts testnet
export const SOLANA_TOKEN_BRIDGE_DEVNET =
  "DZnkkTmCiFWfYTfT41X3Rd1kDgozqzxWaHqsw6W4x2oe";
export const SOLANA_CORE_BRIDGE_DEVNET =
  "Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o";
export const ETH_TOKEN_BRIDGE_TESTNET =
  "0xF890982f9310df57d00f659cf4fd87e65adEd8d7";
export const ETH_CORE_BRIDGE_TESTNENT =
  "0x706abc4E45D419950511e474C7B9Ed348A4a716c";

// keys mainnet
export const ETH_PRIVATE_KEY = process.env
  .REACT_APP_ETHEREUM_PRIVATE_KEY as string;
export const SOL_PRIVATE_KEY = process.env
  .REACT_APP_SOLANA_PRIVATE_KEY as string;

// rpc endpoints
export const WORMHOLE_RPC_HOST_MAINNET = "https://wormhole.inotel.ro";
export const WORMHOLE_RPC_HOST_TESTNET =
  "https://wormhole-v2-testnet-api.certus.one";
export const ETH_NODE_URL_MAINNET =
  "wss://chaotic-hidden-shape.discover.quiknode.pro/5425bf89f1b0d6b649a3a08e6c1d422c07a875be/";
export const ETH_NODE_URL_TESTNET =
  "wss://bold-spring-shape.ethereum-goerli.discover.quiknode.pro/552834c379cccc468688e95496b9f3565ba1954d/";
// export const SOLANA_NODE_URL_MAINNET = "https://api.mainnet-beta.solana.com";
// export const SOLANA_NODE_URL_MAINNET =
//   "https://mercuria-fronten-1cd8.mainnet.rpcpool.com/";
export const SOLANA_NODE_URL_MAINNET =
  "https://p2p.rpcpool.com/82313b15169cb10f3ff230febb8d";
// export const SOLANA_NODE_URL_MAINNET =
//   "https://icy-fabled-emerald.solana-mainnet.discover.quiknode.pro/69b58eb106bd2c95ac3f4ec535a9e0f2b6cb3251/";
