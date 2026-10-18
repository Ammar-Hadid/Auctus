import { describe, it, expect } from 'vitest';
import { openDatabase } from './test-store';
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
      { exercise_id: exercise.id, sets: [{ ...set, type: 'warmup' }, set, set] },
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
  const complete = (index: number, grams: number) => {
    const id = w.exercises[0].sets[index].id;
    act('set.start', { id });
    act('set.complete', { id, actual_grams: grams, actual_reps: 8 });
  };
  return {
    store,
    p,
    s,
    template,
    assignment,
    act,
    complete,
    get: () => w,
    repeat: () => {
      now += 1000;
      w = s.start(assignment, true);
      return w;
    },
  };
}
describe('weight from the same set in the previous workout', () => {
  it('keeps first-use fields empty and carries warm-up and each working set independently', () => {
    const x = setup();
    try {
      let e = x.get().exercises[0];
      x.act('exercise.start', { id: e.id });
      for (const [i, grams] of [15000, 30000, 35000].entries()) {
        x.complete(i, grams);
        expect(x.get().exercises[0].sets[i].prefill_grams).toBeNull();
      }
      x.act('workout.complete', { skipRemaining: true });
      const oldSets = e.sets;
      e = x.repeat().exercises[0];
      x.act('exercise.start', { id: e.id });
      for (const [i, grams] of [15000, 30000, 35000].entries()) {
        const w = x.act('set.start', { id: e.sets[i].id });
        expect(w.exercises[0].sets[i]).toMatchObject({
          prefill_grams: grams,
          prefill_set_id: oldSets[i].id,
          actual_grams: null,
        });
        // Today's different results cannot replace the next set's prior-workout suggestion.
        x.act('set.complete', { id: e.sets[i].id, actual_grams: 40000, actual_reps: 8 });
      }
      const other = x.get().exercises[1];
      x.act('exercise.start', { id: other.id });
      expect(
        x.act('set.start', { id: other.sets[0].id }).exercises[1].sets[0].prefill_grams,
      ).toBeNull();
    } finally {
      x.store.sqlite.close();
    }
  });
  it('preserves each set identity through template saves, reordering and adding another warm-up', () => {
    const x = setup();
    try {
      x.act('exercise.start', { id: x.get().exercises[0].id });
      [15000, 30000, 35000].forEach((grams, i) => x.complete(i, grams));
      x.act('workout.complete', { skipRemaining: true });
      const e = x.template.exercises[0];
      const revised = x.p.saveTemplate({
        ...x.template,
        exercises: [
          {
            ...e,
            sets: [
              { type: 'warmup', min_reps: 10, max_reps: 10, rest_ms: 60000 },
              e.sets[2],
              e.sets[0],
              e.sets[1],
            ],
          },
        ],
      });
      expect(revised.exercises[0].sets[1].id).toBe(e.sets[2].id);
      const next = x.repeat().exercises[0];
      x.act('exercise.start', { id: next.id });
      for (const [i, grams] of [null, 35000, 15000, 30000].entries()) {
        expect(x.act('set.start', { id: next.sets[i].id }).exercises[0].sets[i].prefill_grams).toBe(
          grams,
        );
        x.act('set.skip', { id: next.sets[i].id });
      }
    } finally {
      x.store.sqlite.close();
    }
  });
  it('uses corrected and zero loads, while started suggestions survive pause and reload', () => {
    const x = setup();
    try {
      let e = x.get().exercises[0];
      x.act('exercise.start', { id: e.id });
      x.complete(0, 15000);
      x.act('set.edit', { id: e.sets[0].id, actual_grams: 0, actual_reps: 8 });
      x.act('workout.complete', { skipRemaining: true });
      e = x.repeat().exercises[0];
      x.act('exercise.start', { id: e.id });
      x.act('set.start', { id: e.sets[0].id });
      x.act('workout.pause');
      const w = x.act('workout.resume');
      expect(x.s.get(w.id).exercises[0].sets[0]).toMatchObject({
        prefill_grams: 0,
        actual_grams: null,
      });
    } finally {
      x.store.sqlite.close();
    }
  });
  it('does not borrow from skipped or removed sets, older workouts, or an abandoned workout’s other sets', () => {
    const x = setup();
    try {
      let e = x.get().exercises[0];
      x.act('exercise.start', { id: e.id });
      [15000, 30000, 35000].forEach((grams, i) => x.complete(i, grams));
      x.act('workout.complete', { skipRemaining: true });
      e = x.repeat().exercises[0];
      x.act('exercise.start', { id: e.id });
      x.complete(0, 17000);
      x.complete(1, 40000);
      x.act('set.remove', { id: e.sets[1].id });
      x.act('workout.abandon');
      e = x.repeat().exercises[0];
      x.act('exercise.start', { id: e.id });
      for (const [i, grams] of [17000, null, null].entries()) {
        expect(x.act('set.start', { id: e.sets[i].id }).exercises[0].sets[i].prefill_grams).toBe(
          grams,
        );
        x.act('set.skip', { id: e.sets[i].id });
      }
    } finally {
      x.store.sqlite.close();
    }
  });
  it('leaves changed set types and session-only added sets empty', () => {
    const x = setup();
    try {
      x.act('exercise.start', { id: x.get().exercises[0].id });
      x.complete(0, 15000);
      x.act('workout.complete', { skipRemaining: true });
      const e = x.repeat().exercises[0];
      x.act('set.prescription', {
        id: e.sets[0].id,
        type: 'normal',
        min_reps: 8,
        max_reps: 8,
        rest_ms: 60000,
      });
      x.act('exercise.start', { id: e.id });
      expect(
        x.act('set.start', { id: e.sets[0].id }).exercises[0].sets[0].prefill_grams,
      ).toBeNull();
      x.act('set.skip', { id: e.sets[0].id });
      const added = x
        .act('set.add', { id: e.id, type: 'warmup', min_reps: 8, max_reps: 8, rest_ms: 60000 })
        .exercises[0].sets.at(-1)!;
      expect(x.act('set.start', { id: added.id }).exercises[0].sets.at(-1)).toMatchObject({
        template_set_id: null,
        prefill_grams: null,
      });
    } finally {
      x.store.sqlite.close();
    }
  });
});
