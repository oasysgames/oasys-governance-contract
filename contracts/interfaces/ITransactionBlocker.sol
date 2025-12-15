// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

/// @title ITransactionBlocker
/// @notice Interface for the TransactionBlocker contract, which manages blocked addresses and global blocking state
interface ITransactionBlocker {
    /// @notice Error thrown when a function is not implemented
    error NotImplemented();

    /// @notice Emitted when an address is added to the blocked list
    /// @param addr The address that was blocked
    event BlockedAddressAdded(address addr);

    /// @notice Emitted when an address is removed from the blocked list
    /// @param addr The address that was unblocked
    event BlockedAddressRemoved(address addr);

    /// @notice Emitted when the global blocking state is changed
    /// @param isBlockedAll The new global blocking state
    event BlockedAllSet(bool isBlockedAll);

    /// @notice Global flag indicating whether all transactions are blocked
    function isBlockedAll() external view returns (bool);

    /**
     * @notice Sets the global blocking state for all transactions
     * @param _isBlockedAll True to block all transactions, false to allow transactions (subject to address-level blocking)
     * @dev Only callable by managers
     */
    function setBlockedAll(bool _isBlockedAll) external;

    /**
     * @notice Blocks a single address from executing transactions
     * @param addr The address to block
     * @dev Only callable by managers. Reverts if address is already blocked or is the zero address.
     */
    function addBlockedList(address addr) external;

    /**
     * @notice Removes an address from the blocked list
     * @param addr The address to unblock
     * @param prev The previous address in the linked list
     *             If unspecified, traversing the linked list may cause an out-of-gas error.
     * @dev Only callable by managers. Reverts if address is not currently blocked or is the zero address.
     */
    function removeBlockedList(address addr, address prev) external;

    /**
     * @notice Checks if an address is blocked
     * @param addr The address to check
     * @return True if the address is blocked, false otherwise
     */
    function isBlockedAddress(address addr) external view returns (bool);

    /**
     * @notice Returns the list of blocked addresses
     * @param _cursor The starting address in the linked list
     *                If unspecified, starts from the top of the linked list
     * @param _howMany The maximum number of addresses to retrieve
     * @return list of blocked addresses
     */
    function listBlockedAddresses(address _cursor, uint256 _howMany) external view returns (address[] memory);
}
