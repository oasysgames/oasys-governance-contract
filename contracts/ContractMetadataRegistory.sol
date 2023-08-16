// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0 <0.9.0;

/**
 * @title ContractMetadataRegistory
 * @dev This contract is a registry of Metadata of created contracts.
 */
contract ContractMetadataRegistory {
    // Struct for metadata of created contract
    struct ContractMetadata {
        address createdAddress;
        address creator;
        string tag; // tag for created contract, we intended to set it as a contract name
    }

    /*************
     * Variables *
     *************/

    // Array with all created contract address, used for enumeration
    address[] private _allCreatedAddress;

    // Mapping from created address to ContractMetadata
    mapping(address => ContractMetadata) private _allMetadata;

    /**********
     * Events *
     **********/

    /**
     * @dev Emitted when a contract is registered.
     */
    event Registerd(address indexed creator, address createdAddress, string tag);

    /**
     * @dev register the metadata of a newly created contract.
     */
    function _registerMetadata(address createdAddress, address creator, string calldata tag) internal {
        require(_allMetadata[createdAddress].creator == address(0), "already registered");

        emit Registerd(creator, createdAddress, tag);

        _allCreatedAddress.push(createdAddress);
        _allMetadata[createdAddress] = ContractMetadata(createdAddress, creator, tag);
    }

    /**
     * @dev Returns the number of created contracts.
     */
    function totalCreatedContract() public view returns (uint256) {
        return _allCreatedAddress.length;
    }

    /**
     * @dev Returns the metadata of a created contract.
     */
    function getMetadata(address createdAddress) public view returns (ContractMetadata memory meta) {
        meta = _allMetadata[createdAddress];
        require(meta.creator != address(0), "not found");
    }

    /**
     * @dev Returns the metadata of a created contract by index.
     */
    function getMetadataByIndex(uint256 index) public view returns (ContractMetadata memory meta) {
        require(index + 1 <= totalCreatedContract(), "index out of range");
        meta = _allMetadata[_allCreatedAddress[index]];
    }
}
