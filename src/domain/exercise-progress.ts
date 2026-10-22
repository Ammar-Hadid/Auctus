import { Temporal } from '@js-temporal/polyfill';
import { TIMEZONE, trainingWeek } from './calendar';
import { heaviestSet, type ExercisePerformance, type RecordedSet } from './metrics';

/** Eight assigned training weeks, with explicit gaps rather than invented load observations. */
export function exerciseWeeks(data: ExercisePerformance[], now: number, page = 0) {
  const current = trainingWeek(now);
  const end = Temporal.Instant.fromEpochMilliseconds(current.start)
    .toZonedDateTimeISO(TIMEZONE)
    .subtract({ weeks: page * 8 });
  const weeks = [trainingWeek(end.epochMilliseconds)];
  for (let i = 1; i < 8; i++) weeks.unshift(trainingWeek(weeks[0].start - 1));
  return weeks.map((week) => {
    const sessions = data.filter((d) => d.weekId === week.id);
    const estimates = sessions.map((d) => d.estimated).filter((n): n is number => n !== null);
    const topSet = heaviestSet(sessions.map((d) => d.topSet));
    return {
      ...week,
      current: week.id === current.id,
      sessions: sessions.length,
      topSet,
      heaviest: topSet?.kg ?? null,
      sets: sessions.reduce((n, d) => n + d.workingSets.length, 0),
      reps: sessions.reduce((n, d) => n + d.reps, 0),
      volume: sessions.reduce((n, d) => n + d.volume, 0),
      estimated: estimates.length ? Math.max(...estimates) : null,
    };
  });
}
export type ExerciseWeek = ReturnType<typeof exerciseWeeks>[number];

export function exerciseRecords(data: ExercisePerformance[]) {
  const byReps = new Map<number, RecordedSet & { date: number; workoutId: string }>();
  for (const session of data) {
    for (const set of session.workingSets) {
      const best = byReps.get(set.reps);
      if (!best || set.kg > best.kg)
        byReps.set(set.reps, { ...set, date: session.date, workoutId: session.workoutId });
    }
  }
  return [...byReps.values()].sort((a, b) => a.reps - b.reps);
}
