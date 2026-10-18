import { expect, it } from 'vitest';
import { prescription } from '../src/domain/validation';
import { openDatabase } from '../src/server/db/connection';
import { Programming } from '../src/server/programming';
import { Sessions } from '../src/server/sessions';
import { repRangeLabel } from '../src/domain/reps';

it('displays a range or an exact rep target', () => {
  expect(repRangeLabel(6, 8)).toBe('6–8');
  expect(repRangeLabel(8, 8)).toBe('8');
});

it('accepts rep ranges and exact targets, and rejects invalid bounds', () => {
  const set = { type: 'normal', min_reps: 6, max_reps: 8, rest_ms: 60000 };
  expect(prescription.parse(set)).toMatchObject({ min_reps: 6, max_reps: 8 });
  expect(prescription.parse({ ...set, min_reps: 8 })).toMatchObject({ min_reps: 8, max_reps: 8 });
  expect(() => prescription.parse({ ...set, min_reps: 9 })).toThrow(
    'Maximum reps must be at least minimum reps.',
  );
  for (const patch of [
    { min_reps: -1 },
    { max_reps: 1001 },
    { min_reps: 6.5 },
    { max_reps: 8.5 },
  ]) {
    expect(prescription.safeParse({ ...set, ...patch }).success).toBe(false);
  }
});

it('preserves planned ranges in workout snapshots while recording exact results outside the range', () => {
  const store = openDatabase(':memory:');
  try {
    let now = Date.parse('2026-10-18T12:00Z');
    const p = new Programming(store, () => now);
    const s = new Sessions(store, () => now);
    const exercise = p.saveExercise({ name: 'Press' });
    const program = p.saveProgram({ name: 'Strength' });
    const template = p.saveTemplate({
      program_id: program.id,
      name: 'Upper',
      exercises: [
        {
          exercise_id: exercise.id,
          sets: [{ type: 'normal', min_reps: 6, max_reps: 8, rest_ms: 60000 }],
        },
      ],
    });
    expect(p.templates()[0].exercises[0].sets[0]).toMatchObject({ min_reps: 6, max_reps: 8 });
    p.selectProgram(program.id);
    const w = s.start(p.availability().assignments[0].id, false);
    const e = w.exercises[0],
      set = e.sets[0];
    const act = (action: string, payload: Record<string, unknown> = {}) =>
      s.act({ workout_id: w.id, version: s.get(w.id).version, action, ...payload });
    p.saveTemplate({
      ...template,
      exercises: [
        {
          exercise_id: exercise.id,
          sets: [{ type: 'normal', min_reps: 10, max_reps: 12, rest_ms: 60000 }],
        },
      ],
    });
    expect(s.get(w.id).exercises[0].sets[0]).toMatchObject({ min_reps: 6, max_reps: 8 });
    expect(() =>
      act('set.prescription', {
        id: set.id,
        type: 'normal',
        min_reps: 9,
        max_reps: 8,
        rest_ms: 60000,
      }),
    ).toThrow();
    act('set.prescription', {
      id: set.id,
      type: 'normal',
      min_reps: 5,
      max_reps: 7,
      rest_ms: 60000,
    });
    act('exercise.start', { id: e.id });
    act('set.start', { id: set.id });
    now += 1000;
    act('set.complete', { id: set.id, actual_reps: 9, actual_grams: 30000 });
    expect(s.get(w.id).exercises[0].sets[0]).toMatchObject({
      min_reps: 5,
      max_reps: 7,
      actual_reps: 9,
      actual_grams: 30000,
    });
    expect(p.templates()[0].exercises[0].sets[0]).toMatchObject({ min_reps: 10, max_reps: 12 });
    expect(() =>
      store.sqlite.prepare('UPDATE template_set SET min_reps=13 WHERE max_reps=12').run(),
    ).toThrow();
  } finally {
    store.sqlite.close();
  }
});
