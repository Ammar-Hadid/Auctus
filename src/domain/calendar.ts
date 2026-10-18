import { Temporal } from '@js-temporal/polyfill';
export const TIMEZONE = 'Europe/Amsterdam';
export function trainingWeek(now: number) {
  const local = Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(TIMEZONE);
  let monday = local.toPlainDate().subtract({ days: local.dayOfWeek - 1 });
  let start = monday.toZonedDateTime({ timeZone: TIMEZONE, plainTime: '03:00' });
  if (now < start.epochMilliseconds) { monday = monday.subtract({ days: 7 }); start = monday.toZonedDateTime({ timeZone: TIMEZONE, plainTime: '03:00' }); }
  return { id: monday.toString(), start: start.epochMilliseconds, end: start.add({ weeks:1 }).epochMilliseconds };
}
