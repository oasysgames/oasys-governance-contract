// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title EVMAccessControl
 * @dev System contract that manages access control for EVM operations.
 * - create: only allowed addresses can execute
 * - call: specific addresses are denied from calling
 */
contract EVMAccessControl is AccessControl {
    /*************
     * Variables *
     *************/

    /// @notice Semantic version.
    string private constant _VERSION = "1.0.0";

    /// @dev keccak256 hash of "CREATOR_ROLE" is the role identifier
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /**
     * @dev list of addresses allowed to execute create
     * Never change the slot of this variable, as this value is directly accessed by storage key.
     */
    mapping(address => bool) private _createAllowedList;

    /**
     * @dev list of addresses denied from calling
     * Never change the slot of this variable, as this value is directly accessed by storage key.
     */
    mapping(address => bool) private _callDeniedList;

    /**
     * @dev list of addresses allowed to execute create
     * This order is not guaranteed to be the same as the order in which the addresses were added.
     */
    address[] private _createAllowedListKeys;

    /**
     * @dev list of addresses denied from calling
     * This order is not guaranteed to be the same as the order in which the addresses were added.
     */
    address[] private _callDeniedListKeys;

    /**********
     * Events *
     **********/

    /// @dev Emitted when an address is added to the allowed create list.
    event CreateAllowed(address indexed addr);

    /// @dev Emitted when an address is removed from the allowed create list.
    event CreateDenied(address indexed addr);

    /// @dev Emitted when an address is added to the denied call list.
    event CallDenied(address indexed addr);

    /// @dev Emitted when an address is removed from the denied call list.
    event CallAllowed(address indexed addr);

    /**
     * @dev Initialize the contract with the given `admins` and `managers`.
     * @param admins The addresses to be granted the `DEFAULT_ADMIN_ROLE`.
     * @param managers The addresses to be granted the `MANAGER_ROLE`.
     */
    constructor(address[] memory admins, address[] memory managers) {
        for (uint256 i = 0; i < admins.length; ++i) {
            require(admins[i] != address(0), "EAC: admin is zero");
            _setupRole(DEFAULT_ADMIN_ROLE, admins[i]);
        }
        for (uint256 i = 0; i < managers.length; ++i) {
            require(managers[i] != address(0), "EAC: creator is zero");
            _setupRole(MANAGER_ROLE, managers[i]);
        }
    }

    /**
     * @dev returns the semantic version.
     */
    function version() external pure returns (string memory) {
        return _VERSION;
    }

    /**
     * @dev Adds `_addr` to the allowed create list.
     * Can only be called by an account with `MANAGER_ROLE`.
     * @param _addr The address to be added to the allowed create list.
     */
    function addCreateAllowedList(address _addr) external onlyRole(MANAGER_ROLE) {
        require(_addr != address(0), "EAC: addr is zero");
        require(!_createAllowedList[_addr], "EAC: already allowed");

        _createAllowedList[_addr] = true;
        _addAddressToArray(_createAllowedListKeys, _addr);
        emit CreateAllowed(_addr);
    }

    /**
     * @dev Removes `_addr` from the allowed create list.
     * Can only be called by an account with `MANAGER_ROLE`.
     * @param _addr The address to be removed from the allowed create list.
     */
    function removeCreateAllowedList(address _addr) external onlyRole(MANAGER_ROLE) {
        require(_addr != address(0), "EAC: addr is zero");
        require(_createAllowedList[_addr], "EAC: not allowed");

        delete _createAllowedList[_addr];
        _removeAddressFromArray(_createAllowedListKeys, _addr);
        emit CreateDenied(_addr);
    }

    /**
     * @dev Adds `_addr` to the denied call list.
     * Can only be called by an account with `MANAGER_ROLE`.
     * @param _addr The address to be added to the denied call list.
     */
    function addCallDeniedList(address _addr) external onlyRole(MANAGER_ROLE) {
        require(_addr != address(0), "EAC: addr is zero");
        require(!_callDeniedList[_addr], "EAC: already denied");

        _callDeniedList[_addr] = true;
        _addAddressToArray(_callDeniedListKeys, _addr);
        emit CallDenied(_addr);
    }

    /**
     * @dev Removes `_addr` from the denied call list.
     * Can only be called by an account with `MANAGER_ROLE`.
     * @param _addr The address to be removed from the denied call list.
     */
    function removeCallDeniedList(address _addr) external onlyRole(MANAGER_ROLE) {
        require(_addr != address(0), "EAC: addr is zero");
        require(_callDeniedList[_addr], "EAC: not denied");

        delete _callDeniedList[_addr];
        _removeAddressFromArray(_callDeniedListKeys, _addr);
        emit CallAllowed(_addr);
    }

    /**
     * @dev Returns `true` if `_addr` is in the allowed create list, otherwise returns `false`.
     * @param _addr The address to check.
     * @return bool indicating if the address is allowed to create.
     */
    function isAllowedToCreate(address _addr) external view returns (bool) {
        return _createAllowedList[_addr];
    }

    /**
     * @dev Returns `true` if `_addr` is in the denied call list, otherwise returns `false`.
     * @param _addr The address to check.
     * @return bool indicating if the address is denied.
     */
    function isDeniedToCall(address _addr) external view returns (bool) {
        return _callDeniedList[_addr];
    }

    /**
     * @dev Returns the list of addresses allowed to execute create.
     * Empty addresses means the slot is empty.
     * @return list of addresses allowed to execute create.
     */
    function listCreateAllowed() external view returns (address[] memory) {
        return _listSkippingEmpty(_createAllowedListKeys);
    }

    /**
     * @dev Returns the list of addresses denied from calling.
     * Empty addresses means the slot is empty.
     * @return list of addresses denied from calling.
     */
    function listCallDenied() external view returns (address[] memory) {
        return _listSkippingEmpty(_callDeniedListKeys);
    }

    /**
     * @dev Internal function to add an address to the array.
     * @param array The array to add the address.
     * @param _addr The address to be added.
     */
    function _addAddressToArray(address[] storage array, address _addr) private {
        // find empty index
        (bool found, uint256 index) = _findFirstIndex(array, address(0));
        if (found) {
            array[index] = _addr;
        } else {
            array.push(_addr);
        }
    }

    /**
     * @dev Internal function to remove an address from the array.
     * @param array The array to remove the address.
     * @param _addr The address to be removed.
     */
    function _removeAddressFromArray(address[] storage array, address _addr) private {
        // find the index of the address
        (bool found, uint256 index) = _findFirstIndex(array, _addr);
        if (found) {
            // set the address to zero
            array[index] = address(0);
        } else {
            revert("EAC: index not found");
        }
    }

    /**
     * @dev Internal function to find the first index of the address in the array.
     * @param array The array to find the address.
     * @param _addr The address to find.
     * @return bool indicating if the address is found, uint256 index of the address.
     */
    function _findFirstIndex(address[] storage array, address _addr) private view returns (bool, uint256) {
        for (uint256 i = 0; i < array.length; ++i) {
            if (array[i] == _addr) {
                return (true, i);
            }
        }
        return (false, type(uint256).max);
    }

    /**
     * @dev Internal function to list the addresses in the array skipping empty addresses.
     * @param array The array to list the addresses.
     * @return list of addresses.
     */
    function _listSkippingEmpty(address[] storage array) private view returns (address[] memory) {
        address[] memory list = new address[](array.length);
        uint256 listIndex = 0;
        for (uint256 i = 0; i < array.length; ++i) {
            if (array[i] == address(0)) {
                continue;
            }
            list[listIndex] = array[i];
            ++listIndex;
        }
        return list;
    }
}
