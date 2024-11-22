import { 
  provider, 
  liquigenFactory, 
  liquigenPairAbi, 
  dexPairAbi
} from './config.mjs';
import { calculateMintThreshold } from './holderQuery.mjs';
import { ethers } from 'ethers';

// TODO: Set Liquigen default values. These can be updated in-contract later
const traitCID = '';
const description = 'Liquigen NFT represent liquity positions!';
// const liquigenWallet = await liquigenFactory.liquigenWallet(); // TODO: Use on-chain variable when live
const liquigenWallet = '0xF1662217851e209928A5d0C13eA8277157c06519';

async function processPairCreated(token0, token1, pair) {
  // Determine pair name
  const token0Contract = new ethers.Contract(token0, dexPairAbi.abi, provider);
  const token0Symbol = await token0Contract.symbol();
  const token1Contract = new ethers.Contract(token1, dexPairAbi.abi, provider);
  const token1Symbol = await token1Contract.symbol();
  const name = `${token0Symbol}/${token1Symbol} Liquigen NFT`;
  // Determine pair symbol
  const symbol = `${token0Symbol}/${token1Symbol}_NFT`;
  liquigenFactory.createPair(name, symbol, traitCID, description, liquigenWallet, pair);
  // TODO: add to pairs.json
}

async function processDeposit(erc20, erc721, caller, value) {
  // Update mintThreshold in LiquigenPair contract
  const mintThreshold = await calculateMintThreshold(erc20);
  await liquigenPair.setMintThreshold(mintThreshold);

  const liquigenPair = new ethers.Contract(erc721, liquigenPairAbi.abi, provider);

  if (value >= mintThreshold) {
    const modifier = Math.floor(value / mintThreshold);
    liquigenPair.mint(caller, modifier);
  }

  console.log(`Minted NFT to ${caller} with a rarity modifier of ${modifier}`);
}

async function processWithdrawal(erc20, erc721, caller, value) {
  // Update mintThreshold in LiquigenPair contract
  const mintThreshold = await calculateMintThreshold(erc20);
  await liquigenPair.setMintThreshold(mintThreshold);

  const liquigenPair = new ethers.Contract(erc721, liquigenPairAbi.abi, provider);
  const ownedTokens = liquigenPair.tokensOfOwner(caller);
  
  // Calculate total value of NFTs
  let totalNftValue = 0;
  let nftValues = {};
  ownedTokens.forEach((tokenId) => {
    const attrs = liquigenPair.getTokenAttributes(tokenId);
    const nftValue = attrs[3]
    totalNftValue += nftValue;
    nftValues[tokenId] = nftValue;
  });

  // Burn NFT to match initial value
  let burning = true;
  let amount = 0;
  while (burning) {
    nftValues.forEach((nft) => {
      // End while loop if totalNftValue is less than value
      if (value < totalNftValue) {
        burning = false;
      }

      // Burn NFT
      liquigenPair.burnNFT(nft);
      totalNftValue -= nft.value;
      delete nftValues[nft];

      amount++;
    });
  }

  console.log(`Burnt ${amount} NFTs from ${caller}`);
}

async function processERC20Transfer(erc20, erc721, caller, recipient, value) {
  const callerExempt = await liquigenFactory.exempt(caller);
  const recipientExempt = await liquigenFactory.exempt(recipient);

  const liquigenPair = new ethers.Contract(erc721, liquigenPairAbi.abi, provider);

  let ownedTokens, amount;

  if (recipientExempt) {
    // Lock NFT
    ownedTokens = liquigenPair.tokensOfOwner(caller);
    amount = Math.floor(value / mintThreshold);

    for (let i = 0; i < amount; i++) {
      const tokenId = ownedTokens[i];
      liquigenPair.setLocked(tokenId, true);
    }
  } else if (callerExempt) {
    // Unlock NFT
    ownedTokens = liquigenPair.tokensOfOwner(caller);
    amount = Math.floor(value / mintThreshold);

    while (amount >= ownedTokens.length) {
      for (let i = 0; i < ownedTokens.length; i++) {
        const tokenId = ownedTokens[i];
        liquigenPair.setLocked(tokenId, false);
        amount--;
      }
    }
  } else {
    // Transfer NFT
    ownedTokens = liquigenPair.tokensOfOwner(caller);
    amount = Math.floor(value / mintThreshold);

    for (let i = 0; i < amount; i++) {
      const tokenId = ownedTokens[i];
      liquigenPair.adminTransfer(caller, recipient, tokenId);
    }
  }
}

async function processERC20Approval(erc20, erc721, owner, spender, value) {
  if (spender === liquigenWallet) {
    const liquigenPair = new ethers.Contract(erc721, liquigenPairAbi.abi, provider);
    const ownedTokens = await liquigenPair.tokensOfOwner(owner);
    const totalNftValue = 0;

    // Calculate total value of NFTs
    for (let i = 0; i < ownedTokens.length; i++) {
      const tokenId = await liquigenPair.tokensOfOwner(owner)[i];
      const attrs = await liquigenPair.getTokenAttributes(tokenId);
      totalNftValue += attrs[3];
    }

    if (value < totalNftValue) {
      const ownedTokens = await liquigenPair.tokensOfOwner(owner);
      // Loop through owned tokens and lock them
      for (let i = 0; i < ownerBalance - value; i++) {
        const tokenId = ownedTokens[i];
        await liquigenPair.setLocked(tokenId, true);
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

export { 
  processPairCreated, 
  processDeposit, 
  processWithdrawal, 
  processERC20Transfer, 
  processERC721Transfer, 
  processERC20Approval, 
  processERC721Approval 
};