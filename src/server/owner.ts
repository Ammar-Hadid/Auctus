import { hashPassword } from 'better-auth/crypto';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Store } from './db/connection';

export async function provisionOwner(store: Store, email: string, password: string) {
  z.email().parse(email);
  z.string().min(12).max(128).parse(password);
  const hash = await hashPassword(password);
  const now = Date.now();
  store.sqlite
    .transaction(() => {
      const prior = store.sqlite
        .prepare("SELECT user_id AS id FROM account_access WHERE role='master'")
        .get() as { id: string } | undefined;
      const id = prior?.id ?? randomUUID();
      if (!prior) {
        store.sqlite
          .prepare(
            'INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,1,?,?)',
          )
          .run(id, 'Owner', email, now, now);
        store.sqlite
          .prepare(
            'INSERT INTO account (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
          )
          .run(randomUUID(), id, 'credential', id, hash, now, now);
        store.sqlite.prepare("INSERT INTO account_access VALUES (?,'master',NULL)").run(id);
        for (const table of [
          'exercise',
          'program',
          'workout_template',
          'schedule_event',
          'weekly_assignment',
          'workout_session',
        ])
          store.sqlite.prepare(`UPDATE ${table} SET user_id=? WHERE user_id IS NULL`).run(id);
      } else {
        store.sqlite.prepare('UPDATE user SET email=?,updated_at=? WHERE id=?').run(email, now, id);
        store.sqlite
          .prepare(
            "UPDATE account SET password=?,updated_at=? WHERE user_id=? AND provider_id='credential'",
          )
          .run(hash, now, id);
        store.sqlite.prepare('DELETE FROM session WHERE user_id=?').run(id);
      }
    })
    .immediate();
}
