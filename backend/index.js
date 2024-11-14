import express from "express";
import { ethers } from "ethers";
import { config } from "dotenv";
import kimFactoryABI from "../smart-contracts/artifacts/contracts/LPNFTFactory.sol/KimLPNFTFactory.json" with { type: "json" };
// TODO: Import the LiquigenPair contract ABI here

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

// TODO: Create a new instance of the LiquigenPair contract
const liquigenFactoryContract = new ethers.Contract(
  process.env.LPNFTFACTORY_CONTRACT_ADDRESS,
  kimFactoryABI.abi,
  provider,
);

// Create a new instance of the Kim Factory
const kimFactoryContract = new ethers.Contract(
  process.env.LPNFTFACTORY_CONTRACT_ADDRESS,
  kimFactoryABI.abi,
  provider,
);

// ~~~~~~ Kim Factory Event Listeners ~~~~~~
// Listen for Create Pair event
kimFactoryContract.on("PairCreated", async (t0, t1, pair, lp404, len) => {
  console.log("PairCreated: ", t0, t1, pair, lp404, len);
  // TODO: Create a new LiquigenPair contract
  // const liquigenPairData = await liquigenFactoryContract.createPair(
  //   name,
  //   symbol,
  //   traitCID,
  //   description,
  //   owner,
  // );

  console.log("LiquigenPairData: ", pair);
  // ~~~~~~ Kim Pair Event Listeners ~~~~~~
  // Listen for Mint event
  lp404PairContract.on("Mint", async (res) => {});

  // Listen for Burn event
  lp404PairContract.on("Burn", async (res) => {
    console.log("Burn: ", res);
  });

  // Listen for Swap event
  lp404PairContract.on("Swap", async (res) => {
    console.log("Swap: ", res);
  });
});

// ~~~~~~ Start the server ~~~~~~
app.listen(port, async () => {
  console.log(`Server is running on port ${port}`);
  console.log(await provider.getBlockNumber());
});
