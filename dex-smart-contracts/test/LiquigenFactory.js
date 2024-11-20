const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LiquigenFactory", function () {
  let MetadataLibrary, LiquigenFactory, dexPairContract;
  let owner, admin, user;

  const addresses = [
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

    await LiquigenFactory.setAdminPrivileges(
      admin,
      true
    )
  });

  it("should create a new LiquigenPair", async function () {
    try {
        const tx = await LiquigenFactory.createPair(
            "Test Pair",
            "TPAIR",
            "ipfs://traitsCID",
            "A test pair",
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
        // console.log(event);
        expect(event).to.exist;

        const pairAddress = event.args.liquigenPair;
        expect(pairAddress).to.not.equal(ethers.ZeroAddress);
        
        console.log("LiquigenPair successfully created at:", pairAddress);
    } catch (error) {
        console.error("Error creating pair:", error);
        throw error;
    }
  });

  it("should set imageUrl to 'Test imageUrl'", async function () {
    try {
      await LiquigenFactory.setImageUrl(
        'Test imageUrl'
      )

      const imageUrl = await LiquigenFactory.imageUrl();
      expect(imageUrl).to.equal('Test imageUrl');

      console.log(`imageUrl sucessfully updated to '${imageUrl}'`);
    } catch (error) {
      console.log("Error calling updateImageUrl:", error);
      throw error;
    }
  });

  it("should add and remove exempt addresses", async function () {
    try {
      // Verify adding to exempt
      await LiquigenFactory.setExempt(
        addresses[0],
        true
      );
      expect(await LiquigenFactory.exempt(addresses[0])).to.equal(true);

      // Verify removing from exempt
      await LiquigenFactory.setExempt(
        addresses[0],
        false
      );
      expect(await LiquigenFactory.exempt(addresses[0])).to.equal(false);

      console.log(`exempt addresses added and removed as expected`);
    } catch (error) {
      console.log("Error calling updateExempt:", error);
      throw error;
    }
  });

  it("should add and remove admin addresses", async function () {
    try {
      // Verify addresses are not admin by default
      expect(await LiquigenFactory.admin(user.address)).to.equal(false);

      // Verify adding to admin
      await LiquigenFactory.setAdminPrivileges(
        user.address,
        true
      );
      expect(await LiquigenFactory.admin(user.address)).to.equal(true);

      // Verify removing from admin
      await LiquigenFactory.setAdminPrivileges(
        user.address,
        false
      );
      expect(await LiquigenFactory.admin(user.address)).to.equal(false);

      console.log(`admin addresses added and removed as expected`);
    } catch (error) {
      console.log("Error calling setAdminPrivileges:", error);
      throw error;
    }
  });

  it("should not allow non-admin to set admin priviliges", async function () {
    try {
      // Verify only admins can call this function
      await expect(LiquigenFactory.connect(user).setAdminPrivileges(
        user.address,
        true
      )).to.be.revertedWith("LiquigenFactory: UNAUTHORIZED");

      console.log(`setAdminPrivileges does not allow non-admin to set admin priviliges`);
    } catch (error) {
      console.log("Error calling setAdminPrivileges:", error);
      throw error;
    }
  });

  it("should not allow removing Liquigen wallet as admin", async function () {
    try {
      expect(await LiquigenFactory.admin(admin.address)).to.equal(true);
      
      // Verify admins can't remove Liquigen wallet
      await expect(LiquigenFactory.connect(admin).setAdminPrivileges(
        owner.address,
        false
      )).to.be.revertedWith("Cannot remove super admin privileges");

      console.log(`setAdminPrivileges does not allow removing Liquigen wallet as admin`);
    } catch (error) {
      console.log("Error calling setAdminPrivileges:", error);
      throw error;
    }
  });

  // TODO: setPairAdminPrivileges test

  it("should change liquigenWallet when called from Liquigen wallet", async function () {
    try {
      expect(await LiquigenFactory.liquigenWallet()).to.equal(owner.address);
      
      // Verify updating liquigenWallet
      await LiquigenFactory.setLiquigenWallet(
        admin.address
      );

      expect(await LiquigenFactory.liquigenWallet()).to.equal(admin.address);

      console.log(`setLiquigenWallet updates as expected when called from liquigenWallet`);
    } catch (error) {
      console.log("Error calling setAdminPrivileges:", error);
      throw error;
    }
  });

  it("should not allow change to liquigenWallet when called from another address", async function () {
    try {
      expect(await LiquigenFactory.admin(admin.address)).to.equal(true);
      
      // Verify other addresses can't change liquigenWallet
      await expect(LiquigenFactory.connect(admin).setLiquigenWallet(
        admin.address
      )).to.be.revertedWith("LiquigenFactory: UNAUTHORIZED");

      console.log(`setLiquigenWallet does not allow changing liquigenWallet when called from another address`);
    } catch (error) {
      console.log("Error calling setAdminPrivileges:", error);
      throw error;
    }
  });
});
