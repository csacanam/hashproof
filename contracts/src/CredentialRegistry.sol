// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title CredentialRegistry
 * @notice Stores credential hashes on-chain. Only the owner (HashProof) can register.
 * @dev Verifiers can call isRegistered(hash) or read registeredAt[hash] to confirm a credential exists.
 */
contract CredentialRegistry {
    address public owner;

    /// @notice credentialHash => timestamp when registered (0 = not registered)
    mapping(bytes32 => uint256) public registeredAt;

    event CredentialRegistered(bytes32 indexed credentialHash, uint256 timestamp);

    error OnlyOwner();
    error AlreadyRegistered();

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    /**
     * @notice Register a credential hash. Only owner can call.
     * @param credentialHash SHA256 hash of the credential JSON (32 bytes, hex)
     */
    function register(bytes32 credentialHash) external onlyOwner {
        if (registeredAt[credentialHash] != 0) revert AlreadyRegistered();

        registeredAt[credentialHash] = block.timestamp;
        emit CredentialRegistered(credentialHash, block.timestamp);
    }

    /**
     * @notice Check if a credential hash is registered
     */
    function isRegistered(bytes32 credentialHash) external view returns (bool) {
        return registeredAt[credentialHash] != 0;
    }

    /**
     * @notice Get registration timestamp (0 if not registered)
     */
    function getRegisteredAt(bytes32 credentialHash) external view returns (uint256) {
        return registeredAt[credentialHash];
    }
}
