// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0 <0.9.0;

/**
 * @title IOwnable
 * @dev Same interface as eip-173 and Openzeppelin Ownable.
 * Ref: https://eips.ethereum.org/EIPS/eip-173
 */
interface IOwnable {
    function owner() external view returns (address);

    function renounceOwnership() external;

    function transferOwnership(address newOwner) external;
}
