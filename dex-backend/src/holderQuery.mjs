import { provider, dexPairAbi } from './config.mjs';
import fs from 'fs';
import { ethers } from 'ethers';

async function getHoldersAndBalances(pairContract) {
  console.log("Fetching holders with pagination...");
  
  // Fetch all holders & balances
  const uniqueHolders = {};
  let nextPageParams = {};

  while (true) {
    let response;
    if (nextPageParams.address_hash) {
      response = await fetch(`https://explorer.mode.network/api/v2/tokens/${pairContract}/holders?address_hash=${nextPageParams.address_hash}&items_count=${nextPageParams.items_count}&value=${nextPageParams.value}`);
    } else {
      response = await fetch(`https://explorer.mode.network/api/v2/tokens/${pairContract}/holders`);
    }
    const data = await response.json();

    // Add the holders from the current page to the uniqueHolders object
    for (const holder of data.items) {
      const address = holder.address.hash;
      const balance = holder.value;

      if (address !== ethers.ZeroAddress && balance > 0) {
        uniqueHolders[address] = balance;
      }
    }

    // If no more pages, break the loop
    if (data.next_page_params === null || data.items.length === 0) {
      console.log("No more holders found, ending pagination.");
      break;
    }

    nextPageParams = data.next_page_params;

    // console.log(`Fetched ${data.items.length} holders from page ${nextPageParams.items_count / 50}`);
    // console.log(nextPageParams);
  }

  console.log(`Total unique holders found with non-zero balance: ${Object.keys(uniqueHolders).length}`);

  // Return array of non-zero balances;
  return Object.values(uniqueHolders);
}

function calculateTop80Percentile(balances) {
  console.log("Calculating 80th percentile...");

  if (balances.length === 0) {
    console.log("No balances found.");
    return 0n;
  }

  // Sort balances in descending order (BigInt comparison)
  balances.sort((a, b) => b - a);
  // console.log("Sorted balances:", balances);

  // Calculate the index for the 80th percentile
  const totalHolders = balances.length;
  const targetIndex = Math.floor(totalHolders * 0.8) - 1;
  console.log(`Target index for 80th percentile: ${targetIndex}`);

  // Return the balance at the 80th percentile in WEI
  const percentileBalance = balances[targetIndex] || 0n;
  console.log(`80th percentile balance: ${percentileBalance}`);
  return percentileBalance;
}

async function calculateMintThreshold(pairAddress) {
  console.log(`Calculating mint threshold for pair: ${pairAddress}`);
  
  const pairContract = new ethers.Contract(pairAddress, dexPairAbi.abi, provider);

  // Step 1: Fetch holders and their balances
  const balances = await getHoldersAndBalances(pairAddress);
  // console.log("Balances fetched:", balances);

  // Step 2: Calculate the top 80% threshold
  const mintThreshold = calculateTop80Percentile(balances);

  console.log(`Mint threshold (80th percentile) for pair ${pairAddress}:`, mintThreshold.toString());
  return mintThreshold;
}

// (async () => {
//   calculateMintThreshold('0x293f2B2c17f8cEa4db346D87Ef5712C9dd0491EF');
// })();


export { calculateMintThreshold };