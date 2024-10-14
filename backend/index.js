import express from "express";
import { ethers } from "ethers";
import { config } from "dotenv";
import kimFactoryABI from "../smart-contracts/artifacts/contracts/LPNFTFactory.sol/KimLPNFTFactory.json" with { type: "json" };
import kimPairABI from "../smart-contracts/artifacts/contracts/LPNFTPair.sol/KimLPNFTPair.json" with { type: "json" };

// Load .env file
config({
  path: "../smart-contracts/.env",
});

// Epress server setup
const app = express();
const port = 8080;

app.get("/", (req, res) => {
  res.send("Im alive!");
});

// Ethers.js setup to listen for Kim events
const provider = new ethers.JsonRpcProvider();

const kimFactoryContract = new ethers.Contract(
  process.env.LPNFTFACTORY_CONTRACT_ADDRESS,
  kimFactoryABI.abi,
  provider,
);

// ~~~~~~ Kim Factory Event Listeners ~~~~~~
// Listen for Create Pair event
kimFactoryContract.on("PairCreated", async (t0, t1, pair, lp404, len) => {
  console.log("Pair Created: ");
  console.log("Token 0: ", t0);
  console.log("Token 1: ", t1);
  console.log("Pair: ", pair);
  console.log("LP404: ", lp404);
  console.log("Len: ", len);
  const kimPairContract = new ethers.Contract(pair, kimPairABI.abi, provider);
  // ~~~~~~ Kim Pair Event Listeners ~~~~~~
  // Listen for Mint event
  kimPairContract.on("Mint", async (res) => {
    console.log("Mint: ", res);
  });

  // Listen for Burn event
  kimPairContract.on("Burn", async (res) => {
    console.log("Burn: ", res);
  });

  // Listen for Swap event
  kimPairContract.on("Swap", async (res) => {
    console.log("Swap: ", res);
  });
});

// ~~~~~~ Start the server ~~~~~~
app.listen(port, async () => {
  console.log(`Server is running on port ${port}`);
  console.log(await provider.getBlockNumber());
});
