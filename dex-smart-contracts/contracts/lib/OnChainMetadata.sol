// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

library MetadataLibrary {
    using Strings for uint256;

    struct Attribute {
        string traitType;
        string value;
    }

    function buildTokenURI(
        uint256 tokenId,
        uint256 lpValueAtMint,
        string memory name,
        string memory description,
        string memory uri,
        address contractAddress,
        Attribute[] memory attributes
    ) public pure returns (string memory) {
        string memory tokenName = string(
            abi.encodePacked("[Liquigen] ", name, " #", tokenId.toString())
        );

        string memory imageLink = string(
            abi.encodePacked(
                uri,
                Strings.toHexString(uint256(uint160(contractAddress)), 20),
                "/",
                tokenId.toString()
            )
        );

        string memory attrStr = "[";

        for (uint i = 0; i < attributes.length; i++) {
            attrStr = string.concat(attrStr, string(abi.encodePacked(
                '{"trait_type": "', attributes[i].traitType, '", "value": "', attributes[i].value, '"}'
            )));
            i == attributes.length - 1
                ? attrStr = string.concat(attrStr, "]")
                : attrStr = string.concat(attrStr, ",");
        }

        return string(abi.encodePacked(
            "data:application/json;base64,", Base64.encode(bytes(abi.encodePacked(
                "{",
                '"name": "', tokenName, '", ',
                '"description": "', description, '", ',
                '"image": "', imageLink, '", ',
                '"LP Value": "', lpValueAtMint, '", ',
                '"attributes": ', attrStr,
                "}"
            )))
        ));
    }
}
