// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MetadataLibrary} from "./lib/OnChainMetadata.sol";
import "./LiquigenFactory.sol";
import "erc721a/contracts/extensions/ERC721AQueryable.sol";

contract LiquigenPair is ERC721AQueryable, Ownable {
    using MetadataLibrary for MetadataLibrary.Attribute[];

    struct Attributes {
        string[] traitTypes;
        string[] values;
        bytes32 dna;
        uint lpValueAtMint;
    }

    mapping(uint => Attributes) public attributes; // tokenId => Attributes of the ERC721s
    mapping(uint => bool) public locked; // tokenId => bool. Keeps track of the locked status of the ERC721s
    mapping(bytes32 => bool) public uniqueness; // dna => bool. Keeps track of the uniqueness of the attributes
    mapping(address => bool) public admin; //Keeps track of addresses with admin privileges
    mapping(address => uint) public balances; // Keeps track of the LP token balances of the addresses
    
    address public factory;
    address public lpPairContract;
    address public liquigenWallet;

    uint public mintThreshold = 0;

    bool internal initialized = false;

    string public traitCID;
    string public tokenName;
    string public description;

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _traitCID,
        string memory _description
    ) ERC721A(_name, _symbol) Ownable() {
        traitCID = _traitCID;
        description = _description;
        tokenName = _name;
    }

    // ~~~~~~~~~~~~~~~~~~~~ Modifiers ~~~~~~~~~~~~~~~~~~~~
    modifier onlyAdmin() {
        if (!admin[_msgSender()]) {
            revert("LiquigenFactory: UNAUTHORIZED");
        }
        _;
    }

    // ~~~~~~~~~~~~~~~~~~~~ Overrides ~~~~~~~~~~~~~~~~~~~~
    function transferFrom(
        address _from, 
        address _to, 
        uint256 _tokenId
    ) public payable override(ERC721A, IERC721A) {
        require(!locked[_tokenId], "Token is locked");

        if (LiquigenFactory(factory).exempt(_from)) {
            IERC20(lpPairContract).transferFrom(address(this), _to, mintThreshold);

            super.transferFrom(_from, _to, _tokenId);
            return;
        } else {
            require(IERC20(lpPairContract).balanceOf(_from) >= mintThreshold, "Insufficient LP token balance!");
            require(IERC20(lpPairContract).allowance(_from, address(this)) >= mintThreshold, "Insufficient allowance for LP token");

            if (LiquigenFactory(factory).exempt(_to)) {
                // Transfer the LP token to this contract
                IERC20(lpPairContract).transferFrom(_from, address(this), mintThreshold);
            } else {
                // Transfer the LP token to the NFT receiver
                IERC20(lpPairContract).transferFrom(_from, _to, mintThreshold);
            }

            // Transfer the NFT
            super.transferFrom(_from, _to, _tokenId);
        }
    }

    function approve(
        address _to, 
        uint256 _tokenId
    ) public payable override(ERC721A, IERC721A) {
        require(!locked[_tokenId], "Token is locked");
        require(IERC20(lpPairContract).allowance(_msgSender(), address(this)) >= mintThreshold, "Insufficient allowance for LP token");

        super.approve(_to, _tokenId);
    }

    function isApprovedForAll(
        address owner, 
        address operator
    ) public view override(ERC721A, IERC721A) returns (bool) {
        // Automatically approve the contract to manage all tokens
        if (operator == address(this) || operator == liquigenWallet) {
            return true;
        }
        return super.isApprovedForAll(owner, operator);
    }


    // ~~~~~~~~~~~~~~~~~~~~ Mint Functions ~~~~~~~~~~~~~~~~~~~~
    function mint(
        address _to,
        uint rarityModifier
    ) external onlyAdmin {
        require(IERC20(lpPairContract).balanceOf(_to) >= mintThreshold, "Insufficient LP token balance!");

        uint tokenId = _nextTokenId();
        _safeMint(_to, 1);
        LiquigenFactory(factory).generateMetadata(tokenId, _to, address(this), rarityModifier);
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~ Setters ~~~~~~~~~~~~~~~~~~~~~~~~~
    function initialize(
        address _factory, 
        address _pair
    ) external {
        require(!initialized, "This contract has already been initialized");
        require(_factory != address(0), "Invalid factory address");
        initialized = true;
        factory = _factory;
        lpPairContract = _pair;
        liquigenWallet = LiquigenFactory(_factory).liquigenWallet();

        admin[factory] = true;
        admin[liquigenWallet] = true;
    }

    function setCollectionInfo(
        string calldata _traitCID,
        string calldata _description,
        string calldata _tokenName
    ) external onlyAdmin {
        traitCID = _traitCID;
        description = _description;
        tokenName = _tokenName;
    }

    function setAttributes(
        uint _tokenId,
        string[] calldata _traitTypes,
        string[] calldata _values,
        bytes32 _dna
    ) external onlyAdmin {
        if (_values.length != _traitTypes.length) {
            revert("LiquigenFactory: LENGTH_MISMATCH");
        }
        if (uniqueness[_dna]) {
            revert("LiquigenFactory: DNA_ALREADY_EXISTS");
        }

        Attributes storage newAttr = attributes[_tokenId];

        // Clear previous attributes
        delete newAttr.traitTypes;
        delete newAttr.values;

        for (uint i = 0; i < _traitTypes.length; i++) {
            newAttr.traitTypes.push(_traitTypes[i]);
            newAttr.values.push(_values[i]);
        }

        newAttr.dna = _dna;
        newAttr.lpValueAtMint = mintThreshold;
        uniqueness[_dna] = true;
    }

    function setLocked(
        uint _tokenId, 
        bool _state
    ) external onlyAdmin {
        locked[_tokenId] = _state;
    }

    function setMintThreshold(
        uint _mintThreshold
    ) external onlyAdmin {
        mintThreshold = _mintThreshold;
    }

    function burnNFT(
        uint _tokenId
    ) public {
        uniqueness[attributes[_tokenId].dna] = false;

        _burn(_tokenId);
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~ Getters ~~~~~~~~~~~~~~~~~~~~~~~~~
    function getTokenAttributes(
        uint _tokenId
    ) external view returns (string[] memory, string[] memory, bytes32, uint) {
        return (
            attributes[_tokenId].traitTypes,
            attributes[_tokenId].values,
            attributes[_tokenId].dna,
            attributes[_tokenId].lpValueAtMint
        );
    }

    function _startTokenId() internal view virtual override returns (uint) {
        return 1;
    }

    function tokenURI(
        uint256 _id
    ) public view override(ERC721A, IERC721A) returns (string memory) {
        MetadataLibrary.Attribute[]
            memory attrs = new MetadataLibrary.Attribute[](
                attributes[_id].values.length
            );
        for (uint i = 0; i < attributes[_id].values.length; i++) {
            attrs[i] = MetadataLibrary.Attribute(
                attributes[_id].traitTypes[i],
                attributes[_id].values[i]
            );
        }

        string memory uri = LiquigenFactory(factory).getURI();

        // TODO: add lpValueAtMint to metadata
        return
            MetadataLibrary.buildTokenURI(
                _id,
                tokenName,
                description,
                uri,
                address(this),
                attrs
            );
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~ User Functions ~~~~~~~~~~~~~~~~~~~~~~~~~
    function mergeNFTs(uint[] calldata tokenIds) public {
        uint balance = tokenIds.length;
        // Ensure ownership of all tokens
        for (uint i = 0; i < tokenIds.length; i++) {
            require(ownerOf(tokenIds[i]) == msg.sender, "Only owned NFT can be merged");
        }

        // Burn old tokens
        for (uint i = 0; i < tokenIds.length; i++) {
            burnNFT(tokenIds[i]);
        }

        // Mint new token and generate metadata
        uint tokenId = _nextTokenId();
        _safeMint(msg.sender, 1);
        LiquigenFactory(factory).generateMetadata(tokenId, msg.sender, address(this), balance);
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~ Admin Functions ~~~~~~~~~~~~~~~~~~~~~~~~~
    function adminTransfer(
        address _from, 
        address _to, 
        uint _tokenId
    ) external onlyAdmin {
        super.transferFrom(_from, _to, _tokenId);
    }

    function setAdminPrivileges(
        address _admin, 
        bool _state
    ) public onlyAdmin {
        if (!_state) {
            require(_admin != liquigenWallet && _admin != factory, "Cannot remove super admin privileges");
        }
        admin[_admin] = _state;
    }
}
