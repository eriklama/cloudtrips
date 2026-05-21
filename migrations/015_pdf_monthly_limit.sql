-- Migration 015: Replace pdf_exports_unlimited boolean with pdf_monthly_limit integer
-- 0 = unlimited, 5 = free tier (default), 100 = paid tier

ALTER TABLE users ADD COLUMN pdf_monthly_limit INTEGER NOT NULL DEFAULT 5;

-- Migrate existing unlimited users (pdf_exports_unlimited = 1) to limit 0
UPDATE users SET pdf_monthly_limit = 0 WHERE pdf_exports_unlimited = 1;
