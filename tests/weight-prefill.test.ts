import { describe, it, expect } from 'vitest';
import { openDatabase } from '../src/server/db/connection';
import { Programming } from '../src/server/programming';
import { Sessions } from '../src/server/sessions';
function setup() {
  const store = openDatabase(':memory:');
  let now = Date.parse('2026-10-18T12:00Z');
  const p = new Programming(store, () => now);
  const exercise = p.saveExercise({ name: 'Incline dumbbell press' });
  const other = p.saveExercise({ name: 'Incline dumbbell press' });
  const program = p.saveProgram({ name: 'Strength' });
  const set = { type: 'normal', min_reps: 8, max_reps: 8, rest_ms: 60000 };
  const template = p.saveTemplate({
    program_id: program.id,
    name: 'Upper',
    exercises: [
      { exercise_id: exercise.id, sets: [set, set, set] },
      { exercise_id: other.id, sets: [set] },
    ],
  });
  p.selectProgram(program.id);
  const s = new Sessions(store, () => now);
  const assignment = p.availability().assignments[0].id;
  let w = s.start(assignment, false);
  const act = (action: string, data: Record<string, unknown> = {}) => {
    now += 1000;
    w = s.act({ workout_id: w.id, version: w.version, action, ...data });
    return w;
  };
  return {
    store,
    p,
    s,
    template,
    assignment,
    act,
    get: () => w,
    repeat: () => {
      now += 1000;
      w = s.start(assignment, true);
      return w;
    },
  };
}
describe('weight from the last completed set', () => {
  it('has no template weight, starts empty, then uses the latest actual weight without recording it', () => {
    const x = setup();
    const [e, other] = x.get().exercises;
    expect(x.template.exercises[0].sets[0]).not.toHaveProperty('target_grams');
    x.act('exercise.start', { id: e.id });
    let w = x.act('set.start', { id: e.sets[0].id });
    expect(w.exercises[0].sets[0].prefill_grams).toBeNull();
    x.act('set.complete', { id: e.sets[0].id, actual_grams: 30000, actual_reps: 8 });
    w = x.act('set.start', { id: e.sets[1].id });
    expect(w.exercises[0].sets[1].prefill_grams).toBe(30000);
    expect(w.exercises[0].sets[1].prefill_set_id).toBe(e.sets[0].id);
    expect(w.exercises[0].sets[1].actual_grams).toBeNull();
    x.act('set.complete', { id: e.sets[1].id, actual_grams: 40000, actual_reps: 6 });
    w = x.act('set.start', { id: e.sets[2].id });
    expect(w.exercises[0].sets[2].prefill_grams).toBe(40000);
    x.act('set.skip', { id: e.sets[2].id });
    x.act('exercise.start', { id: other.id });
    w = x.act('set.start', { id: other.sets[0].id });
    expect(w.exercises[1].sets[0].prefill_grams).toBeNull(); // Identity, not exercise name.
    x.store.sqlite.close();
  });
  it('carries corrected weights into later workouts, freezes started prefills, and retains zero', () => {
    const x = setup();
    let e = x.get().exercises[0];
    x.act('exercise.start', { id: e.id });
    x.act('set.start', { id: e.sets[0].id });
    x.act('set.complete', { id: e.sets[0].id, actual_grams: 30000, actual_reps: 8 });
    x.act('set.edit', { id: e.sets[0].id, actual_grams: 40000, actual_reps: 8 });
    x.act('workout.complete', { skipRemaining: true });
    e = x.repeat().exercises[0];
    x.act('exercise.start', { id: e.id });
    let w = x.act('set.start', { id: e.sets[0].id });
    expect(w.exercises[0].sets[0].prefill_grams).toBe(40000);
    x.act('workout.pause');
    w = x.act('workout.resume');
    expect(x.s.get(w.id).exercises[0].sets[0].prefill_grams).toBe(40000);
    x.act('set.complete', { id: e.sets[0].id, actual_grams: 0, actual_reps: 10 });
    w = x.act('set.start', { id: e.sets[1].id });
    expect(w.exercises[0].sets[1].prefill_grams).toBe(0);
    expect(w.exercises[0].sets[1].actual_grams).toBeNull();
    x.store.sqlite.close();
  });
  it('ignores removed results and skipped sets but keeps completed sets from abandoned workouts', () => {
    const x = setup();
    let e = x.get().exercises[0];
    x.act('exercise.start', { id: e.id });
    x.act('set.start', { id: e.sets[0].id });
    x.act('set.complete', { id: e.sets[0].id, actual_grams: 30000, actual_reps: 8 });
    x.act('set.start', { id: e.sets[1].id });
    x.act('set.complete', { id: e.sets[1].id, actual_grams: 50000, actual_reps: 1 });
    x.act('set.remove', { id: e.sets[1].id });
    x.act('workout.abandon');
    e = x.repeat().exercises[0];
    x.act('exercise.start', { id: e.id });
    const w = x.act('set.start', { id: e.sets[0].id });
    expect(w.exercises[0].sets[0].prefill_grams).toBe(30000);
    x.store.sqlite.close();
  });
});
