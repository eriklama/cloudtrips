-- Migration 006: Extract activities from JSON blob into a proper table
--
-- Backfill note: existing activities_json data is migrated by the
-- application on first save of each trip (lazy migration), and the
-- 006_backfill script should be run via wrangler d1 execute to
-- populate historical data immediately.
--
-- activities_json is kept as a nullable column for safety during
-- the transition but is no longer written to after this migration.

CREATE TABLE IF NOT EXISTS activities (
  id          TEXT    NOT NULL,
  trip_id     TEXT    NOT NULL,
  user_id     TEXT    NOT NULL,
  type        TEXT    NOT NULL DEFAULT 'other',
  name        TEXT    NOT NULL DEFAULT '',
  location    TEXT    NOT NULL DEFAULT '',
  start_date  TEXT    NOT NULL DEFAULT '',
  end_date    TEXT    NOT NULL DEFAULT '',
  cost        REAL    NOT NULL DEFAULT 0,
  currency    TEXT    NOT NULL DEFAULT 'EUR',
  distance    REAL    NOT NULL DEFAULT 0,
  notes       TEXT    NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),

  PRIMARY KEY (id),
  FOREIGN KEY (trip_id) REFERENCES trips(id)
);

CREATE INDEX IF NOT EXISTS idx_activities_trip_id ON activities(trip_id);
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_start_date ON activities(trip_id, start_date);
