import express from 'express';
import { 
  processDeposit, 
  processWithdrawal, 
  processERC20Transfer, 
  processERC721Transfer, 
  processERC20Approval, 
  processERC721Approval, 
  processPairCreated
} from './eventHandler.mjs';
import { ethers } from 'ethers';
import { 
  provider, 
  liquigenPairAbi, 
  dexFactory, 
  dexPairAbi, 
  pairsToWatch 
} from './config.mjs';

const app = express();
const port = process.env.PORT || 3001;

const zeroAddress = ethers.constants.AddressZero;

// Monitor events from multiple contracts
/*
EVENTS TO LISTEN TO AND TAKE ACTION ON:
- DEX factory createPair - Pull new contract address, add to ERC20PairsToWatch, and deploy new NFT pair contract
- DEX pair ERC20 Transfer - transfer NFT to destination if not exempt
  - liquidity deposited - transfer from address(0), mint NFT if threshold is reached
  - liquidity withdrawn - transfer to address(0), burn NFT if threshold is reached
  - transfer from user to user - transfer NFT
  - transfer from user to exempt - lock NFT
- ERC20 Approval - If approval is revoked, lock NFT
- ERC721 Transfer - transfer ERC20 tokens to destination if not exempt
- ERC721 Approval - If approval is revoked, lock NFT
*/

const listenToEvents = async () => {
  // Listen for 'PairCreated' events
  dexFactory.on('PairCreated', async (token0, token1, pair, event) => {
    console.log(`Pair created: ${pair}`);
    await processPairCreated(token0, token1, pair);
    // TODO: add pair to ERC20PairsToWatch
  });

  for (const { erc20address, erc721address } of pairsToWatch) {
    const dexPair = new ethers.Contract(erc20address, dexPairAbi.abi, provider);
    const liquigenPair = new ethers.Contract(erc721address, liquigenPairAbi.abi, provider);

    // Listen for 'Transfer' events from DEX pair
    dexPair.on('Transfer', async (from, to, value) => {
      if (from === zeroAddress) { // Liquidity deposited
        console.log(`Liquidity deposited to ${erc20address}: ${value}`);
        await processDeposit(erc20address, erc721address, to, value);
      } else if (to === zeroAddress) { // Liquidity withdrawn
        console.log(`Liquidity withdrawn from ${erc20address}: ${value}`);
        await processWithdrawal(erc20address, erc721address, from, value);
      } else { // Transfer from user to user
        // TODO: factor in exempt addresses. 
        console.log(`ERC20 Transfer event from ${erc20address}: from ${from}, to ${to}, value ${value}`);
        await processERC20Transfer(erc20address, erc721address, from, to, value);
      }
    });

    // Listen for 'Approval' events from DEX pair
    dexPair.on('Approval', async (owner, spender, value) => {
      console.log(`Approval event from ${erc20address}: owner ${owner}, spender ${spender}, value ${value}`);
      await processERC20Approval(erc20address, erc721address, owner, spender, value);
    });

    // Listen for 'Transfer' events from Liquigen pair
    liquigenPair.on('Transfer', async (from, to, tokenId) => {
      console.log(`ERC721 Transfer event from ${erc721address}: from ${from}, to ${to}, tokenId ${tokenId}`);
      // await processERC721Transfer(erc20address, erc721address, from, to, tokenId);
    });

    // Listen for 'Approval' events from Liquigen pair
    liquigenPair.on('Approval', async (owner, approved, tokenId) => {
      console.log(`ERC721 Approval event from ${erc721address}: owner ${owner}, approved ${approved}, tokenId ${tokenId}`);
      // await processERC721Approval(erc20address, erc721address, owner, approved, tokenId);
    });

  }

  console.log(`Listening for events on ${Object.keys(pairsToWatch).length} pairs...`);
};

// Start listening to events
listenToEvents();

// Start the Express server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}...`);
});
