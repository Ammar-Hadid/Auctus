import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Store } from './db/connection';
import { requireCondition } from './errors';
export function command<T>(
  store: Store,
  id: string,
  payload: unknown,
  now: number,
  perform: () => T,
): T {
  z.string().uuid().parse(id);
  const fingerprint = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return store.sqlite
    .transaction(() => {
      const prior = store.sqlite.prepare('SELECT * FROM mutation_receipt WHERE id=?').get(id) as
        { fingerprint: string; result: string } | undefined;
      if (prior) {
        requireCondition(
          prior.fingerprint === fingerprint,
          'This request ID was already used for another action.',
          409,
        );
        return JSON.parse(prior.result) as T;
      }
      const result = perform();
      store.sqlite
        .prepare('INSERT INTO mutation_receipt VALUES (?,?,?,?)')
        .run(id, fingerprint, JSON.stringify(result), now);
      return result;
    })
    .immediate();
}
