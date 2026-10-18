import { z } from 'zod';
import type { Store } from './db/connection';
import { Sessions } from './sessions';
import { requireCondition } from './errors';
import { notes, setType } from '../domain/validation';
import type { WorkoutDetail } from '../domain/types';
const instant = z.number().int().nonnegative().max(8640000000000000);
function validateTimeline(w: WorkoutDetail) {
  const end = w.ended_at!;
  requireCondition(end >= w.started_at, 'Workout ends before its start.');
  const sets = w.exercises
    .flatMap((e) => e.sets)
    .filter((s) => s.started_at !== null && s.ended_at !== null);
  for (const s of sets)
    requireCondition(
      s.started_at! >= w.started_at && s.ended_at! <= end && s.ended_at! >= s.started_at!,
      'Set timestamps must be ordered and within the workout.',
    );
  const ordered = [...sets].sort((a, b) => a.started_at! - b.started_at!);
  for (let i = 1; i < ordered.length; i++)
    requireCondition(
      ordered[i].started_at! >= ordered[i - 1].ended_at!,
      'Set times cannot overlap.',
    );
  for (const e of w.exercises) {
    requireCondition(
      e.started_at === null || e.started_at >= w.started_at,
      'Exercise starts before workout.',
    );
    requireCondition(e.ended_at === null || e.ended_at <= end, 'Exercise ends after workout.');
    for (const s of e.sets)
      if (s.started_at !== null)
        requireCondition(
          e.started_at !== null &&
            s.started_at >= e.started_at &&
            (e.ended_at === null || s.ended_at === null || s.ended_at <= e.ended_at),
          'Set times must fall within its exercise.',
        );
  }
  for (const p of w.pauses)
    requireCondition(
      p.started_at >= w.started_at &&
        p.ended_at !== null &&
        p.ended_at <= end &&
        p.ended_at >= p.started_at,
      'Pause must stay within the workout.',
    );
  for (const r of w.rests) {
    const preceding = sets.find((s) => s.id === r.set_id);
    requireCondition(
      r.ended_at !== null &&
        r.started_at >= w.started_at &&
        r.ended_at <= end &&
        r.ended_at >= r.started_at,
      'Rest times must be ordered and within the workout.',
    );
    requireCondition(
      !preceding || r.started_at >= preceding.ended_at!,
      'Rest cannot start before its set finishes.',
    );
    for (const s of sets)
      requireCondition(
        s.started_at! >= r.ended_at! || s.ended_at! <= r.started_at,
        'Rest cannot overlap a set.',
      );
  }
  const rests = [...w.rests].sort((a, b) => a.started_at - b.started_at);
  for (let i = 1; i < rests.length; i++)
    requireCondition(rests[i].started_at >= rests[i - 1].ended_at!, 'Rest periods cannot overlap.');
}
export function editHistory(store: Store, input: unknown) {
  const c = z
    .object({
      workout_id: z.string(),
      version: z.number().int(),
      kind: z.enum(['set', 'workout', 'rest']),
      id: z.string().optional(),
    })
    .passthrough()
    .parse(input);
  const s = new Sessions(store);
  return store.sqlite
    .transaction(() => {
      const w = s.get(c.workout_id);
      requireCondition(
        w.version === c.version,
        'This workout changed. Reload before editing.',
        409,
      );
      requireCondition(
        ['completed', 'abandoned'].includes(w.status),
        'Finish the workout before using history edits.',
      );
      if (c.kind === 'set') {
        const previous = w.exercises.flatMap((e) => e.sets).find((s) => s.id === c.id);
        requireCondition(previous, 'Set not found.', 404);
        const v = z
          .object({
            status: z.enum(['completed', 'skipped']),
            actual_reps: z.number().int().min(0).max(1000),
            actual_grams: z.number().int().min(0).max(2000000),
            type: setType,
            notes,
            started_at: instant,
            ended_at: instant,
          })
          .parse(c);
        store.sqlite
          .prepare(
            'UPDATE set_session SET status=?,actual_reps=?,actual_grams=?,type=?,notes=?,started_at=?,ended_at=? WHERE id=?',
          )
          .run(
            v.status,
            v.status === 'completed' ? v.actual_reps : null,
            v.status === 'completed' ? v.actual_grams : null,
            v.type,
            v.notes,
            v.started_at,
            v.ended_at,
            previous.id,
          );
        // Adjacent rest edges follow corrected set edges; unrelated periods retain their timestamps.
        store.sqlite
          .prepare('UPDATE rest_period SET started_at=? WHERE set_id=?')
          .run(v.ended_at, previous.id);
        if (previous.started_at !== null)
          store.sqlite
            .prepare(
              "UPDATE rest_period SET ended_at=? WHERE workout_id=? AND ended_at=? AND reason='next_set'",
            )
            .run(v.started_at, w.id, previous.started_at);
      } else if (c.kind === 'workout') {
        const v = z.object({ notes, started_at: instant, ended_at: instant }).parse(c);
        store.sqlite
          .prepare('UPDATE workout_session SET notes=?,started_at=?,ended_at=? WHERE id=?')
          .run(v.notes, v.started_at, v.ended_at, w.id);
      } else {
        requireCondition(
          w.rests.some((r) => r.id === c.id),
          'Rest not found.',
          404,
        );
        const v = z.object({ started_at: instant, ended_at: instant }).parse(c);
        store.sqlite
          .prepare('UPDATE rest_period SET started_at=?,ended_at=? WHERE id=?')
          .run(v.started_at, v.ended_at, c.id!);
      }
      validateTimeline(s.get(w.id));
      store.sqlite.prepare('UPDATE workout_session SET version=version+1 WHERE id=?').run(w.id);
      return s.get(w.id);
    })
    .immediate();
}
