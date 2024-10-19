// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9 <0.9.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MetadataLibrary} from "./lib/OnChainMetadata.sol";
import "./LiquigenFactory.sol";
import "erc721a/contracts/extensions/ERC721AQueryable.sol";

contract LiquigenPair is ERC721AQueryable, Ownable {
    using MetadataLibrary for MetadataLibrary.Attribute[];

    error Unauthorized();
    error LengthMisMatch();
    error AlreadyExists();

    struct Attributes {
        string[] traitTypes;
        string[] values;
        bytes32 dna;
    }

    mapping(uint => Attributes) public attributes; // tokenId => Attributes of the ERC721s
    mapping(uint => bool) public locked; // tokenId => bool. Keeps track of the locked status of the ERC721s
    mapping(bytes32 => bool) public uniqueness; // dna => bool. Keeps track of the uniqueness of the attributes
    mapping(address => bool) private admin; //Keeps track of addresses with admin privileges

    address public factory;
    address public lpPairContract;

    uint public mintThreshold;

    bool internal initialized = false;

    string public traitCID;
    string public tokenName;
    string public description;

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
        tokenName = _name;
    }

    // ~~~~~~~~~~~~~~~~~~~~ Modifiers ~~~~~~~~~~~~~~~~~~~~
    modifier onlyAdmin() {
        if (!admin[_msgSender()]) {
            revert Unauthorized();
        }
        _;
    }

    // ~~~~~~~~~~~~~~~~~~~~ Overrides ~~~~~~~~~~~~~~~~~~~~
    function transferFrom(address _from, address _to, uint256 _tokenId) public payable override(ERC721A, IERC721A) {
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

    function approve(address _to, uint256 _tokenId) public payable override(ERC721A, IERC721A) {
        require(!locked[_tokenId], "Token is locked");
        require(IERC20(lpPairContract).allowance(_msgSender(), address(this)) >= mintThreshold, "Insufficient allowance for LP token");

        super.approve(_to, _tokenId);
    }

    // ~~~~~~~~~~~~~~~~~~~~ Mint Functions ~~~~~~~~~~~~~~~~~~~~
    function mint(address _to, uint _mintAmount) external onlyAdmin {
        require(IERC20(lpPairContract).balanceOf(_to) >= mintThreshold, "Insufficient LP token balance!");

        _safeMint(_to, _mintAmount);
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~ Setters ~~~~~~~~~~~~~~~~~~~~~~~~~
    function initialize(address _factory, address _pair, uint _mintThreshold) external {
        require(!initialized, "This contract has already been initialized");
        initialized = true;
        factory = _factory;
        admin[_factory] = true;
        lpPairContract = _pair;
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

    // ~~~~~~~~~~~~~~~~~~~~~~~~~ Admin Functions ~~~~~~~~~~~~~~~~~~~~~~~~~
    function setAdminPrivileges(address _admin, bool _state) public onlyAdmin {
        admin[_admin] = _state;
    }
}
