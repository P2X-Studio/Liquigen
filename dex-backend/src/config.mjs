import { config } from 'dotenv';
import { ethers } from 'ethers';
import axios from 'axios';
import liquigenFactoryAbi from '../../dex-smart-contracts/artifacts/contracts/LiquigenFactory.sol/LiquigenFactory.json' assert { type: 'json' };
import liquigenTokenAbi from '../../dex-smart-contracts/artifacts/contracts/LiquigenPair.sol/LiquigenPair.json' assert { type: 'json' };
import dexFactoryAbi from '../../dex-smart-contracts/artifacts/contracts/interfaces/IKimFactory.sol/IKimFactory.json' assert { type: 'json' };
import dexTokenAbi from '../../dex-smart-contracts/artifacts/contracts/interfaces/IERC20.sol/IERC20.json' assert { type: 'json' };

config();

// Initialize ethers provider
// const provider = new ethers.providers.JsonRpcProvider(process.env.MODE_MAINNET_RPC);
const provider = new ethers.JsonRpcProvider('https://sepolia.mode.network/');

// Contract configuration
const liquigenFactoryAddress = '';
const liquigenFactoryContract = new ethers.Contract(liquigenFactoryAddress, liquigenFactoryAbi.abi, provider);

// Pinata gateway URL
// const gatewayUrl = 'https://gateway.pinata.cloud/ipfs/';
const gatewayUrl = `https://${process.env.CLIENT_ID}.ipfscdn.io/ipfs/`;

// Helper to catch errors when fetching files
async function fetchFile(url) {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching file:', error);
    throw error;
  }
}

// Function to list files from CID
async function listFiles(cid) {
  try {
    const url = `${gatewayUrl}${cid}`;
    const data = await fetchFile(url);

    const files = [];
    const regex = /<a\s+href="([^"]+)">([^<]+)<\/a>/g;
    let match;

    while ((match = regex.exec(data)) !== null) {
      const filename = match[2];
      // Exclude the CID itself and ensure the filename is not empty
      if (filename !== cid && filename !== '' && match[1].startsWith('/ipfs/')) {
        files.push(filename);
      }
    }

    return files;
  } catch (error) {
    console.error('Error listing files:', error);
    throw error;
  }
}

async function fetchLayers(cid) {
  const files = await listFiles(cid);
  const structure = {};

  // Organize files into separate elements for each layer
  // NOTE: requires names to be formatted properly as index_layerName_traitName#weight.png
  for (const file of files) {
    const parts = file.split('_');
    if (parts.length > 1) {
      const layer = parts[1];
      if (!structure[layer]) {
        structure[layer] = [];
      }
      structure[layer].push(file);
    }
  }

  // console.log(structure);
  return structure;
}

// (async () => {
//   const cid = 'QmWoVDtbCvHTfmEFDdRpijFuxXWbNXVaBSs9eaS13sFfp6'; // Replace with your CID
//   await fetchLayers(cid);
// })();

export { provider, liquigenFactoryContract, liquigenTokenAbi, dexFactoryAbi, dexTokenAbi, fetchLayers };
