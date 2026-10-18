import { it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { openDatabase } from '../src/server/db/connection';
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
    const active = new Sessions(migrated).get('w').exercises[0].sets[1];
    expect(active.prefill_grams).toBe(30000);
    expect(active.actual_grams).toBeNull();
    expect(migrated.sqlite.pragma('foreign_key_check')).toEqual([]);
    expect(migrated.sqlite.pragma('integrity_check', { simple: true })).toBe('ok');
    migrated.sqlite.close();
    const reopened = openDatabase(file);
    expect(new Sessions(reopened).get('w').exercises[0].sets[1].prefill_set_id).toBe('done');
    reopened.sqlite.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
