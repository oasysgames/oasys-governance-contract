// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0 <0.9.0;

/**
 * @title IContractMetadataRegistory
 * @dev To retreive all the metadata from different version of Factory contract, we need unified interface
 * Ref: https://eips.ethereum.org/EIPS/eip-173
 */
interface IContractMetadataRegistory {
    // Struct for metadata of created contract
    struct ContractMetadata {
        address createdAddress;
        address creator;
        string tag; // tag for created contract, we intended to set it as a contract name
    }

    function totalCreatedContract() external view returns (uint256);

    function getMetadata(address createdAddress) external view returns (ContractMetadata memory meta);
}
