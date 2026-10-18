import type { WorkoutDetail, Metrics } from './types';
import { activeDuration } from './timing';
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
export function exerciseProgress(workouts: WorkoutDetail[], exerciseId: string) {
  return workouts
    .filter((w) => w.status === 'completed')
    .flatMap((w) =>
      w.exercises
        .filter((e) => e.exercise_id === exerciseId)
        .map((e) => {
          const sets = e.sets.filter((s) => s.status === 'completed');
          const eligible = sets.filter((s) => s.type !== 'warmup');
          const estimates = eligible
            .map((s) => estimatedMax((s.actual_grams ?? 0) / 1000, s.actual_reps ?? 0))
            .filter((n): n is number => n !== null);
          return {
            workoutId: w.id,
            date: w.started_at,
            name: w.name,
            sets,
            volume: sets.reduce(
              (n, s) => n + ((s.actual_grams ?? 0) / 1000) * (s.actual_reps ?? 0),
              0,
            ),
            heaviest: eligible.length
              ? Math.max(...eligible.map((s) => (s.actual_grams ?? 0) / 1000))
              : null,
            estimated: estimates.length ? Math.max(...estimates) : null,
          };
        }),
    )
    .sort((a, b) => a.date - b.date);
}
