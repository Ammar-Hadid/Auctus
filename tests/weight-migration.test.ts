import { it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { openDatabase } from './test-store';
import { Sessions } from '../src/server/sessions';
it('upgrades populated databases without changing actual results or legacy session snapshots', () => {
  const dir = mkdtempSync(join(tmpdir(), 'auctus-weight-migration-'));
  const file = join(dir, 'old.db');
  try {
    const old = new Database(file);
    old.pragma('foreign_keys = ON');
    old.exec(
      'CREATE TABLE _migrations (name TEXT PRIMARY KEY,hash TEXT NOT NULL,applied_at INTEGER NOT NULL)',
    );
    for (const name of readdirSync('migrations')
      .filter((n) => n.endsWith('.sql') && n < '0005')
      .sort()) {
      const sql = readFileSync(join('migrations', name), 'utf8');
      old.exec(sql);
      old
        .prepare('INSERT INTO _migrations VALUES (?,?,?)')
        .run(name, createHash('sha256').update(sql).digest('hex'), 0);
    }
    old.exec(`
      INSERT INTO exercise VALUES ('e','Press','',NULL,0);
      INSERT INTO program VALUES ('p','Strength','',NULL,0);
      INSERT INTO workout_template VALUES ('t','p','Upper','',NULL,0,0);
      INSERT INTO template_exercise VALUES ('te','t','e',0);
      INSERT INTO template_set VALUES ('ts','te',0,'normal',8,25000,60000);
      INSERT INTO training_week VALUES ('week',0,100000);
      INSERT INTO weekly_assignment VALUES ('a','week','t','Upper',NULL);
      INSERT INTO workout_session (id,assignment_id,template_id,name,status,started_at) VALUES ('w','a','t','Upper','active',1000);
      INSERT INTO exercise_session (id,workout_id,exercise_id,name,position,status,started_at) VALUES ('es','w','e','Press',0,'active',1000);
      INSERT INTO set_session (id,workout_id,exercise_session_id,position,type,target_reps,target_grams,rest_ms,status,actual_reps,actual_grams,started_at,ended_at)
        VALUES ('done','w','es',0,'normal',8,25000,60000,'completed',8,30000,1100,1200);
      INSERT INTO set_session (id,workout_id,exercise_session_id,position,type,target_reps,target_grams,rest_ms,status,started_at)
        VALUES ('active','w','es',1,'normal',8,25000,60000,'active',1300);
      INSERT INTO rest_period VALUES ('r','w','done',60000,1200,1300,'next_set');
    `);
    old.close();
    const migrated = openDatabase(file);
    expect(
      migrated.sqlite
        .prepare('SELECT actual_grams,legacy_target_grams FROM set_session WHERE id=?')
        .get('done'),
    ).toEqual({ actual_grams: 30000, legacy_target_grams: 25000 });
    expect(migrated.sqlite.prepare('SELECT * FROM template_set').get()).not.toHaveProperty(
      'target_grams',
    );
    expect(migrated.sqlite.prepare('SELECT equipment FROM exercise WHERE id=?').get('e')).toEqual({
      equipment: null,
    });
    expect(new Sessions(migrated).get('w').exercises[0].equipment).toBeNull();
    expect(new Sessions(migrated).get('w').mandatory).toBe(true);
    expect(
      migrated.sqlite.prepare('SELECT mandatory FROM workout_template WHERE id=?').get('t'),
    ).toEqual({ mandatory: 1 });
    const active = new Sessions(migrated).get('w').exercises[0].sets[1];
    // Exact targets are preserved as equal bounds by the subsequent rep-range migration.
    expect(active).toMatchObject({ min_reps: 8, max_reps: 8 });
    expect(new Sessions(migrated).get('w').exercises[0].sets[0]).toMatchObject({
      min_reps: 8,
      max_reps: 8,
      actual_reps: 8,
    });
    expect(migrated.sqlite.prepare('SELECT * FROM template_set').get()).toMatchObject({
      min_reps: 8,
      max_reps: 8,
    });
    expect(active.prefill_grams).toBeNull(); // An already-started set without a saved source is not retroactively changed.
    expect(active.actual_grams).toBeNull();
    expect(migrated.sqlite.pragma('foreign_key_check')).toEqual([]);
    expect(migrated.sqlite.pragma('integrity_check', { simple: true })).toBe('ok');
    migrated.sqlite.close();
    const reopened = openDatabase(file);
    expect(new Sessions(reopened).get('w').exercises[0].sets[1].prefill_set_id).toBeNull();
    reopened.sqlite.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it('links matching legacy sets and corrects an active warm-up suggestion without changing results', () => {
  const dir = mkdtempSync(join(tmpdir(), 'auctus-set-history-migration-'));
  const file = join(dir, 'old.db');
  try {
    const old = new Database(file);
    old.pragma('foreign_keys = ON');
    old.exec(
      'CREATE TABLE _migrations (name TEXT PRIMARY KEY,hash TEXT NOT NULL,applied_at INTEGER NOT NULL)',
    );
    for (const name of readdirSync('migrations')
      .filter((n) => n.endsWith('.sql') && n < '0007')
      .sort()) {
      const sql = readFileSync(join('migrations', name), 'utf8');
      old.exec(sql);
      old
        .prepare('INSERT INTO _migrations VALUES (?,?,?)')
        .run(name, createHash('sha256').update(sql).digest('hex'), 0);
    }
    old.exec(`
      INSERT INTO exercise VALUES ('e','Press','',NULL,0);
      INSERT INTO program VALUES ('p','Strength','',NULL,0);
      INSERT INTO workout_template VALUES ('t','p','Upper','',NULL,0,0);
      INSERT INTO template_exercise VALUES ('te','t','e',0);
      INSERT INTO template_set (id,template_exercise_id,position,type,min_reps,max_reps,rest_ms)
        VALUES ('warmup','te',0,'warmup',8,8,60000),('working','te',1,'normal',8,8,60000);
      INSERT INTO training_week VALUES ('week',0,100000);
      INSERT INTO weekly_assignment VALUES ('a','week','t','Upper',NULL);
      INSERT INTO workout_session (id,assignment_id,template_id,name,status,started_at,ended_at)
        VALUES ('previous','a','t','Upper','completed',1000,2000),('current','a','t','Upper','active',3000,NULL);
      INSERT INTO exercise_session (id,workout_id,exercise_id,name,position,status,started_at,ended_at)
        VALUES ('prior-e','previous','e','Press',0,'completed',1000,1900),('active-e','current','e','Press',0,'active',3000,NULL);
      INSERT INTO set_session (id,workout_id,exercise_session_id,position,type,min_reps,max_reps,legacy_target_grams,rest_ms,status,actual_reps,actual_grams,started_at,ended_at)
        VALUES ('prior-warmup','previous','prior-e',0,'warmup',8,8,0,60000,'completed',8,15000,1100,1200),
               ('prior-working','previous','prior-e',1,'normal',8,8,0,60000,'completed',8,30000,1300,1400);
      INSERT INTO set_session (id,workout_id,exercise_session_id,position,type,min_reps,max_reps,legacy_target_grams,rest_ms,status,started_at,prefill_grams,prefill_set_id)
        VALUES ('active-warmup','current','active-e',0,'warmup',8,8,0,60000,'active',3100,30000,'prior-working'),
               ('pending-working','current','active-e',1,'normal',8,8,0,60000,'pending',NULL,NULL,NULL);
    `);
    old.close();
    const store = openDatabase(file);
    const s = new Sessions(store);
    expect(s.get('current').exercises[0].sets[0]).toMatchObject({
      template_set_id: 'warmup',
      prefill_grams: 15000,
      prefill_reps: 8,
      prefill_set_id: 'prior-warmup',
      actual_grams: null,
    });
    expect(
      s.get('previous').exercises[0].sets.map((set) => [set.template_set_id, set.actual_grams]),
    ).toEqual([
      ['warmup', 15000],
      ['working', 30000],
    ]);
    expect(store.sqlite.pragma('foreign_key_check')).toEqual([]);
    expect(store.sqlite.pragma('integrity_check', { simple: true })).toBe('ok');
    store.sqlite.close();
    const reopened = openDatabase(file);
    expect(new Sessions(reopened).get('current').exercises[0].sets[0].prefill_grams).toBe(15000);
    reopened.sqlite.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
