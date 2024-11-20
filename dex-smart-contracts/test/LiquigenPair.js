const { expect } = require("chai");
const { ethers } = require("hardhat");
const { sha1 } = require("sha1");
const dexFactoryContract = require("@uniswap/v2-core/build/UniswapV2Factory.json");
const dexPairContract = require("@uniswap/v2-core/build/UniswapV2Pair.json");
const ERC20Contract = require("@openzeppelin/contracts/build/contracts/ERC20.json");

describe("LiquigenPair", function () {
  let ERC20token0, ERC20token1, DexFactory, DexPair, MetadataLibrary, LiquigenFactory, LiquigenPair;
  let owner, admin, user1, user2, user3;

  beforeEach(async function () {
    [owner, admin, user1, user2, user3] = await ethers.getSigners();
    
    const ERC20 = await ethers.getContractFactory(ERC20Contract.abi, ERC20Contract.bytecode);

    // Deploy the ERC20 tokens
    ERC20token0 = await ERC20.deploy("Token0", "T0");
    await ERC20token0.waitForDeployment();

    ERC20token1 = await ERC20.deploy("Token1", "T1");
    await ERC20token1.waitForDeployment();

    // Deploy the UniswapV2Factory
    const UniswapV2Factory = await ethers.getContractFactory(dexFactoryContract.abi, dexFactoryContract.bytecode);

    DexFactory = await UniswapV2Factory.deploy(owner.address);
    await DexFactory.waitForDeployment();

    // Create a new pair from the UniswapV2Factory
    const dexCreatePairTx = await DexFactory.createPair(
      ERC20token0.target,
      ERC20token1.target
    );
    const dexCreatePairReceipt = await dexCreatePairTx.wait();

    // Check PairCreated event and create new contract instance
    const dexLogs = dexCreatePairReceipt.logs.map(log => {
      try {
          return DexFactory.interface.parseLog(log);
      } catch (error) {
          return null;
      }
    }).filter(event => event !== null);

    const dexEvent = dexLogs.find(e => e.name === "PairCreated");
    const dexPairAddress = dexEvent.args.pair;
    DexPair = new ethers.Contract(dexPairAddress, dexPairContract.abi, owner);

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

    const LiquigenPairContract = await ethers.getContractFactory("LiquigenPair", {
      libraries: {
        MetadataLibrary: MetadataLibrary.target,
      },
    });

    // Create a new LiquigenPair from the LiquigenFactory
    const liquigenCreatePairTx = await LiquigenFactory.createPair(
      "Test Pair",
      "TPAIR",
      "ipfs://traitsCID",
      "A test description",
      DexPair.target
    );
    const liquigenCreatePairReceipt = await liquigenCreatePairTx.wait();

    // Check PairCreated event and create new contract instance
    const liquigenLogs = liquigenCreatePairReceipt.logs.map(log => {
      try {
          return LiquigenFactory.interface.parseLog(log);
      } catch (error) {
          return null;
      }
    }).filter(event => event !== null);

    const liquigenEvent = liquigenLogs.find(e => e.name === "PairCreated");
    const liquigenPairAddress = liquigenEvent.args.liquigenPair;
    LiquigenPair = new ethers.Contract(liquigenPairAddress, LiquigenPairContract.interface, owner);

    // Set admin privileges
    await LiquigenFactory.setAdminPrivileges(
      admin,
      true
    );

    await LiquigenPair.setAdminPrivileges(
      admin,
      true
    );
  });

  it("should have initialized correctly", async function () {
    try {
      // values set in the constructor
      expect(await LiquigenPair.name()).to.equal("Test Pair");
      expect(await LiquigenPair.symbol()).to.equal("TPAIR");
      expect(await LiquigenPair.traitCID()).to.equal("ipfs://traitsCID");
      expect(await LiquigenPair.description()).to.equal("A test description");
      // values set in initialize()
      expect(await LiquigenPair.factory()).to.equal(LiquigenFactory.target);
      expect(await LiquigenPair.lpPairContract()).to.equal(DexPair.target);
      expect(await LiquigenPair.liquigenWallet()).to.equal(owner.address);
      expect(await LiquigenPair.admin(LiquigenFactory.target)).to.equal(true);
      expect(await LiquigenPair.admin(owner.address)).to.equal(true);

      console.log(`LiquigenPair initialized correctly`);
    } catch (error) {
      console.log("Error with initialization:", error);
      throw error;
    }
  });

  it("should add and remove admin addresses", async function () {
    try {
      // Verify addresses are not admin by default
      expect(await LiquigenPair.admin(user1.address)).to.equal(false);

      // Verify adding to admin
      await LiquigenPair.setAdminPrivileges(
        user1.address,
        true
      );
      expect(await LiquigenPair.admin(user1.address)).to.equal(true);

      // Verify removing from admin
      await LiquigenPair.setAdminPrivileges(
        user1.address,
        false
      );
      expect(await LiquigenPair.admin(user1.address)).to.equal(false);

      console.log(`admin addresses added and removed as expected`);
    } catch (error) {
      console.log("Error calling setAdminPrivileges:", error);
      throw error;
    }
  });

  it("should not allow non-admin to set admin priviliges", async function () {
    try {
      // Verify only admins can call this function
      await expect(LiquigenPair.connect(user1).setAdminPrivileges(
        user1.address,
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
      expect(await LiquigenPair.admin(admin.address)).to.equal(true);
      
      // Verify admins can't remove Liquigen wallet
      await expect(LiquigenPair.connect(admin).setAdminPrivileges(
        owner.address,
        false
      )).to.be.revertedWith("Cannot remove super admin privileges");

      console.log(`setAdminPrivileges does not allow removing Liquigen wallet as admin`);
    } catch (error) {
      console.log("Error calling setAdminPrivileges:", error);
      throw error;
    }
  });

  it("should mint a token to a user, and emit NeedsMetadata event", async function () {
    try {
      const mintTx = await LiquigenPair.mint(
        user1.address,
        1
      );
      const mintReceipt = await mintTx.wait();

      // Check NeedsMetadata event
      const logs = mintReceipt.logs.map(log => {
        try {
            return LiquigenFactory.interface.parseLog(log);
        } catch (error) {
            return null;
        }
      }).filter(event => event !== null);

      const event = logs.find(e => e.name === "NeedsMetadata");
      expect(event.args.tokenId).to.equal(1);
      expect(event.args.owner).to.equal(user1.address);
      expect(event.args.collection).to.equal(LiquigenPair.target);
      expect(event.args.rarityModifier).to.equal(1);

      console.log(`minted token to user and emitted NeedsMetadata event`);
    } catch (error) {
      console.log("Error minting token:", error);
      throw error;
    }
  });

  it("sould set collection info when called from admin", async function () {
    try {
      await LiquigenPair.setCollectionInfo(
        "ipfs://newTraitsCID",
        "A new test description",
        "New Token Name",
      );

      expect(await LiquigenPair.traitCID()).to.equal("ipfs://newTraitsCID");
      expect(await LiquigenPair.description()).to.equal("A new test description");
      expect(await LiquigenPair.tokenName()).to.equal("New Token Name");

      console.log(`set collection info as expected`);
    } catch (error) {
      console.log("Error setting collection info:", error);
      throw error;
    }
  });

  it("should not allow non-admin to set collection info", async function () {
    try {
      await expect(LiquigenPair.connect(user1).setCollectionInfo(
        "ipfs://newTraitsCID",
        "A new test description",
        "New Token Name",
      )).to.be.revertedWith("LiquigenFactory: UNAUTHORIZED");

      console.log(`setCollectionInfo does not allow non-admin to set collection info`);
    } catch (error) {
      console.log("Error setting collection info:", error);
      throw error;
    }
  });

  it("should set attributes for a token when called from admin", async function () {
    try {
      // Mint a token to set attributes for
      await LiquigenPair.mint(
        user1.address,
        1
      );

      await LiquigenPair.setAttributes(
        1,
        ["trait1", "trait2", "trait3"],
        ["value1", "value2", "value3"],
        '0x796f752d6b6e65772d6d652d7468652d73616d65000000000000000000000000'
      );

      const token = await LiquigenPair.getTokenAttributes(1);
      
      expect(token[0]).to.deep.equal(['trait1', 'trait2', 'trait3']);
      expect(token[1]).to.deep.equal(["value1", "value2", "value3"]);
      expect(token[2]).to.equal('0x796f752d6b6e65772d6d652d7468652d73616d65000000000000000000000000');
      expect(token[3]).to.equal(0);

      console.log(`set attributes for token as expected`);
    } catch (error) {
      console.log("Error setting attributes for token:", error);
      throw error;
    }
  });

  it("should revert setAttributes when dna is not unique", async function () {
    try {
      // Mint two tokens to set attributes for
      await LiquigenPair.mint(
        user1.address,
        1
      );

      await LiquigenPair.mint(
        user1.address,
        1
      );

      await LiquigenPair.setAttributes(
        1,
        ["trait1", "trait2", "trait3"],
        ["value1", "value2", "value3"],
        '0x796f752d6b6e65772d6d652d7468652d73616d65000000000000000000000000'
      );

      await expect(LiquigenPair.setAttributes(
        2,
        ["trait1", "trait2", "trait3"],
        ["value1", "value2", "value3"],
        '0x796f752d6b6e65772d6d652d7468652d73616d65000000000000000000000000'
      )).to.be.revertedWith("LiquigenFactory: DNA_ALREADY_EXISTS");

      console.log(`setAttributes reverts as expected when dna is not unique`);
    } catch (error) {
      console.log("Error setting attributes for token:", error);
      throw error;
    }
  });

  it("should revert setAttributes when traits and values are not equal length", async function () {
    try {
      // Mint a token to set attributes for
      await LiquigenPair.mint(
        user1.address,
        1
      );

      await expect(LiquigenPair.setAttributes(
        1,
        ["trait1", "trait2", "trait3"],
        ["value1", "value2"],
        '0x796f752d6b6e65772d6d652d7468652d73616d65000000000000000000000000'
      )).to.be.revertedWith("LiquigenFactory: LENGTH_MISMATCH");

      console.log(`setAttributes reverts as expected when traits and values are not equal length`);
    } catch (error) {
      console.log("Error setting attributes for token:", error);
      throw error;
    }
  });

  it("should not allow non-admin to set attributes for a token", async function () {
    try {
      await LiquigenPair.mint(
        user1.address,
        1
      );

      await expect(LiquigenPair.connect(user1).setAttributes(
        1,
        ["trait1", "trait2", "trait3"],
        ["value1", "value2", "value3"],
        '0x796f752d6b6e65772d6d652d7468652d73616d65000000000000000000000000'
      )).to.be.revertedWith("LiquigenFactory: UNAUTHORIZED");

      console.log(`setAttributes does not allow non-admin to set attributes for a token`);
    } catch (error) {
      console.log("Error setting attributes for token:", error);
      throw error;
    }
  });

  it("should set locked status for a token when called from admin", async function () {
    try {
      // Mint a token to set locked status for
      await LiquigenPair.mint(
        user1.address,
        1
      );

      expect(await LiquigenPair.locked(1)).to.equal(false);

      await LiquigenPair.setLocked(
        1,
        true
      );

      expect(await LiquigenPair.locked(1)).to.equal(true);

      console.log(`set locked status for token as expected`);
    } catch (error) {
      console.log("Error setting locked status for token:", error);
      throw error;
    }
  });

  it("should not allow non-admin to set locked status for a token", async function () {
    try {
      await LiquigenPair.mint(
        user1.address,
        1
      );

      await expect(LiquigenPair.connect(user1).setLocked(
        1,
        true
      )).to.be.revertedWith("LiquigenFactory: UNAUTHORIZED");

      console.log(`setLocked does not allow non-admin to set locked status for a token`);
    } catch (error) {
      console.log("Error setting locked status for token:", error);
      throw error;
    }
  });

  it("should set mint threshold when called from admin", async function () {
    try {
      expect(await LiquigenPair.mintThreshold()).to.equal(0);

      await LiquigenPair.setMintThreshold(
        100
      );

      expect(await LiquigenPair.mintThreshold()).to.equal(100);

      console.log(`set mint threshold as expected`);
    } catch (error) {
      console.log("Error setting mint threshold:", error);
      throw error;
    }
  });

  it("should not allow non-admin to set mint threshold", async function () {
    try {
      await expect(LiquigenPair.connect(user1).setMintThreshold(
        100
      )).to.be.revertedWith("LiquigenFactory: UNAUTHORIZED");

      console.log(`setMintThreshold does not allow non-admin to set mint threshold`);
    } catch (error) {
      console.log("Error setting mint threshold:", error);
      throw error;
    }
  });

  it("should burn NFT and reset uniqueness", async function () {
    try {
      // Mint a token and set attributes for it
      await LiquigenPair.mint(
        user1.address,
        1
      );

      expect(await LiquigenPair.ownerOf(1)).to.equal(user1.address);
      expect(await LiquigenPair.uniqueness('0x796f752d6b6e65772d6d652d7468652d73616d65000000000000000000000000')).to.equal(false);

      await LiquigenPair.setAttributes(
        1,
        ["trait1", "trait2", "trait3"],
        ["value1", "value2", "value3"],
        '0x796f752d6b6e65772d6d652d7468652d73616d65000000000000000000000000'
      );

      expect(await LiquigenPair.uniqueness('0x796f752d6b6e65772d6d652d7468652d73616d65000000000000000000000000')).to.equal(true);

      await LiquigenPair.burnNFT(1);

      expect(await LiquigenPair.uniqueness('0x796f752d6b6e65772d6d652d7468652d73616d65000000000000000000000000')).to.equal(false);

      await expect(LiquigenPair.ownerOf(1)).to.be.revertedWithCustomError(LiquigenPair, "OwnerQueryForNonexistentToken");

      console.log(`burned NFT and reset uniqueness as expected`);
    } catch (error) {
      console.log("Error burning NFT:", error);
      throw error;
    }
  });

  it("should allow user to merge owned nfts", async function () {
    try {
      // Mint two tokens and set attributes for them
      await LiquigenPair.mint(
        user1.address,
        1
      );

      await LiquigenPair.mint(
        user1.address,
        2
      );

      await LiquigenPair.setAttributes(
        1,
        ["trait1", "trait2", "trait3"],
        ["value1", "value2", "value3"],
        '0x796f752d6b6e65772d6d652d7468652d73616d65000000000000000000000000'
      );

      await LiquigenPair.setAttributes(
        2,
        ["trait1", "trait2", "trait3"],
        ["value1", "value2", "value3"],
        '0x796f752d6b6e65772d6d652d7468652d73616d65000000000000000000000001'
      );

      // Merge the two tokens
      const mergeTx = await LiquigenPair.connect(user1).mergeNFTs(
        [ 1, 2 ]
      );

      // Check that the old tokens were burnt
      await expect(LiquigenPair.ownerOf(1)).to.be.revertedWithCustomError(LiquigenPair, "OwnerQueryForNonexistentToken");
      await expect(LiquigenPair.ownerOf(2)).to.be.revertedWithCustomError(LiquigenPair, "OwnerQueryForNonexistentToken");

      const mergeReceipt = await mergeTx.wait();

      // Check that NeedsMetadata event was emitted
      const logs = mergeReceipt.logs.map(log => {
        try {
            return LiquigenFactory.interface.parseLog(log);
        } catch (error) {
            return null;
        }
      }).filter(event => event !== null);

      const event = logs.find(e => e.name === "NeedsMetadata");
      expect(event).to.exist;

      // Check that the new token was minted
      expect(await LiquigenPair.ownerOf(3)).to.equal(user1.address);

      console.log(`merged NFTs as expected`);
    } catch (error) {
      console.log("Error merging NFTs:", error);
      throw error;
    }
  });

  it("should not allow user to merge nfts they don't own", async function () {
    try {
      // Mint two tokens and set attributes for them
      await LiquigenPair.mint(
        user1.address,
        1
      );

      await LiquigenPair.mint(
        user1.address,
        2
      );

      await LiquigenPair.setAttributes(
        1,
        ["trait1", "trait2", "trait3"],
        ["value1", "value2", "value3"],
        '0x796f752d6b6e65772d6d652d7468652d73616d65000000000000000000000000'
      );

      await LiquigenPair.setAttributes(
        2,
        ["trait1", "trait2", "trait3"],
        ["value1", "value2", "value3"],
        '0x796f752d6b6e65772d6d652d7468652d73616d65000000000000000000000001'
      );

      // Attempt to merge the two tokens
      await expect(LiquigenPair.connect(user2).mergeNFTs(
        [ 1, 2 ]
      )).to.be.revertedWith("Only owned NFT can be merged");

      console.log(`mergeNFTs does not allow user to merge nfts they don't own`);
    } catch (error) {
      console.log("Error merging NFTs:", error);
      throw error;
    }
  });

  // TODO: write transfer test functions
  // TOOD: write adminTransfer test functions
});
