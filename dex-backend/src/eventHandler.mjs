import { 
  provider, 
  liquigenFactory, 
  liquigenPairAbi, 
  dexFactory, 
  dexPairAbi, 
  pairsToWatch 
} from './config.mjs';
import { ethers } from 'ethers';

// Set Liquigen default values. These can be updated in-contract later
const traitCID = '';
const description = 'Liquigen NFT represent liquity positions!';
const liquigenWallet = await liquigenFactory.liquigenWallet();

async function processPairCreated(token0, token1, pair) {
  // Determine pair name
  const token0Contract = new ethers.Contract(token0, dexPairAbi.abi, provider);
  const token0Symbol = await token0Contract.symbol();
  const token1Contract = new ethers.Contract(token1, dexPairAbi.abi, provider);
  const token1Symbol = await token1Contract.symbol();
  const name = `${token0Symbol}-${token1Symbol} Liquigen NFT`;
  // Determine pair symbol
  const symbol = `${token0Symbol}-${token1Symbol}`;
  // TODO: Determine mint threshold. Need to calculate something based off of the pair's liquidity
  liquigenFactory.createPair(name, symbol, traitCID, description, liquigenWallet, pair, mintThreshold);
}

async function processDeposit(erc20, erc721, caller, value) {
  let mintThreshold;
  for (const { erc20address, erc721address, threshold } of pairsToWatch) {
    if (erc20address === erc20 && erc721address === erc721) {
      mintThreshold = threshold;
      break;
    }
  }
  
  if (value >= mintThreshold) {
    const liquigenPair = new ethers.Contract(erc721, liquigenPairAbi.abi, provider);
    const amount = Math.floor(value / mintThreshold);
    liquigenPair.mint(caller, amount);
  }

  console.log(`Minted ${amount} NFTs to ${caller}`);
}

async function processWithdrawal(erc20, erc721, caller, value) {
  let mintThreshold;
  for (const { erc20address, erc721address, threshold } of pairsToWatch) {
    if (erc20address === erc20 && erc721address === erc721) {
      mintThreshold = threshold;
      break;
    }
  }
  
  if (value >= mintThreshold) {
    const liquigenPair = new ethers.Contract(erc721, liquigenPairAbi.abi, provider);
    const amount = Math.floor(value / mintThreshold);
    liquigenPair.burn(caller, amount);
  }

  console.log(`Burnt ${amount} NFTs from ${caller}`);
}

async function processERC20Transfer(erc20, erc721, caller, recipient, value) {
  const liquigenPair = new ethers.Contract(erc721, liquigenPairAbi.abi, provider);
  const amount = Math.floor(value / mintThreshold);
  const ownedTokens = liquigenPair.tokensOfOwner(caller);
  // Loop through owned tokens and transfer appropriate amount to the recipient
  for (let i = 0; i < amount; i++) {
    const tokenId = ownedTokens[i];
    liquigenPair.adminTransfer(caller, recipient, tokenId);
  }
}

async function processERC20Approval(erc20, erc721, owner, spender, value) {
  if (spender === liquigenWallet) {
    const liquigenPair = new ethers.Contract(erc721, liquigenPairAbi.abi, provider);
    const ownerBalance = liquigenPair.balanceOf(owner);
    const amount = Math.floor(value / mintThreshold);

    if (amount < ownerBalance) {
      const ownedTokens = liquigenPair.tokensOfOwner(owner);
      // Loop through owned tokens and lock them
      for (let i = 0; i < ownerBalance - value; i++) {
        const tokenId = ownedTokens[i];
        liquigenPair.setLocked(tokenId, true);
      }
    }
  }
}

async function processERC721Transfer() {
  // Process transfer event
  // This really just needs to be verification, as most requirements will be handled in-contract
}

async function processERC721Approval() {
  // Process approval event
  // This really just needs to be verification, as most requirements will be handled in-contract
}

export { processPairCreated, processDeposit, processWithdrawal, processERC20Transfer, processERC721Transfer, processERC20Approval, processERC721Approval };
