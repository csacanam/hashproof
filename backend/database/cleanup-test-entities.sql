-- Cleanup: empty credentials, holders, contexts — start BD from zero.
-- Run in Supabase SQL Editor.
-- Note: Pinata unpinning must be done separately (no SQL for that).

TRUNCATE TABLE credentials, holders, contexts RESTART IDENTITY CASCADE;
