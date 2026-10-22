import type { WorkoutDetail, Metrics } from './types';
import { activeDuration } from './timing';
import { trainingWeek } from './calendar';
export function summarize(workouts: WorkoutDetail[]): Metrics {
  const completed = workouts.filter((w) => w.status === 'completed');
  const sets = completed
    .flatMap((w) => w.exercises.flatMap((e) => e.sets))
    .filter((s) => s.status === 'completed');
  return {
    workouts: completed.length,
    sets: sets.length,
    volume: sets.reduce((n, s) => n + ((s.actual_grams ?? 0) / 1000) * (s.actual_reps ?? 0), 0),
    duration: completed.reduce((n, w) => n + activeDuration(w, w.ended_at!), 0),
  };
}
export function estimatedMax(kg: number, reps: number) {
  if (kg <= 0 || reps < 1 || reps > 10) return null;
  return reps === 1 ? kg : kg * (1 + reps / 30);
}
export interface RecordedSet {
  kg: number;
  reps: number;
}
export function heaviestSet(sets: RecordedSet[]): RecordedSet | null {
  return sets.reduce<RecordedSet | null>(
    (best, set) =>
      !best || set.kg > best.kg || (set.kg === best.kg && set.reps > best.reps) ? set : best,
    null,
  );
}

/** One result per completed workout; recorded work survives removal from the plan. */
export function exerciseProgress(workouts: WorkoutDetail[], exerciseId: string) {
  return workouts
    .filter((w) => w.status === 'completed')
    .flatMap((w) => {
      const sets = w.exercises
        .filter((e) => e.exercise_id === exerciseId)
        .flatMap((e) => e.sets)
        .filter((s) => s.status === 'completed');
      const workingSets = sets
        .filter(
          (s) =>
            s.type !== 'warmup' &&
            s.actual_grams !== null &&
            s.actual_grams >= 0 &&
            s.actual_reps !== null &&
            s.actual_reps > 0,
        )
        .map((s) => ({ kg: s.actual_grams! / 1000, reps: s.actual_reps! }));
      if (!workingSets.length) return [];
      const estimates = workingSets
        .map((s) => estimatedMax(s.kg, s.reps))
        .filter((value): value is number => value !== null);
      const topSet = heaviestSet(workingSets)!;
      return [
        {
          workoutId: w.id,
          date: w.started_at,
          weekId: w.week_id ?? trainingWeek(w.started_at).id,
          name: w.name,
          sets,
          workingSets,
          topSet,
          volume: workingSets.reduce((sum, s) => sum + s.kg * s.reps, 0),
          reps: workingSets.reduce((sum, s) => sum + s.reps, 0),
          heaviest: topSet.kg,
          estimated: estimates.length ? Math.max(...estimates) : null,
        },
      ];
    })
    .sort((a, b) => a.date - b.date);
}
export type ExercisePerformance = ReturnType<typeof exerciseProgress>[number];
