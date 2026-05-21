-- Migration 013: Email verification
-- Add email_verified_at to users table
-- Existing users are auto-verified (set to created_at so it's meaningful)

ALTER TABLE users ADD COLUMN email_verified_at TEXT;

UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL;

-- Verification tokens table
CREATE TABLE IF NOT EXISTS email_verifications (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_token_hash ON email_verifications(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON email_verifications(user_id);
