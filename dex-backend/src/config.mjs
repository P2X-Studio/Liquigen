import { config } from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import liquigenFactoryAbi from '../../dex-smart-contracts/artifacts/contracts/LiquigenFactory.sol/LiquigenFactory.json' assert { type: 'json' };
import liquigenPairAbi from '../../dex-smart-contracts/artifacts/contracts/LiquigenPair.sol/LiquigenPair.json' assert { type: 'json' };
import dexFactoryAbi from '../../dex-smart-contracts/artifacts/contracts/interfaces/IKimFactory.sol/IKimFactory.json' assert { type: 'json' };
import dexPairAbi from '../../dex-smart-contracts/artifacts/contracts/interfaces/IERC20.sol/IERC20.json' assert { type: 'json' };

config();

// Initialize ethers provider
// const provider = new ethers.JsonRpcProvider(MAINNET_RPC);
const provider = new ethers.JsonRpcProvider(TESTNET_RPC);

// Contract configuration
const dexFactoryAddress = '';
const dexFactory = new ethers.Contract(dexFactoryAddress, dexFactoryAbi.abi, provider);

const liquigenFactoryAddress = '';
const liquigenFactory = new ethers.Contract(liquigenFactoryAddress, liquigenFactoryAbi.abi, provider);

const loadPairs = () => {
  const data = fs.readFileSync('./pairs.json', 'utf-8');
  const pairs = JSON.parse(data).pairs;
  return pairs;
};

const pairsToWatch = loadPairs();

export { provider, liquigenFactory, liquigenPairAbi, dexFactory, dexPairAbi, pairsToWatch };
