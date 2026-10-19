import { equipmentTypes } from '../domain/equipment';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { accountId, type Store } from './db/connection';
import type {
  Exercise,
  Program,
  Template,
  TemplateExercise,
  Prescription,
  Assignment,
} from '../domain/types';
import { trainingWeek } from '../domain/calendar';
import { name, notes, id, templateInput } from '../domain/validation';
import { requireCondition } from './errors';

export class Programming {
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
  exercises() {
    return this.sql
      .prepare('SELECT * FROM exercise WHERE user_id=? ORDER BY name COLLATE NOCASE')
      .all(this.userId) as Exercise[];
  }
  programs() {
    return this.sql
      .prepare('SELECT * FROM program WHERE user_id=? ORDER BY created_at')
      .all(this.userId) as Program[];
  }
  templates() {
    return (
      this.sql
        .prepare('SELECT * FROM workout_template WHERE user_id=? ORDER BY created_at')
        .all(this.userId) as Omit<Template, 'exercises'>[]
    ).map((t) => ({
      ...t,
      exercises: (
        this.sql
          .prepare('SELECT * FROM template_exercise WHERE template_id=? ORDER BY position')
          .all(t.id) as (TemplateExercise & { id: string })[]
      ).map((e) => ({
        ...e,
        sets: this.sql
          .prepare('SELECT * FROM template_set WHERE template_exercise_id=? ORDER BY position')
          .all(e.id) as Prescription[],
      })),
    }));
  }
  selected() {
    return (
      (
        this.sql
          .prepare('SELECT selected_program_id FROM settings WHERE user_id=?')
          .get(this.userId) as { selected_program_id: string | null } | undefined
      )?.selected_program_id ?? null
    );
  }
  saveExercise(input: unknown) {
    const v = z
      .object({
        id: id.optional(),
        name,
        details: notes,
        equipment: z.enum(equipmentTypes).nullable().optional(),
      })
      .parse(input);
    const key = v.id ?? randomUUID();
    if (v.id) {
      requireCondition(
        this.exercises().some((e) => e.id === v.id),
        'Exercise not found.',
        404,
      );
      this.sql
        .prepare('UPDATE exercise SET name=?,details=?,equipment=? WHERE id=?')
        .run(
          v.name,
          v.details,
          v.equipment === undefined
            ? this.exercises().find((e) => e.id === key)!.equipment
            : v.equipment,
          key,
        );
    } else
      this.sql
        .prepare(
          'INSERT INTO exercise (id,name,details,archived_at,created_at,user_id,equipment) VALUES (?,?,?,NULL,?,?,?)',
        )
        .run(key, v.name, v.details, this.clock(), this.userId, v.equipment ?? null);
    return this.exercises().find((e) => e.id === key)!;
  }
  saveProgram(input: unknown) {
    const v = z.object({ id: id.optional(), name, notes }).parse(input);
    const key = v.id ?? randomUUID();
    if (v.id) {
      requireCondition(
        this.programs().some((p) => p.id === v.id),
        'Program not found.',
        404,
      );
      this.sql.prepare('UPDATE program SET name=?,notes=? WHERE id=?').run(v.name, v.notes, key);
    } else
      this.sql
        .prepare(
          'INSERT INTO program (id,name,notes,archived_at,created_at,user_id) VALUES (?,?,?,NULL,?,?)',
        )
        .run(key, v.name, v.notes, this.clock(), this.userId);
    return this.programs().find((p) => p.id === key)!;
  }
  saveTemplate(input: unknown) {
    const v = templateInput.parse(input);
    const key = v.id ?? randomUUID();
    return this.sql
      .transaction(() => {
        requireCondition(
          this.programs().some((p) => p.id === v.program_id && !p.archived_at),
          'Choose an available program.',
        );
        const prior = v.id ? this.templates().find((t) => t.id === v.id) : undefined;
        if (v.id) {
          requireCondition(prior, 'Workout not found.', 404);
          requireCondition(
            prior.version === v.version,
            'This workout changed. Reload before saving.',
            409,
          );
          requireCondition(!prior.archived_at, 'Archived workouts cannot be edited.');
          this.sql
            .prepare('UPDATE workout_template SET name=?,notes=?,version=version+1 WHERE id=?')
            .run(v.name, v.notes, key);
          this.sql.prepare('DELETE FROM template_exercise WHERE template_id=?').run(key);
        } else
          this.sql
            .prepare(
              'INSERT INTO workout_template (id,program_id,name,notes,archived_at,version,created_at,user_id) VALUES (?,?,?,?,NULL,0,?,?)',
            )
            .run(key, v.program_id, v.name, v.notes, this.clock(), this.userId);
        const usedIds = new Set<string>();
        v.exercises.forEach((e, position) => {
          requireCondition(
            this.exercises().some((x) => x.id === e.exercise_id),
            'Exercise not found.',
          );
          const priorExercise = prior?.exercises.find((old) => old.id === e.id);
          requireCondition(
            !e.id || (priorExercise?.exercise_id === e.exercise_id && !usedIds.has(e.id)),
            'Exercise reference is invalid. Reload the workout before saving.',
          );
          const eid = e.id ?? randomUUID();
          usedIds.add(eid);
          this.sql
            .prepare('INSERT INTO template_exercise VALUES (?,?,?,?)')
            .run(eid, key, e.exercise_id, position);
          e.sets.forEach((s, i) => {
            requireCondition(
              !s.id || (priorExercise?.sets.some((old) => old.id === s.id) && !usedIds.has(s.id)),
              'Set reference is invalid. Reload the workout before saving.',
            );
            const sid = s.id ?? randomUUID();
            usedIds.add(sid);
            this.sql
              .prepare(
                'INSERT INTO template_set (id,template_exercise_id,position,type,min_reps,max_reps,rest_ms) VALUES (?,?,?,?,?,?,?)',
              )
              .run(sid, eid, i, s.type, s.min_reps, s.max_reps, s.rest_ms);
          });
        });
        return this.templates().find((t) => t.id === key)!;
      })
      .immediate();
  }
  selectProgram(programId: string | null) {
    if (programId !== null)
      requireCondition(
        this.programs().some((p) => p.id === programId && !p.archived_at),
        'Choose an available program.',
      );
    this.sql
      .transaction(() => {
        this.sql
          .prepare(
            'INSERT INTO settings (user_id,selected_program_id) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET selected_program_id=excluded.selected_program_id',
          )
          .run(this.userId, programId);
        this.applySchedule();
      })
      .immediate();
    return { ok: true };
  }
  applySchedule() {
    const selected = this.selected();
    const ids = this.templates()
      .filter((t) => t.program_id === selected && !t.archived_at)
      .map((t) => t.id);
    this.sql
      .prepare('INSERT INTO schedule_event (id,effective_at,template_ids,user_id) VALUES (?,?,?,?)')
      .run(randomUUID(), this.clock(), JSON.stringify(ids), this.userId);
    return this.availability();
  }
  archive(kind: 'exercise' | 'program' | 'template', key: string) {
    const table = { exercise: 'exercise', program: 'program', template: 'workout_template' }[kind];
    requireCondition(table, 'Unknown archive type.');
    return this.sql
      .transaction(() => {
        const result = this.sql
          .prepare(`UPDATE ${table} SET archived_at=? WHERE id=? AND user_id=?`)
          .run(this.clock(), key, this.userId);
        requireCondition(result.changes, 'Record not found.', 404);
        if (kind === 'program' && this.selected() === key) this.selectProgram(null);
        if (kind === 'template') this.applySchedule();
        return { ok: true };
      })
      .immediate();
  }
  availability(at = this.clock()) {
    const week = trainingWeek(at);
    return this.sql
      .transaction(() => {
        this.sql
          .prepare('INSERT OR IGNORE INTO training_week VALUES (?,?,?)')
          .run(week.id, week.start, week.end);
        const events = this.sql
          .prepare(
            'SELECT template_ids FROM schedule_event WHERE user_id=? AND effective_at<? ORDER BY effective_at DESC,rowid DESC LIMIT 1',
          )
          .get(this.userId, Math.min(at + 1, week.end)) as { template_ids: string } | undefined;
        const ids: string[] = events ? JSON.parse(events.template_ids) : [];
        for (const key of ids) {
          const t = this.sql
            .prepare('SELECT name FROM workout_template WHERE id=? AND user_id=?')
            .get(key, this.userId) as { name: string } | undefined;
          if (t)
            this.sql
              .prepare(
                'INSERT INTO weekly_assignment (id,week_id,template_id,name,withdrawn_at,user_id) VALUES (?,?,?,?,NULL,?) ON CONFLICT(week_id,template_id) DO UPDATE SET withdrawn_at=NULL',
              )
              .run(randomUUID(), week.id, key, t.name, this.userId);
        }
        const assignments = this.sql
          .prepare('SELECT *,0 AS completed FROM weekly_assignment WHERE week_id=? AND user_id=?')
          .all(week.id, this.userId) as Assignment[];
        for (const a of assignments)
          if (
            !ids.includes(a.template_id) &&
            a.withdrawn_at === null &&
            !this.sql
              .prepare('SELECT id FROM workout_session WHERE assignment_id=? LIMIT 1')
              .get(a.id)
          )
            this.sql
              .prepare('UPDATE weekly_assignment SET withdrawn_at=? WHERE id=?')
              .run(at, a.id);
        return {
          week,
          assignments: this.sql
            .prepare(
              'SELECT *,0 AS completed FROM weekly_assignment WHERE week_id=? AND user_id=? ORDER BY rowid',
            )
            .all(week.id, this.userId) as Assignment[],
        };
      })
      .immediate();
  }
}
