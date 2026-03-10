// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/CredentialRegistry.sol";

contract CredentialRegistryTest is Test {
    CredentialRegistry public registry;

    address owner = address(0x1);
    address stranger = address(0x2);

    string constant SAMPLE_CREDENTIAL_ID = "4f9a6c20-196c-4dd2-adf5-95bcad2412fb";
    string constant SAMPLE_CID = "bafkreibojmhdxbqhx6tuekyuserrcgxzmosziaycjzwawqek7blbs4w7eq";
    uint256 constant SAMPLE_ISSUED_AT = 1709900000; // fixed timestamp
    uint256 constant SAMPLE_VALID_UNTIL = 0; // no expiration

    function setUp() public {
        vm.prank(owner);
        registry = new CredentialRegistry();
    }

    function test_OwnerIsSet() public view {
        assertEq(registry.owner(), owner);
    }

    function test_InitialCountersAreZero() public view {
        assertEq(registry.totalIssued(), 0);
        assertEq(registry.totalRevoked(), 0);
    }

    function test_TotalIssuedIncrementsOnRegister() public {
        vm.startPrank(owner);
        assertEq(registry.totalIssued(), 0);
        registry.register(SAMPLE_CREDENTIAL_ID, SAMPLE_CID, SAMPLE_ISSUED_AT, SAMPLE_VALID_UNTIL);
        assertEq(registry.totalIssued(), 1);
        registry.register("other-id", SAMPLE_CID, SAMPLE_ISSUED_AT, SAMPLE_VALID_UNTIL);
        assertEq(registry.totalIssued(), 2);
        vm.stopPrank();
    }

    function test_TotalRevokedIncrementsOnRevoke() public {
        vm.startPrank(owner);
        registry.register(SAMPLE_CREDENTIAL_ID, SAMPLE_CID, SAMPLE_ISSUED_AT, SAMPLE_VALID_UNTIL);
        assertEq(registry.totalRevoked(), 0);
        registry.revoke(SAMPLE_CREDENTIAL_ID);
        assertEq(registry.totalRevoked(), 1);
        vm.stopPrank();
    }

    function test_RegisterAsOwner() public {
        vm.prank(owner);
        registry.register(SAMPLE_CREDENTIAL_ID, SAMPLE_CID, SAMPLE_ISSUED_AT, SAMPLE_VALID_UNTIL);

        assertTrue(registry.isRegistered(SAMPLE_CREDENTIAL_ID));
        (string memory cid, uint256 issuedAt, uint256 validUntil, uint256 revokedAt) =
            registry.getRecord(SAMPLE_CREDENTIAL_ID);
        assertEq(cid, SAMPLE_CID);
        assertEq(issuedAt, SAMPLE_ISSUED_AT);
        assertEq(validUntil, SAMPLE_VALID_UNTIL);
        assertEq(revokedAt, 0);
        assertTrue(registry.isValid(SAMPLE_CREDENTIAL_ID));
        assertFalse(registry.isRevoked(SAMPLE_CREDENTIAL_ID));
        assertFalse(registry.isExpired(SAMPLE_CREDENTIAL_ID));
    }

    function test_RevertWhenCredentialIdIsEmpty() public {
        vm.prank(owner);
        vm.expectRevert(CredentialRegistry.InvalidCredentialId.selector);
        registry.register("", SAMPLE_CID, SAMPLE_ISSUED_AT, SAMPLE_VALID_UNTIL);
    }

    function test_RevertWhenIssuedAtIsZero() public {
        vm.prank(owner);
        vm.expectRevert(CredentialRegistry.InvalidIssuedAt.selector);
        registry.register(SAMPLE_CREDENTIAL_ID, SAMPLE_CID, 0, SAMPLE_VALID_UNTIL);
    }

    function test_RevertWhenStrangerRegisters() public {
        vm.prank(stranger);
        vm.expectRevert(CredentialRegistry.OnlyOwner.selector);
        registry.register(SAMPLE_CREDENTIAL_ID, SAMPLE_CID, SAMPLE_ISSUED_AT, SAMPLE_VALID_UNTIL);
    }

    function test_RevertWhenAlreadyRegistered() public {
        vm.startPrank(owner);
        registry.register(SAMPLE_CREDENTIAL_ID, SAMPLE_CID, SAMPLE_ISSUED_AT, SAMPLE_VALID_UNTIL);
        vm.expectRevert(CredentialRegistry.AlreadyRegistered.selector);
        registry.register(SAMPLE_CREDENTIAL_ID, SAMPLE_CID, SAMPLE_ISSUED_AT, SAMPLE_VALID_UNTIL);
        vm.stopPrank();
    }

    function test_emitCredentialRegistered() public {
        vm.recordLogs();
        vm.prank(owner);
        registry.register(SAMPLE_CREDENTIAL_ID, SAMPLE_CID, SAMPLE_ISSUED_AT, SAMPLE_VALID_UNTIL);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1);
        assertEq(logs[0].topics[0], keccak256("CredentialRegistered(string,string,uint256,uint256)"));
    }

    function test_Revoke() public {
        vm.startPrank(owner);
        registry.register(SAMPLE_CREDENTIAL_ID, SAMPLE_CID, SAMPLE_ISSUED_AT, SAMPLE_VALID_UNTIL);
        assertTrue(registry.isValid(SAMPLE_CREDENTIAL_ID));

        vm.warp(block.timestamp + 100);
        registry.revoke(SAMPLE_CREDENTIAL_ID);

        assertTrue(registry.isRevoked(SAMPLE_CREDENTIAL_ID));
        assertFalse(registry.isValid(SAMPLE_CREDENTIAL_ID));
        (, , , uint256 revokedAt) = registry.getRecord(SAMPLE_CREDENTIAL_ID);
        assertGt(revokedAt, 0);
    }

    function test_emitCredentialRevoked() public {
        vm.startPrank(owner);
        registry.register(SAMPLE_CREDENTIAL_ID, SAMPLE_CID, SAMPLE_ISSUED_AT, SAMPLE_VALID_UNTIL);

        vm.warp(123456);
        vm.recordLogs();
        registry.revoke(SAMPLE_CREDENTIAL_ID);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1);
        assertEq(logs[0].topics[0], keccak256("CredentialRevoked(string,uint256)"));
    }

    function test_RevertWhenStrangerRevokes() public {
        vm.prank(owner);
        registry.register(SAMPLE_CREDENTIAL_ID, SAMPLE_CID, SAMPLE_ISSUED_AT, SAMPLE_VALID_UNTIL);

        vm.prank(stranger);
        vm.expectRevert(CredentialRegistry.OnlyOwner.selector);
        registry.revoke(SAMPLE_CREDENTIAL_ID);
    }

    function test_RevertWhenRevokeNotRegistered() public {
        vm.prank(owner);
        vm.expectRevert(CredentialRegistry.NotRegistered.selector);
        registry.revoke(SAMPLE_CREDENTIAL_ID);
    }

    function test_RevertWhenAlreadyRevoked() public {
        vm.startPrank(owner);
        registry.register(SAMPLE_CREDENTIAL_ID, SAMPLE_CID, SAMPLE_ISSUED_AT, SAMPLE_VALID_UNTIL);
        registry.revoke(SAMPLE_CREDENTIAL_ID);
        vm.expectRevert(CredentialRegistry.AlreadyRevoked.selector);
        registry.revoke(SAMPLE_CREDENTIAL_ID);
        vm.stopPrank();
    }

    function test_ExpiredWhenValidUntilPassed() public {
        uint256 validUntil = SAMPLE_ISSUED_AT + 86400; // 1 day
        vm.prank(owner);
        registry.register(SAMPLE_CREDENTIAL_ID, SAMPLE_CID, SAMPLE_ISSUED_AT, validUntil);

        vm.warp(validUntil + 1);
        assertTrue(registry.isExpired(SAMPLE_CREDENTIAL_ID));
        assertFalse(registry.isValid(SAMPLE_CREDENTIAL_ID));
    }

    function test_ValidUntilZeroMeansNoExpiration() public {
        vm.prank(owner);
        registry.register(SAMPLE_CREDENTIAL_ID, SAMPLE_CID, SAMPLE_ISSUED_AT, 0);

        vm.warp(block.timestamp + 365 days);
        assertFalse(registry.isExpired(SAMPLE_CREDENTIAL_ID));
        assertTrue(registry.isValid(SAMPLE_CREDENTIAL_ID));
    }

    function test_TransferOwnership() public {
        address newOwner = address(0x3);
        vm.prank(owner);
        registry.transferOwnership(newOwner);

        assertEq(registry.owner(), newOwner);
    }

    function test_RevertWhenStrangerTransfersOwnership() public {
        vm.prank(stranger);
        vm.expectRevert(CredentialRegistry.OnlyOwner.selector);
        registry.transferOwnership(address(0x3));
    }

    function test_RevertWhenTransferToZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(CredentialRegistry.InvalidOwner.selector);
        registry.transferOwnership(address(0));
    }

    function test_NewOwnerCanRegister() public {
        address newOwner = address(0x3);
        vm.prank(owner);
        registry.transferOwnership(newOwner);

        vm.prank(newOwner);
        registry.register(SAMPLE_CREDENTIAL_ID, SAMPLE_CID, SAMPLE_ISSUED_AT, SAMPLE_VALID_UNTIL);

        assertTrue(registry.isRegistered(SAMPLE_CREDENTIAL_ID));
    }

    function test_OldOwnerCannotRegisterAfterTransfer() public {
        address newOwner = address(0x3);
        vm.prank(owner);
        registry.transferOwnership(newOwner);

        vm.prank(owner);
        vm.expectRevert(CredentialRegistry.OnlyOwner.selector);
        registry.register(SAMPLE_CREDENTIAL_ID, SAMPLE_CID, SAMPLE_ISSUED_AT, SAMPLE_VALID_UNTIL);
    }
}
