// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0 <0.9.0;

import {IContractMetadataRegistory} from "./interfaces/IContractMetadataRegistory.sol";

/**
 * @title ContractMetadataRegistory
 * @dev This contract is a registry of Metadata of created contracts.
 * Registory refer to the previous version to return the all history of created contracts.
 */
contract ContractMetadataRegistory is IContractMetadataRegistory {
    /*************
     * Variables *
     *************/

    // Array with all created contract address, used for enumeration
    address[] private _allCreatedAddress;

    // Mapping from created address to ContractMetadata
    mapping(address => ContractMetadata) private _allMetadata;

    // Address of the previous version of the ContractMetadataRegistory
    IContractMetadataRegistory public immutable prevRegistory;

    /**********
     * Events *
     **********/

    /**
     * @dev Emitted when a contract is registered.
     */
    event Registerd(address indexed creator, address createdAddress, string tag);

    constructor(IContractMetadataRegistory _prevRegistory) {
        prevRegistory = _prevRegistory;
    }

    /**
     * @dev register the metadata of a newly created contract.
     */
    function _registerMetadata(address createdAddress, address creator, string calldata tag) internal {
        require(_getMetadata(createdAddress).creator == address(0), "already registered");

        emit Registerd(creator, createdAddress, tag);

        _allCreatedAddress.push(createdAddress);
        _allMetadata[createdAddress] = ContractMetadata(createdAddress, creator, tag);
    }

    /**
     * @dev Returns the number of created contracts including historical contracts.
     * if prevRegistory is set, it returns the sum of the number of created contracts of the previous version.
     */
    function totalCreatedContract() public view override returns (uint256 total) {
        total = totalCreatedContracFromThis();
        if (_prevRegistoryExists()) {
            total += prevRegistory.totalCreatedContract();
        }
    }

    /**
     * @dev Returns the number of created contracts via this contract only.
     */
    function totalCreatedContracFromThis() public view returns (uint256 total) {
        total = _allCreatedAddress.length;
    }

    /**
     * @dev Returns the metadata of a created contract.
     */
    function getMetadata(address createdAddress) public view override returns (ContractMetadata memory meta) {
        meta = _getMetadata(createdAddress);
        require(meta.creator != address(0), "not found");
    }

    /**
     * @dev Returns the metadata of a created contract by index.
     */
    function getMetadataByIndex(uint256 index) public view returns (ContractMetadata memory) {
        require(index <= totalCreatedContracFromThis() - 1, "index out of range");
        return _allMetadata[_allCreatedAddress[index]];
    }

    function _prevRegistoryExists() internal view returns (bool) {
        return address(prevRegistory) != address(0);
    }

    function _getMetadata(address createdAddress) internal view returns (ContractMetadata memory meta) {
        meta = _allMetadata[createdAddress];
        if (meta.creator == address(0) && _prevRegistoryExists()) {
            // try to get metadata from the previous version
            try prevRegistory.getMetadata(createdAddress) returns (ContractMetadata memory prevMeta) {
                meta = prevMeta;
            } catch Error(string memory reason) {
                // when it reverted, check the error message
                // if the error message is "not found", it means the contract is not registered in the previous version
                // don't revert in this case
                require(keccak256(bytes(reason)) == keccak256(bytes("not found")), "unexpected error");
            }
        }
    }
}
