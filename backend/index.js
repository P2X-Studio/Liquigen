import express from "express";
import { ethers } from "ethers";
import { config } from "dotenv";
import kimFactoryABI from "../smart-contracts/artifacts/contracts/LPNFTFactory.sol/KimLPNFTFactory.json" with { type: "json" };

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

// ~~~~~~ Kim Factory Event Listeners ~~~~~~
const kimFactoryContract = new ethers.Contract(
  process.env.LPNFTFACTORY_CONTRACT_ADDRESS,
  kimFactoryABI.abi,
  provider,
);

// Listen for Create Pair event
kimFactoryContract.on("PairCreated", async (res) => {
  console.log("Pair Created: ", res);
});

// ~~~~~~ Start the server ~~~~~~
app.listen(port, async () => {
  console.log(`Server is running on port ${port}`);
  console.log(await provider.getBlockNumber());
});
