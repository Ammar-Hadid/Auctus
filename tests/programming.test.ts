import { describe, it, expect } from 'vitest';
import { openDatabase } from '../src/server/db/connection';
import { Programming } from '../src/server/programming';

describe('programming and weekly assignments', () => {
  it('round trips prescribed exercises and sets, rejects stale edits, archives safely and rolls weeks forward', () => {
    const store = openDatabase(':memory:');
    let now = Date.parse('2026-10-18T12:00Z');
    const service = new Programming(store, () => now);
    const exercise = service.saveExercise({ name: 'DB row', details: 'Per side' });
    const program = service.saveProgram({ name: 'Strength', notes: '' });
    const template = service.saveTemplate({
      program_id: program.id,
      name: 'A',
      notes: '',
      exercises: [
        {
          exercise_id: exercise.id,
          sets: [{ type: 'normal', target_reps: 8, rest_ms: 90000 }],
        },
      ],
    });
    expect(service.templates()[0].exercises[0].sets[0].target_reps).toBe(8);
    service.selectProgram(program.id);
    const week = service.availability();
    expect(week.assignments).toHaveLength(1);
    expect(service.availability().assignments[0].id).toBe(week.assignments[0].id);
    service.saveTemplate({ ...template, name: 'A revised', version: 0 });
    expect(() => service.saveTemplate({ ...template, name: 'Stale', version: 0 })).toThrow(
      'changed',
    );
    now = Date.parse('2026-10-19T01:00Z');
    expect(service.availability().week.id).toBe('2026-10-19');
    expect(service.availability().assignments).toHaveLength(1);
    service.archive('template', template.id);
    expect(service.availability().assignments[0].withdrawn_at).not.toBeNull();
    expect(store.sqlite.prepare('SELECT COUNT(*) AS n FROM weekly_assignment').get()).toEqual({
      n: 2,
    });
    store.sqlite.close();
  });
  it('preserves calendar availability for an unvisited historical week', () => {
    const store = openDatabase(':memory:');
    let now = Date.parse('2026-10-05T12:00Z');
    const service = new Programming(store, () => now);
    const p = service.saveProgram({ name: 'Base' });
    service.saveTemplate({ program_id: p.id, name: 'A', exercises: [] });
    service.selectProgram(p.id);
    now = Date.parse('2026-11-02T12:00Z');
    expect(service.availability(Date.parse('2026-10-15T12:00Z')).assignments).toHaveLength(1);
    store.sqlite.close();
  });
});
