import { 
  provider, 
  liquigenFactory, 
  liquigenPairAbi, 
  dexPairAbi
} from './config.mjs';
import { calculateMintThreshold } from './holderQuery.mjs';
import { ethers } from 'ethers';
import { promises as fs } from 'fs';

// TODO: Set Liquigen default values. These can be updated in-contract later
const traitCID = '';
const description = 'Liquigen NFT represent liquity positions!';
// const liquigenWallet = await liquigenFactory.liquigenWallet(); // TODO: Use on-chain variable when live
const liquigenWallet = '0xF1662217851e209928A5d0C13eA8277157c06519';

async function updatePairsJson(erc20Address, erc721Address) {
  const dataPath = './data/pairs.json';
  
  try {
    let pairsData = { pairs: [] };

    try {
      const fileData = await fs.readFile(dataPath, 'utf-8');
      pairsData = JSON.parse(fileData);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error; 
      }
      console.log('pairs.json not found, creating a new one.');
    }

    // Append the new pair
    pairsData.pairs.push({
      erc20Address,
      erc721Address,
    });

    // Write the updated data back to pairs.json
    await fs.writeFile(dataPath, JSON.stringify(pairsData, null, 2), 'utf-8');
    console.log(`Successfully updated pairs.json with new pair: { erc20Address: ${erc20Address}, erc721Address: ${erc721Address} }`);
  } catch (error) {
    console.error('Error updating pairs.json:', error);
    throw error;
  }
}

async function processPairCreated(token0, token1, pair) {
  // Determine pair name
  const token0Contract = new ethers.Contract(token0, dexPairAbi.abi, provider);
  const token0Symbol = await token0Contract.symbol();
  const token1Contract = new ethers.Contract(token1, dexPairAbi.abi, provider);
  const token1Symbol = await token1Contract.symbol();
  const name = `${token0Symbol}/${token1Symbol} Liquigen NFT`;
  // Determine pair symbol
  const symbol = `${token0Symbol}/${token1Symbol}_NFT`;
  const tx = await liquigenFactory.createPair(
    name, symbol, traitCID, description, liquigenWallet, pair
  );

  const receipt = await tx.wait();

  const eventLogs = receipt.logs.map(log => {
    try {
        return liquigenFactory.interface.parseLog(log);
    } catch (error) {
        return null;
    }
  }).filter(event => event !== null);

  const event = eventLogs.find(e => e.name === "PairCreated");
  const liquigenPairAddress = event.args.liquigenPair;

  console.log(`Created Liquigen NFT pair: ${liquigenPairAddress}`);
  updatePairsJson(pair, liquigenPairAddress);
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
  let count = 0;

  for (let i = 0; i < ownedTokens.length; i++) {
    const tokenId = ownedTokens[i];
    const nft = nftValues[tokenId];

    // End loop if totalNftValue is less than value
    if (value < totalNftValue) {
      break;
    }

    await liquigenPair.burnNFT(nft);
    totalNftValue -= nft.value;
    delete nftValues[tokenId];

    count++;
  }

  console.log(`Burnt ${count} NFTs from ${caller}`);
}

async function processERC20Transfer(erc721, caller, recipient, value) {
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

  console.log(`Processed ERC20 transfer from ${caller} to ${recipient}`);
}

async function processERC20Approval(erc20, erc721, owner, spender, value) {
  if (spender === liquigenWallet) {
    const liquigenPair = new ethers.Contract(erc721, liquigenPairAbi.abi, provider);
    const ownedTokens = await liquigenPair.tokensOfOwner(owner);

    if (value === 0) {
      // Loop through owned tokens and lock them all
      for (let i = 0; i < ownerBalance - value; i++) {
        const tokenId = ownedTokens[i];
        const isLocked = await liquigenPair.locked(tokenId);
        if (!isLocked) {
          await liquigenPair.setLocked(tokenId, true);
        }
      }

      console.log(`Approval revoked from ${owner} to Liquigen Wallet. All NFTs locked.`);
    } else {
      // Calculate total value of NFTs
      let ownedTokensStatus = {};
      let totalNftValue = 0;

      for (let i = 0; i < ownedTokens.length; i++) {
        const tokenId = await liquigenPair.tokensOfOwner(owner)[i];
        const isLocked = await liquigenPair.locked(tokenId);
        const attrs = await liquigenPair.getTokenAttributes(tokenId);
        const nftValue = attrs[3];

        totalNftValue += nftValue;
        ownedTokensStatus[tokenId].locked = isLocked;
        ownedTokensStatus[tokenId].value = nftValue;
      }

      if (value >= totalNftValue) {
        // Make sure all owned tokens are unlocked
        for (let i = 0; i < ownedTokens.length; i++) {
          const tokenId = ownedTokens[i];
          const isLocked = await liquigenPair.locked(tokenId);
          if (isLocked) {
            await liquigenPair.setLocked(tokenId, false);
          }
        }

        console.log(`Processed ERC20 approval from ${owner} to Liquigen Wallet. All NFTs unlocked.`);
      } else if (value < totalNftValue) {
        // Lock NFTs until value is reached
        let count = 0;
        for (let i = 0; i < ownedTokens.length; i++) {
          const tokenId = ownedTokens[i];

          if (ownedTokensStatus[tokenId].locked) {
            await liquigenPair.setLocked(tokenId, true);
            totalNftValue -= ownedTokensStatus[tokenId].value;
          }

          count++;

          // End loop if value is greater than totalNftValue
          if (value >= totalNftValue) {
            break;
          }
        }

        console.log(`Processed ERC20 approval from ${owner} to Liquigen Wallet. ${count} NFTs locked.`);
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