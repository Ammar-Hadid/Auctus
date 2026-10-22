import { Temporal } from '@js-temporal/polyfill';
import { TIMEZONE, trainingWeek } from './calendar';
import { exerciseProgress, summarize } from './metrics';
import type { Week, WorkoutDetail } from './types';

export function localDate(time: number) {
  return Temporal.Instant.fromEpochMilliseconds(time).toZonedDateTimeISO(TIMEZONE).toPlainDate();
}

/** Attendance follows calendar dates, independently of the assigned training week. */
export function attendanceWeek(history: WorkoutDetail[], now: number, offset = 0) {
  const today = localDate(now);
  const monday = today.subtract({ days: today.dayOfWeek - 1 }).add({ weeks: offset });
  return Array.from({ length: 7 }, (_, index) => {
    const date = monday.add({ days: index });
    return {
      id: date.toString(),
      day: date.day,
      label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index],
      timestamp: date.toZonedDateTime(TIMEZONE).epochMilliseconds,
      today: date.equals(today),
      future: Temporal.PlainDate.compare(date, today) > 0,
      workouts: history.filter(
        (w) => w.status === 'completed' && localDate(w.started_at).equals(date),
      ),
    };
  });
}

/** Match the weekly assignment accounting used by readState and History. */
export function trainingTrend(history: WorkoutDetail[], currentWeek: Week) {
  const weeks = [currentWeek];
  for (let i = 1; i < 8; i++) weeks.unshift(trainingWeek(weeks[0].start - 1));
  return weeks.map((week) => ({
    ...week,
    ...summarize(history.filter((w) => (w.week_id ?? trainingWeek(w.started_at).id) === week.id)),
  }));
}

/** One observed top working set per workout; no estimated strength or warm-ups. */
export function strengthTrend(history: WorkoutDetail[], exerciseId: string) {
  return exerciseProgress(history, exerciseId)
    .filter((session) => session.topSet.kg > 0)
    .map((session) => ({ workoutId: session.workoutId, date: session.date, ...session.topSet }))
    .slice(-8);
}

export function shortDate(time: number) {
  const date = localDate(time);
  // ICU versions disagree on September (Sep / Sept), which breaks hydration in Safari.
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${date.day} ${months[date.month - 1]}`;
}
export function formatNumber(value: number) {
  return value.toLocaleString('en-GB', { maximumFractionDigits: 3 });
}
