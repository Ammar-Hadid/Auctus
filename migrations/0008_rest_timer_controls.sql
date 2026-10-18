ALTER TABLE rest_period ADD COLUMN added_ms INTEGER NOT NULL DEFAULT 0 CHECK(added_ms>=0);
ALTER TABLE rest_period ADD COLUMN timer_paused_at INTEGER;
ALTER TABLE rest_period ADD COLUMN timer_paused_ms INTEGER NOT NULL DEFAULT 0 CHECK(timer_paused_ms>=0);
