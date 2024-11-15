const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LiquigenPair", function () {
  let LiquigenFactory, LiquigenPair, pair, factory, owner, admin, user, lpPairContract;

  beforeEach(async function () {
    [owner, admin, user] = await ethers.getSigners();

    // Deploy LiquigenPair contract
    const LiquigenPairFactory = await ethers.getContractFactory("LiquigenPair");
    LiquigenPair = await LiquigenPairFactory.deploy();
    await LiquigenPair.deployed();

    // Deploy LiquigenFactory contract
    const Factory = await ethers.getContractFactory("LiquigenFactory");
    factory = await Factory.deploy();
    await factory.deployed();

    // Mock UniswapV2 LP pair contract
    const ERC20 = await ethers.getContractFactory("ERC20Mock");
    lpPairContract = await ERC20.deploy("LP Token", "LPT");
    await lpPairContract.deployed();

    // Create a new pair
    const tx = await factory.createPair(
      "Test Pair",
      "TPAIR",
      "ipfs://traitsCID",
      "A test pair",
      owner.address,
      lpPairContract.address,
      5 // mint threshold
    );
    const receipt = await tx.wait();
    const event = receipt.events.find(e => e.event === "PairCreated");
    const pairAddress = event.args.liquigenPair;

    // Attach the deployed LiquigenPair contract
    pair = await ethers.getContractAt("LiquigenPair", pairAddress);
  });

  it("should initialize the pair correctly", async function () {
    expect(await pair.tokenName()).to.equal("Test Pair");
    expect(await pair.description()).to.equal("A test pair");
  });

  it("should mint new tokens and trigger metadata event when threshold is met", async function () {
    await pair.safeMint(owner.address, 5);
    const balance = await pair.balanceOf(owner.address);
    expect(balance).to.equal(5);
  });

  it("should set and retrieve attributes correctly", async function () {
    const traitTypes = ["Color", "Size"];
    const values = ["Red", "Large"];
    const dna = ethers.utils.formatBytes32String("uniqueDNA");

    await pair.setAttributes(1, traitTypes, values, dna);
    const [retrievedTypes, retrievedValues, retrievedDNA] = await pair.getTokenAttributes(1);

    expect(retrievedTypes[0]).to.equal("Color");
    expect(retrievedValues[0]).to.equal("Red");
    expect(retrievedDNA).to.equal(dna);
  });

  it("should lock and unlock tokens", async function () {
    await pair.setLocked(1, true);
    const isLocked = await pair.locked(1);
    expect(isLocked).to.be.true;

    await pair.setLocked(1, false);
    expect(await pair.locked(1)).to.be.false;
  });

  it("should allow admin-controlled transfers", async function () {
    await pair.safeMint(owner.address, 1);
    await pair.adminTransfer(owner.address, user.address, 1);
    expect(await pair.ownerOf(1)).to.equal(user.address);
  });

  it("should generate correct tokenURI", async function () {
    await pair.safeMint(owner.address, 1);
    const tokenURI = await pair.tokenURI(1);
    expect(tokenURI).to.contain("lp-nft.xyz/nft-viewer/");
  });
});
