const { ethers } = require("hardhat");
const fs = require("fs");
const { getAddress } = require("ethers");

require("dotenv").config();

// Load the ABI from the JSON file
const kimLPNFTFactoryArtifact = JSON.parse(
  fs.readFileSync(
    "./artifacts/contracts/LPNFTFactory.sol/KimLPNFTFactory.json",
    "utf8"
  )
);

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using deployer account:", deployer.address);

  const lpNFTFactoryAddress = process.env.LPNFTFACTORY_CONTRACT_ADDRESS;

  const kimLPNFTFactory = new ethers.Contract(
    lpNFTFactoryAddress,
    kimLPNFTFactoryArtifact.abi,
    deployer
  );

  // Define your function arguments
  const name = "Test Collection";
  const symbol = "TC";
  const traitCID = "ThisIsACID"; // IPFS CID
  const description = "This is a description";
  const decimals = 18;

  try {
    console.log("Creating tokens...");
    const tokenAFactory = await hre.ethers.getContractFactory("TSTToken");
    const tokenA = await tokenAFactory.deploy(1000000n * 10n ** 18n);

    const tokenBFactory = await hre.ethers.getContractFactory("TSTToken");
    const tokenB = await tokenBFactory.deploy(1000000n * 10n ** 18n);
    console.log("Tokens created");
    console.log("Token A:", await tokenA.getAddress());
    console.log("Token B:", await tokenB.getAddress());

    console.log("Calling createPair...");
    const tx = await kimLPNFTFactory.createPair(
      tokenA.getAddress(),
      tokenB.getAddress(),
      name,
      symbol,
      traitCID,
      description,
      ethers.getUint(decimals)
    );
    console.log("Transaction hash:", tx.hash);

    const receipt = await tx.wait();
    console.log("Transaction was mined in block", receipt.blockNumber);

    console.log("Receipt events:", receipt);

    const pairCreatedEvent = receipt.events.find(
      (event) => event.event === "PairCreated"
    );

    if (pairCreatedEvent) {
      const pairAddress = pairCreatedEvent.args.pair;
      const lp404Address = pairCreatedEvent.args.lp404;
      console.log("New pair address:", pairAddress);
      console.log("New LP404 address:", lp404Address);
    } else {
      console.log("PairCreated event not found in transaction receipt.");
    }
  } catch (error) {
    console.error("Error in createPair:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
