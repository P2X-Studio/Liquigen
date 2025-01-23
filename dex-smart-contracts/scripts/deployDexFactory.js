const { ethers } = require("hardhat");
const compiledUniswapFactory = require("@uniswap/v2-core/build/UniswapV2Factory.json");

async function main() {
  const {abi, bytecode} = compiledUniswapFactory;

  const [deployer] = await ethers.getSigners();
  console.log(`Using deployer address: ${deployer.address}`);

  const Factory = new ethers.ContractFactory(abi, bytecode, deployer);

  // Deploy DEX Factory
  console.log("Deploying DEX Factory...");
  // const DexFactory = await ethers.deployContract(abi, bytecode, ['0xF1662217851e209928A5d0C13eA8277157c06519']);
  const DexFactory = await Factory.deploy('0xF1662217851e209928A5d0C13eA8277157c06519');
  // await DexFactory.waitForDeployment();
  await DexFactory.waitForDeployment();
  
  console.log(`DEX Factory deployed at: ${DexFactory.target}`);

  // console.log("Verifying contracts...");
  // await hre.run("verify:verify", {
  //   address: DexFactory.target,
  //   constructorArguments: ['0xF1662217851e209928A5d0C13eA8277157c06519'],
  // });
}

// Main execution
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error during deployment:", error);
    process.exit(1);
  });
