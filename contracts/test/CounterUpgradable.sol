// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Proxy} from "@openzeppelin/contracts/proxy/Proxy.sol";

contract CounterUpgradable is Proxy {
    bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    struct AddressSlot {
        address value;
    }

    function upgradeToAndCall(address newImplementation) public {
        _setImplementation(newImplementation);
    }

    function _setImplementation(address newImplementation) private {
        if (newImplementation.code.length == 0) {
            revert("invalid implementation");
        }
        _getAddressSlot(_IMPLEMENTATION_SLOT).value = newImplementation;
    }

    function _implementation() internal view override returns (address) {
        return _getAddressSlot(_IMPLEMENTATION_SLOT).value;
    }

    function _getAddressSlot(bytes32 slot) internal pure returns (AddressSlot storage r) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            r.slot := slot
        }
    }
}
