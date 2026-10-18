-- An existing exact target becomes an equal minimum and maximum.
ALTER TABLE template_set RENAME COLUMN target_reps TO min_reps;
ALTER TABLE template_set ADD COLUMN max_reps INTEGER NOT NULL DEFAULT 1000
  CHECK(max_reps BETWEEN 0 AND 1000 AND max_reps >= min_reps);
UPDATE template_set SET max_reps=min_reps;

ALTER TABLE set_session RENAME COLUMN target_reps TO min_reps;
ALTER TABLE set_session ADD COLUMN max_reps INTEGER NOT NULL DEFAULT 1000
  CHECK(max_reps BETWEEN 0 AND 1000 AND max_reps >= min_reps);
UPDATE set_session SET max_reps=min_reps;
