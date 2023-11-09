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
     * @dev Returns the number of created contracts.
     * if prevRegistory is set, it returns the sum of the number of created contracts of the previous version.
     */
    function totalCreatedContract() public view override returns (uint256 total) {
        total = _allCreatedAddress.length;
        if (_prevRegistoryExists()) {
            total += prevRegistory.totalCreatedContract();
        }
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
    function getMetadataByIndex(uint256 index) public view override returns (ContractMetadata memory) {
        require(index <= totalCreatedContract() - 1, "index out of range");

        if (!_prevRegistoryExists()) {
            return _allMetadata[_allCreatedAddress[index]];
        }

        uint256 prevTotal = prevRegistory.totalCreatedContract();
        if (index <= prevTotal - 1) {
            return prevRegistory.getMetadataByIndex(index);
        }

        return _allMetadata[_allCreatedAddress[index - prevTotal]];
    }

    function _prevRegistoryExists() internal view returns (bool) {
        return address(prevRegistory) != address(0);
    }

    function _getMetadata(address createdAddress) internal view returns (ContractMetadata memory meta) {
        meta = _allMetadata[createdAddress];
        if (meta.creator == address(0) && _prevRegistoryExists()) {
            meta = prevRegistory.getMetadata(createdAddress);
        }
    }
}
