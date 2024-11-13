import { provider, tokenAbi, fetchLayers } from './config.mjs';
import generateTraits from './utils/dnaGenerator.mjs';
import { ethers, Wallet } from 'ethers';

async function processEvent(contractAddress, tokenId) {
  const tokenContract = new ethers.Contract(contractAddress, tokenAbi.abi, provider);

  // Fetch traitCID from contract
  const traitCID = await tokenContract.traitCID();

  // Fetch layer structure from IPFS
  const layers = await fetchLayers(traitCID);

  let traits, dna;
  let isUnique = false;

  while (!isUnique) {
    // Generate traits and metadata
    const result = await generateTraits(layers);
    traits = { traitTypes: result.traitTypes, values: result.values, dna: result.dna };
    dna = result.dna;

    // Check uniqueness of the generated DNA
    isUnique = !(await tokenContract.uniqueness(dna));
  }

  console.log('Generated traits:', traits);

  // Setup wallet to sign the transaction
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const contractWithSigner = tokenContract.connect(signer);

  // Update contract with generated attributes
  const tx = await contractWithSigner.setAttributes(tokenId, traits.traitTypes, traits.values, traits.dna, {
    gasLimit: 3000000
  });
  const receipt = await tx.wait();
  console.log('Gas Used:', receipt.gasUsed.toString());
}

export default processEvent;
