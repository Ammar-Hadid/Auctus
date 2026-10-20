import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { openDatabase, forUser } from '../src/server/db/connection';
import { provisionOwner } from '../src/server/owner';
import { createMember, requireMaster, confirmPassword } from '../src/server/accounts';
import { Programming } from '../src/server/programming';
import { Sessions } from '../src/server/sessions';
import { dispatch } from '../src/server/dispatch';
import { readState } from '../src/server/read-state';
import { editHistory } from '../src/server/history';
async function setup() {
  const db = openDatabase(':memory:');
  await provisionOwner(db, 'master@example.test', 'master-test-password');
  const master = (
    db.sqlite.prepare("SELECT user_id AS id FROM account_access WHERE role='master'").get() as {
      id: string;
    }
  ).id;
  const member = await createMember(db, master, {
    name: 'Test',
    email: 'test@example.test',
    password: 'member-test-password',
  });
  return { db, master, member, owner: forUser(db, master), test: forUser(db, member.id) };
}
it('isolates reads, writes, history, scheduling, active workouts and request receipts', async () => {
  const x = await setup();
  try {
    const a = new Programming(x.owner),
      b = new Programming(x.test);
    const e = a.saveExercise({ name: 'Private press' }),
      p = a.saveProgram({ name: 'Private program' });
    const t = a.saveTemplate({
      program_id: p.id,
      name: 'A',
      exercises: [
        { exercise_id: e.id, sets: [{ type: 'normal', min_reps: 6, max_reps: 8, rest_ms: 1000 }] },
      ],
    });
    a.selectProgram(p.id);
    const assignment = a.availability().assignments[0];
    const w = new Sessions(x.owner).start(assignment.id, false);
    expect(readState(x.test).exercises).toEqual([]);
    expect(readState(x.test).templates).toEqual([]);
    expect(readState(x.test).history).toEqual([]);
    expect(readState(x.test).activeWorkout).toBeNull();
    expect(() => b.saveExercise({ ...e, name: 'Attack' })).toThrow();
    expect(() => b.saveProgram({ ...p, name: 'Attack' })).toThrow();
    for (const kind of ['exercise', 'program', 'template'] as const)
      expect(() =>
        b.archive(kind, { exercise: e.id, program: p.id, template: t.id }[kind]),
      ).toThrow();
    expect(() => b.selectProgram(p.id)).toThrow();
    expect(() => b.saveTemplate({ ...t })).toThrow();
    expect(() => new Sessions(x.test).get(w.id)).toThrow();
    expect(() => new Sessions(x.test).start(assignment.id, false)).toThrow();
    expect(() =>
      new Sessions(x.test).act({ workout_id: w.id, version: w.version, action: 'workout.abandon' }),
    ).toThrow();
    expect(() => new Sessions(x.test).cancel({ workout_id: w.id, version: w.version })).toThrow(
      'Workout not found',
    );
    expect(() =>
      editHistory(x.test, {
        workout_id: w.id,
        version: w.version,
        kind: 'workout',
        notes: 'Attack',
      }),
    ).toThrow();
    const bp = b.saveProgram({ name: 'Test only' }),
      be = b.saveExercise({ name: 'Test row' });
    expect(() =>
      b.saveTemplate({
        program_id: bp.id,
        name: 'Attack',
        exercises: [{ exercise_id: e.id, sets: [] }],
      }),
    ).toThrow();
    b.saveTemplate({
      program_id: bp.id,
      name: 'B',
      exercises: [
        { exercise_id: be.id, sets: [{ type: 'normal', min_reps: 8, max_reps: 8, rest_ms: 1000 }] },
      ],
    });
    b.selectProgram(bp.id);
    expect(new Sessions(x.test).start(b.availability().assignments[0].id, false).id).not.toBe(w.id);
    const requestId = randomUUID();
    const own = dispatch(x.owner, {
      requestId,
      action: 'exercise.save',
      data: { name: 'Receipt A' },
    });
    const other = dispatch(x.test, {
      requestId,
      action: 'exercise.save',
      data: { name: 'Receipt B' },
    });
    expect(other).not.toEqual(own);
    expect(a.exercises().map((e) => e.name)).not.toContain('Test row');
    expect(b.selected()).toBe(bp.id);
    expect(a.selected()).toBe(p.id);
    expect(() =>
      x.db.sqlite
        .prepare('INSERT INTO template_exercise VALUES (?,?,?,0)')
        .run(randomUUID(), t.id, be.id),
    ).toThrow('account mismatch');
    expect(() => new Programming(x.db)).toThrow('scope');
  } finally {
    x.db.sqlite.close();
  }
});
it('only the master can create members, cannot create another master, and recovery preserves the member', async () => {
  const x = await setup();
  try {
    expect(() => requireMaster(x.db, x.member.id)).toThrow();
    await expect(
      createMember(x.db, x.member.id, {
        name: 'Attack',
        email: 'x@example.test',
        password: 'another-long-password',
      }),
    ).rejects.toThrow();
    await expect(
      createMember(x.db, x.master, {
        name: 'Attack',
        email: 'x@example.test',
        password: 'another-long-password',
        role: 'master',
      }),
    ).rejects.toThrow();
    await expect(
      createMember(x.db, x.master, {
        name: 'Duplicate',
        email: 'TEST@example.test',
        password: 'another-long-password',
      }),
    ).rejects.toThrow('already exists');
    await expect(confirmPassword(x.db, x.master, 'wrong')).rejects.toThrow('incorrect');
    await confirmPassword(x.db, x.master, 'master-test-password');
    await provisionOwner(x.db, 'master@example.test', 'changed-master-password');
    expect(x.db.sqlite.prepare('SELECT name FROM user WHERE id=?').get(x.member.id)).toEqual({
      name: 'Test',
    });
    expect(x.db.sqlite.prepare('SELECT count(*) n FROM user').get()).toEqual({ n: 2 });
  } finally {
    x.db.sqlite.close();
  }
});
