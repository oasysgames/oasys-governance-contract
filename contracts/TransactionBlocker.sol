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
    /// @notice Global flag indicating whether all transactions are blocked.
    /// @dev Slot number is `3`. Do not change. This is hardcoded in the oasys-validator side.
    bool public isBlockedAll;

    // Don't use this mapping directly. Use the `_createAllowedList` mapping from EVMAccessControl for the `_blockedList` purpose.
    // mapping(address => address) internal _blockedList;

    /**
     * @notice Constructor.
     * @param admins The addresses to be granted the `DEFAULT_ADMIN_ROLE`.
     * @param managers The addresses to be granted the `MANAGER_ROLE`.
     */
    // solhint-disable-next-line no-empty-blocks
    constructor(address[] memory admins, address[] memory managers) EVMAccessControl(admins, managers) {}

    /**
     * @notice Sets the global blocking state for all transactions.
     * @param _isBlockedAll True to block all transactions, false to allow transactions (subject to address-level blocking).
     * @dev Only callable by managers.
     */
    function setBlockedAll(bool _isBlockedAll) external virtual override onlyRole(MANAGER_ROLE) {
        isBlockedAll = _isBlockedAll;
        emit BlockedAllSet(_isBlockedAll);
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
