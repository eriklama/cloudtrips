-- Migration 008: Drop activities_json column from trips
--
-- SQLite doesn't support DROP COLUMN directly in older versions.
-- D1 supports it via ALTER TABLE ... DROP COLUMN since SQLite 3.35+
-- which Cloudflare D1 supports.

ALTER TABLE trips DROP COLUMN activities_json;