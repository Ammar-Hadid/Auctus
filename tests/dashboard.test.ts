import { describe, expect, it } from 'vitest';
import { attendanceWeek, shortDate, strengthTrend, trainingTrend } from '../src/domain/dashboard';
import { trainingWeek } from '../src/domain/calendar';
import { readState } from '../src/server/read-state';
import { seedShowcase } from '../src/server/showcase-seed';
import { openDatabase } from './test-store';

function fixture() {
  const store = openDatabase();
  const now = Date.parse('2026-10-22T12:00:00Z');
  seedShowcase(store, now);
  const state = readState(store, now);
  store.sqlite.close();
  return state;
}

describe('dashboard insights', () => {
  it('uses a consistent September label across server and browser locales', () => {
    expect(shortDate(Date.parse('2026-09-07T12:00Z'))).toBe('7 Sep');
  });
  it('matches authoritative current and previous totals and fills empty weeks with zeros', () => {
    const state = fixture();
    const trend = trainingTrend(state.history, state.week);
    expect(trend).toHaveLength(8);
    expect(trend.at(-1)).toMatchObject(state.current);
    expect(trend.at(-2)).toMatchObject(state.previous);
    expect(trend[0]).toMatchObject({ workouts: 0, sets: 0, volume: 0, duration: 0 });
  });
  it('counts repeat workouts as one attended day and excludes abandoned and live workouts', () => {
    const state = fixture();
    const w = state.history[0];
    const at = Date.parse('2026-10-21T22:30:00Z');
    const history = [
      { ...w, id: 'one', started_at: at },
      { ...w, id: 'two', started_at: at + 60000 },
      { ...w, id: 'abandoned', status: 'abandoned' as const, started_at: at - 86400000 },
      { ...w, id: 'live', status: 'active' as const, started_at: at - 86400000 },
    ];
    const days = attendanceWeek(history, state.serverNow);
    expect(days.filter((d) => d.workouts.length)).toHaveLength(1);
    expect(days[3]).toMatchObject({ id: '2026-10-22', today: true });
    expect(days[3].workouts).toHaveLength(2);
    expect(days[4].future).toBe(true);
  });
  it('keeps actual attendance separate from assignment weeks across the 03:00 reset', () => {
    const state = fixture();
    const now = Date.parse('2026-10-26T01:30:00Z'); // Monday 02:30 Amsterdam, after DST ends
    const w = { ...state.history[0], started_at: now, week_id: '2026-10-19' };
    expect(trainingWeek(now).id).toBe('2026-10-19');
    expect(attendanceWeek([w], now)[0].id).toBe('2026-10-26');
    expect(attendanceWeek([w], now)[0].workouts).toHaveLength(1);
    expect(trainingTrend([w], trainingWeek(now)).at(-1)?.workouts).toBe(1);
  });
  it('uses calendar arithmetic over DST and year boundaries', () => {
    expect(attendanceWeek([], Date.parse('2026-10-25T12:00Z')).map((d) => d.id)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);
    expect(attendanceWeek([], Date.parse('2027-01-01T12:00Z'))[0].id).toBe('2026-12-28');
    const spring = trainingTrend([], trainingWeek(Date.parse('2026-03-30T12:00Z')));
    expect(spring.at(-2)!.end - spring.at(-2)!.start).toBe(167 * 3600000);
  });
  it('uses one actual working set per workout, ignores warm-ups and zero-load sets, and updates after corrections', () => {
    const state = fixture();
    const w = structuredClone(state.history[0]);
    const e = w.exercises[0];
    e.sets[0] = { ...e.sets[0], actual_grams: 100000, type: 'warmup' };
    e.sets[1] = { ...e.sets[1], actual_grams: 25000, actual_reps: 8 };
    e.sets[2] = { ...e.sets[2], actual_grams: 25000, actual_reps: 10 };
    expect(strengthTrend([w], e.exercise_id)).toMatchObject([{ kg: 25, reps: 10 }]);
    e.sets[2].actual_grams = 30000;
    expect(strengthTrend([w], e.exercise_id)[0].kg).toBe(30);
    e.sets.forEach((s) => {
      s.actual_grams = 0;
    });
    expect(strengthTrend([w], e.exercise_id)).toEqual([]);
    expect(strengthTrend([{ ...w, status: 'abandoned' }], e.exercise_id)).toEqual([]);
  });
});
