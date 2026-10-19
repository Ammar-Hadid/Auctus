-- Existing plans remain mandatory; every workout has an explicit boolean value.
ALTER TABLE workout_template ADD COLUMN mandatory INTEGER NOT NULL DEFAULT 1 CHECK(mandatory IN (0,1));
-- Historical sessions retain the requirement in effect when they started.
ALTER TABLE workout_session ADD COLUMN mandatory INTEGER NOT NULL DEFAULT 1 CHECK(mandatory IN (0,1));
