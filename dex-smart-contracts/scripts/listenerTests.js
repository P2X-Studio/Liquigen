const { ethers } = require("hardhat");
const compiledUniswapFactory = require("@uniswap/v2-core/build/UniswapV2Factory.json");
const compiledUniswapPair = require("@uniswap/v2-core/build/UniswapV2Pair.json");

async function deployTokens() {
    const tokenDetails = [
        { name: "Token A", symbol: "TA" },
        { name: "Token B", symbol: "TB" },
        { name: "Token C", symbol: "TC" },
        { name: "Token D", symbol: "TD" },
        { name: "Token E", symbol: "TE" },
        { name: "Token F", symbol: "TF" },
    ];

    console.log("Deploying ERC20 tokens...");

    for (const token of tokenDetails) {
        console.log(`Deploying ERC20 Token: ${token.name} (${token.symbol})...`);

        const erc20Token = await ethers.deployContract("Token", [token.name, token.symbol]);
        await erc20Token.waitForDeployment();

        console.log(`${token.name} deployed at: ${erc20Token.target}`);
    }

    console.log("ERC20 tokens deployed successfully.");
}

async function deployFactory() {
    const {abi, bytecode} = compiledUniswapFactory;
    const [deployer] = await ethers.getSigners();
    const Factory = new ethers.ContractFactory(abi, bytecode, deployer);
  
    // Deploy DEX Factory
    console.log("Deploying DEX Factory...");
    const DexFactory = await Factory.deploy(deployer.address);
    // await DexFactory.waitForDeployment();
    await DexFactory.waitForDeployment();
    
    console.log(`DEX Factory deployed at: ${DexFactory.target}`);
}

async function createPair() {
    // Example createPair function logic
    console.log("Executing createPair function...");

    const {abi, bytecode} = compiledUniswapFactory;
    const [deployer] = await ethers.getSigners();
    const factoryContract = new ethers.ContractFactory(abi, bytecode, deployer);
    const factory = new ethers.Contract(process.env.DEXFACTORY, factoryContract.interface, deployer);

    // Call factory contract's createPair function
    console.log("Creating pair...");
    try {
        const tx = await factory.createPair(process.env.TOKENA, process.env.TOKENB);
        const receipt = await tx.wait();

        // Use the contract's interface to parse logs
        const eventLogs = receipt.logs.map(log => {
            try {
                return factory.interface.parseLog(log);
            } catch (error) {
                return null;
            }
        }).filter(event => event !== null);

        // Check if the PairCreated event exists
        const event = eventLogs.find(e => e.name === "PairCreated");

        const pairAddress = event.args.pair;

        console.log(`Pair created at: ${pairAddress}`);
    } catch (error) {
        console.error("Error creating pair:", error);
    }
    
}

async function deposit() {
    console.log("Executing deposit function...");

    // Initiate contract instances
    const [deployer] = await ethers.getSigners();
    const factoryContract = new ethers.ContractFactory(compiledUniswapFactory.abi, compiledUniswapFactory.bytecode, deployer);
    const factory = new ethers.Contract(process.env.DEXFACTORY, factoryContract.interface, deployer);

    const pairAddress = await factory.getPair(process.env.TOKENA, process.env.TOKENB);

    const pairContract = new ethers.ContractFactory(compiledUniswapPair.abi, compiledUniswapPair.bytecode, deployer);
    const pair = new ethers.Contract(pairAddress, pairContract.interface, deployer);

    const tokenContract = await ethers.getContractFactory("Token");
    const tokenA = new ethers.Contract(process.env.TOKENA, tokenContract.interface, deployer);
    const tokenB = new ethers.Contract(process.env.TOKENB, tokenContract.interface, deployer);

    const amountA = ethers.parseUnits("1", 18); // Example: 1 token
    const amountB = ethers.parseUnits("1", 18); // Example: 1 token

    console.log(`Transferring ${amountA} (WEI value) Token A to pair contract...`);
    await tokenA.transfer(pairAddress, amountA);

    console.log(`Transferring ${amountB} (WEI value) Token B to pair contract...`);
    await tokenB.transfer(pairAddress, amountB);

    console.log("Minting LP Tokens...");
    await pair.mint(deployer.address);

    console.log("Deposit completed.");
}

async function withdraw() {
    console.log("Executing withdraw function...");

    // Initiate contract instances
    const [deployer] = await ethers.getSigners();
    const factoryContract = new ethers.ContractFactory(compiledUniswapFactory.abi, compiledUniswapFactory.bytecode, deployer);
    const factory = new ethers.Contract(process.env.DEXFACTORY, factoryContract.interface, deployer);

    const pairAddress = await factory.getPair(process.env.TOKENA, process.env.TOKENB);

    const pairContract = new ethers.ContractFactory(compiledUniswapPair.abi, compiledUniswapPair.bytecode, deployer);
    const pair = new ethers.Contract(pairAddress, pairContract.interface, deployer);

    const tokenContract = await ethers.getContractFactory("Token");
    const tokenA = new ethers.Contract(process.env.TOKENA, tokenContract.interface, deployer);
    const tokenB = new ethers.Contract(process.env.TOKENB, tokenContract.interface, deployer);

    const balanceA = await tokenA.balanceOf(pairAddress);
    const balanceB = await tokenB.balanceOf(pairAddress);
    const pairBalance = await pair.balanceOf(deployer.address);

    console.log(`Pair contract balances: tokenA = ${balanceA}, tokenB = ${balanceB}`);

    console.log(`Token A balance before: ${await tokenA.balanceOf(deployer.address)}`);
    console.log(`Token B balance before: ${await tokenB.balanceOf(deployer.address)}`);
    console.log(`LP balance before: ${pairBalance}`);

    console.log("Burning LP Tokens...");
    await pair.transfer(pairAddress, pairBalance);
    await pair.burn(deployer.address);

    console.log(`Token A balance after: ${await tokenA.balanceOf(deployer.address)}`);
    console.log(`Token B balance after: ${await tokenB.balanceOf(deployer.address)}`);
    console.log(`LP balance after: ${await pair.balanceOf(deployer.address)}`);

    console.log("Withdraw completed.");
}

async function main() {
    const action = process.env.ACTION;

    if (action === "deploy tokens") {
        await deployTokens();
    } else if (action === "deploy factory") {
        await deployFactory();
    } else if (action === "create pair") {
        await createPair();
    } else if (action === "deposit") {
        await deposit();
    } else if (action === "withdraw") {
        await withdraw();
    } else {
        console.log(`No valid function specified. Set ACTION to "deploy tokens", "deploy factory", "create pair", "deposit", or "withdraw".`);
    }
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
});
  