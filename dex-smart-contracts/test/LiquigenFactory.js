const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LiquigenFactory", function () {
  let LiquigenFactory, LiquigenPair, factory, owner, admin, user, lpPairContract;

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
  });

  it("should create a new LiquigenPair", async function () {
    const tx = await factory.createPair(
      "Test Pair",
      "TPAIR",
      "ipfs://traitsCID",
      "A test pair",
      owner.address,
      lpPairContract.address,
      10 // mint threshold
    );

    const receipt = await tx.wait();
    const event = receipt.events.find(e => e.event === "PairCreated");
    expect(event).to.exist;

    const pairAddress = event.args.liquigenPair;
    expect(pairAddress).to.not.equal(ethers.constants.AddressZero);
  });

  it("should revert if non-admin tries to create a pair", async function () {
    await expect(
      factory.connect(user).createPair(
        "Non-Admin Pair",
        "NAPAIR",
        "ipfs://traitsCID",
        "Non-admin attempt",
        user.address,
        lpPairContract.address,
        5
      )
    ).to.be.revertedWith("Unauthorized");
  });

  it("should set admin privileges correctly", async function () {
    await factory.setAdminPrivileges(admin.address, true);
    expect(await factory.admin(admin.address)).to.be.true;

    await factory.setAdminPrivileges(admin.address, false);
    expect(await factory.admin(admin.address)).to.be.false;
  });
});
