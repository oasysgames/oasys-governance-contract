// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import {ITransactionBlocker} from "./interfaces/ITransactionBlocker.sol";
import {EVMAccessControl} from "./EVMAccessControl.sol";

/**
 * @title TransactionBlocker
 * @dev Contract that manages blocked addresses and global blocking state.
 * This contract overrides the `EVMAccessControl` contract to skip contract audit.
 * To minimize changes, reuse the code from EVMAccessControl as much as possible.
 */
contract TransactionBlocker is ITransactionBlocker, EVMAccessControl {
    // Don't use this mapping directly. Use the `_createAllowedList` mapping from EVMAccessControl for the `_blockedList` purpose.
    // mapping(address => address) internal _blockedList;

    // Do not use this variable. Use the `_callDeniedList` mapping from EVMAccessControl for the `isBlockedAll` purpose.
    // bool public isBlockedAll;

    /// @notice The address that represents all transactions are blocked.
    /// @dev This address is 0xffffffffffffffffffffffffffffffffffffffff.
    address public constant BLOCKED_ALL_ADDRESS = address(type(uint160).max);

    /**
     * @notice Constructor.
     * @param admins The addresses to be granted the `DEFAULT_ADMIN_ROLE`.
     * @param managers The addresses to be granted the `MANAGER_ROLE`.
     */
    // solhint-disable-next-line no-empty-blocks
    constructor(address[] memory admins, address[] memory managers) EVMAccessControl(admins, managers) {}

    /**
     * @notice Grants a role to an account.
     * @param role The role to grant.
     * @param account The account to grant the role to.
     * @dev For the purpose of keeping the oasys-validator side simple, the manager must be an EOA.
     *      To ensure this restriction is not overlooked, we enforce it directly in the code.
     */
    function grantRole(bytes32 role, address account) public override {
        // Restrict the manager role to EOAs only
        if (role == MANAGER_ROLE && !_isEOA(account)) {
            revert("not EOA for manager role");
        }
        super.grantRole(role, account);
    }

    /**
     * @notice Adds an address to the blocked list.
     * @param addr The address to block.
     * @dev Only callable by managers.
     */
    function addBlockedList(address addr) external virtual override onlyRole(MANAGER_ROLE) {
        _add(_createAllowedList, addr);
        emit BlockedAddressAdded(addr);
    }

    /**
     * @notice Removes an address from the blocked list.
     * @param addr The address to unblock.
     * @param prev The previous address in the linked list.
     * @dev Only callable by managers.
     */
    function removeBlockedList(address addr, address prev) external virtual override onlyRole(MANAGER_ROLE) {
        _remove(_createAllowedList, addr, prev);
        emit BlockedAddressRemoved(addr);
    }

    /**
     * @notice Sets the global blocking state for all transactions.
     * @param _isBlockedAll True to block all transactions, false to allow transactions (subject to address-level blocking).
     * @dev Only callable by managers.
     * @dev The `isBlockedAll` flag is expressed by the `_callDeniedList` mapping.
     *      If the `BLOCKED_ALL_ADDRESS` is in the `_callDeniedList` mapping, then all transactions are blocked.
     */
    function setBlockedAll(bool _isBlockedAll) external virtual override onlyRole(MANAGER_ROLE) {
        if (_isBlockedAll) {
            _add(_callDeniedList, BLOCKED_ALL_ADDRESS);
        } else {
            _remove(_callDeniedList, BLOCKED_ALL_ADDRESS, SENTINEL);
        }
        emit BlockedAllSet(_isBlockedAll);
    }

    /**
     * @notice Checks if an address is blocked.
     * @param addr The address to check.
     * @return True if the address is blocked, false otherwise.
     */
    function isBlockedAddress(address addr) external view virtual override returns (bool) {
        return _contains(_createAllowedList, addr);
    }

    /**
     * @notice Returns the list of blocked addresses.
     * @param _cursor The starting address in the linked list.
     * @param _howMany The maximum number of addresses to retrieve.
     * @return The list of blocked addresses.
     */
    function listBlockedAddresses(
        address _cursor,
        uint256 _howMany
    ) external view virtual override returns (address[] memory) {
        return _paginate(_createAllowedList, _cursor, _howMany);
    }

    /**
     * @notice Checks if all transactions are blocked.
     * @return True if all transactions are blocked, false otherwise.
     */
    function isBlockedAll() external view virtual override returns (bool) {
        return _contains(_callDeniedList, BLOCKED_ALL_ADDRESS);
    }

    /**
     * @notice Checks if an address is an EOA.
     * @param account The address to check.
     * @return True if the address is an EOA, false otherwise.
     */
    function _isEOA(address account) internal view returns (bool) {
        return account.code.length == 0;
    }

    /***************************************************************
     * Overrides from the EVMAccessControl contract. Then,
     * revert with NotImplemented() to prevent misuse.
     ***************************************************************/

    function addCreateAllowedList(address /* _addr */) external pure override {
        revert NotImplemented();
    }

    function removeCreateAllowedList(address /* _addr */, address /* _prev */) external pure override {
        revert NotImplemented();
    }

    function addCallDeniedList(address /* _addr */) external pure override {
        revert NotImplemented();
    }

    function removeCallDeniedList(address /* _addr */, address /* _prev */) external pure override {
        revert NotImplemented();
    }

    function isAllowedToCreate(address /* _addr */) external pure override returns (bool) {
        revert NotImplemented();
    }

    function isDeniedToCall(address /* _addr */) external pure override returns (bool) {
        revert NotImplemented();
    }

    function listCreateAllowed(
        address /* _cursor */,
        uint256 /* _howMany */
    ) external pure override returns (address[] memory) {
        revert NotImplemented();
    }

    function listCallDenied(
        address /* _cursor */,
        uint256 /* _howMany */
    ) external pure override returns (address[] memory) {
        revert NotImplemented();
    }
}
