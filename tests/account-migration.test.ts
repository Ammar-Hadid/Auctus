import { it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { openDatabase, forUser } from '../src/server/db/connection';
import { createMember } from '../src/server/accounts';
import { readState } from '../src/server/read-state';
import { passkeyVerified } from '../src/server/passkeys';
it('assigns all existing data to the master without changing history and keeps new members empty', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'auctus-account-migration-'));
  try {
    const file = join(dir, 'old.db');
    const old = new Database(file);
    old.pragma('foreign_keys = ON');
    old.exec(
      'CREATE TABLE _migrations (name TEXT PRIMARY KEY,hash TEXT NOT NULL,applied_at INTEGER NOT NULL)',
    );
    for (const name of readdirSync('migrations')
      .filter((n) => n.endsWith('.sql') && n < '0010')
      .sort()) {
      const sql = readFileSync(join('migrations', name), 'utf8');
      old.exec(sql);
      old
        .prepare('INSERT INTO _migrations VALUES (?,?,?)')
        .run(name, createHash('sha256').update(sql).digest('hex'), 0);
    }
    old.exec(`
      INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES ('master','Owner','master@example.test',1,0,0);
      INSERT INTO session (id,expires_at,token,created_at,updated_at,user_id) VALUES ('old-session',9999999999999,'old-token',0,0,'master');
      INSERT INTO exercise VALUES ('e','Press','Technique',NULL,0);
      INSERT INTO program VALUES ('p','Strength','Notes',NULL,0);
      INSERT INTO workout_template VALUES ('t','p','Upper','',NULL,0,0);
      INSERT INTO template_exercise VALUES ('te','t','e',0);
      INSERT INTO template_set (id,template_exercise_id,position,type,min_reps,max_reps,rest_ms) VALUES ('ts','te',0,'normal',6,8,60000);
      INSERT INTO training_week VALUES ('old-week',0,100000);
      INSERT INTO weekly_assignment VALUES ('a','old-week','t','Upper',NULL);
      INSERT INTO schedule_event VALUES ('schedule',0,'["t"]');
      INSERT OR REPLACE INTO settings VALUES (1,'p');
      INSERT INTO mutation_receipt VALUES ('request','fingerprint','{"ok":true}',0);
      INSERT INTO workout_session (id,assignment_id,template_id,name,status,started_at,ended_at) VALUES ('w','a','t','Upper','completed',1000,5000);
      INSERT INTO exercise_session (id,workout_id,exercise_id,name,position,status,started_at,ended_at) VALUES ('es','w','e','Press',0,'completed',1000,4900);
      INSERT INTO set_session (id,workout_id,exercise_session_id,position,type,min_reps,max_reps,legacy_target_grams,rest_ms,status,actual_reps,actual_grams,started_at,ended_at) VALUES ('set','w','es',0,'normal',6,8,0,60000,'completed',7,30000,1100,1200);
    `);
    const result = old.prepare('SELECT * FROM set_session').get();
    old.close();
    const store = openDatabase(file);
    try {
      for (const table of [
        'exercise',
        'program',
        'workout_template',
        'schedule_event',
        'weekly_assignment',
        'workout_session',
      ])
        expect(store.sqlite.prepare(`SELECT DISTINCT user_id FROM ${table}`).all()).toEqual([
          { user_id: 'master' },
        ]);
      expect(store.sqlite.prepare('SELECT * FROM set_session').get()).toEqual(result);
      expect(store.sqlite.prepare('SELECT * FROM settings').get()).toEqual({
        user_id: 'master',
        selected_program_id: 'p',
      });
      expect(store.sqlite.prepare('SELECT user_id,result FROM mutation_receipt').get()).toEqual({
        user_id: 'master',
        result: '{"ok":true}',
      });
      expect(passkeyVerified(store, 'old-session', 'master')).toBe(false);
      const master = readState(forUser(store, 'master'));
      expect(master.account.role).toBe('master');
      expect(master.history).toHaveLength(1);
      const member = await createMember(store, 'master', {
        name: 'Test',
        email: 'test@example.test',
        password: 'long-test-password',
      });
      const empty = readState(forUser(store, member.id));
      expect(empty.history).toEqual([]);
      expect(empty.exercises).toEqual([]);
      expect(empty.programs).toEqual([]);
      expect(store.sqlite.pragma('foreign_key_check')).toEqual([]);
      expect(store.sqlite.pragma('integrity_check', { simple: true })).toBe('ok');
    } finally {
      store.sqlite.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
