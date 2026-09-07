// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Minimal local-EVM fixture. It is injected with anvil_setCode and is never deployed.
contract OpportunityToken {
    mapping(address account => uint256 balance) public balanceOf;

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient fixture balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}
