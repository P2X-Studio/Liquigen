// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./LiquigenPair.sol";

contract LiquigenFactory {
    event PairCreated(address indexed creator, address liquigenPair);

    event NeedsMetadata(
        uint256 indexed tokenId,
        address indexed owner,
        address indexed collection
    );

    function createPair(
        string calldata _name,
        string calldata _symbol,
        string calldata _traitCID,
        string calldata _description,
        address owner
    ) external returns (address) {
        bytes memory constructorArgs = abi.encode(
            _name,
            _symbol,
            _traitCID,
            _description,
            owner
        );
        bytes memory bytecode = abi.encodePacked(
            type(LP404).creationCode,
            constructorArgs
        );
        bytes32 salt = keccak256(abi.encodePacked(constructorArgs));
        address liquigenPair;
        assembly {
            liquigenPair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        require(liquigenPair != address(0), "LiquigenFactory: CREATION_FAILED");
        emit PairCreated(owner, liquigenPair);
        return liquigenPair;
    }

    function generateMetadata(
        uint256 tokenId,
        address owner,
        address collection
    ) external {
        emit NeedsMetadata(tokenId, owner, collection);
    }
}
