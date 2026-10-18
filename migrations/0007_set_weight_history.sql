-- Snapshot identity survives template edits/deletions, so it intentionally has no foreign key.
ALTER TABLE set_session ADD COLUMN template_set_id TEXT;
CREATE INDEX set_template_history ON set_session(workout_id,template_set_id);

-- Older sessions have no saved template-set identity. Link only exercises that occur once
-- in both plans, with the same number/order/types of sets. Ambiguous legacy matches stay empty.
UPDATE set_session AS current SET template_set_id = (
  SELECT ts.id FROM exercise_session es
  JOIN workout_session w ON w.id=es.workout_id
  JOIN template_exercise te ON te.template_id=w.template_id AND te.exercise_id=es.exercise_id
  JOIN template_set ts ON ts.template_exercise_id=te.id AND ts.position=current.position AND ts.type=current.type
  WHERE es.id=current.exercise_session_id AND es.removed_at IS NULL AND current.removed_at IS NULL
    AND (SELECT COUNT(*) FROM exercise_session other WHERE other.workout_id=w.id AND other.exercise_id=es.exercise_id)=1
    AND (SELECT COUNT(*) FROM template_exercise other WHERE other.template_id=w.template_id AND other.exercise_id=es.exercise_id)=1
    AND (SELECT COUNT(*) FROM set_session s WHERE s.exercise_session_id=es.id)=(SELECT COUNT(*) FROM template_set t WHERE t.template_exercise_id=te.id)
    AND NOT EXISTS (
      SELECT 1 FROM set_session s WHERE s.exercise_session_id=es.id AND
        (s.removed_at IS NOT NULL OR NOT EXISTS (
          SELECT 1 FROM template_set t WHERE t.template_exercise_id=te.id AND t.position=s.position AND t.type=s.type
        ))
    )
);

-- Correct old suggestions for currently running sets without touching actual results or drafts.
UPDATE set_session AS current SET prefill_set_id = (
  SELECT s.id FROM set_session s
  JOIN exercise_session e ON e.id=s.exercise_session_id
  WHERE s.workout_id=(
    SELECT previous.id FROM workout_session previous
    JOIN workout_session active ON active.id=current.workout_id
    WHERE previous.template_id=active.template_id AND previous.id<>active.id
      AND previous.status IN ('completed','abandoned') AND previous.ended_at<=active.started_at
    ORDER BY previous.ended_at DESC,previous.rowid DESC LIMIT 1
  )
    AND s.template_set_id=current.template_set_id AND s.type=current.type
    AND e.exercise_id=(SELECT exercise_id FROM exercise_session WHERE id=current.exercise_session_id)
    AND s.status='completed' AND s.removed_at IS NULL AND e.removed_at IS NULL
  LIMIT 1
) WHERE status IN ('active','paused');
UPDATE set_session SET prefill_grams=(SELECT actual_grams FROM set_session previous WHERE previous.id=set_session.prefill_set_id)
WHERE status IN ('active','paused');
