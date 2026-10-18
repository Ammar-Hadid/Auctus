import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../src/server/db/connection';
import { Programming } from '../src/server/programming';
import { Sessions } from '../src/server/sessions';
import { activeDuration, restDuration } from '../src/domain/timing';
import { command } from '../src/server/commands';
function setup() {
  const store = openDatabase(':memory:');
  let now = Date.parse('2026-10-18T12:00Z');
  const clock = () => now;
  const p = new Programming(store, clock);
  const exercise = p.saveExercise({ name: 'Row' });
  const other = p.saveExercise({ name: 'Press' });
  const program = p.saveProgram({ name: 'Strength' });
  const prescription = { type: 'normal', target_reps: 8, target_grams: 20000, rest_ms: 60000 };
  const template = p.saveTemplate({
    program_id: program.id,
    name: 'A',
    exercises: [
      { exercise_id: exercise.id, sets: [prescription, prescription] },
      { exercise_id: other.id, sets: [prescription] },
    ],
  });
  p.selectProgram(program.id);
  const a = p.availability().assignments[0];
  const s = new Sessions(store, clock);
  const workout = s.start(a.id, false);
  return {
    store,
    p,
    s,
    template,
    workout,
    tick: (ms: number) => {
      now += ms;
    },
    clock,
  };
}
const context = (x: ReturnType<typeof setup>) => ({
  workout_id: x.workout.id,
  version: x.s.get(x.workout.id).version,
});
describe('persistent workout engine', () => {
  it('keeps final-set rest running after exercise completion until switching', () => {
    const x = setup();
    const [a, b] = x.workout.exercises;
    x.s.act({ ...context(x), action: 'exercise.start', id: b.id });
    x.s.act({ ...context(x), action: 'set.start', id: b.sets[0].id });
    x.tick(10000);
    x.s.act({
      ...context(x),
      action: 'set.complete',
      id: b.sets[0].id,
      actual_reps: 8,
      actual_grams: 20000,
    });
    x.tick(1000);
    x.s.act({ ...context(x), action: 'exercise.complete', id: b.id });
    expect(x.s.get(x.workout.id).rests[0].ended_at).toBeNull();
    x.tick(29000);
    const w = x.s.act({ ...context(x), action: 'exercise.start', id: a.id });
    expect(restDuration(w.rests[0], w.pauses, x.clock())).toBe(30000);
    x.store.sqlite.close();
  });
  it('snapshots prescriptions and exercise names independently of templates', () => {
    const x = setup();
    x.p.saveTemplate({ ...x.template, name: 'Changed', version: 0, exercises: [] });
    const w = x.s.get(x.workout.id);
    expect(w.name).toBe('A');
    expect(w.exercises).toHaveLength(2);
    expect(w.exercises[0].sets[0].target_grams).toBe(20000);
    expect(() => x.s.start(w.assignment_id, true)).toThrow('unfinished');
    x.store.sqlite.close();
  });
  it('allows arbitrary exercise order, deliberately switches and prevents active-set switching', () => {
    const x = setup();
    const [a, b] = x.s.get(x.workout.id).exercises;
    x.s.act({ ...context(x), action: 'exercise.start', id: b.id });
    x.s.act({ ...context(x), action: 'set.start', id: b.sets[0].id });
    expect(() => x.s.act({ ...context(x), action: 'exercise.start', id: a.id })).toThrow('set');
    x.s.act({ ...context(x), action: 'set.skip', id: b.sets[0].id });
    x.s.act({ ...context(x), action: 'exercise.start', id: a.id });
    const w = x.s.get(x.workout.id);
    expect(w.exercises.filter((e) => e.status === 'active')).toHaveLength(1);
    expect(w.exercises[1].status).toBe('paused');
    x.store.sqlite.close();
  });
  it('records results and real rest, freezes on pause, restores the same active child and rejects duplicate completion', () => {
    const x = setup();
    const e = x.s.get(x.workout.id).exercises[0];
    const set = e.sets[0];
    x.s.act({ ...context(x), action: 'exercise.start', id: e.id });
    x.s.act({ ...context(x), action: 'set.start', id: set.id });
    x.tick(20000);
    x.s.act({
      ...context(x),
      action: 'set.complete',
      id: set.id,
      actual_grams: 22000,
      actual_reps: 9,
    });
    expect(() =>
      x.s.act({
        ...context(x),
        action: 'set.complete',
        id: set.id,
        actual_grams: 22000,
        actual_reps: 9,
      }),
    ).toThrow();
    x.tick(30000);
    x.s.act({ ...context(x), action: 'workout.pause' });
    x.tick(120000);
    let w = x.s.get(x.workout.id);
    expect(restDuration(w.rests[0], w.pauses, x.clock())).toBe(30000);
    x.s.act({ ...context(x), action: 'workout.resume' });
    expect(x.s.get(w.id).exercises[0].status).toBe('active');
    x.tick(40000);
    x.s.act({ ...context(x), action: 'set.start', id: e.sets[1].id });
    w = x.s.get(w.id);
    expect(restDuration(w.rests[0], w.pauses, x.clock())).toBe(70000);
    expect(activeDuration(w, x.clock())).toBe(90000);
    expect(w.exercises[0].sets[0].target_grams).toBe(20000);
    expect(w.exercises[0].sets[0].actual_grams).toBe(22000);
    x.store.sqlite.close();
  });
  it('resumes a paused set and preserves completed results on abandonment', () => {
    const x = setup();
    const e = x.workout.exercises[0];
    x.s.act({ ...context(x), action: 'exercise.start', id: e.id });
    x.s.act({ ...context(x), action: 'set.start', id: e.sets[0].id });
    x.tick(1000);
    x.s.act({ ...context(x), action: 'workout.pause' });
    x.tick(5000);
    x.s.act({ ...context(x), action: 'workout.resume' });
    expect(x.s.get(x.workout.id).exercises[0].sets[0].status).toBe('active');
    x.tick(1000);
    x.s.act({
      ...context(x),
      action: 'set.complete',
      id: e.sets[0].id,
      actual_grams: 20000,
      actual_reps: 8,
    });
    x.s.act({ ...context(x), action: 'workout.abandon' });
    const w = x.s.get(x.workout.id);
    expect(w.status).toBe('abandoned');
    expect(w.exercises[0].sets[0].actual_reps).toBe(8);
    expect(w.rests.every((r) => r.ended_at !== null)).toBe(true);
    x.store.sqlite.close();
  });
  it('rejects stale versions and replays identical command receipts without duplicate records', () => {
    const x = setup();
    const key = randomUUID();
    const payload = { action: 'exercise.start' };
    const execute = () =>
      x.s.act({ ...context(x), action: 'exercise.start', id: x.workout.exercises[0].id });
    const result = command(x.store, key, payload, x.clock(), execute);
    expect(command(x.store, key, payload, x.clock(), execute)).toEqual(result);
    expect(() => command(x.store, key, { different: true }, x.clock(), execute)).toThrow(
      'already used',
    );
    expect(() =>
      x.s.act({ workout_id: x.workout.id, version: 0, action: 'workout.pause' }),
    ).toThrow('changed');
    x.store.sqlite.close();
  });
  it('keeps an unfinished session in its original week and requires deliberate completion of pending items', () => {
    const x = setup();
    const original = x.workout.assignment_id;
    x.tick(86400000);
    expect(x.p.availability().week.id).toBe('2026-10-19');
    expect(x.s.get(x.workout.id).assignment_id).toBe(original);
    expect(() => x.s.act({ ...context(x), action: 'workout.complete' })).toThrow('unfinished');
    x.s.act({ ...context(x), action: 'workout.complete', skipRemaining: true });
    expect(x.s.get(x.workout.id).status).toBe('completed');
    x.store.sqlite.close();
  });
  it('persists reordering, additions and removals while protecting recorded activity', () => {
    const x = setup();
    const [a, b] = x.workout.exercises;
    x.s.act({ ...context(x), action: 'exercise.reorder', ids: [b.id, a.id] });
    expect(x.s.get(x.workout.id).exercises[0].id).toBe(b.id);
    x.s.act({
      ...context(x),
      action: 'set.add',
      id: a.id,
      type: 'warmup',
      target_reps: 10,
      target_grams: 5000,
      rest_ms: 30000,
    });
    expect(x.s.get(x.workout.id).exercises[1].sets).toHaveLength(3);
    x.s.act({ ...context(x), action: 'exercise.remove', id: b.id });
    expect(x.s.get(x.workout.id).exercises[0].removed_at).not.toBeNull();
    x.store.sqlite.close();
  });
});

it('edits live prescriptions and recorded results without changing the original targets', () => {
  const x = setup();
  const e = x.workout.exercises[0];
  const id = e.sets[0].id;
  x.s.act({
    ...context(x),
    action: 'set.prescription',
    id,
    type: 'dropset',
    target_reps: 12,
    target_grams: 15000,
    rest_ms: 45000,
  });
  x.s.act({ ...context(x), action: 'exercise.start', id: e.id });
  x.s.act({ ...context(x), action: 'set.start', id });
  x.tick(1000);
  x.s.act({ ...context(x), action: 'set.complete', id, actual_grams: 15000, actual_reps: 10 });
  x.s.act({
    ...context(x),
    action: 'set.edit',
    id,
    actual_grams: 16000,
    actual_reps: 11,
    notes: 'Correction',
  });
  const w = x.s.get(x.workout.id);
  expect(w.exercises[0].sets[0].target_grams).toBe(15000);
  expect(w.exercises[0].sets[0].actual_grams).toBe(16000);
  expect(w.rests).toHaveLength(1);
  expect(w.rests[0].planned_ms).toBe(45000);
  x.store.sqlite.close();
});
