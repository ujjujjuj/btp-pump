import dotenv from "dotenv";
import { PumpFunSDK, type TradeEvent } from "pumpdotfun-sdk";

import Decimal from "decimal.js";
import { JSONFilePreset } from "lowdb/node";
import { getProvider, metaplex } from "./conn";
import PQueue from "p-queue";
import { PublicKey } from "@metaplex-foundation/js";

dotenv.config();

type Transaction = {
  user: string;
  isBuy: boolean;
  solAmount: number;
  tokenAmount: number;
  priceChangePercent: number;
  oldPrice: string;
  newPrice: string;
  slot: number;
  signature: string;
  realSolReserves: number;
  realTokenReserves: number;
};

type Token = {
  info?: {
    name: string;
    symbol: string;
  };
  address: string;
  txs: Transaction[];
};

type Store = {
  tokens: Token[];
};

const defaultData = { tokens: [] };
const db = await JSONFilePreset<Store>("db.json", defaultData);

// Start auto-save interval
setInterval(async () => {
  await db.write();
  console.log("Auto-saved database");
}, 5000);

const getTokenInfo = async (tokenAddr: string) => {
  try {
    const token = await metaplex.nfts().findByMint({
      mintAddress: new PublicKey(tokenAddr),
    });
    if (!token) {
      throw new Error("Could not fetch token info");
    }

    return {
      name: token.name,
      symbol: token.symbol,
    };
  } catch (error) {
    console.error("Could not fetch token info", error);
    return null;
  }
};

const registerNewToken = async (tokenAddr: string) => {
  const tok = db.data.tokens.find((t) => t.address === tokenAddr);
  if (tok?.info) {
    return;
  }

  const info = await getTokenInfo(tokenAddr);
  if (!info) {
    if (!tok) {
      db.data.tokens.push({
        address: tokenAddr,
        txs: [],
      });
    }
    return;
  }

  console.log(
    `=== UPDATING TOKEN INFO ===\n${info.name} (${info.symbol}) @ (${tokenAddr})`
  );

  const existingToken = db.data.tokens.find((t) => t.address === tokenAddr);
  if (existingToken) {
    existingToken.info = info;
  } else {
    db.data.tokens.push({
      address: tokenAddr,
      info,
      txs: [],
    });
  }
};

const addLog = async (event: TradeEvent, slot: number, signature: string) => {
  await registerNewToken(event.mint.toBase58());

  const prevSol = event.isBuy
    ? event.realSolReserves - event.solAmount
    : event.realSolReserves + event.solAmount;
  const prevToken = event.isBuy
    ? event.realTokenReserves + event.tokenAmount
    : event.realTokenReserves - event.tokenAmount;

  const prevPrice = new Decimal(prevToken.toString()).div(prevSol.toString());
  const newPrice = new Decimal(event.realTokenReserves.toString()).div(
    event.realSolReserves.toString()
  );

  const priceChangePercent = newPrice
    .div(prevPrice)
    .minus(1)
    .mul(100)
    .toNumber();

  const token = db.data.tokens.find((t) => t.address === event.mint.toBase58());
  if (token) {
    token.txs.push({
      user: event.user.toBase58(),
      isBuy: event.isBuy,
      solAmount: Number(event.solAmount),
      tokenAmount: Number(event.tokenAmount),
      oldPrice: prevPrice.toString(),
      newPrice: newPrice.toString(),
      priceChangePercent: priceChangePercent,
      slot,
      signature,
      realSolReserves: Number(event.realSolReserves),
      realTokenReserves: Number(event.realTokenReserves),
    });
  }

  console.log(
    `==== TRADE EVENT ====\nToken ${
      token?.info ? `${token.info.name} (${token.info.symbol})` : ``
    } (${event.mint.toBase58()})\n${prevPrice} -> ${newPrice} (${priceChangePercent}%)`
  );
};

const setupEventListeners = async (sdk: PumpFunSDK) => {
  const createEventId = sdk.addEventListener("createEvent", async (event) => {
    const tokenMint = event.mint.toBase58();
    await registerNewToken(tokenMint);
    console.log(`=== NEW TOKEN ===\n${tokenMint}`);
  });
  console.log("Subscribed to createEvent with ID:", createEventId);

  const tradeEventId = sdk.addEventListener(
    "tradeEvent",
    async (event, slot, signature) => {
      await addLog(event, slot, signature);
    }
  );
  console.log("Subscribed to tradeEvent with ID:", tradeEventId);

  const completeEventId = sdk.addEventListener(
    "completeEvent",
    (event, slot, signature) => {
      console.log("completeEvent", event, slot, signature);
    }
  );
  console.log("Subscribed to completeEvent with ID:", completeEventId);
};

const main = async () => {
  try {
    const provider = getProvider();
    const sdk = new PumpFunSDK(provider);
    await setupEventListeners(sdk);
  } catch (error) {
    console.error("An error occurred:", error);
  }
};

main();
