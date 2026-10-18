import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { openDatabase } from '../src/server/db/connection';
import { Programming } from '../src/server/programming';
import { Sessions } from '../src/server/sessions';
import { restDuration } from '../src/domain/timing';
import { readState } from '../src/server/read-state';

describe('recovery and database invariants', () => {
  it('recovers a live rest after database restart and restores a consistent online backup', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'auctus-recovery-'));
    const file = join(dir, 'live.db');
    let store = openDatabase(file);
    let now = Date.parse('2026-10-18T12:00Z');
    const clock = () => now;
    try {
      const p = new Programming(store, clock);
      const e = p.saveExercise({ name: 'Press' }),
        program = p.saveProgram({ name: 'Plan' });
      p.saveTemplate({
        program_id: program.id,
        name: 'A',
        exercises: [
          {
            exercise_id: e.id,
            sets: [{ type: 'normal', target_reps: 8, target_grams: 20000, rest_ms: 60000 }],
          },
        ],
      });
      p.selectProgram(program.id);
      const s = new Sessions(store, clock);
      let w = s.start(p.availability().assignments[0].id, false);
      w = s.act({
        workout_id: w.id,
        version: w.version,
        action: 'exercise.start',
        id: w.exercises[0].id,
      });
      w = s.act({
        workout_id: w.id,
        version: w.version,
        action: 'set.start',
        id: w.exercises[0].sets[0].id,
      });
      now += 10000;
      w = s.act({
        workout_id: w.id,
        version: w.version,
        action: 'set.complete',
        id: w.exercises[0].sets[0].id,
        actual_grams: 20000,
        actual_reps: 8,
      });
      store.sqlite.close();
      store = openDatabase(file);
      now += 90000;
      const restored = new Sessions(store, clock).get(w.id);
      expect(restDuration(restored.rests[0], restored.pauses, now)).toBe(90000);
      expect(restored.exercises[0].sets[0].actual_reps).toBe(8);
      const backup = join(dir, 'backup.db');
      await store.sqlite.backup(backup);
      const copy = new Database(backup, { readonly: true });
      expect(copy.prepare('SELECT count(*) n FROM set_session').get()).toEqual({ n: 1 });
      expect(copy.pragma('integrity_check', { simple: true })).toBe('ok');
      expect(copy.pragma('foreign_key_check')).toEqual([]);
      copy.close();
    } finally {
      store.sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('retains a completed assignment when its program is archived and allows explicit repeats', () => {
    const store = openDatabase(':memory:');
    const now = Date.parse('2026-10-18T12:00Z');
    const p = new Programming(store, () => now);
    const e = p.saveExercise({ name: 'Row' }),
      program = p.saveProgram({ name: 'Base' });
    p.saveTemplate({
      program_id: program.id,
      name: 'A',
      exercises: [
        {
          exercise_id: e.id,
          sets: [{ type: 'normal', target_grams: 20000, target_reps: 8, rest_ms: 60000 }],
        },
      ],
    });
    p.selectProgram(program.id);
    const s = new Sessions(store, () => now);
    const a = p.availability().assignments[0];
    let w = s.start(a.id, false);
    s.act({
      workout_id: w.id,
      version: w.version,
      action: 'workout.complete',
      skipRemaining: true,
    });
    expect(() => s.start(a.id, false)).toThrow('Repeat');
    w = s.start(a.id, true);
    s.act({ workout_id: w.id, version: w.version, action: 'workout.abandon' });
    p.archive('program', program.id);
    const state = readState(store, now);
    expect(state.assignments[0].withdrawn_at).toBeNull();
    expect(state.assignments[0].completed).toBe(1);
    expect(state.current.workouts).toBe(1);
    store.sqlite.close();
  });
  it('enforces referential integrity at the database layer', () => {
    const store = openDatabase(':memory:');
    expect(() =>
      store.sqlite
        .prepare("INSERT INTO workout_template VALUES ('missing','no-program','A','',NULL,0,0)")
        .run(),
    ).toThrow('FOREIGN KEY');
    expect(() =>
      store.sqlite.prepare("INSERT INTO settings VALUES (1,'no-program')").run(),
    ).toThrow('FOREIGN KEY');
    store.sqlite.close();
  });
});
