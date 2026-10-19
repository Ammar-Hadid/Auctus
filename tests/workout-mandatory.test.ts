import { it, expect } from 'vitest';
import { openDatabase } from './test-store';
import { Programming } from '../src/server/programming';
import { Sessions } from '../src/server/sessions';
import { readState } from '../src/server/read-state';
import { weeklyGoal } from '../src/domain/weekly-goal';

it('persists real booleans, preserves omitted edits, snapshots sessions and excludes optional work from the goal', () => {
  const store = openDatabase(':memory:');
  let now = Date.parse('2026-10-19T12:00Z');
  try {
    const p = new Programming(store, () => now);
    const s = new Sessions(store, () => now);
    const e = p.saveExercise({ name: 'Press', equipment: 'dumbbell' });
    const program = p.saveProgram({ name: 'Plan' });
    const input = {
      program_id: program.id,
      name: 'Mandatory',
      exercises: [
        { exercise_id: e.id, sets: [{ type: 'normal', min_reps: 6, max_reps: 8, rest_ms: 30000 }] },
      ],
    };
    const required = p.saveTemplate(input);
    expect(required.mandatory).toBe(true);
    const optional = p.saveTemplate({ ...input, name: 'Optional', mandatory: false });
    expect(optional.mandatory).toBe(false);
    const omitted = { ...optional, mandatory: undefined };
    const updated = p.saveTemplate(omitted);
    expect(updated.mandatory).toBe(false);
    for (const mandatory of ['false', 0, null])
      expect(() => p.saveTemplate({ ...input, mandatory })).toThrow();
    expect(() => store.sqlite.prepare('UPDATE workout_template SET mandatory=2').run()).toThrow();
    p.selectProgram(program.id);
    let state = readState(store, now);
    expect(weeklyGoal(state.assignments)).toEqual({
      total: 1,
      completed: 0,
      optionalTotal: 1,
      optionalCompleted: 0,
    });
    const assignment = state.assignments.find((a) => a.template_id === optional.id)!;
    let w = s.start(assignment.id, false);
    expect(w.mandatory).toBe(false);
    const edited = p.saveTemplate({ ...updated, mandatory: true });
    expect(p.availability().assignments.find((a) => a.id === assignment.id)?.mandatory).toBe(true);
    expect(s.get(w.id).mandatory).toBe(false);
    expect(() =>
      store.sqlite.prepare('UPDATE workout_session SET mandatory=NULL WHERE id=?').run(w.id),
    ).toThrow();
    p.saveTemplate({ ...edited, mandatory: false });
    now += 1000;
    w = s.act({
      workout_id: w.id,
      version: w.version,
      action: 'workout.complete',
      skipRemaining: true,
    });
    expect(w.mandatory).toBe(false);
    state = readState(store, now);
    expect(state.history[0].mandatory).toBe(false);
    expect(weeklyGoal(state.assignments)).toEqual({
      total: 1,
      completed: 0,
      optionalTotal: 1,
      optionalCompleted: 1,
    });
    p.archive('template', required.id);
    expect(weeklyGoal(readState(store, now).assignments)).toEqual({
      total: 0,
      completed: 0,
      optionalTotal: 1,
      optionalCompleted: 1,
    });
  } finally {
    store.sqlite.close();
  }
});
