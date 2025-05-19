import { AnchorProvider } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { Connection, Keypair } from "@solana/web3.js";
import { Metaplex } from "@metaplex-foundation/js";

export const connection = new Connection(process.env.HELIUS_RPC_URL || "");
export const httpConnection = new Connection(
  "https://pump-fe.helius-rpc.com/?api-key=1b8db865-a5a1-4535-9aec-01061440523b",
  {
    httpHeaders: {
      origin: "https://pump.fun",
      referer: "https://pump.fun/",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    },
  }
);
export const metaplex = new Metaplex(httpConnection);
export const wallet = new NodeWallet(new Keypair());

export const getProvider = () => {
  if (!process.env.HELIUS_RPC_URL) {
    throw new Error("Please set HELIUS_RPC_URL in .env file");
  }

  return new AnchorProvider(connection, wallet, { commitment: "finalized" });
};
