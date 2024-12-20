// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MetadataLibrary} from "./lib/OnChainMetadata.sol";
import "./LP404Factory.sol";
import "ERC404/contracts/ERC404.sol";

contract LP404 is Ownable, ERC404 {
    using MetadataLibrary for MetadataLibrary.Attribute[];

    error LengthMisMatch();

    struct Attributes {
        string[] traitTypes;
        string[] values;
        bytes32 dna;
    }

    mapping(uint => Attributes) public attributes; // tokenId => Attributes of the ERC721s
    mapping(bytes32 => bool) public uniqueness; // dna => bool. Keeps track of the uniqueness of the attributes
    mapping(uint => bool) private circulating; // tokenId => bool. Keeps track of the circulating status of the ERC721s
    mapping(address => bool) private admin; //Keeps track of addresses with admin privileges

    address public factory;
    address public pairContract;

    bool internal initialized = false;

    string public traitCID;
    string public description;

    string internal uri = "lp-nft.xyz/nft-viewer/";

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _traitCID,
        string memory _description,
        uint8 _decimals,
        address _initialOwner
    ) ERC404(_name, _symbol, _decimals) Ownable(_initialOwner) {
        _setERC721TransferExempt(_initialOwner, true);
        admin[_initialOwner] = true;
        traitCID = _traitCID;
        description = _description;
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~ Modifiers ~~~~~~~~~~~~~~~~~~~~~~~~~
    modifier onlyAdmin() {
        if (!admin[_msgSender()]) {
            revert Unauthorized();
        }
        _;
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~ Transfer Functions ~~~~~~~~~~~~~~~~~~~~~~~~~
    // Added check to prevent transfers from unauthorized addresses
    // I was getting an arithmetic error, where the erc20TransferFrom function was trying to subtract
    // value from the allowed variable when its value is 0, which causeed overflow.
    // See erc20TransferFrom function in ERC404.sol on line 295
    // function erc20TransferFrom(    //     address from_,
    //     address to_,
    //     uint256 value_
    // ) public virtual override returns (bool) {
    //     // Check that the operator has allowance.
    //     if (allowance[from_][msg.sender] == 0) {
    //         revert InsufficientAllowance();
    //     }

    //     return super.erc20TransferFrom(from_, to_, value_);
    // }
    // ~~~~~~~~~~~~~~~~~~~~~~~~~ Mint Functions ~~~~~~~~~~~~~~~~~~~~~~~~~
    function _retrieveOrMintERC721(address _to) internal override {
        uint256 tokenId = getNextTokenId();
        circulating[tokenId] = true;

        super._retrieveOrMintERC721(_to);

        LP404Factory(factory).generateMetadata(tokenId, _to, address(this));
    }

    function mintERC20(address to, uint256 amount) external onlyAdmin {
        _mintERC20(to, amount);
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~ Setters ~~~~~~~~~~~~~~~~~~~~~~~~~
    function initialize(address _factory, address _pair) external {
        require(!initialized, "This contract has already been initialized");
        initialized = true;
        factory = _factory;
        admin[_factory] = true;
        pairContract = _pair;
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

    function getNextTokenId() internal view returns (uint tokenId) {
        uint tokenIndex = getERC721QueueLength();

        if (tokenIndex > 0) {
            return getERC721TokensInQueue(tokenIndex - 1, 1)[0];
        } else {
            return minted + 1;
        }
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~ Admin Functions ~~~~~~~~~~~~~~~~~~~~~~~~~
    function setERC721TransferExempt(
        address account_,
        bool value_
    ) external onlyAdmin {
        _setERC721TransferExempt(account_, value_);
    }

    function setAdminPrivileges(address _admin, bool _state) public onlyAdmin {
        admin[_admin] = _state;
    }

    // Function that allows external Pair Contract to burn tokens
    function burnERC20(address _from, uint256 _value) public onlyAdmin {
        _transferERC20WithERC721(_from, address(0), _value);
    }

    function _withdrawAndStoreERC721(address _from) internal override {
        uint256 id = _owned[_from][_owned[_from].length - 1];

        resetNFT(id);

        super._withdrawAndStoreERC721(_from);
    }
}
