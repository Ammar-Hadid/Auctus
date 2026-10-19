import { it, expect } from 'vitest';
import { openDatabase } from './test-store';
import { Programming } from '../src/server/programming';
import { Sessions } from '../src/server/sessions';
import { equipmentTypes } from '../src/domain/equipment';

it('validates equipment and preserves it when an older client omits the field', () => {
  const store = openDatabase(':memory:');
  try {
    const p = new Programming(store);
    for (const equipment of equipmentTypes) {
      const e = p.saveExercise({ name: 'Press', equipment });
      expect(e.equipment).toBe(equipment);
      expect(p.saveExercise({ id: e.id, name: 'Renamed press' }).equipment).toBe(equipment);
    }
    expect(p.saveExercise({ name: 'Legacy exercise' }).equipment).toBeNull();
    expect(() => p.saveExercise({ name: 'Press', equipment: 'invalid' })).toThrow();
    expect(() => store.sqlite.prepare('UPDATE exercise SET equipment=?').run('invalid')).toThrow();
  } finally {
    store.sqlite.close();
  }
});

it('snapshots equipment at workout start and for added exercises without rewriting history or mixing weights', () => {
  const store = openDatabase(':memory:');
  let now = Date.parse('2026-10-19T12:00Z');
  try {
    const p = new Programming(store, () => now);
    const s = new Sessions(store, () => now);
    const e = p.saveExercise({ name: 'Press', equipment: 'dumbbell' });
    const p1 = p.saveProgram({ name: 'Equipment check' });
    const set = { type: 'normal', min_reps: 6, max_reps: 8, rest_ms: 60000 };
    p.saveTemplate({
      program_id: p1.id,
      name: 'Upper',
      exercises: [{ exercise_id: e.id, sets: [set] }],
    });
    p.selectProgram(p1.id);
    const assignment = p.availability().assignments[0].id;
    let w = s.start(assignment, false);
    const firstId = w.id;
    const act = (action: string, data: Record<string, unknown> = {}) => {
      now += 1000;
      w = s.act({ workout_id: w.id, version: w.version, action, ...data });
    };
    expect(w.exercises[0].equipment).toBe('dumbbell');
    act('exercise.start', { id: w.exercises[0].id });
    act('set.start', { id: w.exercises[0].sets[0].id });
    act('set.complete', { id: w.exercises[0].sets[0].id, actual_grams: 30000, actual_reps: 8 });
    act('workout.complete', { skipRemaining: true });
    now += 1000;
    w = s.start(assignment, true);
    act('exercise.start', { id: w.exercises[0].id });
    act('set.start', { id: w.exercises[0].sets[0].id });
    expect(w.exercises[0].sets[0].prefill_grams).toBe(30000);
    act('set.complete', { id: w.exercises[0].sets[0].id, actual_grams: 35000, actual_reps: 8 });
    act('workout.complete', { skipRemaining: true });
    p.saveExercise({ id: e.id, name: e.name, equipment: 'plate_loaded_machine' });
    expect(s.get(firstId).exercises[0].equipment).toBe('dumbbell');
    now += 1000;
    w = s.start(assignment, true);
    expect(w.exercises[0].equipment).toBe('plate_loaded_machine');
    act('exercise.start', { id: w.exercises[0].id });
    act('set.start', { id: w.exercises[0].sets[0].id });
    expect(w.exercises[0].sets[0].prefill_grams).toBeNull();
    const cable = p.saveExercise({ name: 'Rope pushdown', equipment: 'cable' });
    act('exercise.add', { exercise_id: cable.id, sets: [set] });
    expect(w.exercises[1].equipment).toBe('cable');
    p.saveExercise({ id: cable.id, name: cable.name, equipment: 'other' });
    expect(s.get(w.id).exercises[1].equipment).toBe('cable');
  } finally {
    store.sqlite.close();
  }
});
