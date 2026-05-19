-- Migration 012: Multi-user trip membership
-- trip_members: users who have been granted access to a trip
-- trip_invites: pending invitations sent by email

CREATE TABLE IF NOT EXISTS trip_members (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  trip_id     TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('editor')),
  invited_by  TEXT NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(trip_id, user_id)
);

CREATE TABLE IF NOT EXISTS trip_invites (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  trip_id     TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,
  invited_by  TEXT NOT NULL REFERENCES users(id),
  expires_at  TEXT NOT NULL,
  accepted_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trip_members_trip_id ON trip_members(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_user_id ON trip_members(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_invites_token_hash ON trip_invites(token_hash);
CREATE INDEX IF NOT EXISTS idx_trip_invites_trip_id ON trip_invites(trip_id);
