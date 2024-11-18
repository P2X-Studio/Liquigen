const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LiquigenFactory", function () {
  let LiquigenFactory, LiquigenPair, MetadataLibrary, dexFactory, owner, admin, user, dexPairContract;

  beforeEach(async function () {
    [owner, admin, user] = await ethers.getSigners();

    // Step 1: Deploy the MetadataLibrary
    MetadataLibrary = await ethers.deployContract("MetadataLibrary");
    await MetadataLibrary.waitForDeployment();

    // Step 2: Deploy the LiquigenFactory contract
    LiquigenFactory = await ethers.deployContract("LiquigenFactory", {
      libraries: {
        MetadataLibrary: MetadataLibrary.target,
      },
    });
    await LiquigenFactory.waitForDeployment();

    // Step 3: Deploy a UniswapV2ERC20 contract
    dexPairContract = await ethers.deployContract("UniswapV2ERC20");
    await dexPairContract.waitForDeployment();
  });

  it("should create a new LiquigenPair", async function () {
    try {
        const tx = await LiquigenFactory.createPair(
            "Test Pair",
            "TPAIR",
            "ipfs://traitsCID",
            "A test pair",
            owner.address,
            dexPairContract.target,
            10 // mint threshold, TODO: figure out best way to calculate this
        );

        const receipt = await tx.wait();

        // Use the contract's interface to parse logs
        const eventLogs = receipt.logs.map(log => {
            try {
                return LiquigenFactory.interface.parseLog(log);
            } catch (error) {
                return null;
            }
        }).filter(event => event !== null);

        // Check if the PairCreated event exists
        const event = eventLogs.find(e => e.name === "PairCreated");
        expect(event).to.exist;

        const pairAddress = event.args.liquigenPair;
        expect(pairAddress).to.not.equal(ethers.ZeroAddress);
        console.log("LiquigenPair successfully created at:", pairAddress);
    } catch (error) {
        console.error("Error creating pair:", error);
        throw error;
    }
  });
});
