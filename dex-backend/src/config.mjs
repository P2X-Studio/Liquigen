import { config } from 'dotenv';
import { ethers } from 'ethers';
import { promises as fs } from 'fs';
import liquigenFactoryAbi from '../../dex-smart-contracts/artifacts/contracts/LiquigenFactory.sol/LiquigenFactory.json' assert { type: 'json' };
import liquigenPairAbi from '../../dex-smart-contracts/artifacts/contracts/LiquigenPair.sol/LiquigenPair.json' assert { type: 'json' };
import dexFactoryAbi from '../../dex-smart-contracts/artifacts/contracts/interfaces/IUniswapV2Factory.sol/IUniswapV2Factory.json' assert { type: 'json' };
import dexPairAbi from '../../dex-smart-contracts/artifacts/contracts/interfaces/IUniswapV2Pair.sol/IUniswapV2Pair.json' assert { type: 'json' };
import { sign } from 'crypto';

config();

// Initialize ethers provider
// const provider = new ethers.JsonRpcProvider(process.env.MAINNET_RPC);
const provider = new ethers.JsonRpcProvider(process.env.TESTNET_RPC_CONDUIT);

// Signer confuiguration
const liquigenWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Contract configuration
const dexFactoryAddress = process.env.DEX_FACTORY;
const dexFactory = new ethers.Contract(dexFactoryAddress, dexFactoryAbi.abi, liquigenWallet);

const liquigenFactoryAddress = process.env.LIQUIGEN_FACTORY;
const liquigenFactory = new ethers.Contract(liquigenFactoryAddress, liquigenFactoryAbi.abi, liquigenWallet);

async function loadPairs () {
  const dataPath = './data/pairs.json';
  let pairs = [];

  try {
    const fileData = await fs.readFile(dataPath, 'utf-8');
    pairs = JSON.parse(fileData).pairs;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Unexpected error:', error.message);
      throw error; 
    }
    console.log('pairs.json not found');
  }

  return pairs;
};

const pairsToWatch = await loadPairs();

export { provider, liquigenWallet, liquigenFactory, liquigenPairAbi, dexFactory, dexPairAbi, pairsToWatch };
