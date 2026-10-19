-- Old exercises stay unclassified; never infer equipment from a name.
ALTER TABLE exercise ADD COLUMN equipment TEXT CHECK(equipment IS NULL OR equipment IN ('dumbbell','stack_machine','plate_loaded_machine','cable','other'));
-- Preserve equipment as used, just like the exercise name, in each session.
ALTER TABLE exercise_session ADD COLUMN equipment TEXT CHECK(equipment IS NULL OR equipment IN ('dumbbell','stack_machine','plate_loaded_machine','cable','other'));
