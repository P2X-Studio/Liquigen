import { 
  provider, 
  liquigenFactory, 
  liquigenPairAbi, 
  dexFactory, 
  dexPairAbi, 
  pairsToWatch 
} from './config.mjs';
import fs from 'fs';
import { ethers } from 'ethers';

// Set Liquigen default values. These can be updated in-contract later
const traitCID = '';
const description = 'Liquigen NFT represent liquity positions!';
// const liquigenWallet = await liquigenFactory.liquigenWallet();
const liquigenWallet = '0xF1662217851e209928A5d0C13eA8277157c06519';

// Helper function to fetch the block number at which a contract was deployed
async function getContractDeploymentBlock(pairContract) {
  console.log(`Fetching deployment block for contract: ${pairContract}...`);

  try {
    const logs = await provider.getLogs({
      address: pairContract,
      topics: [], // No specific event topics, we just want any logs related to the contract
      fromBlock: 0,
      toBlock: 'latest',
    });

    if (logs.length > 0) {
      const transactionHash = logs[0].transactionHash;
      const receipt = await provider.getTransactionReceipt(transactionHash);
      return receipt.blockNumber;
    } else {
      console.warn(`No logs found for contract: ${pairContract}.`);
      return 0; // Fallback to block 0 if no logs are found
    }
  } catch (error) {
    console.error(`Error fetching deployment block: ${error}`);
    return 0;
  }
}

// Load existing data from JSON file
async function loadHoldersData(pairContract) {
  const holdersFilePath = `./data/eventHistory/${pairContract}-events`;
  if (fs.existsSync(holdersFilePath)) {
    console.log(`Loading holders data from ${holdersFilePath}...`);
    return JSON.parse(fs.readFileSync(holdersFilePath, 'utf8'));
  } else {
    console.log(`No existing holders data found for pair ${pairContract}, loading defaults...`);

    const tx = await provider.getCode(pairContract);
    console.log ("tx", tx);

    const deploymentBlock = await getContractDeploymentBlock(pairContract);
    console.log(`Pair contract ${pairContract} deployed at block ${deploymentBlock}`);
    return { lastProcessedBlock: deploymentBlock, holders: {} };
  }
}

// Save updated data to JSON file
function saveHoldersData(data, pairContract) {
  const holdersFilePath = `./data/eventHistory/${pairContract}-events`;
  fs.writeFileSync(holdersFilePath, JSON.stringify(data, null, 2), 'utf8');
}

async function getNewTransferEvents(pairContract, startBlock, endBlock, step = 500) {
  let holders = [];

  for (let fromBlock = startBlock; fromBlock < endBlock; fromBlock += step) {
    const toBlock = Math.min(fromBlock + step - 1, endBlock);
    console.log(`Fetching events from blocks ${fromBlock} to ${toBlock}...`);
    
    try {
      const events = await pairContract.queryFilter(
        pairContract.filters.Transfer(null, null),
        fromBlock,
        toBlock
      );

      holders.push(...events);
    }
    catch (error) {
      console.error(`Error fetching events from blocks ${fromBlock} to ${toBlock}:`, error);
    }
  }
  
  console.log(`New transfer events found: ${holders.length}`);
  return holders;
}

async function getHoldersAndBalances(pairContract, holdersData) {
  console.log("Fetching holders...");

  // Fetch all Transfer events
  // const holders = await pairContract.queryFilter(pairContract.filters.Transfer(null, null));
  const startBlock = holdersData.lastProcessedBlock + 1;
  const endBlock = await provider.getBlockNumber();
  const transferEvents = await getNewTransferEvents(pairContract, startBlock, endBlock); // TODO: Update endBlock

  const uniqueHolders = new Set();

  for (const event of transferEvents) {
    const toAddress = event.args.to;
    const fromAddress = event.args.from;

    if (toAddress !== ethers.ZeroAddress) {
      uniqueHolders.add(toAddress);
    }
    if (fromAddress !== ethers.ZeroAddress) {
      uniqueHolders.add(fromAddress);
    }
  }

  // Fetch balances for each holder
  const balancePromises = Array.from(uniqueHolders).map(async (holder) => {
    const balance = await pairContract.balanceOf(holder);
    return { holder, balance };
  });

  const results = await Promise.all(balancePromises);

  // Filter out holders with a balance of zero
  // const nonZeroBalances = results.filter(({ balance }) => balance > 0n).map(({ balance }) => balance);

  // Filter out holders with a balance of zero and update the holders data
  results.forEach(({ holder, balance }) => {
    if (balance > 0n) {
      holdersData.holders[holder] = balance.toString(); // Store balance as a string
    } else {
      delete holdersData.holders[holder]; // Remove holders with zero balance
    }
  });

  console.log(`Total unique holders found with non-zero balance: ${Object.keys(holdersData.holders).length}`);

  // Update stored event data
  holdersData.lastProcessedBlock = endBlock;
  saveHoldersData(holdersData, pairContract.target);

  // return nonZeroBalances;
  return Object.values(holdersData.holders).map(balance => BigInt(balance));
}

function calculateTop80Percentile(balances) {
  console.log("Calculating 80th percentile...");

  if (balances.length === 0) {
    console.log("No balances found.");
    return 0n; // Use BigInt literal 0n
  }

  // Sort balances in descending order (BigInt comparison)
  balances.sort((a, b) => b - a);
  console.log("Sorted balances:", balances);

  // Calculate the index for the 80th percentile
  const totalHolders = balances.length;
  const targetIndex = Math.floor(totalHolders * 0.8) - 1;
  console.log(`Target index for 80th percentile: ${targetIndex}`);

  // Return the balance at the 80th percentile in WEI
  const percentileBalance = balances[targetIndex] || 0n;
  console.log(`80th percentile balance: ${percentileBalance}`);
  return percentileBalance;
}

async function calculateMintThreshold(pairAddress, holdersData) {
  console.log(`Calculating mint threshold for pair: ${pairAddress}`);
  
  const pairContract = new ethers.Contract(pairAddress, dexPairAbi.abi, provider);

  // Step 1: Fetch holders and their balances
  const balances = await getHoldersAndBalances(pairContract, holdersData);
  console.log("Balances fetched:", balances);

  // Step 2: Calculate the top 80% threshold
  const mintThreshold = calculateTop80Percentile(balances);

  console.log(`Mint threshold (80th percentile) for pair ${pairAddress}:`, mintThreshold.toString());
  return mintThreshold;
}

(async () => {
  getContractDeploymentBlock('0x293f2B2c17f8cEa4db346D87Ef5712C9dd0491EF');
  // const holdersData = await loadHoldersData('0x293f2B2c17f8cEa4db346D87Ef5712C9dd0491EF');
  // calculateMintThreshold('0x293f2B2c17f8cEa4db346D87Ef5712C9dd0491EF', holdersData);
})();


// async function processPairCreated(token0, token1, pair) {
//   // Determine pair name
//   const token0Contract = new ethers.Contract(token0, dexPairAbi.abi, provider);
//   const token0Symbol = await token0Contract.symbol();
//   const token1Contract = new ethers.Contract(token1, dexPairAbi.abi, provider);
//   const token1Symbol = await token1Contract.symbol();
//   const name = `${token0Symbol}-${token1Symbol} Liquigen NFT`;
//   // Determine pair symbol
//   const symbol = `${token0Symbol}-${token1Symbol}`;
//   // Determine mint threshold
//   const mintThreshold = await calculateMintThreshold(pair);
//   liquigenFactory.createPair(name, symbol, traitCID, description, liquigenWallet, pair, mintThreshold);
// }

// async function processDeposit(erc20, erc721, caller, value) {
//   let mintThreshold;
//   for (const { erc20address, erc721address, threshold } of pairsToWatch) {
//     if (erc20address === erc20 && erc721address === erc721) {
//       mintThreshold = threshold;
//       break;
//     }
//   }
  
//   if (value >= mintThreshold) {
//     const liquigenPair = new ethers.Contract(erc721, liquigenPairAbi.abi, provider);
//     const amount = Math.floor(value / mintThreshold);
//     liquigenPair.mint(caller, amount);
//   }

//   console.log(`Minted ${amount} NFTs to ${caller}`);
// }

// async function processWithdrawal(erc20, erc721, caller, value) {
//   let mintThreshold;
//   for (const { erc20address, erc721address, threshold } of pairsToWatch) {
//     if (erc20address === erc20 && erc721address === erc721) {
//       mintThreshold = threshold;
//       break;
//     }
//   }
  
//   if (value >= mintThreshold) {
//     const liquigenPair = new ethers.Contract(erc721, liquigenPairAbi.abi, provider);
//     const amount = Math.floor(value / mintThreshold);
//     liquigenPair.burn(caller, amount);
//   }

//   console.log(`Burnt ${amount} NFTs from ${caller}`);
// }

// async function processERC20Transfer(erc20, erc721, caller, recipient, value) {
//   const liquigenPair = new ethers.Contract(erc721, liquigenPairAbi.abi, provider);
//   const amount = Math.floor(value / mintThreshold);
//   const ownedTokens = liquigenPair.tokensOfOwner(caller);
//   // Loop through owned tokens and transfer appropriate amount to the recipient
//   for (let i = 0; i < amount; i++) {
//     const tokenId = ownedTokens[i];
//     liquigenPair.adminTransfer(caller, recipient, tokenId);
//   }
// }

// async function processERC20Approval(erc20, erc721, owner, spender, value) {
//   if (spender === liquigenWallet) {
//     const liquigenPair = new ethers.Contract(erc721, liquigenPairAbi.abi, provider);
//     const ownerBalance = liquigenPair.balanceOf(owner);
//     const amount = Math.floor(value / mintThreshold);

//     if (amount < ownerBalance) {
//       const ownedTokens = liquigenPair.tokensOfOwner(owner);
//       // Loop through owned tokens and lock them
//       for (let i = 0; i < ownerBalance - value; i++) {
//         const tokenId = ownedTokens[i];
//         liquigenPair.setLocked(tokenId, true);
//       }
//     }
//   }
// }

// async function processERC721Transfer() {
//   // Process transfer event
//   // This really just needs to be verification, as most requirements will be handled in-contract
// }

// async function processERC721Approval() {
//   // Process approval event
//   // This really just needs to be verification, as most requirements will be handled in-contract
// }

// TODO: adjust exports
// export { processPairCreated, processDeposit, processWithdrawal, processERC20Transfer, processERC721Transfer, processERC20Approval, processERC721Approval };
export default calculateMintThreshold;