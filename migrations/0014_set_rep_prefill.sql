-- Keep suggested reps beside the suggested weight; actual results remain untouched.
ALTER TABLE set_session ADD COLUMN prefill_reps INTEGER CHECK(prefill_reps BETWEEN 0 AND 1000);

-- Existing started sets retain their chosen source and weight. Add its reps without
-- replacing any in-progress input drafts stored in the browser.
UPDATE set_session AS current SET prefill_reps = (
  SELECT previous.actual_reps FROM set_session previous
  WHERE previous.id=current.prefill_set_id
) WHERE prefill_set_id IS NOT NULL;
