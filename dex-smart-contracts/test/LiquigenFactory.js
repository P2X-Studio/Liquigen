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

    // Deploy the MetadataLibrary
    MetadataLibrary = await ethers.deployContract("MetadataLibrary");
    await MetadataLibrary.waitForDeployment();

    // Deploy the LiquigenFactory contract
    LiquigenFactory = await ethers.deployContract("LiquigenFactory", {
      libraries: {
        MetadataLibrary: MetadataLibrary.target,
      },
    });
    await LiquigenFactory.waitForDeployment();

    // Deploy a UniswapV2ERC20 contract
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
    } catch (error) {
      console.log("Error calling setAdminPrivileges:", error);
      throw error;
    }
  });

  it("should add and remove admin addresses for specified pair when valid", async function () {
    try {
    // Create a new LiquigenPair from the LiquigenFactory
    const LiquigenPairContract = await ethers.getContractFactory("LiquigenPair", {
      libraries: {
        MetadataLibrary: MetadataLibrary.target,
      },
    });

    const tx = await LiquigenFactory.createPair(
      "Test Pair",
      "TPAIR",
      "ipfs://traitsCID",
      "A test description",
      dexPairContract.target
    );
    const receipt = await tx.wait();

    // Check PairCreated event and create new contract instance
    const liquigenLogs = receipt.logs.map(log => {
      try {
          return LiquigenFactory.interface.parseLog(log);
      } catch (error) {
          return null;
      }
    }).filter(event => event !== null);

    const liquigenEvent = liquigenLogs.find(e => e.name === "PairCreated");
    const liquigenPairAddress = liquigenEvent.args.liquigenPair;
    LiquigenPair = new ethers.Contract(liquigenPairAddress, LiquigenPairContract.interface, owner);

    // Verify addresses are not admin by default
    expect(await LiquigenFactory.admin(user.address)).to.equal(false);

    // Verify adding to admin
    await LiquigenFactory.setPairAdminPrivileges(
      user.address,
      true,
      liquigenPairAddress
    );
    expect(await LiquigenPair.admin(user.address)).to.equal(true);

    // Verify removing from admin
    await LiquigenFactory.setPairAdminPrivileges(
      user.address,
      false,
      liquigenPairAddress
    );

    expect(await LiquigenPair.admin(user.address)).to.equal(false);
    } catch (error) {
      console.log("Error calling setAdminPrivileges:", error);
      throw error;
    }
  });

  it("should not allow non-admin to set admin priviliges for specified pair", async function () {
    try {
      // Verify only admins can call this function
      await expect(LiquigenFactory.connect(user).setPairAdminPrivileges(
        user.address,
        true,
        dexPairContract.target
      )).to.be.revertedWith("LiquigenFactory: UNAUTHORIZED");
    } catch (error) {
      console.log("Error calling setAdminPrivileges:", error);
      throw error;
    }
  });

  it("should not add and remove admin addresses for specified pair when invalid", async function () {
    try {
      const nonLiquigenPairAddress = dexPairContract.target;

      // Verify only admins can call this function
      await expect(LiquigenFactory.connect(admin).setPairAdminPrivileges(
        user.address,
        true,
        nonLiquigenPairAddress
      )).to.be.revertedWith("LiquigenFactory: COLLECTION_NOT_FOUND");
    } catch (error) {
      console.log("Error calling setAdminPrivileges:", error);
      throw error;
    }
  });

  it("should change liquigenWallet when called from Liquigen wallet", async function () {
    try {
      expect(await LiquigenFactory.liquigenWallet()).to.equal(owner.address);
      
      // Verify updating liquigenWallet
      await LiquigenFactory.setLiquigenWallet(
        admin.address
      );

      expect(await LiquigenFactory.liquigenWallet()).to.equal(admin.address);
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
    } catch (error) {
      console.log("Error calling setAdminPrivileges:", error);
      throw error;
    }
  });
});
