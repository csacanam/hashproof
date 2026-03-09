-- Add IPFS CID column for Pinata-backed credential storage.
-- Run this on existing databases that were created before ipfs_cid was added.

alter table credentials add column if not exists ipfs_cid text;
