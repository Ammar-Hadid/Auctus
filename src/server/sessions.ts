import { elapsed } from '../domain/timing';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { accountId, type Store } from './db/connection';
import type {
  Workout,
  WorkoutDetail,
  ExerciseSession,
  SetSession,
  Pause,
  Rest,
  Assignment,
} from '../domain/types';
import { prescription, notes } from '../domain/validation';
import { Programming } from './programming';
import { requireCondition, DomainError } from './errors';

export class Sessions {
  constructor(
    public store: Store,
    public clock = Date.now,
  ) {
    accountId(store);
  }
  get userId() {
    return accountId(this.store);
  }
  get sql() {
    return this.store.sqlite;
  }
  get(id: string): WorkoutDetail {
    const w = this.sql
      .prepare('SELECT * FROM workout_session WHERE id=? AND user_id=?')
      .get(id, this.userId) as Workout | undefined;
    requireCondition(w, 'Workout not found.', 404);
    const exercises = (
      this.sql
        .prepare('SELECT * FROM exercise_session WHERE workout_id=? ORDER BY position')
        .all(id) as ExerciseSession[]
    ).map((e) => ({
      ...e,
      sets: this.sql
        .prepare(
          'SELECT id,template_set_id,workout_id,exercise_session_id,position,type,min_reps,max_reps,rest_ms,status,actual_reps,actual_grams,started_at,ended_at,notes,removed_at,prefill_grams,prefill_set_id FROM set_session WHERE exercise_session_id=? ORDER BY position',
        )
        .all(e.id) as SetSession[],
    }));
    return {
      ...w,
      mandatory: Boolean(w.mandatory),
      exercises,
      pauses: this.sql
        .prepare('SELECT * FROM workout_pause WHERE workout_id=? ORDER BY started_at')
        .all(id) as Pause[],
      rests: this.sql
        .prepare('SELECT * FROM rest_period WHERE workout_id=? ORDER BY started_at')
        .all(id) as Rest[],
    };
  }
  all() {
    return (
      this.sql
        .prepare('SELECT id FROM workout_session WHERE user_id=? ORDER BY started_at DESC')
        .all(this.userId) as {
        id: string;
      }[]
    ).map((w) => this.get(w.id));
  }
  cancel(input: unknown) {
    const c = z
      .object({ workout_id: z.string(), version: z.number().int().nonnegative() })
      .parse(input);
    return this.sql
      .transaction(() => {
        const w = this.get(c.workout_id);
        requireCondition(
          w.version === c.version,
          'This workout changed on another screen. Review the latest version and retry.',
          409,
        );
        requireCondition(
          ['active', 'paused', 'abandoned'].includes(w.status),
          'Completed workouts cannot be cancelled.',
          409,
        );
        // Later workouts may have copied a weight from an abandoned set.
        this.sql
          .prepare(
            'UPDATE set_session SET prefill_set_id=NULL,prefill_grams=NULL WHERE prefill_set_id IN (SELECT id FROM set_session WHERE workout_id=?) AND workout_id<>?',
          )
          .run(w.id, w.id);
        this.sql.prepare('DELETE FROM rest_period WHERE workout_id=?').run(w.id);
        this.sql.prepare('DELETE FROM workout_pause WHERE workout_id=?').run(w.id);
        this.sql.prepare('DELETE FROM set_session WHERE workout_id=?').run(w.id);
        this.sql.prepare('DELETE FROM exercise_session WHERE workout_id=?').run(w.id);
        this.sql
          .prepare('DELETE FROM workout_session WHERE id=? AND user_id=?')
          .run(w.id, this.userId);
        return { id: w.id };
      })
      .immediate();
  }
  start(assignmentId: string, repeat: boolean) {
    return this.sql
      .transaction(() => {
        const now = this.clock();
        const p = new Programming(this.store, this.clock);
        const { week } = p.availability();
        requireCondition(
          !this.sql
            .prepare(
              "SELECT id FROM workout_session WHERE user_id=? AND status IN ('active','paused')",
            )
            .get(this.userId),
          'Resume, abandon, or cancel your unfinished workout first.',
          409,
        );
        const a = this.sql
          .prepare('SELECT * FROM weekly_assignment WHERE id=? AND user_id=?')
          .get(assignmentId, this.userId) as Assignment | undefined;
        requireCondition(
          a && !a.withdrawn_at && a.week_id === week.id,
          'This workout is not available in the current training week.',
          409,
        );
        const completed = this.sql
          .prepare("SELECT id FROM workout_session WHERE assignment_id=? AND status='completed'")
          .get(a.id);
        requireCondition(!completed || repeat, 'Use Repeat to perform this workout again.', 409);
        const t = p.templates().find((t) => t.id === a.template_id);
        requireCondition(
          t &&
            !t.archived_at &&
            t.program_id === p.selected() &&
            p.programs().some((program) => program.id === t.program_id && !program.archived_at),
          'Template is no longer in your current program.',
        );
        requireCondition(
          t.exercises.length > 0 && t.exercises.every((e) => e.sets.length > 0),
          'Add exercises and at least one set to each exercise before starting.',
        );
        const id = randomUUID();
        this.sql
          .prepare(
            "INSERT INTO workout_session (id,assignment_id,template_id,name,notes,status,started_at,user_id,mandatory) VALUES (?,?,?,?,?,'active',?,?,?)",
          )
          .run(id, a.id, t.id, t.name, t.notes, now, this.userId, Number(t.mandatory));
        t.exercises.forEach((e, i) => {
          const source = p.exercises().find((x) => x.id === e.exercise_id)!;
          const eid = randomUUID();
          this.sql
            .prepare(
              "INSERT INTO exercise_session (id,workout_id,exercise_id,name,position,status,equipment) VALUES (?,?,?,?,?,'pending',?)",
            )
            .run(eid, id, e.exercise_id, source.name, i, source.equipment);
          e.sets.forEach((s, j) => this.insertSet(id, eid, j, s, s.id));
        });
        return this.get(id);
      })
      .immediate();
  }
  // The legacy load column is retained only to preserve pre-migration session snapshots.
  private insertSet(
    workout: string,
    exercise: string,
    position: number,
    input: unknown,
    templateSetId: string | null = null,
  ) {
    const s = prescription.parse(input);
    this.sql
      .prepare(
        "INSERT INTO set_session (id,template_set_id,workout_id,exercise_session_id,position,type,min_reps,max_reps,legacy_target_grams,rest_ms,status) VALUES (?,?,?,?,?,?,?,?,0,?,'pending')",
      )
      .run(
        randomUUID(),
        templateSetId,
        workout,
        exercise,
        position,
        s.type,
        s.min_reps,
        s.max_reps,
        s.rest_ms,
      );
  }
  private closeRest(workout: string, now: number, reason: string) {
    const w = this.get(workout);
    const rest = w.rests.find((r) => r.ended_at === null);
    if (rest && rest.timer_paused_at !== null)
      this.sql
        .prepare(
          'UPDATE rest_period SET timer_paused_ms=timer_paused_ms+?,timer_paused_at=NULL WHERE id=?',
        )
        .run(elapsed(rest.timer_paused_at, now, w.pauses), rest.id);
    this.sql
      .prepare('UPDATE rest_period SET ended_at=?,reason=? WHERE workout_id=? AND ended_at IS NULL')
      .run(now, reason, workout);
  }
  private activateExercise(w: WorkoutDetail, exercise: ExerciseSession, now: number) {
    requireCondition(!exercise.removed_at, 'Exercise not found.', 404);
    requireCondition(
      ['pending', 'paused'].includes(exercise.status),
      'This exercise cannot be started.',
      409,
    );
    requireCondition(
      !w.exercises.some((e) => e.sets.some((s) => ['active', 'paused'].includes(s.status))),
      'Complete or skip the active set before switching exercises.',
      409,
    );
    this.closeRest(w.id, now, 'exercise_switch');
    this.sql
      .prepare("UPDATE exercise_session SET status='paused' WHERE workout_id=? AND status='active'")
      .run(w.id);
    this.sql
      .prepare(
        "UPDATE exercise_session SET status='active',started_at=COALESCE(started_at,?) WHERE id=?",
      )
      .run(now, exercise.id);
  }
  private resolveExercise(exerciseId: string, now: number) {
    const sets = this.sql
      .prepare('SELECT status FROM set_session WHERE exercise_session_id=? AND removed_at IS NULL')
      .all(exerciseId) as { status: SetSession['status'] }[];
    if (sets.some((s) => !['completed', 'skipped'].includes(s.status))) return;
    // Resolve this exercise only; never activate it or disturb another exercise or its rest.
    const status = sets.some((s) => s.status === 'completed') ? 'completed' : 'skipped';
    this.sql
      .prepare(
        "UPDATE exercise_session SET status=?,ended_at=? WHERE id=? AND status IN ('pending','active','paused')",
      )
      .run(status, now, exerciseId);
  }
  act(input: unknown): WorkoutDetail {
    const c = z
      .object({
        workout_id: z.string(),
        version: z.number().int().nonnegative(),
        action: z.string(),
        id: z.string().optional(),
      })
      .passthrough()
      .parse(input);
    return this.sql
      .transaction(() => {
        const w = this.get(c.workout_id);
        const now = this.clock();
        requireCondition(
          w.version === c.version,
          'This workout changed on another screen. Review the latest version and retry.',
          409,
        );
        requireCondition(
          ['active', 'paused'].includes(w.status),
          'This workout is finished. Use history to edit its records.',
          409,
        );
        const allSets = w.exercises.flatMap((e) => e.sets);
        const activeSet = allSets.find((s) => s.status === 'active' || s.status === 'paused');
        const exercise = w.exercises.find((e) => e.id === c.id);
        const set = allSets.find((s) => s.id === c.id);
        if (!['workout.resume', 'workout.abandon', 'workout.notes'].includes(c.action))
          requireCondition(
            w.status === 'active',
            'Resume the workout before making this change.',
            409,
          );
        switch (c.action) {
          case 'exercise.switch': {
            requireCondition(exercise && !exercise.removed_at, 'Exercise not found.', 404);
            requireCondition(
              !['completed', 'skipped'].includes(exercise.status) &&
                exercise.sets.every((s) => s.status === 'pending'),
              'Quick Switch is available before the first set starts.',
              409,
            );
            const source = new Programming(this.store, this.clock)
              .exercises()
              .find((e) => e.id === c.exercise_id && !e.archived_at);
            requireCondition(source, 'Choose an available exercise.');
            requireCondition(source.id !== exercise.exercise_id, 'Choose a different exercise.');
            this.sql
              .prepare('UPDATE exercise_session SET exercise_id=?,name=?,equipment=? WHERE id=?')
              .run(source.id, source.name, source.equipment, exercise.id);
            this.sql
              .prepare(
                'UPDATE set_session SET prefill_grams=NULL,prefill_set_id=NULL WHERE exercise_session_id=?',
              )
              .run(exercise.id);
            break;
          }
          case 'workout.pause': {
            const active = w.exercises.find((e) => e.status === 'active');
            this.sql
              .prepare(
                "UPDATE workout_session SET status='paused',resume_exercise_id=?,resume_set_id=? WHERE id=?",
              )
              .run(active?.id ?? null, activeSet?.id ?? null, w.id);
            this.sql
              .prepare(
                "UPDATE exercise_session SET status='paused' WHERE workout_id=? AND status='active'",
              )
              .run(w.id);
            this.sql
              .prepare(
                "UPDATE set_session SET status='paused' WHERE workout_id=? AND status='active'",
              )
              .run(w.id);
            this.sql
              .prepare('INSERT INTO workout_pause VALUES (?,?,?,NULL)')
              .run(randomUUID(), w.id, now);
            break;
          }
          case 'workout.resume': {
            requireCondition(w.status === 'paused', 'Workout is not paused.', 409);
            this.sql
              .prepare(
                'UPDATE workout_pause SET ended_at=? WHERE workout_id=? AND ended_at IS NULL',
              )
              .run(now, w.id);
            this.sql
              .prepare(
                "UPDATE workout_session SET status='active',resume_exercise_id=NULL,resume_set_id=NULL WHERE id=?",
              )
              .run(w.id);
            if (w.resume_exercise_id)
              this.sql
                .prepare("UPDATE exercise_session SET status='active' WHERE id=?")
                .run(w.resume_exercise_id);
            if (w.resume_set_id)
              this.sql
                .prepare("UPDATE set_session SET status='active' WHERE id=?")
                .run(w.resume_set_id);
            break;
          }
          case 'workout.complete':
          case 'workout.abandon': {
            const completing = c.action === 'workout.complete';
            if (completing) {
              requireCondition(!activeSet, 'Complete or skip the active set first.');
              requireCondition(
                c.skipRemaining === true ||
                  w.exercises.every((e) => ['completed', 'skipped'].includes(e.status)),
                'There are unfinished exercises. Confirm skipping them to finish.',
              );
            }
            this.closeRest(w.id, now, completing ? 'workout_completed' : 'workout_abandoned');
            this.sql
              .prepare(
                'UPDATE workout_pause SET ended_at=? WHERE workout_id=? AND ended_at IS NULL',
              )
              .run(now, w.id);
            this.sql
              .prepare(
                "UPDATE set_session SET status='skipped',ended_at=? WHERE workout_id=? AND status NOT IN ('completed','skipped')",
              )
              .run(now, w.id);
            this.sql
              .prepare(
                "UPDATE exercise_session SET status='skipped',ended_at=? WHERE workout_id=? AND status NOT IN ('completed','skipped')",
              )
              .run(now, w.id);
            this.sql
              .prepare(
                'UPDATE workout_session SET status=?,ended_at=?,resume_exercise_id=NULL,resume_set_id=NULL WHERE id=?',
              )
              .run(completing ? 'completed' : 'abandoned', now, w.id);
            break;
          }
          case 'workout.notes':
            this.sql
              .prepare('UPDATE workout_session SET notes=? WHERE id=?')
              .run(notes.parse(c.notes), w.id);
            break;
          case 'exercise.start': {
            requireCondition(exercise && !exercise.removed_at, 'Exercise not found.', 404);
            this.activateExercise(w, exercise, now);
            break;
          }
          case 'exercise.complete':
          case 'exercise.skip': {
            requireCondition(exercise && !exercise.removed_at, 'Exercise not found.', 404);
            // Older clients may still acknowledge an exercise after the last set resolved it.
            if (c.action === 'exercise.complete' && exercise.status === 'completed') break;
            requireCondition(
              !['completed', 'skipped'].includes(exercise.status),
              'Exercise is already finished.',
              409,
            );
            requireCondition(
              !activeSet || activeSet.exercise_session_id !== exercise.id,
              'Complete or skip this exercise’s active set first.',
            );
            const completing = c.action === 'exercise.complete';
            if (completing) {
              requireCondition(
                exercise.sets.every(
                  (s) => s.removed_at || ['completed', 'skipped'].includes(s.status),
                ),
                'Complete or skip the remaining sets first.',
              );
              this.resolveExercise(exercise.id, now);
              break;
            }
            if (exercise.status === 'active' && !completing)
              this.closeRest(w.id, now, 'exercise_skipped');
            this.sql
              .prepare(
                "UPDATE set_session SET status='skipped',ended_at=? WHERE exercise_session_id=? AND status NOT IN ('completed','skipped')",
              )
              .run(now, exercise.id);
            this.sql
              .prepare('UPDATE exercise_session SET status=?,ended_at=? WHERE id=?')
              .run(completing ? 'completed' : 'skipped', now, exercise.id);
            break;
          }
          case 'set.prescription': {
            requireCondition(
              set && set.status === 'pending' && !set.removed_at,
              'Only a planned set can have its prescription changed.',
            );
            const v = prescription.parse(c);
            this.sql
              .prepare('UPDATE set_session SET type=?,min_reps=?,max_reps=?,rest_ms=? WHERE id=?')
              .run(v.type, v.min_reps, v.max_reps, v.rest_ms, set.id);
            break;
          }
          case 'set.edit': {
            requireCondition(
              set && set.status === 'completed',
              'Only a completed set can be corrected.',
            );
            const v = z
              .object({
                actual_reps: z.number().int().min(0).max(1000),
                actual_grams: z.number().int().min(0).max(2000000),
                notes,
              })
              .parse(c);
            this.sql
              .prepare('UPDATE set_session SET actual_reps=?,actual_grams=?,notes=? WHERE id=?')
              .run(v.actual_reps, v.actual_grams, v.notes, set.id);
            break;
          }
          case 'set.begin':
          case 'set.start': {
            requireCondition(set && !set.removed_at, 'Set not found.', 404);
            requireCondition(set.status === 'pending', 'This set cannot be started.', 409);
            const parent = w.exercises.find((e) => e.id === set.exercise_session_id)!;
            if (c.action === 'set.begin' && parent.status !== 'active')
              this.activateExercise(w, parent, now);
            else requireCondition(parent.status === 'active', 'Start this exercise first.');
            requireCondition(!activeSet, 'Another set is already active.', 409);
            const previous = this.sql
              .prepare(
                `
              SELECT s.id,s.actual_grams FROM set_session s
              JOIN exercise_session e ON e.id=s.exercise_session_id
              WHERE s.workout_id=(
                SELECT id FROM workout_session
                WHERE template_id=? AND id<>? AND status IN ('completed','abandoned') AND ended_at<=?
                ORDER BY ended_at DESC,rowid DESC LIMIT 1
              )
                AND s.template_set_id=? AND s.type=? AND e.exercise_id=? AND e.equipment IS ?
                AND s.status='completed' AND s.removed_at IS NULL AND e.removed_at IS NULL
              LIMIT 1
            `,
              )
              .get(
                w.template_id,
                w.id,
                w.started_at,
                set.template_set_id,
                set.type,
                parent.exercise_id,
                parent.equipment,
              ) as { id: string; actual_grams: number } | undefined;
            this.closeRest(w.id, now, 'next_set');
            this.sql
              .prepare(
                "UPDATE set_session SET status='active',started_at=?,prefill_grams=?,prefill_set_id=? WHERE id=?",
              )
              .run(now, previous?.actual_grams ?? null, previous?.id ?? null, set.id);
            break;
          }
          case 'set.complete': {
            requireCondition(
              set && set.status === 'active',
              'Only an active set can be completed.',
              409,
            );
            const v = z
              .object({
                actual_reps: z.number().int().min(0).max(1000),
                actual_grams: z.number().int().min(0).max(2000000),
                notes,
              })
              .parse(c);
            this.sql
              .prepare(
                "UPDATE set_session SET status='completed',actual_reps=?,actual_grams=?,notes=?,ended_at=? WHERE id=?",
              )
              .run(v.actual_reps, v.actual_grams, v.notes, now, set.id);
            this.sql
              .prepare(
                'INSERT INTO rest_period (id,workout_id,set_id,planned_ms,started_at,ended_at,reason) VALUES (?,?,?,?,?,NULL,NULL)',
              )
              .run(randomUUID(), w.id, set.id, set.rest_ms, now);
            this.resolveExercise(set.exercise_session_id, now);
            break;
          }
          case 'set.skip': {
            requireCondition(
              set && !set.removed_at && !['completed', 'skipped'].includes(set.status),
              'Only an unfinished set can be skipped.',
              409,
            );
            this.sql
              .prepare("UPDATE set_session SET status='skipped',ended_at=? WHERE id=?")
              .run(now, set.id);
            this.resolveExercise(set.exercise_session_id, now);
            break;
          }
          case 'rest.pause':
          case 'rest.resume':
          case 'rest.extend': {
            const rest = w.rests.find((r) => r.ended_at === null);
            requireCondition(rest && rest.id === c.id, 'This rest is no longer active.', 409);
            if (c.action === 'rest.pause') {
              requireCondition(rest.timer_paused_at === null, 'Rest timer is already paused.', 409);
              this.sql
                .prepare('UPDATE rest_period SET timer_paused_at=? WHERE id=?')
                .run(now, rest.id);
            } else if (c.action === 'rest.resume') {
              requireCondition(rest.timer_paused_at !== null, 'Rest timer is not paused.', 409);
              this.sql
                .prepare(
                  'UPDATE rest_period SET timer_paused_ms=timer_paused_ms+?,timer_paused_at=NULL WHERE id=?',
                )
                .run(elapsed(rest.timer_paused_at, now, w.pauses), rest.id);
            } else {
              const ms = z.union([z.literal(5000), z.literal(15000)]).parse(c.ms);
              this.sql
                .prepare('UPDATE rest_period SET added_ms=added_ms+? WHERE id=?')
                .run(ms, rest.id);
            }
            break;
          }
          case 'rest.end':
            requireCondition(
              w.rests.some((r) => !r.ended_at),
              'There is no active rest.',
              409,
            );
            this.closeRest(w.id, now, 'manual');
            break;
          case 'exercise.reorder': {
            const ids = z.array(z.string()).parse(c.ids);
            requireCondition(
              ids.length === w.exercises.length &&
                new Set(ids).size === ids.length &&
                ids.every((id) => w.exercises.some((e) => e.id === id)),
              'Supply each exercise exactly once.',
            );
            ids.forEach((id, i) =>
              this.sql.prepare('UPDATE exercise_session SET position=? WHERE id=?').run(i, id),
            );
            break;
          }
          case 'set.reorder': {
            requireCondition(exercise, 'Exercise not found.', 404);
            const ids = z.array(z.string()).parse(c.ids);
            requireCondition(
              ids.length === exercise.sets.length &&
                new Set(ids).size === ids.length &&
                ids.every((id) => exercise.sets.some((s) => s.id === id)),
              'Supply each set exactly once.',
            );
            ids.forEach((id, i) =>
              this.sql.prepare('UPDATE set_session SET position=? WHERE id=?').run(i, id),
            );
            break;
          }
          case 'set.add': {
            requireCondition(exercise && !exercise.removed_at, 'Choose an available exercise.');
            this.insertSet(w.id, exercise.id, exercise.sets.length, c);
            if (['completed', 'skipped'].includes(exercise.status))
              this.sql
                .prepare("UPDATE exercise_session SET status='pending',ended_at=NULL WHERE id=?")
                .run(exercise.id);
            break;
          }
          case 'exercise.add': {
            const source = new Programming(this.store, this.clock)
              .exercises()
              .find((e) => e.id === c.exercise_id && !e.archived_at);
            requireCondition(source, 'Choose an available exercise.');
            const eid = randomUUID();
            this.sql
              .prepare(
                "INSERT INTO exercise_session (id,workout_id,exercise_id,name,position,status,equipment) VALUES (?,?,?,?,?,'pending',?)",
              )
              .run(eid, w.id, source.id, source.name, w.exercises.length, source.equipment);
            const sets = z.array(prescription).min(1).max(100).parse(c.sets);
            sets.forEach((s, i) => this.insertSet(w.id, eid, i, s));
            break;
          }
          case 'exercise.remove': {
            requireCondition(exercise && !exercise.removed_at, 'Exercise not found.', 404);
            requireCondition(
              exercise.status !== 'active' &&
                !exercise.sets.some((s) => s.status === 'active' || s.status === 'paused'),
              'Finish or skip active activity before removing this exercise.',
            );
            this.sql
              .prepare(
                "UPDATE set_session SET status=CASE WHEN status='completed' THEN status ELSE 'skipped' END,ended_at=COALESCE(ended_at,?),removed_at=? WHERE exercise_session_id=?",
              )
              .run(now, now, exercise.id);
            this.sql
              .prepare(
                "UPDATE exercise_session SET status=CASE WHEN status='completed' THEN status ELSE 'skipped' END,ended_at=COALESCE(ended_at,?),removed_at=? WHERE id=?",
              )
              .run(now, now, exercise.id);
            break;
          }
          case 'set.remove': {
            requireCondition(set && !set.removed_at, 'Set not found.', 404);
            requireCondition(
              !['active', 'paused'].includes(set.status),
              'Finish or skip the active set before removing it.',
            );
            this.sql
              .prepare(
                "UPDATE set_session SET status=CASE WHEN status='completed' THEN status ELSE 'skipped' END,ended_at=COALESCE(ended_at,?),removed_at=? WHERE id=?",
              )
              .run(now, now, set.id);
            this.resolveExercise(set.exercise_session_id, now);
            break;
          }
          default:
            throw new DomainError('Unknown workout action.');
        }
        this.sql.prepare('UPDATE workout_session SET version=version+1 WHERE id=?').run(w.id);
        return this.get(w.id);
      })
      .immediate();
  }
}
