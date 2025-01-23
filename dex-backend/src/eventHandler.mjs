import { 
  provider, 
  liquigenWallet, 
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
    console.log(`Successfully added new pair: { erc20Address: ${erc20Address}, erc721Address: ${erc721Address} }`);
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
    name, symbol, traitCID, description, pair
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
  await updatePairsJson(pair, liquigenPairAddress);

  return liquigenPairAddress;
}

async function processDepositSIMPLE(erc20, erc721, caller, value) {
  // Update mintThreshold in LiquigenPair contract
  const mintThreshold = await calculateMintThreshold(erc20);
  await liquigenPair.setMintThreshold(mintThreshold);

  const liquigenPair = new ethers.Contract(erc721, liquigenPairAbi.abi, liquigenWallet);

  if (value >= mintThreshold) {
    const modifier = Math.floor(value / mintThreshold);
    liquigenPair.mint(caller, modifier);
  }
  console.log(`Minted NFT to ${caller} with a rarity modifier of ${modifier}`);
}

async function processDeposit(erc20, erc721, caller, value) {
  const dataPath = './data/depositTracker.json';

  // Load depositTracker.json or initialize a new tracker
  let depositTracker = { unprocessedDeposits: {} };
  try {
    const fileData = await fs.readFile(dataPath, 'utf-8');
    depositTracker = JSON.parse(fileData);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error; // Rethrow unexpected errors
    }
    console.log('depositTracker.json not found, creating a new one.');
  }

  let callerMinted = false;

  // Initialize unprocessedDeposits for the erc20 and caller if missing
  if (!depositTracker.unprocessedDeposits[erc20]) {
    depositTracker.unprocessedDeposits[erc20] = {};
  }

  if (!depositTracker.unprocessedDeposits[erc20][caller]) {
    depositTracker.unprocessedDeposits[erc20][caller] = 0;
  } else {
    callerMinted = true;
  }

  // Calculate total deposit
  const callerUnprocessedBalance = BigInt(depositTracker.unprocessedDeposits[erc20][caller]);
  console.log('types: ', typeof callerUnprocessedBalance, typeof value);
  const totalDeposit = callerUnprocessedBalance + BigInt(value);

  // Mint NFTs if totalDeposit meets or exceeds mintThreshold
  const liquigenPair = new ethers.Contract(erc721, liquigenPairAbi.abi, liquigenWallet);
  const mintThreshold = await calculateMintThreshold(erc20);
  await liquigenPair.setMintThreshold(mintThreshold);

  if (totalDeposit >= mintThreshold) {
    let modifier = 1;
    let leftoverBalance = 0;

    if (mintThreshold === 0) {
      // Use default values
    } else if (mintThreshold === 999) {
      // Mint NFT with a modifier of 3 for the first 10 liquidity providers
      console.log(callerMinted);
      modifier = 3;
    } else {
      modifier = Math.floor(Number(totalDeposit / mintThreshold));
      leftoverBalance = Number(totalDeposit % mintThreshold);
    }

    // const modifier = mintThreshold === 0 ? 1 : Number(totalDeposit / mintThreshold);
    // const leftoverBalance = mintThreshold === 0 ? 0 : totalDeposit % mintThreshold;

    // Mint NFT
    await liquigenPair.mint(caller, modifier);
    console.log(`Minted NFT to ${caller} with a rarity modifier of ${modifier}`);

    // Update the caller's unprocessed balance with the leftover
    depositTracker.unprocessedDeposits[erc20][caller] = Number(leftoverBalance);
  } else {
    // Update the caller's unprocessed balance without minting
    depositTracker.unprocessedDeposits[erc20][caller] = Number(totalDeposit);
  }

  // Save updated depositTracker
  try {
    await fs.writeFile(dataPath, JSON.stringify(depositTracker, null, 2), 'utf-8');
    console.log(`Successfully updated depositTracker.json`);
  } catch (error) {
    console.error('Error updating depositTracker.json:', error);
    throw error;
  }
}

async function processWithdrawal(erc20, erc721, caller, value) {
  /* RICKY: TODO: 
  This logic needs to be adjusted. As it stands, it's still calculating a
  NUMBER of NFT to burn based on mintthreshold. This is incorrect. We need to
  extract the valueAtMint (rarity modifier) and burn the appropriate amount
  based on value. 
  We also need to account for partial withdraws and what that may mean for remainder
  For example, if someone withdraws 90% of their liquidity, it may burn all their NFT.
  It's possible that the 10% they have left meets the mintThreshold, so this amount should
  be added to their unprocessed balance, and a new NFT minted if it meets the threshold.

  */

  // Update mintThreshold in LiquigenPair contract
  const mintThreshold = await calculateMintThreshold(erc20);
  await liquigenPair.setMintThreshold(mintThreshold);

  const liquigenPair = new ethers.Contract(erc721, liquigenPairAbi.abi, liquigenWallet);
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

  const liquigenPair = new ethers.Contract(erc721, liquigenPairAbi.abi, liquigenWallet);

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
  if (spender === liquigenWallet.address) {
    const liquigenPair = new ethers.Contract(erc721, liquigenPairAbi.abi, liquigenWallet);
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