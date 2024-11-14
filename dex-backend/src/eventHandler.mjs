import { 
  provider, 
  liquigenFactory, 
  liquigenPairAbi, 
  dexFactory, 
  dexPairAbi, 
  ERC20PairsToWatch 
} from './config.mjs';
import { ethers, Wallet } from 'ethers';

// Set Liquigen default values. These can be updated in-contract later
const traitCID = '';
const description = 'Liquigen NFT represent liquity positions!';
const liquigenWallet = '';

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

async function processDeposit() {
  // Process deposit event
}

async function processWithdrawal() {
  // Process withdrawal event
}

async function processERC20Transfer() {
  // Process transfer event
}

async function processERC20Approval() {
  // Process approval event
}

async function processERC721Approval() {
  // Process approval event
  // This really just needs to be verification, as most requirements will be handled in-contract
}

async function processERC721Transfer() {
  // Process transfer event
  // This really just needs to be verification, as most requirements will be handled in-contract
}

// async function processEvent(contractAddress, tokenId) {
//   const tokenContract = new ethers.Contract(contractAddress, tokenAbi.abi, provider);

//   // Fetch traitCID from contract
//   const traitCID = await tokenContract.traitCID();

//   // Fetch layer structure from IPFS
//   const layers = await fetchLayers(traitCID);

//   let traits, dna;
//   let isUnique = false;

//   while (!isUnique) {
//     // Generate traits and metadata
//     const result = await generateTraits(layers);
//     traits = { traitTypes: result.traitTypes, values: result.values, dna: result.dna };
//     dna = result.dna;

//     // Check uniqueness of the generated DNA
//     isUnique = !(await tokenContract.uniqueness(dna));
//   }

//   console.log('Generated traits:', traits);

//   // Setup wallet to sign the transaction
//   const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
//   const contractWithSigner = tokenContract.connect(signer);

//   // Update contract with generated attributes
//   const tx = await contractWithSigner.setAttributes(tokenId, traits.traitTypes, traits.values, traits.dna, {
//     gasLimit: 3000000
//   });
//   const receipt = await tx.wait();
//   console.log('Gas Used:', receipt.gasUsed.toString());
// }

export { processPairCreated, processDeposit, processWithdrawal, processERC20Transfer, processERC721Transfer, processERC20Approval, processERC721Approval };
