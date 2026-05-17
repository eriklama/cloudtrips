CREATE TABLE IF NOT EXISTS error_logs (
  id          TEXT    NOT NULL PRIMARY KEY,
  endpoint    TEXT    NOT NULL DEFAULT '',
  method      TEXT    NOT NULL DEFAULT '',
  status      INTEGER NOT NULL DEFAULT 500,
  message     TEXT    NOT NULL DEFAULT '',
  user_id     TEXT,
  ip          TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);