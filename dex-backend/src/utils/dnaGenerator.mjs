import { ethers } from 'ethers';
import sha1 from 'sha1';

const rarityDelimiter = '#';

const rarity_config = {
  Mythic: 1,
  Legendary: 6,
  Epic: 15,
  Rare: 31,
  Uncommon: 56,
  Common: 100,
};

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

const cleanName = (_str) => {
  let nameWithoutLayer = _str.split('_').pop();
  let nameWithoutExtension = nameWithoutLayer.slice(0, -4);
  let nameWithoutWeight = nameWithoutExtension.split(rarityDelimiter).shift();
  return nameWithoutWeight;
};

const getRarityWeight = (_str) => {
  let weight = capitalizeFirstLetter(_str.slice(0, -4).split(rarityDelimiter).pop());
  if (isNaN(weight)) {
    // Ensure non-number weights appropriately adhere to rarity_config
    if (!rarity_config[weight]) {
      throw new Error(
        `'${weight}' contained in ${_str} is not a valid rarity.` +
        ` Please ensure your weights adhere to rarity_config.`
      );
    }
    let rarity = Object.keys(rarity_config);
    for (let i = 0; i < rarity.length; i++) {
      if (rarity[i] == weight && i == 0) {
        var finalWeight = rarity_config[weight];
      } else if (rarity[i] == weight) {
        let min = rarity_config[rarity[i - 1]];
        let max = rarity_config[rarity[i]];
        var finalWeight = Math.floor(Math.random() * (max - min) + min);
      }
    }
  } else {
    var finalWeight = weight;
  }
  return Number(finalWeight);
};

const getElements = (layer) => {
  return layer.map((i, index) => {
    if (i.includes('-')) {
      throw new Error(`Layer name cannot contain dashes, please fix: ${i}`);
    }
    return {
      id: index,
      name: cleanName(i),
      filename: i,
      weight: getRarityWeight(i),
    };
  });
};

async function generateTraits(layers) {
  const traitTypes = [];
  const values = [];
  const randNum = [];

  const layerNames = Object.keys(layers);

  for (const layer of layerNames) {
    const elements = getElements(layers[layer]);

    let totalWeight = 0;
    elements.forEach((element) => {
      totalWeight += element.weight;
    });

    let random = Math.floor(Math.random() * totalWeight);
    for (let i = 0; i < elements.length; i++) {
      random -= elements[i].weight;
      if (random < 0) {
        traitTypes.push(layer);
        values.push(elements[i].name);
        randNum.push(`${elements[i].id}:${elements[i].filename}`);
        break;
      }
    }
  }

  const dna = ethers.hexlify(ethers.zeroPadValue(ethers.getBytes(`0x${sha1(`${randNum.join('-')}`)}`), 32));

  // console.log({ traitTypes, values, dna });

  return { traitTypes, values, dna };
}

export default generateTraits;
