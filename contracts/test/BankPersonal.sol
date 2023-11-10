// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract BankPersonal is Ownable {
    uint256 public balance;
    string public name;
    bool public initialized = false;

    constructor() payable {
        balance = msg.value;
    }

    function initalize(string memory _name) public onlyOwner {
        require(!initialized, "already initialized");
        initialized = true;
        name = _name;
    }

    function deposit() public payable onlyOwner {
        uint256 amount = msg.value;
        balance += amount;
    }

    function withdraw(uint256 amount) public onlyOwner {
        require(amount <= balance, "too much withdrawal");
        balance -= amount;

        address payable receiver = payable(msg.sender);
        // slither-disable-next-line arbitrary-send-eth, missing-zero-check
        receiver.transfer(amount);
    }
}
