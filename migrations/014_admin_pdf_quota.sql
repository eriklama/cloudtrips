-- Migration 014: Admin flag + PDF export unlimited per user

ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN pdf_exports_unlimited INTEGER NOT NULL DEFAULT 0;

-- Auto-promote existing ADMIN_EMAIL user
-- (run separately after migration if needed:
--  UPDATE users SET is_admin = 1 WHERE email = 'your@email.com';)
