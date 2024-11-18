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
  const name = `${token0Symbol}-${token1Symbol} Liquigen NFT`;
  // Determine pair symbol
  const symbol = `${token0Symbol}-${token1Symbol}`;
  // Determine mint threshold
  liquigenFactory.createPair(name, symbol, traitCID, description, liquigenWallet, pair);
}

async function processDeposit(erc20, erc721, caller, value) {
  const mintThreshold = await calculateMintThreshold(erc20);
  const liquigenPair = new ethers.Contract(erc721, liquigenPairAbi.abi, provider);

  if (value >= mintThreshold) {
    const modifier = Math.floor(value / mintThreshold);
    liquigenPair.mint(caller, modifier);
  }

  liquigenPair.setMintThreshold(mintThreshold);

  console.log(`Minted ${amount} NFTs to ${caller}`);
}

async function processWithdrawal(erc20, erc721, caller, value) {
  const liquigenPair = new ethers.Contract(erc721, liquigenPairAbi.abi, provider);
  const ownedTokens = liquigenPair.tokensOfOwner(caller);
  
  // Calculate total value of NFTs
  let totalNftValue = 0;
  let nftValues = {};
  ownedTokens.forEach((token) => {
    const attrs = liquigenPair.getTokenAttributes(token);
    const nftValue = attrs[3]
    totalNftValue += nftValue;
    nftValues[token] = nftValue;
  });

  // Burn NFT to match initial value
  let burning = true;
  let amount = 0;
  while (burning) {
    nftValues.forEach((nft) => {
      liquigenPair.burnNFT(nft);
      totalNftValue -= nft.value;
      delete nftValues[nft];

      if (value < totalNftValue) {
        burning = false;
      }
    });
  }

  liquigenPair.setMintThreshold(mintThreshold);

  console.log(`Burnt ${amount} NFTs from ${caller}`);
}

async function processERC20Transfer(erc20, erc721, caller, recipient, value) {
  // TODO: factor in exempt addresses.
  // TODO: udpate mintthreshold when called 
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

export { 
  processPairCreated, 
  processDeposit, 
  processWithdrawal, 
  processERC20Transfer, 
  processERC721Transfer, 
  processERC20Approval, 
  processERC721Approval 
};