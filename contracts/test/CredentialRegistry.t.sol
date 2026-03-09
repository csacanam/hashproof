// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/CredentialRegistry.sol";

contract CredentialRegistryTest is Test {
    CredentialRegistry public registry;

    address owner = address(0x1);
    address stranger = address(0x2);

    bytes32 constant SAMPLE_HASH = keccak256("credential-json-sha256-hex");

    function setUp() public {
        vm.prank(owner);
        registry = new CredentialRegistry();
    }

    function test_OwnerIsSet() public view {
        assertEq(registry.owner(), owner);
    }

    function test_RegisterAsOwner() public {
        vm.prank(owner);
        registry.register(SAMPLE_HASH);

        assertTrue(registry.isRegistered(SAMPLE_HASH));
        assertGt(registry.registeredAt(SAMPLE_HASH), 0);
    }

    function test_RevertWhenStrangerRegisters() public {
        vm.prank(stranger);
        vm.expectRevert(CredentialRegistry.OnlyOwner.selector);
        registry.register(SAMPLE_HASH);
    }

    function test_RevertWhenAlreadyRegistered() public {
        vm.startPrank(owner);
        registry.register(SAMPLE_HASH);
        vm.expectRevert(CredentialRegistry.AlreadyRegistered.selector);
        registry.register(SAMPLE_HASH);
        vm.stopPrank();
    }

    function test_emitCredentialRegistered() public {
        vm.recordLogs();
        vm.prank(owner);
        registry.register(SAMPLE_HASH);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1);
        assertEq(logs[0].topics[0], keccak256("CredentialRegistered(bytes32,uint256)"));
    }
}
