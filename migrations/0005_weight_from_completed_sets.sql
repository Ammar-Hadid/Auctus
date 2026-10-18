-- Template prescriptions now contain type, reps and rest only.
ALTER TABLE template_set DROP COLUMN target_grams;
-- Preserve old session snapshots for archival integrity; this field is no longer used by the app.
ALTER TABLE set_session RENAME COLUMN target_grams TO legacy_target_grams;
ALTER TABLE set_session ADD COLUMN prefill_grams INTEGER CHECK(prefill_grams BETWEEN 0 AND 2000000);
ALTER TABLE set_session ADD COLUMN prefill_set_id TEXT REFERENCES set_session(id);
CREATE INDEX exercise_identity ON exercise_session(exercise_id);
CREATE INDEX completed_set_history ON set_session(exercise_session_id,ended_at DESC) WHERE status='completed' AND removed_at IS NULL;
-- Existing active/paused sets receive the value available when they began.
UPDATE set_session AS current SET prefill_set_id = (
  SELECT previous.id FROM set_session previous
  JOIN exercise_session exercise ON exercise.id=previous.exercise_session_id
  WHERE exercise.exercise_id=(SELECT exercise_id FROM exercise_session WHERE id=current.exercise_session_id)
    AND previous.status='completed' AND previous.removed_at IS NULL AND exercise.removed_at IS NULL
    AND previous.ended_at<=current.started_at
  ORDER BY previous.ended_at DESC,previous.rowid DESC LIMIT 1
) WHERE status IN ('active','paused');
UPDATE set_session SET prefill_grams=(SELECT actual_grams FROM set_session previous WHERE previous.id=set_session.prefill_set_id)
WHERE prefill_set_id IS NOT NULL;
