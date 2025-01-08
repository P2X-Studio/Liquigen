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
const provider = new ethers.JsonRpcProvider(process.env.TESTNET_RPC);

// Signer confuiguration
const liquigenWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Contract configuration
const dexFactoryAddress = '0xAb1eD9375097Be451BFDd6A5011FA271124B6349'; // TODO: Update this address
const dexFactory = new ethers.Contract(dexFactoryAddress, dexFactoryAbi.abi, liquigenWallet);

const liquigenFactoryAddress = '0xA71bCDf3995Ca8133eb41b0A381a1A6ab2296B3a'; // TODO: Update this address
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
