// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./LiquigenPair.sol";

contract LiquigenFactory {
    event PairCreated(address indexed creator, address liquigenPair);

    event NeedsMetadata(
        uint256 tokenId,
        address indexed owner,
        address indexed collection,
        uint256 rarityModifier
    );

    mapping(address => bool) public exempt; // Keeps track of addresses with exempt privileges
    mapping(address => bool) public admin; //Keeps track of addresses with admin privileges
    mapping(address => bool) public isPair; // Keeps track of all liquigen pairs

    string public imageUrl = "lp-nft.xyz/nft-viewer/";

    address public liquigenWallet;

    constructor() {
        admin[msg.sender] = true;
        liquigenWallet = msg.sender;
    }

    // ~~~~~~~~~~~~~~~~~~~~ Modifiers ~~~~~~~~~~~~~~~~~~~~
    modifier onlyAdmin() {
        if (!admin[msg.sender]) {
            revert("LiquigenFactory: UNAUTHORIZED");
        }
        _;
    }

    modifier validCollection(address _collection) {
        if (!isPair[_collection]) {
            revert("LiquigenFactory: COLLECTION_NOT_FOUND");
        }
        _;
    }

    // ~~~~~~~~~~~~~~~~~~~~ Liquigen Functions ~~~~~~~~~~~~~~~~~~~~
    function createPair(
        string calldata _name,
        string calldata _symbol,
        string calldata _traitCID,
        string calldata _description,
        address _lpPairContract
    ) external onlyAdmin returns (address) {
        bytes memory constructorArgs = abi.encode(
            _name,
            _symbol,
            _traitCID,
            _description
        );
        bytes memory bytecode = abi.encodePacked(
            type(LiquigenPair).creationCode,
            constructorArgs
        );
        bytes32 salt = keccak256(abi.encodePacked(constructorArgs));

        address liquigenPair;
        assembly {
            liquigenPair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        require(liquigenPair != address(0), "LiquigenFactory: CREATION_FAILED");
        LiquigenPair(liquigenPair).initialize(address(this), _lpPairContract);

        emit PairCreated(msg.sender, liquigenPair);
        return liquigenPair;
    }

    function generateMetadata(
        uint256 _tokenId,
        address _owner,
        address _collection,
        uint _rarityModifier
    ) external validCollection(_collection) {
        require(msg.sender == _collection, "LiquigenFactory: CALLER_NOT_AUTHORIZED");

        emit NeedsMetadata(_tokenId, _owner, _collection, _rarityModifier);
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~ Setters ~~~~~~~~~~~~~~~~~~~~~~~~~
    function updateImageUrl(
        string calldata _imageUrl
    ) external onlyAdmin {
        imageUrl = _imageUrl;
    }

    function updateExempt(
        address _address, 
        bool _exempt
    ) external onlyAdmin {
        exempt[_address] = _exempt;
    }

    function setAdminPrivileges(
        address _admin, 
        bool _state
    ) public onlyAdmin {
        if (!_state) {
            require(_admin != liquigenWallet, "Cannot remove super admin privileges");
        }
        admin[_admin] = _state;
    }

    function setPairAdminPrivileges(
        address _admin, 
        bool _state, 
        address _collection
    ) public onlyAdmin validCollection(_collection) {
        if (!_state) {
            require(_admin != liquigenWallet, "Cannot remove super admin privileges");
        }
        admin[_admin] = _state;

        LiquigenPair(_collection).setAdminPrivileges(_admin, _state);
    }

    function setLiquigenWallet(
        address _liquigenWallet
    ) external onlyAdmin {
        require(msg.sender == liquigenWallet, "LiquigenFactory: UNAUTHORIZED");
        require(_liquigenWallet != address(0), "LiquigenFactory: INVALID_ADDRESS");
        liquigenWallet = _liquigenWallet;
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~ Getters ~~~~~~~~~~~~~~~~~~~~~~~~~
    function getURI() external view returns (string memory) {
        return imageUrl;
    }

    function isExempt(
        address _address
    ) external view returns (bool) {
        return exempt[_address];
    }
}
