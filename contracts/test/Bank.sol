// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract Bank {
    uint256 public balance;

    constructor() payable {
        balance = msg.value;
    }

    function deposit() public payable {
        uint256 amount = msg.value;
        balance += amount;
    }

    function withdraw(uint256 amount) public {
        require(amount <= balance, "too much withdrawal");
        balance -= amount;

        address payable receiver = payable(msg.sender);
        receiver.transfer(amount);
    }
}
