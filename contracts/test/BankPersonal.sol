// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract BankPersonal is Ownable {
    uint256 public balance;

    constructor() payable {
        balance = msg.value;
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
