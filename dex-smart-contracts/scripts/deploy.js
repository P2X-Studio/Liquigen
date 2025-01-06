const { ethers } = require("hardhat");

async function main() {
  // Deploy MetadataLibrary
  console.log("Deploying MetadataLibrary...");
  const MetadataLibrary = await ethers.deployContract("MetadataLibrary");
  await MetadataLibrary.waitForDeployment();
  console.log(`MetadataLibrary deployed at: ${MetadataLibrary.target}`);

  // Deploy LiquigenFactory
  console.log("Deploying LiquigenFactory...");
  const LiquigenFactory = await ethers.deployContract("LiquigenFactory", {
    libraries: {
      MetadataLibrary: MetadataLibrary.target,
    },
  });

  await LiquigenFactory.waitForDeployment();
  console.log(`LiquigenFactory deployed at: ${LiquigenFactory.target}`);

  console.log("Verifying contracts...");
  await hre.run("verify:verify", {
    address: MetadataLibrary.target,
  });
  await hre.run("verify:verify", {
    address: LiquigenFactory.target,
    libraries: {
      MetadataLibrary: MetadataLibrary.target,
    },
  });
  // await hre.run("verify:verify", {
  //   address: '0xA71bCDf3995Ca8133eb41b0A381a1A6ab2296B3a',
  //   libraries: {
  //     MetadataLibrary: '0xbc4DB8CFa12f06caeED048A1739b63BEb0365b8E',
  //   },
  // });
}

// Main execution
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error during deployment:", error);
    process.exit(1);
  });
