const { expect } = require("chai");
const { ethers } = require("hardhat");
const { sha1 } = require("sha1");
const dexFactoryContract = require("@uniswap/v2-core/build/UniswapV2Factory.json");
const dexPairContract = require("@uniswap/v2-core/build/UniswapV2Pair.json");
const ERC20Contract = require("@openzeppelin/contracts/build/contracts/ERC20PresetMinterPauser.json");

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

    // Mint some ERC20 tokens to owner
    await ERC20token0.mint(owner.address, 100000);
    await ERC20token1.mint(owner.address, 100000);

    // Mint some ERC20 tokens to user1
    await ERC20token0.mint(user1.address, 50000);
    await ERC20token1.mint(user1.address, 50000);

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

    // Add initial liquidity to the pair from owner
    await ERC20token0.connect(owner).approve(DexPair.target, 50000);
    await ERC20token1.connect(owner).approve(DexPair.target, 50000);

    await ERC20token0.connect(owner).transfer(DexPair.target, 50000);
    await ERC20token1.connect(owner).transfer(DexPair.target, 50000);
    await DexPair.mint(owner.address);

    // Add liquidity to the pair from user1
    await ERC20token0.connect(user1).approve(DexPair.target, 10000);
    await ERC20token1.connect(user1).approve(DexPair.target, 10000);

    await ERC20token0.connect(user1).transfer(DexPair.target, 10000);
    await ERC20token1.connect(user1).transfer(DexPair.target, 10000);
    await DexPair.mint(user1.address);

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
      )).to.be.revertedWith("LiquigenPair: UNAUTHORIZED");
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
      )).to.be.revertedWith("LiquigenPair: UNAUTHORZED_SUPER_ADMIN");
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
      )).to.be.revertedWith("LiquigenPair: UNAUTHORIZED");
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
      expect(token[3]).to.equal(1000);
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
      )).to.be.revertedWith("LiquigenPair: DNA_ALREADY_EXISTS");
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
      )).to.be.revertedWith("LiquigenPair: LENGTH_MISMATCH");
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
      )).to.be.revertedWith("LiquigenPair: UNAUTHORIZED");
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
      )).to.be.revertedWith("LiquigenPair: UNAUTHORIZED");
    } catch (error) {
      console.log("Error setting locked status for token:", error);
      throw error;
    }
  });

  it("should set mint threshold when called from admin", async function () {
    try {
      expect(await LiquigenPair.mintThreshold()).to.equal(1000);

      await LiquigenPair.setMintThreshold(
        2000
      );

      expect(await LiquigenPair.mintThreshold()).to.equal(2000);
    } catch (error) {
      console.log("Error setting mint threshold:", error);
      throw error;
    }
  });

  it("should not allow non-admin to set mint threshold", async function () {
    try {
      await expect(LiquigenPair.connect(user1).setMintThreshold(
        100
      )).to.be.revertedWith("LiquigenPair: UNAUTHORIZED");
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
      )).to.be.revertedWith("LiquigenPair: UNAUTHORIZED");
    } catch (error) {
      console.log("Error merging NFTs:", error);
      throw error;
    }
  });

  it("should transfer NFT & LP tokens to another user", async function () {
    try {
      // Mint an NFT and set attributes for it
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

      // Set approval for LP tokens
      await DexPair.connect(user1).approve(LiquigenPair.target, 1000);

      expect(await LiquigenPair.ownerOf(1)).to.equal(user1.address);
      expect(await DexPair.balanceOf(user1.address)).to.equal(10000);
      expect(await DexPair.balanceOf(user2.address)).to.equal(0);

      // Transfer NFT to user2
      await LiquigenPair.connect(user1).transferFrom(
        user1.address,
        user2.address,
        1
      );

      expect(await LiquigenPair.ownerOf(1)).to.equal(user2.address);
      expect(await DexPair.balanceOf(user1.address)).to.equal(9000);
      expect(await DexPair.balanceOf(user2.address)).to.equal(1000);
    } catch (error) {
      console.log("transferFrom error:", error);
      throw error;
    }
  });

  it("should not allow user to transfer NFT they don't own", async function () {
    try {
      // Mint an NFT and set attributes for it
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
     
      await DexPair.connect(user1).approve(LiquigenPair.target, 1000);

      // Attempt to transfer NFT to user2
      await expect(LiquigenPair.connect(user2).transferFrom(
        user1.address,
        user2.address,
        1
      )).to.be.revertedWithCustomError(LiquigenPair, "TransferCallerNotOwnerNorApproved");
    } catch (error) {
      console.log("transferFrom error:", error);
      throw error;
    }
  });

  it("should not allow user to transfer NFT that is locked", async function () {
    try {
      // Mint an NFT and set attributes for it
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

      await LiquigenPair.setLocked(
        1,
        true
      );

      await DexPair.connect(user1).approve(LiquigenPair.target, 1000);

      // Attempt to transfer NFT to user2
      await expect(LiquigenPair.connect(user1).transferFrom(
        user1.address,
        user2.address,
        1
      )).to.be.revertedWith("LiquigenPair: TOKEN_LOCKED");
    } catch (error) {
      console.log("transferFrom error:", error);
      throw error;
    }
  });

  it("should not allow user to transfer NFT if they don't have LP tokens", async function () {
    try {
      // Mint an NFT and set attributes for it
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

      // Emulate user1 burning their LP tokens. NFT would normally be burnt in this scenario
      await DexPair.connect(user1).transfer(DexPair.target, 10000);
      await DexPair.burn(user1.address);

      // Attempt to transfer NFT to user2
      await expect(LiquigenPair.connect(user1).transferFrom(
        user1.address,
        user2.address,
        1
      )).to.be.revertedWith("LiquigenPair: INSUFFICIENT_LP_BALANCE");
    } catch (error) {
      console.log("transferFrom error:", error);
      throw error;
    }
  });

  it("should not allow user to transfer NFT if LP allowance is not set for LiquigenPair contract", async function () {
    try {
      // Mint an NFT and set attributes for it
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

      // Attempt to transfer NFT to user2 without approval
      await expect(LiquigenPair.connect(user1).transferFrom(
        user1.address,
        user2.address,
        1
      )).to.be.revertedWith("LiquigenPair: INSUFFICIENT_LP_ALLOWANCE");
    } catch (error) {
      console.log("transferFrom error:", error);
      throw error;
    }
  });

  it("should transfer NFT to exempt address & LP tokens to LiquigenPair contract for holding", async function () {
    try {
      // Set an exempt address for something like an NFT staking contract or owner wallet
      await LiquigenFactory.setExempt(
        user3.address, 
        true
      );

      // Mint an NFT and set attributes for it
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

      // Set approval for LP tokens
      await DexPair.connect(user1).approve(LiquigenPair.target, 1000);

      expect(await LiquigenPair.ownerOf(1)).to.equal(user1.address);
      expect(await DexPair.balanceOf(user1.address)).to.equal(10000);
      expect(await DexPair.balanceOf(LiquigenPair.target)).to.equal(0);
      expect(await LiquigenPair.lockedLP(1)).to.equal(0);

      // Transfer NFT to exempt address
      await LiquigenPair.connect(user1).transferFrom(
        user1.address,
        user3.address,
        1
      );

      expect(await LiquigenPair.ownerOf(1)).to.equal(user3.address);
      expect(await DexPair.balanceOf(user1.address)).to.equal(9000);
      expect(await DexPair.balanceOf(LiquigenPair.target)).to.equal(1000);
      expect(await LiquigenPair.lockedLP(1)).to.equal(1000);
    } catch (error) {
      console.log("transferFrom error:", error);
      throw error;
    }
  });

  it("should transfer NFT & LP tokens from exempt address and LiquigenPair contract to user (does not need to be original user)", async function () {
    try {
      // Set an exempt address for something like an NFT staking contract or owner wallet
      await LiquigenFactory.setExempt(
        user3.address, 
        true
      );

      // Mint an NFT and set attributes for it
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

      // Set approval for LP tokens
      await DexPair.connect(user1).approve(LiquigenPair.target, 1000);

      // Transfer NFT to exempt address
      await LiquigenPair.connect(user1).transferFrom(
        user1.address,
        user3.address,
        1
      );

      // Transfer NFT from exempt address to user
      await LiquigenPair.connect(user3).transferFrom(
        user3.address,
        user2.address,
        1
      );

      expect(await LiquigenPair.ownerOf(1)).to.equal(user2.address);
      expect(await DexPair.balanceOf(user2.address)).to.equal(1000);
      expect(await DexPair.balanceOf(LiquigenPair.target)).to.equal(0);
      expect(await LiquigenPair.lockedLP(1)).to.equal(0);
    } catch (error) {
      console.log("transferFrom error:", error);
      throw error;
    }
  });

  it("should allow admin to transfer NFT from one user to another directly", async function () {
    try {
      // Mint an NFT and set attributes for it
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

      expect(await LiquigenPair.ownerOf(1)).to.equal(user1.address);
      expect(await DexPair.balanceOf(user1.address)).to.equal(10000);
      expect(await DexPair.balanceOf(user2.address)).to.equal(0);

      // Transfer LP tokens from user1 to user2 to emulate normal transfer
      await DexPair.connect(user1).transfer(user2.address, 1000);

      // Transfer NFT to user2 from admin account
      // Fewer requirements, as this is intended to be called when user transfers LP tokens
      await LiquigenPair.connect(admin).adminTransfer(
        user1.address,
        user2.address,
        1
      );

      expect(await LiquigenPair.ownerOf(1)).to.equal(user2.address);
      expect(await DexPair.balanceOf(user1.address)).to.equal(9000);
      expect(await DexPair.balanceOf(user2.address)).to.equal(1000);
    } catch (error) {
      console.log("transferFrom error:", error);
      throw error;
    }
  });

  it("should allow admin to emergency transfer tokens sent directly to the contract by mistake", async function () {
    try {
      // Mint some ERC20 tokens to user2
      await ERC20token0.mint(user2.address, 50000);

      expect(await ERC20token0.balanceOf(user2.address)).to.equal(50000);

      // User2 transfers those tokens directly to the contract
      await ERC20token0.connect(user2).transfer(LiquigenPair.target, 10000);

      expect(await ERC20token0.balanceOf(user2.address)).to.equal(40000);
      expect(await ERC20token0.balanceOf(LiquigenPair.target)).to.equal(10000);

      // Admin transfers those tokens back to user2
      await LiquigenPair.connect(admin).emergencyTransfer(
        ERC20token0.target,
        user2.address,
        10000
      );

      expect(await ERC20token0.balanceOf(user2.address)).to.equal(50000);
      expect(await ERC20token0.balanceOf(LiquigenPair.target)).to.equal(0);

    } catch (error) {
      console.log("adminTransfer error:", error);
      throw error;
    }
  });

  it("should not allow admin to emergency transfer tokens to 0 address", async function () {
    try {
      // Mint some ERC20 tokens to user2
      await ERC20token0.mint(user2.address, 50000);

      // User2 transfers those tokens directly to the contract
      await ERC20token0.connect(user2).transfer(LiquigenPair.target, 10000);
      
      // Admin attempts to transfer those tokens to 0 address by mistake
      await expect(LiquigenPair.connect(admin).emergencyTransfer(
        ERC20token0.target,
        ethers.ZeroAddress,
        10000
      )).to.be.revertedWith("LiquigenPair: INVALID_ADDRESS");
    } catch (error) {
      console.log("adminTransfer error:", error);
      throw error;
    }
  });

  it("should not allow admin to emergency transfer more tokens than the contract has", async function () {
    try {
      // Mint some ERC20 tokens to user2
      await ERC20token0.mint(user2.address, 50000);

      // User2 transfers those tokens directly to the contract
      await ERC20token0.connect(user2).transfer(LiquigenPair.target, 10000);
      
      // Admin attempts to transfer those tokens to 0 address by mistake
      await expect(LiquigenPair.connect(admin).emergencyTransfer(
        ERC20token0.target,
        user2.address,
        100000
      )).to.be.revertedWith("LiquigenPair: INSUFFICIENT_BALANCE");
    } catch (error) {
      console.log("adminTransfer error:", error);
      throw error;
    }
  });

  it("should not allow admin to emergency transfer LP tokens in excess of locked amount", async function () {
    try {
      // Set an exempt address for something like an NFT staking contract or owner wallet
      await LiquigenFactory.setExempt(
        user3.address, 
        true
      );

      // Mint an NFT and set attributes for it
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

      // Set approval for LP tokens
      await DexPair.connect(user1).approve(LiquigenPair.target, 1000);

      // Transfer NFT to exempt address
      await LiquigenPair.connect(user1).transferFrom(
        user1.address,
        user3.address,
        1
      );

      // User1 transfers additional LP tokens directly to the contract
      await DexPair.connect(user1).transfer(LiquigenPair.target, 1000);

      expect(await DexPair.balanceOf(LiquigenPair.target)).to.equal(2000);
      
      // Admin attempts to transfer too many LP tokens by mistake
      await expect(LiquigenPair.connect(admin).emergencyTransfer(
        DexPair.target,
        user1.address,
        2000
      )).to.be.revertedWith("LiquigenPair: EXCEEDS_LOCKED_LP");
    } catch (error) {
      console.log("adminTransfer error:", error);
      throw error;
    }
  });
});
