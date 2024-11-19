const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LiquigenFactory", function () {
  let LiquigenFactory, LiquigenPair, MetadataLibrary, dexFactory, owner, admin, user, dexPairContract;

  const wallets = [
    '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
    '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
    '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955'
  ]

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
            dexPairContract.target
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

  it("should emit NeedsMetadata event", async function () {
    try {
      const tx = await LiquigenFactory.generateMetadata(
        3, 
        wallets[0], 
        wallets[1], 
        2
      )

      const receipt = await tx.wait();

      // Use the contract's interface to parse logs
      const eventLogs = receipt.logs.map(log => {
          try {
              return LiquigenFactory.interface.parseLog(log);
          } catch (error) {
              return null;
          }
      }).filter(event => event !== null);

      // Check if the NeedsMetadata event exists
      const event = eventLogs.find(e => e.name === "NeedsMetadata");
      expect(event).to.exist;

      const tokenId = event.args.tokenId;
      expect(tokenId).to.equal(3);
      
      const owner = event.args.owner;
      expect(owner).to.equal(wallets[0]);

      const collection = event.logs.collection;
      expect(collection).to.equal(wallets[1]);

      const rarityModifier = event.logs.rarityModifier;
      expect(rarityModifier).to.equal(2);

      console.log("NeedsMetadata event emitted as expected");
    } catch (error) {
      console.log("Error calling generateMetadata:", error);
      throw error;
    }
  });

  it("should set imageUrl", async function () {
    try {
      const tx = await LiquigenFactory.updateImageUrl(
        'Test imageUrl'
      )

      const imageUrl = await LiquigenFactory.imageUrl;
      expect(imageUrl).to.equal('Test imageUrl');

      console.log(`imageUrl sucessfully updated to ${imageUrl}`);
    } catch (error) {
      console.log("Error calling updateImageUrl:", error);
      throw error;
    }
  });

  it("should set exempt address", async function () {
    try {
      let isAdmin = await LiquigenFactory.admin[wallets[0]];
      expect(isAdmin).to.equal(false);

      await LiquigenFactory.setAdminPrivileges(
        wallets[0],
        true
      )

      isAdmin = await LiquigenFactory.admin[wallets[0]];
      expect(isAdmin).to.equal(true);

      await LiquigenFactory.setAdminPrivileges(
        wallets[0],
        false
      )

      isAdmin = await LiquigenFactory.admin[wallets[0]];
      expect(isAdmin).to.equal(false);

      console.log(`admin state updated as expected`);
    } catch (error) {
      console.log("Error calling setAdminPrivileges:", error);
      throw error;
    }
  });
});
