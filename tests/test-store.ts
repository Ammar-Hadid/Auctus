import { openDatabase as open, forUser } from '../src/server/db/connection';
export function openDatabase(path = ':memory:') {
  const store = open(path);
  let user = store.sqlite.prepare('SELECT id FROM user LIMIT 1').get() as
    { id: string } | undefined;
  if (!user) {
    user = { id: 'test-owner' };
    store.sqlite
      .prepare(
        "INSERT INTO user (id,name,email,created_at,updated_at) VALUES (?,'Owner','fixture@example.test',0,0)",
      )
      .run(user.id);
    store.sqlite.prepare("INSERT INTO account_access VALUES (?,'master',NULL)").run(user.id);
    for (const table of [
      'exercise',
      'program',
      'workout_template',
      'schedule_event',
      'weekly_assignment',
      'workout_session',
    ])
      store.sqlite.prepare(`UPDATE ${table} SET user_id=? WHERE user_id IS NULL`).run(user.id);
  }
  return forUser(store, user.id);
}
