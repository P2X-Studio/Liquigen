// SPDX-License-Identifier: MIT
pragma solidity ^0.6.5;

interface IKimFactory {
    event PairCreated(
        address indexed token0,
        address indexed token1,
        address pair,
        address lp404,
        uint256
    );

    function owner() external view returns (address);

    function feePercentOwner() external view returns (address);

    function setStableOwner() external view returns (address);

    function feeTo() external view returns (address);

    function ownerFeeShare() external view returns (uint256);

    function referrersFeeShare(address) external view returns (uint256);

    function getPair(
        address tokenA,
        address tokenB
    ) external view returns (address pair);

    function allPairs(uint256) external view returns (address pair);

    function allPairsLength() external view returns (uint256);

    function createPair(
        address tokenA,
        address tokenB,
        string calldata _name,
        string calldata _symbol,
        string calldata _traitCID,
        string calldata _description,
        uint8 _decimals
    ) external returns (address pair);

    function setFeeTo(address) external;

    function feeInfo()
        external
        view
        returns (uint _ownerFeeShare, address _feeTo);
}
