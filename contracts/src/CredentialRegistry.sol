// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title CredentialRegistry
 * @notice Stores credential records on-chain. Only the owner (HashProof) can register and revoke.
 * @dev Records are keyed by credentialId (UUID string).
 *
 * Valid credential: revokedAt == 0 AND (validUntil == 0 OR block.timestamp <= validUntil)
 * Revoked: revokedAt > 0
 * Expired: validUntil > 0 AND block.timestamp > validUntil
 */
contract CredentialRegistry {
    address public owner;

    struct CredentialRecord {
        string cid;          // IPFS CID
        uint256 issuedAt;
        uint256 validUntil;  // 0 = no expiration
        uint256 revokedAt;   // 0 = not revoked
    }

    /// @notice credentialId (UUID string) => record
    mapping(string => CredentialRecord) public records;

    event CredentialRegistered(
        string credentialId,
        string cid,
        uint256 issuedAt,
        uint256 validUntil
    );
    event CredentialRevoked(string credentialId, uint256 revokedAt);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error OnlyOwner();
    error AlreadyRegistered();
    error InvalidOwner();
    error NotRegistered();
    error AlreadyRevoked();
    error InvalidCredentialId();
    error InvalidIssuedAt();

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    /**
     * @notice Register a credential. Only owner can call.
     * @param credentialId UUID string from DB (mapping key)
     * @param cid IPFS CID
     * @param issuedAt Unix timestamp when issued
     * @param validUntil Unix timestamp when it expires (0 = no expiration)
     */
    function register(
        string calldata credentialId,
        string calldata cid,
        uint256 issuedAt,
        uint256 validUntil
    ) external onlyOwner {
        if (bytes(credentialId).length == 0) revert InvalidCredentialId();
        if (issuedAt == 0) revert InvalidIssuedAt();
        if (records[credentialId].issuedAt != 0) revert AlreadyRegistered();

        records[credentialId] = CredentialRecord({
            cid: cid,
            issuedAt: issuedAt,
            validUntil: validUntil,
            revokedAt: 0
        });

        emit CredentialRegistered(
            credentialId,
            cid,
            issuedAt,
            validUntil
        );
    }

    /**
     * @notice Revoke a credential. Only owner can call.
     */
    function revoke(string calldata credentialId) external onlyOwner {
        CredentialRecord storage r = records[credentialId];
        if (r.issuedAt == 0) revert NotRegistered();
        if (r.revokedAt != 0) revert AlreadyRevoked();

        r.revokedAt = block.timestamp;
        emit CredentialRevoked(credentialId, block.timestamp);
    }

    /**
     * @notice Check if a credential is registered
     */
    function isRegistered(string calldata credentialId) external view returns (bool) {
        return records[credentialId].issuedAt != 0;
    }

    /**
     * @notice Check if credential is revoked (revokedAt > 0)
     */
    function isRevoked(string calldata credentialId) external view returns (bool) {
        return records[credentialId].revokedAt != 0;
    }

    /**
     * @notice Check if credential is expired (validUntil > 0 AND block.timestamp > validUntil)
     */
    function isExpired(string calldata credentialId) external view returns (bool) {
        CredentialRecord storage r = records[credentialId];
        return r.validUntil != 0 && block.timestamp > r.validUntil;
    }

    /**
     * @notice Check if credential is valid: not revoked AND (no expiration OR not yet expired)
     */
    function isValid(string calldata credentialId) external view returns (bool) {
        CredentialRecord storage r = records[credentialId];
        if (r.issuedAt == 0) return false;
        if (r.revokedAt != 0) return false;
        if (r.validUntil != 0 && block.timestamp > r.validUntil) return false;
        return true;
    }

    /**
     * @notice Get full record
     */
    function getRecord(string calldata credentialId)
        external
        view
        returns (
            string memory cid,
            uint256 issuedAt,
            uint256 validUntil,
            uint256 revokedAt
        )
    {
        CredentialRecord storage r = records[credentialId];
        return (r.cid, r.issuedAt, r.validUntil, r.revokedAt);
    }

    /**
     * @notice Transfer ownership to a new address.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidOwner();

        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }
}
