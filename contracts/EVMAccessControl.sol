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
     * @dev SENTINEL is used in linked list traversal to mark the start and end.
     * Apply the `Sentinel Pattern` to internal maps to make them iterable.
     * Reference: https://andrej.hashnode.dev/sentinel-pattern
     */
    address public constant SENTINEL = address(0x1);

    /**
     * @dev linked list of addresses allowed to execute create
     * Never change the slot of this variable, as this value is directly accessed by storage key.
     */
    mapping(address => address) private _createAllowedList;

    /**
     * @dev linked list of addresses denied from calling
     * Never change the slot of this variable, as this value is directly accessed by storage key.
     */
    mapping(address => address) private _callDeniedList;

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

        // Initialize the sentinel node of the linked list.
        _createAllowedList[SENTINEL] = SENTINEL;
        _callDeniedList[SENTINEL] = SENTINEL;
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
        _add(_createAllowedList, _addr);
        emit CreateAllowed(_addr);
    }

    /**
     * @dev Removes `_addr` from the allowed create list.
     * Can only be called by an account with `MANAGER_ROLE`.
     * @param _addr The address to be removed from the allowed create list.
     * @param _prev The previous address in the linked list.
     *              If unspecified, traversing the linked list may cause an out-of-gas error.
     */
    function removeCreateAllowedList(address _addr, address _prev) external onlyRole(MANAGER_ROLE) {
        _remove(_createAllowedList, _addr, _prev);
        emit CreateDenied(_addr);
    }

    /**
     * @dev Adds `_addr` to the denied call list.
     * Can only be called by an account with `MANAGER_ROLE`.
     * @param _addr The address to be added to the denied call list.
     */
    function addCallDeniedList(address _addr) external onlyRole(MANAGER_ROLE) {
        _add(_callDeniedList, _addr);
        emit CallDenied(_addr);
    }

    /**
     * @dev Removes `_addr` from the denied call list.
     * Can only be called by an account with `MANAGER_ROLE`.
     * @param _addr The address to be removed from the denied call list.
     * @param _prev The previous address in the linked list.
     *              If unspecified, traversing the linked list may cause an out-of-gas error.
     */
    function removeCallDeniedList(address _addr, address _prev) external onlyRole(MANAGER_ROLE) {
        _remove(_callDeniedList, _addr, _prev);
        emit CallAllowed(_addr);
    }

    /**
     * @dev Returns `true` if `_addr` is in the allowed create list, otherwise returns `false`.
     * @param _addr The address to check.
     * @return bool indicating if the address is allowed to create.
     */
    function isAllowedToCreate(address _addr) external view returns (bool) {
        return _contains(_createAllowedList, _addr);
    }

    /**
     * @dev Returns `true` if `_addr` is in the denied call list, otherwise returns `false`.
     * @param _addr The address to check.
     * @return bool indicating if the address is denied.
     */
    function isDeniedToCall(address _addr) external view returns (bool) {
        return _contains(_callDeniedList, _addr);
    }

    /**
     * @dev Returns the list of addresses allowed to execute create.
     * @param _cursor The starting address in the linked list.
     *                If unspecified, starts from the top of the linked list
     * @param _howMany The maximum number of addresses to retrieve.
     * @return list of addresses allowed to execute create.
     */
    function listCreateAllowed(address _cursor, uint256 _howMany) external view returns (address[] memory) {
        return _paginate(_createAllowedList, _cursor, _howMany);
    }

    /**
     * @dev Returns the list of addresses denied from calling.
     * @param _cursor The starting address in the linked list.
     *                If unspecified, starts from the top of the linked list
     * @param _howMany The maximum number of addresses to retrieve.
     * @return list of addresses denied from calling.
     */
    function listCallDenied(address _cursor, uint256 _howMany) external view returns (address[] memory) {
        return _paginate(_callDeniedList, _cursor, _howMany);
    }

    /**
     * @dev Internal function to add an address to a linked list.
     * @param _list The linked list.
     * @param _addr The address to add.
     */
    function _add(mapping(address => address) storage _list, address _addr) private {
        require(_addr != address(0), "EAC: addr is zero");
        require(_addr != address(this), "EAC: addr is self");
        require(_addr != SENTINEL, "EAC: addr is sentinel");
        require(_list[_addr] == address(0), "EAC: already exists");

        _list[_addr] = _list[SENTINEL];
        _list[SENTINEL] = _addr;
    }

    /**
     * @dev Internal function to remove an address from a linked list.
     * @param _list The linked list.
     * @param _addr The address to remove.
     * @param _prev The previous address in the linked list.
     *              If unspecified, traversing the linked list may cause an out-of-gas error.
     */
    function _remove(mapping(address => address) storage _list, address _addr, address _prev) private {
        require(_addr != address(0), "EAC: addr is zero");
        require(_addr != SENTINEL, "EAC: addr is sentinel");
        require(_list[_addr] != address(0), "EAC: not found");

        if (_prev == address(0)) {
            _prev = _findPrev(_list, _addr);
        }
        require(_list[_prev] == _addr, "EAC: prev address does not match");

        _list[_prev] = _list[_addr];
        _list[_addr] = address(0);
    }

    /**
     * @dev Internal function to check if an address is in a linked list.
     * @param _list The linked list.
     * @param _addr The address to check.
     * @return True if the address is in the list, false otherwise.
     */
    function _contains(mapping(address => address) storage _list, address _addr) private view returns (bool) {
        return _list[_addr] != address(0);
    }

    /**
     * @dev Internal function to retrieve a list of addresses from a linked list.
     * @param _list The linked list.
     * @param _cursor The starting address in the linked list.
     *                If unspecified, starts from the top of the linked list
     * @param _howMany The maximum number of addresses to retrieve.
     * @return An array of addresses.
     */
    function _paginate(
        mapping(address => address) storage _list,
        address _cursor,
        uint256 _howMany
    ) private view returns (address[] memory) {
        if (_cursor == address(0)) {
            _cursor = SENTINEL;
        }

        address[] memory ret = new address[](_howMany);
        for (uint256 i = 0; i < _howMany; ++i) {
            _cursor = _list[_cursor];
            if (_cursor == SENTINEL) {
                break;
            }
            ret[i] = _cursor;
        }
        return ret;
    }

    /**
     * @dev Internal function to find the previous address in a linked list.
     * @param _list The linked list.
     * @param _addr The address whose previous address is to be found.
     * @return The previous address in the list.
     */
    function _findPrev(mapping(address => address) storage _list, address _addr) private view returns (address) {
        address current = SENTINEL;
        while (_list[current] != SENTINEL) {
            if (_list[current] == _addr) {
                return current;
            }
            current = _list[current];
        }
        revert("EAC: prev address not found");
    }
}
