import { describe, it, expect } from 'vitest';
import { openDatabase } from './test-store';
import { Programming } from '../src/server/programming';
import { Sessions } from '../src/server/sessions';
function setup(startAction: 'set.start' | 'set.begin') {
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
  const complete = (index: number, grams: number, reps = 8) => {
    const id = w.exercises[0].sets[index].id;
    act(startAction, { id });
    act('set.complete', { id, actual_grams: grams, actual_reps: reps });
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
describe.each(['set.start', 'set.begin'] as const)(
  'latest completed exercise values (%s)',
  (startAction) => {
    it('prefills both values from the latest same-type set including the current exercise', () => {
      const x = setup(startAction);
      try {
        let e = x.get().exercises[0];
        x.act('exercise.start', { id: e.id });
        for (const [i, grams] of [15000, 30000, 35000].entries()) {
          x.complete(i, grams);
          expect(x.get().exercises[0].sets[i]).toMatchObject({
            prefill_grams: i === 2 ? 30000 : null,
            prefill_reps: i === 2 ? 8 : null,
          });
        }
        x.act('workout.complete', { skipRemaining: true });
        const oldSets = e.sets;
        e = x.repeat().exercises[0];
        x.act('exercise.start', { id: e.id });
        for (const [i, grams] of [15000, 35000, 40000].entries()) {
          const w = x.act(startAction, { id: e.sets[i].id });
          expect(w.exercises[0].sets[i]).toMatchObject({
            prefill_grams: grams,
            prefill_set_id: i === 0 ? oldSets[0].id : i === 1 ? oldSets[2].id : e.sets[1].id,
            prefill_reps: i === 2 ? 7 : 8,
            actual_grams: null,
          });
          // Today's most recent working set becomes the next working set's suggestion.
          x.act('set.complete', { id: e.sets[i].id, actual_grams: 40000, actual_reps: 7 });
        }
        const other = x.get().exercises[1];
        x.act('exercise.start', { id: other.id });
        expect(
          x.act(startAction, { id: other.sets[0].id }).exercises[1].sets[0].prefill_grams,
        ).toBeNull();
      } finally {
        x.store.sqlite.close();
      }
    });
    it('finds history after template saves, reordering and adding another warm-up', () => {
      const x = setup(startAction);
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
        for (const [i, grams] of [15000, 35000, 15000, 35000].entries()) {
          expect(
            x.act(startAction, { id: next.sets[i].id }).exercises[0].sets[i].prefill_grams,
          ).toBe(grams);
          x.act('set.skip', { id: next.sets[i].id });
        }
      } finally {
        x.store.sqlite.close();
      }
    });
    it('uses completed-set time across templates and repeated exercise instances', () => {
      const x = setup(startAction);
      try {
        const original = x.get();
        x.act('exercise.start', { id: original.exercises[0].id });
        x.complete(1, 30000, 9);
        x.act('workout.complete', { skipRemaining: true });
        const oldSet = x.get().exercises[0].sets[1];
        // An intervening workout has no result for this exercise.
        x.repeat();
        x.act('workout.complete', { skipRemaining: true });
        const plan = { type: 'normal', min_reps: 6, max_reps: 8, rest_ms: 60000 };
        const exercise = { exercise_id: original.exercises[0].exercise_id, sets: [plan, plan] };
        const template = x.p.saveTemplate({
          program_id: x.template.program_id,
          name: 'Another workout',
          exercises: [exercise, exercise],
        });
        x.p.applySchedule();
        const assignment = x.p
          .availability()
          .assignments.find((a) => a.template_id === template.id)!;
        let w = x.s.start(assignment.id, false);
        const act = (action: string, data: Record<string, unknown>) => {
          w = x.s.act({ workout_id: w.id, version: w.version, action, ...data });
          return w;
        };
        act('exercise.start', { id: w.exercises[0].id });
        act(startAction, { id: w.exercises[0].sets[1].id });
        expect(w.exercises[0].sets[1]).toMatchObject({
          prefill_grams: 30000,
          prefill_reps: 9,
          prefill_set_id: oldSet.id,
        });
        act('set.complete', { id: w.exercises[0].sets[1].id, actual_grams: 35000, actual_reps: 7 });
        act('set.skip', { id: w.exercises[0].sets[0].id });
        act('exercise.start', { id: w.exercises[1].id });
        act(startAction, { id: w.exercises[1].sets[0].id });
        expect(w.exercises[1].sets[0]).toMatchObject({
          prefill_grams: 35000,
          prefill_reps: 7,
          prefill_set_id: w.exercises[0].sets[1].id,
        });
        // New results remain a suggestion until explicitly completed.
        expect(w.exercises[1].sets[0]).toMatchObject({ actual_grams: null, actual_reps: null });
      } finally {
        x.store.sqlite.close();
      }
    });
    it('ignores removed exercises and cancelled workouts', () => {
      const x = setup(startAction);
      try {
        x.act('exercise.start', { id: x.get().exercises[0].id });
        x.complete(1, 30000, 9);
        x.act('workout.abandon');
        const removedWorkout = x.get();
        x.repeat();
        x.act('exercise.start', { id: x.get().exercises[0].id });
        x.complete(1, 40000, 6);
        x.act('exercise.skip', { id: x.get().exercises[0].id });
        x.act('exercise.remove', { id: x.get().exercises[0].id });
        x.act('workout.abandon');
        const e = x.repeat().exercises[0];
        x.act('exercise.start', { id: e.id });
        expect(x.act(startAction, { id: e.sets[1].id }).exercises[0].sets[1]).toMatchObject({
          prefill_grams: 30000,
          prefill_reps: 9,
        });
        x.s.cancel({ workout_id: removedWorkout.id, version: removedWorkout.version });
        expect(x.s.get(x.get().id).exercises[0].sets[1]).toMatchObject({
          prefill_grams: null,
          prefill_reps: null,
          prefill_set_id: null,
        });
      } finally {
        x.store.sqlite.close();
      }
    });
    it('uses corrected and zero loads, while started suggestions survive pause and reload', () => {
      const x = setup(startAction);
      try {
        let e = x.get().exercises[0];
        x.act('exercise.start', { id: e.id });
        x.complete(0, 15000);
        x.act('set.edit', { id: e.sets[0].id, actual_grams: 0, actual_reps: 0 });
        x.act('workout.complete', { skipRemaining: true });
        e = x.repeat().exercises[0];
        x.act('exercise.start', { id: e.id });
        x.act(startAction, { id: e.sets[0].id });
        x.act('workout.pause');
        const w = x.act('workout.resume');
        expect(x.s.get(w.id).exercises[0].sets[0]).toMatchObject({
          prefill_grams: 0,
          prefill_reps: 0,
          actual_grams: null,
        });
      } finally {
        x.store.sqlite.close();
      }
    });
    it('searches older workouts past skipped and removed sets, including completed sets in abandoned workouts', () => {
      const x = setup(startAction);
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
        for (const [i, grams] of [17000, 35000, 35000].entries()) {
          expect(x.act(startAction, { id: e.sets[i].id }).exercises[0].sets[i].prefill_grams).toBe(
            grams,
          );
          x.act('set.skip', { id: e.sets[i].id });
        }
      } finally {
        x.store.sqlite.close();
      }
    });
    it('keeps unmatched set types empty and prefills session-only added sets', () => {
      const x = setup(startAction);
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
          x.act(startAction, { id: e.sets[0].id }).exercises[0].sets[0].prefill_grams,
        ).toBeNull();
        x.act('set.skip', { id: e.sets[0].id });
        const added = x
          .act('set.add', { id: e.id, type: 'warmup', min_reps: 8, max_reps: 8, rest_ms: 60000 })
          .exercises[0].sets.at(-1)!;
        expect(x.act(startAction, { id: added.id }).exercises[0].sets.at(-1)).toMatchObject({
          template_set_id: null,
          prefill_grams: 15000,
          prefill_reps: 8,
        });
      } finally {
        x.store.sqlite.close();
      }
    });
  },
);
