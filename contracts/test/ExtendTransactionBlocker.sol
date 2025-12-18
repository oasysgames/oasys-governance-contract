// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import {TransactionBlocker} from "../TransactionBlocker.sol";

contract ExtendTransactionBlocker is TransactionBlocker {
    // solhint-disable-next-line no-empty-blocks
    constructor(address[] memory admins, address[] memory managers) TransactionBlocker(admins, managers) {}

    function computeMapStorageKey(bytes32 paddedAddress, uint256 slot) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(paddedAddress, slot));
    }

    function accessMapValue(bytes32 storageKey) external view returns (bytes32) {
        bytes32 value;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            value := sload(storageKey)
        }
        return value;
    }
}
