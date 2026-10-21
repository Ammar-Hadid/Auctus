import type { Store } from './db/connection';
import { Programming } from './programming';
import { Sessions } from './sessions';
import { trainingWeek } from '../domain/calendar';

/** Fictional records only. Never copy an existing account's data. */
export function seedShowcase(store: Store, now: number) {
  let time = trainingWeek(now).start - 21 * 86400000;
  const clock = () => time;
  const p = new Programming(store, clock);
  const exercises = [
    p.saveExercise({ name: 'Incline dumbbell press', equipment: 'dumbbell' }),
    p.saveExercise({ name: 'Seated cable row', equipment: 'cable' }),
    p.saveExercise({ name: 'Lateral raise', equipment: 'dumbbell' }),
    p.saveExercise({ name: 'Leg press', equipment: 'plate_loaded_machine' }),
    p.saveExercise({ name: 'Romanian deadlift', equipment: 'dumbbell' }),
    p.saveExercise({ name: 'Leg curl', equipment: 'stack_machine' }),
  ];
  const program = p.saveProgram({
    name: 'The strength foundation',
    notes: 'A balanced week of focused strength training.',
  });
  for (const [index, name] of ['Upper body', 'Lower body', 'Full body'].entries()) {
    p.saveTemplate({
      program_id: program.id,
      name,
      exercises: (index === 0
        ? exercises.slice(0, 3)
        : index === 1
          ? exercises.slice(3)
          : [exercises[0], exercises[1], exercises[3]]
      ).map((e) => ({
        exercise_id: e.id,
        sets: Array.from({ length: 3 }, () => ({
          type: 'normal',
          min_reps: 8,
          max_reps: 12,
          rest_ms: 90000,
        })),
      })),
    });
  }
  p.selectProgram(program.id);
  const sessions = new Sessions(store, clock);
  const record = (assignmentId: string, progression: number) => {
    const workout = sessions.start(assignmentId, false);
    const act = (data: Record<string, unknown>) =>
      sessions.act({ workout_id: workout.id, version: sessions.get(workout.id).version, ...data });
    for (const [exerciseIndex, exercise] of workout.exercises.entries()) {
      for (const set of exercise.sets) {
        act({ action: 'set.begin', id: set.id });
        time += 45000;
        act({
          action: 'set.complete',
          id: set.id,
          actual_reps: 8 + progression,
          actual_grams: (20 + exerciseIndex * 5 + progression * 2) * 1000,
        });
        time += 90000;
        act({ action: 'rest.end' });
      }
    }
    act({ action: 'workout.complete' });
  };
  // Three prior weeks give history and progress something meaningful to show.
  for (let week = 0; week < 3; week++) {
    time = trainingWeek(now).start - (3 - week) * 7 * 86400000 + 12 * 3600000;
    for (const [index, assignment] of p.availability().assignments.entries()) {
      time += index === 0 ? 0 : 2 * 86400000;
      record(assignment.id, week);
    }
  }
  // Keep all sample timestamps in the past, including near the weekly boundary.
  if (now - trainingWeek(now).start > 3600000) {
    time = now - 3600000;
    const fullBody = p.availability().assignments.find((a) => a.name === 'Full body')!;
    record(fullBody.id, 3);
  }
  time = now;
  p.availability();
}
