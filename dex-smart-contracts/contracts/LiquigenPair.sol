// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9 <0.9.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MetadataLibrary} from "./lib/OnChainMetadata.sol";
import "./LiquigenFactory.sol";
import "erc721a/contracts/extensions/ERC721AQueryable.sol";

// TODO: call lpPairContract on transfers
// TODO: call lpPairContract to verify holding before mint


contract LiquigenPair is ERC721AQueryable, Ownable {
    using MetadataLibrary for MetadataLibrary.Attribute[];

    error Unauthorized();
    error LengthMisMatch();
    error AlreadyExists();
    error InvalidTokenId();

    struct Attributes {
        string[] traitTypes;
        string[] values;
        bytes32 dna;
    }

    mapping(uint => Attributes) public attributes; // tokenId => Attributes of the ERC721s
    mapping(uint => bool) public locked; // tokenId => bool. Keeps track of the locked status of the ERC721s
    mapping(address => bool) public exempt; // Keeps track of addresses with exempt privileges
    mapping(bytes32 => bool) public uniqueness; // dna => bool. Keeps track of the uniqueness of the attributes
    mapping(uint => bool) private circulating; // tokenId => bool. Keeps track of the circulating status of the ERC721s
    mapping(address => bool) private admin; //Keeps track of addresses with admin privileges

    address public factory;
    address public lpPairContract;

    uint public requireToMint;

    bool internal initialized = false;

    string public traitCID;
    string public description;

    string internal uri = "lp-nft.xyz/nft-viewer/";

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _traitCID,
        string memory _description,
        address _initialOwner
    ) ERC721A(_name, _symbol) Ownable(_initialOwner) {
        admin[_initialOwner] = true;
        traitCID = _traitCID;
        description = _description;
    }

    // ~~~~~~~~~~~~~~~~~~~~ Modifiers ~~~~~~~~~~~~~~~~~~~~
    modifier onlyAdmin() {
        if (!admin[_msgSender()]) {
            revert Unauthorized();
        }
        _;
    }

    // ~~~~~~~~~~~~~~~~~~~~ Mint Functions ~~~~~~~~~~~~~~~~~~~~
    function mint(address _to, uint _mintAmount) external onlyAdmin {
        _safeMint(_to, _mintAmount);
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~ Setters ~~~~~~~~~~~~~~~~~~~~~~~~~
    function initialize(address _factory, address _pair, uint _requireToMint) external {
        require(!initialized, "This contract has already been initialized");
        initialized = true;
        factory = _factory;
        admin[_factory] = true;
        lpPairContract = _pair;
        admin[_pair] = true;
    }

    function setCollectionInfo(
        string calldata _traitCID,
        string calldata _description
    ) external onlyAdmin {
        traitCID = _traitCID;
        description = _description;
    }

    function setAttributes(
        uint _tokenId,
        string[] calldata _traitTypes,
        string[] calldata _values,
        bytes32 _dna
    ) external onlyAdmin {
        if (_values.length != _traitTypes.length) {
            revert LengthMisMatch();
        }
        if (uniqueness[_dna]) {
            revert AlreadyExists();
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
        uniqueness[_dna] = true;
    }

    function resetNFT(uint _tokenId) internal onlyAdmin {
        bytes32 dna = attributes[_tokenId].dna;

        uniqueness[dna] = false;
        circulating[_tokenId] = false;

        attributes[_tokenId].traitTypes = [""];
        attributes[_tokenId].values = [""];
        attributes[_tokenId].dna = 0;
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~ Getters ~~~~~~~~~~~~~~~~~~~~~~~~~
    function getTokenAttributes(
        uint tokenId
    ) external view returns (string[] memory, string[] memory, bytes32) {
        return (
            attributes[tokenId].traitTypes,
            attributes[tokenId].values,
            attributes[tokenId].dna
        );
    }

    function _startTokenId() internal view virtual override returns (uint) {
        return 1;
    }

    function tokenURI(
        uint256 _id
    ) public view override returns (string memory) {
        if (!circulating[_id]) {
            revert InvalidTokenId();
        }

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

        return
            MetadataLibrary.buildTokenURI(
                _id,
                name,
                description,
                uri,
                address(this),
                attrs
            );
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~ Admin Functions ~~~~~~~~~~~~~~~~~~~~~~~~~
    function setAdminPrivileges(address _admin, bool _state) public onlyAdmin {
        admin[_admin] = _state;
    }
}
