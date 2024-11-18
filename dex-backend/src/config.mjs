import { config } from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import liquigenFactoryAbi from '../../dex-smart-contracts/artifacts/contracts/LiquigenFactory.sol/LiquigenFactory.json' assert { type: 'json' };
import liquigenPairAbi from '../../dex-smart-contracts/artifacts/contracts/LiquigenPair.sol/LiquigenPair.json' assert { type: 'json' };
import dexFactoryAbi from '../../dex-smart-contracts/artifacts/contracts/interfaces/IUniswapV2Factory.sol/IUniswapV2Factory.json' assert { type: 'json' };
import dexPairAbi from '../../dex-smart-contracts/artifacts/contracts/interfaces/IUniswapV2Pair.sol/IUniswapV2Pair.json' assert { type: 'json' };

config();

// Initialize ethers provider
// const provider = new ethers.JsonRpcProvider(process.env.MAINNET_RPC);
// const provider = new ethers.JsonRpcProvider('https://mainnet.mode.network/');
const provider = new ethers.JsonRpcProvider(`https://mode-mainnet.blastapi.io/${process.env.ACCESS_TOKEN}`);
// const provider = new ethers.JsonRpcProvider(process.env.TESTNET_RPC);
// const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');


// Contract configuration
const dexFactoryAddress = '0x293f2B2c17f8cEa4db346D87Ef5712C9dd0491EF'; // TODO: Update this address
const dexFactory = new ethers.Contract(dexFactoryAddress, dexFactoryAbi.abi, provider);

const liquigenFactoryAddress = '0x293f2B2c17f8cEa4db346D87Ef5712C9dd0491EF'; // TODO: Update this address
const liquigenFactory = new ethers.Contract(liquigenFactoryAddress, liquigenFactoryAbi.abi, provider);

const loadPairs = () => {
  const data = fs.readFileSync('./data/pairs.json', 'utf-8');
  const pairs = JSON.parse(data).pairs;
  return pairs;
};

const pairsToWatch = loadPairs();

export { provider, liquigenFactory, liquigenPairAbi, dexFactory, dexPairAbi, pairsToWatch };
