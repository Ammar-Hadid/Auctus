import { accountId, type Store } from './db/connection';
import { requireCondition } from './errors';
import { profile } from './accounts';

// Explicit opt-in. New API routes and commands (including AI) are closed by default.
export function requireShowcaseCapability(
  isShowcase: boolean,
  capability?: 'training.read' | 'training.write',
) {
  requireCondition(
    !isShowcase || capability === 'training.read' || capability === 'training.write',
    'This feature is not available in showcase mode.',
    403,
  );
}
const commands = new Set([
  'history.edit',
  'workout.start',
  'workout.cancel',
  'session.action',
  'exercise.save',
  'program.save',
  'template.save',
  'program.select',
  'schedule.apply',
  'archive',
]);
const sessionActions = new Set([
  'exercise.switch',
  'workout.pause',
  'workout.resume',
  'workout.complete',
  'workout.abandon',
  'workout.notes',
  'exercise.start',
  'exercise.complete',
  'exercise.skip',
  'set.prescription',
  'set.edit',
  'set.begin',
  'set.start',
  'set.complete',
  'set.skip',
  'rest.pause',
  'rest.resume',
  'rest.extend',
  'rest.end',
  'exercise.reorder',
  'set.reorder',
  'set.add',
  'exercise.add',
  'exercise.remove',
  'set.remove',
]);
export function requireShowcaseCommand(
  store: Store,
  action: string,
  data: Record<string, unknown>,
) {
  if (profile(store, accountId(store)).role !== 'showcase') return;
  requireCondition(
    commands.has(action) &&
      (action !== 'session.action' || sessionActions.has(String(data.action))),
    'This action is not available in showcase mode.',
    403,
  );
  const count = store.sqlite
    .prepare('SELECT count(*) AS n FROM mutation_receipt WHERE user_id=?')
    .get(accountId(store)) as { n: number };
  requireCondition(
    count.n < 400,
    'This demo has reached its activity limit. Start a fresh demo to continue.',
    429,
  );
}
