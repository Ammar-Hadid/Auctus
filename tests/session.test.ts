import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { openDatabase } from './test-store';
import { Programming } from '../src/server/programming';
import { Sessions } from '../src/server/sessions';
import { activeDuration, restDuration, restRemaining } from '../src/domain/timing';
import { command } from '../src/server/commands';
function setup() {
  const store = openDatabase(':memory:');
  let now = Date.parse('2026-10-18T12:00Z');
  const clock = () => now;
  const p = new Programming(store, clock);
  const exercise = p.saveExercise({ name: 'Row' });
  const other = p.saveExercise({ name: 'Press' });
  const program = p.saveProgram({ name: 'Strength' });
  const prescription = { type: 'normal', min_reps: 8, max_reps: 8, rest_ms: 60000 };
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
    expect(w.exercises[0].sets[0].min_reps).toBe(8);
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
    expect(w.exercises[1].status).toBe('skipped');
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
    expect(w.exercises[0].sets[0].min_reps).toBe(8);
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
      min_reps: 10,
      max_reps: 10,
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
    min_reps: 12,
    max_reps: 12,
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
  expect(w.exercises[0].sets[0].min_reps).toBe(12);
  expect(w.exercises[0].sets[0].actual_grams).toBe(16000);
  expect(w.rests).toHaveLength(1);
  expect(w.rests[0].planned_ms).toBe(45000);
  x.store.sqlite.close();
});

it('persists independent rest pauses and extensions without double-counting workout pauses', () => {
  const x = setup();
  const exercise = x.workout.exercises[0];
  x.s.act({ ...context(x), action: 'exercise.start', id: exercise.id });
  x.s.act({ ...context(x), action: 'set.start', id: exercise.sets[0].id });
  x.tick(10000);
  let w = x.s.act({
    ...context(x),
    action: 'set.complete',
    id: exercise.sets[0].id,
    actual_reps: 8,
    actual_grams: 20000,
  });
  const id = w.rests[0].id;
  const act = (action: string, extra = {}) => x.s.act({ ...context(x), id, action, ...extra });
  x.tick(10000);
  w = act('rest.pause');
  expect(w.status).toBe('active');
  expect(restRemaining(w.rests[0], w.pauses, x.clock())).toBe(50000);
  x.tick(5000);
  act('workout.pause');
  x.tick(20000);
  act('workout.resume');
  x.tick(5000);
  // Reload from persisted state, including the overlapping workout pause.
  w = new Sessions(x.store, x.clock).get(w.id);
  expect(restRemaining(w.rests[0], w.pauses, x.clock())).toBe(50000);
  expect(restDuration(w.rests[0], w.pauses, x.clock())).toBe(20000);
  expect(activeDuration(w, x.clock())).toBe(30000);
  act('rest.extend', { ms: 5000 });
  w = act('rest.extend', { ms: 15000 });
  expect(restRemaining(w.rests[0], w.pauses, x.clock())).toBe(70000);
  expect(w.rests[0].planned_ms).toBe(60000);
  expect(() => act('rest.extend', { ms: -5000 })).toThrow();
  expect(() => act('rest.extend', { ms: 10000 })).toThrow();
  expect(() => act('rest.pause')).toThrow('already paused');
  act('rest.resume');
  expect(() => act('rest.resume')).toThrow('not paused');
  x.tick(75000);
  w = x.s.get(w.id);
  expect(restRemaining(w.rests[0], w.pauses, x.clock())).toBe(-5000);
  // A retry receipt must not add the same 15 seconds twice.
  const request = randomUUID();
  const payload = { ...context(x), action: 'rest.extend', id, ms: 15000 };
  const execute = () => x.s.act(payload);
  command(x.store, request, payload, x.clock(), execute);
  command(x.store, request, payload, x.clock(), execute);
  w = x.s.get(w.id);
  expect(w.rests[0].added_ms).toBe(35000);
  expect(restRemaining(w.rests[0], w.pauses, x.clock())).toBe(10000);
  act('rest.pause');
  x.tick(3000);
  w = act('set.start', { id: exercise.sets[1].id });
  expect(w.rests[0].timer_paused_at).toBeNull();
  expect(w.rests[0].timer_paused_ms).toBe(13000);
  expect(w.rests[0].ended_at).toBe(x.clock());
  expect(() => act('rest.extend', { ms: 5000 })).toThrow('no longer active');
  x.store.sqlite.close();
});

describe('guided set flow', () => {
  it('begins a chosen set atomically and deliberately resumes an interrupted exercise', () => {
    const x = setup();
    try {
      const [a, b] = x.workout.exercises;
      let w = x.s.act({ ...context(x), action: 'set.begin', id: a.sets[1].id });
      expect(w.version).toBe(1);
      expect(w.exercises[0].status).toBe('active');
      expect(w.exercises[0].sets.map((s) => s.status)).toEqual(['pending', 'active']);
      x.s.act({
        ...context(x),
        action: 'set.complete',
        id: a.sets[1].id,
        actual_grams: 20000,
        actual_reps: 8,
      });
      x.tick(15000);
      w = x.s.act({ ...context(x), action: 'set.begin', id: b.sets[0].id });
      expect(w.exercises[0].status).toBe('paused');
      expect(w.exercises[1].status).toBe('active');
      expect(w.rests[0].ended_at).toBe(x.clock());
      expect(w.rests[0].reason).toBe('exercise_switch');
      x.s.act({ ...context(x), action: 'set.skip', id: b.sets[0].id });
      w = x.s.act({ ...context(x), action: 'set.begin', id: a.sets[0].id });
      expect(w.exercises[0].status).toBe('active');
      expect(w.exercises[0].sets[0].status).toBe('active');
      expect(w.exercises[0].started_at).toBe(x.workout.started_at);
      expect(w.exercises[1].status).toBe('skipped');
    } finally {
      x.store.sqlite.close();
    }
  });

  it('rejects switching with an active set, stale versions and paused workouts without partial changes', () => {
    const x = setup();
    try {
      const [a, b] = x.workout.exercises;
      const w = x.s.act({ ...context(x), action: 'set.begin', id: a.sets[0].id });
      expect(() => x.s.act({ ...context(x), action: 'set.begin', id: b.sets[0].id })).toThrow(
        'active',
      );
      expect(() =>
        x.s.act({ workout_id: w.id, version: 0, action: 'set.begin', id: b.sets[0].id }),
      ).toThrow('changed');
      expect(x.s.get(w.id)).toEqual(w);
      const paused = x.s.act({ ...context(x), action: 'workout.pause' });
      expect(() => x.s.act({ ...context(x), action: 'set.begin', id: b.sets[0].id })).toThrow(
        'Resume',
      );
      expect(x.s.get(w.id)).toEqual(paused);
    } finally {
      x.store.sqlite.close();
    }
  });

  it('finishes the last completed set’s exercise without ending rest or beginning the next effort', () => {
    const x = setup();
    try {
      const [a, b] = x.workout.exercises;
      x.s.act({ ...context(x), action: 'set.begin', id: b.sets[0].id });
      x.tick(10000);
      const w = x.s.act({
        ...context(x),
        action: 'set.complete',
        id: b.sets[0].id,
        actual_grams: 30000,
        actual_reps: 9,
      });
      expect(w.exercises[1]).toMatchObject({ status: 'completed', ended_at: x.clock() });
      expect(w.exercises[0]).toMatchObject({ id: a.id, status: 'pending', started_at: null });
      expect(w.exercises[0].sets.every((s) => s.status === 'pending')).toBe(true);
      expect(w.status).toBe('active');
      expect(w.rests).toHaveLength(1);
      expect(w.rests[0].ended_at).toBeNull();
    } finally {
      x.store.sqlite.close();
    }
  });

  it('completes mixed-result exercises and marks entirely skipped exercises skipped', () => {
    const x = setup();
    try {
      const [a, b] = x.workout.exercises;
      x.s.act({ ...context(x), action: 'set.begin', id: a.sets[0].id });
      x.s.act({
        ...context(x),
        action: 'set.complete',
        id: a.sets[0].id,
        actual_grams: 30000,
        actual_reps: 9,
      });
      const mixed = x.s.act({ ...context(x), action: 'set.skip', id: a.sets[1].id });
      expect(mixed.exercises[0].status).toBe('completed');
      expect(mixed.rests[0].ended_at).toBeNull();
      x.s.act({ ...context(x), action: 'set.begin', id: b.sets[0].id });
      const skipped = x.s.act({ ...context(x), action: 'set.skip', id: b.sets[0].id });
      expect(skipped.exercises[1].status).toBe('skipped');
      expect(skipped.rests).toHaveLength(1);
    } finally {
      x.store.sqlite.close();
    }
  });

  it('ignores removed sets when resolving an exercise and handles completion after an earlier skip', () => {
    const x = setup();
    try {
      const a = x.workout.exercises[0];
      x.s.act({
        ...context(x),
        action: 'set.add',
        id: a.id,
        type: 'warmup',
        min_reps: 10,
        max_reps: 12,
        rest_ms: 30000,
      });
      x.s.act({ ...context(x), action: 'set.skip', id: a.sets[0].id });
      expect(x.s.get(x.workout.id).exercises[0].status).toBe('pending');
      const added = x.s.get(x.workout.id).exercises[0].sets.at(-1)!;
      x.s.act({ ...context(x), action: 'set.remove', id: added.id });
      x.s.act({ ...context(x), action: 'set.begin', id: a.sets[1].id });
      const w = x.s.act({
        ...context(x),
        action: 'set.complete',
        id: a.sets[1].id,
        actual_grams: 25000,
        actual_reps: 8,
      });
      expect(w.exercises[0].status).toBe('completed');
      expect(w.rests[0].ended_at).toBeNull();
    } finally {
      x.store.sqlite.close();
    }
  });
});

it.each(['completed', 'skipped'] as const)(
  'reopens a %s exercise for extra sets without interrupting another active exercise',
  (terminalStatus) => {
    const x = setup();
    try {
      const [a, b] = x.workout.exercises;
      x.s.act({ ...context(x), action: 'set.begin', id: b.sets[0].id });
      x.s.act({
        ...context(x),
        action: terminalStatus === 'completed' ? 'set.complete' : 'set.skip',
        id: b.sets[0].id,
        actual_grams: 20000,
        actual_reps: 8,
      });
      expect(x.s.get(x.workout.id).exercises[1].status).toBe(terminalStatus);
      x.tick(10000);
      x.s.act({ ...context(x), action: 'set.begin', id: a.sets[0].id });
      let w = x.s.act({
        ...context(x),
        action: 'set.add',
        id: b.id,
        type: 'normal',
        min_reps: 8,
        max_reps: 10,
        rest_ms: 60000,
      });
      expect(w.exercises[0].status).toBe('active');
      expect(w.exercises[1]).toMatchObject({
        status: 'pending',
        ended_at: null,
        started_at: x.workout.started_at,
      });
      const extra = w.exercises[1].sets.at(-1)!;
      expect(extra).toMatchObject({ status: 'pending', template_set_id: null });
      expect(() => x.s.act({ ...context(x), action: 'set.begin', id: extra.id })).toThrow(
        'active set',
      );
      x.s.act({ ...context(x), action: 'set.skip', id: a.sets[0].id });
      w = x.s.act({ ...context(x), action: 'set.begin', id: extra.id });
      expect(w.exercises[0].status).toBe('paused');
      expect(w.exercises[1].status).toBe('active');
      expect(w.exercises[1].sets.at(-1)!.prefill_grams).toBeNull();
      w = x.s.act({
        ...context(x),
        action: 'set.complete',
        id: extra.id,
        actual_grams: 22000,
        actual_reps: 9,
      });
      expect(w.exercises[1]).toMatchObject({ status: 'completed', ended_at: x.clock() });
      expect(w.exercises[1].sets[0].status).toBe(terminalStatus);
      expect(w.rests.at(-1)!.ended_at).toBeNull();
    } finally {
      x.store.sqlite.close();
    }
  },
);

it('replays a guided begin receipt without starting a second effort or changing its timestamp', () => {
  const x = setup();
  try {
    const request = randomUUID();
    const payload = { ...context(x), action: 'set.begin', id: x.workout.exercises[0].sets[0].id };
    const execute = () => x.s.act(payload);
    const first = command(x.store, request, payload, x.clock(), execute);
    x.tick(5000);
    expect(command(x.store, request, payload, x.clock(), execute)).toEqual(first);
    const w = x.s.get(x.workout.id);
    expect(w.version).toBe(1);
    expect(w.exercises.flatMap((e) => e.sets).filter((s) => s.status === 'active')).toHaveLength(1);
    expect(w.exercises[0].sets[0].started_at).toBe(x.workout.started_at);
  } finally {
    x.store.sqlite.close();
  }
});

it('resolves fully skipped pending and paused exercises without disturbing another exercise or rest', () => {
  const x = setup();
  try {
    const [a, b] = x.workout.exercises;
    x.s.act({ ...context(x), action: 'set.begin', id: a.sets[0].id });
    x.s.act({
      ...context(x),
      action: 'set.complete',
      id: a.sets[0].id,
      actual_grams: 20000,
      actual_reps: 8,
    });
    const rest = x.s.get(x.workout.id).rests[0];
    let w = x.s.act({ ...context(x), action: 'set.skip', id: b.sets[0].id });
    expect(w.exercises[1]).toMatchObject({ status: 'skipped', started_at: null });
    expect(w.exercises[0].status).toBe('active');
    expect(w.rests[0]).toEqual(rest);
    w = x.s.act({
      ...context(x),
      action: 'set.add',
      id: b.id,
      type: 'normal',
      min_reps: 8,
      max_reps: 8,
      rest_ms: 60000,
    });
    const added = w.exercises[1].sets.at(-1)!;
    x.s.act({ ...context(x), action: 'set.begin', id: added.id });
    const activeOther = x.s.get(x.workout.id).exercises[1];
    expect(x.s.get(x.workout.id).exercises[0].status).toBe('paused');
    w = x.s.act({ ...context(x), action: 'set.skip', id: a.sets[1].id });
    expect(w.exercises[0].status).toBe('completed');
    expect(w.exercises[1]).toEqual(activeOther);
  } finally {
    x.store.sqlite.close();
  }
});

it('resolves an exercise when its last unfinished set is removed without deleting recorded results or ending rest', () => {
  const x = setup();
  try {
    const [a, b] = x.workout.exercises;
    x.s.act({ ...context(x), action: 'set.begin', id: a.sets[0].id });
    x.s.act({
      ...context(x),
      action: 'set.complete',
      id: a.sets[0].id,
      actual_grams: 23000,
      actual_reps: 9,
    });
    let w = x.s.act({ ...context(x), action: 'set.remove', id: a.sets[1].id });
    expect(w.exercises[0].status).toBe('completed');
    expect(w.exercises[0].sets[0]).toMatchObject({
      status: 'completed',
      actual_grams: 23000,
      actual_reps: 9,
      removed_at: null,
    });
    expect(w.rests[0].ended_at).toBeNull();
    w = x.s.act({ ...context(x), action: 'set.remove', id: b.sets[0].id });
    expect(w.exercises[1].status).toBe('skipped');
    expect(w.exercises[1].sets[0].removed_at).not.toBeNull();
    expect(w.rests[0].ended_at).toBeNull();
  } finally {
    x.store.sqlite.close();
  }
});

it.each(['pending', 'paused'] as const)(
  'finishes legacy fully resolved %s exercises without starting them or closing rest',
  (status) => {
    const x = setup();
    try {
      const [a, b] = x.workout.exercises;
      x.s.act({ ...context(x), action: 'set.begin', id: b.sets[0].id });
      x.s.act({
        ...context(x),
        action: 'set.complete',
        id: b.sets[0].id,
        actual_grams: 20000,
        actual_reps: 8,
      });
      // Model an already-existing session written before automatic exercise resolution.
      x.store.sqlite
        .prepare("UPDATE set_session SET status='skipped',ended_at=? WHERE exercise_session_id=?")
        .run(x.clock(), a.id);
      x.store.sqlite
        .prepare('UPDATE exercise_session SET status=?,ended_at=NULL WHERE id=?')
        .run(status, a.id);
      const before = x.s.get(x.workout.id);
      const w = x.s.act({ ...context(x), action: 'exercise.complete', id: a.id });
      expect(w.exercises[0]).toMatchObject({
        status: 'skipped',
        started_at: null,
        ended_at: x.clock(),
      });
      expect(w.exercises[1]).toEqual(before.exercises[1]);
      expect(w.rests).toEqual(before.rests);
    } finally {
      x.store.sqlite.close();
    }
  },
);
