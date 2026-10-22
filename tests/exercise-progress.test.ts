import { describe, expect, it } from 'vitest';
import { exerciseProgress } from '../src/domain/metrics';
import { formatNumber } from '../src/domain/dashboard';
import { exerciseRecords, exerciseWeeks } from '../src/domain/exercise-progress';
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

describe('exercise statistics', () => {
  it('preserves gram precision when displaying recorded loads', () => {
    expect(formatNumber(20.25)).toBe('20.25');
    expect(formatNumber(20.125)).toBe('20.125');
  });
  it('merges duplicate exercise appearances into one session and uses IDs, not names', () => {
    const state = fixture();
    const workout = structuredClone(state.history[0]);
    const e = workout.exercises[0];
    workout.exercises.push({ ...e, id: 'second-appearance', sets: [e.sets[0]] });
    workout.exercises.push({ ...e, id: 'other', exercise_id: 'different-id' });
    const data = exerciseProgress([workout], e.exercise_id);
    expect(data).toHaveLength(1);
    expect(data[0].workingSets).toHaveLength(4);
    expect(data[0].volume).toBe((e.sets[0].actual_grams! / 1000) * e.sets[0].actual_reps! * 4);
    e.name = 'Renamed';
    expect(exerciseProgress([workout], e.exercise_id)).toEqual(data);
  });
  it('excludes warmups, skipped sets, prefills and abandoned sessions, but preserves completed removed work', () => {
    const state = fixture();
    const workout = structuredClone(state.history[0]);
    const e = workout.exercises[0];
    e.removed_at = state.serverNow;
    e.sets[0] = { ...e.sets[0], type: 'warmup', actual_grams: 99000 };
    e.sets[1] = { ...e.sets[1], status: 'skipped', actual_grams: null, prefill_grams: 99000 };
    e.sets[2] = { ...e.sets[2], removed_at: state.serverNow, actual_grams: 25000, actual_reps: 8 };
    const data = exerciseProgress(
      [workout, { ...workout, id: 'abandoned', status: 'abandoned' }],
      e.exercise_id,
    );
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ topSet: { kg: 25, reps: 8 }, reps: 8, volume: 200 });
    expect(data[0].workingSets).toHaveLength(1);
  });
  it('preserves actual zero loads and reps without inventing missing weights or estimates', () => {
    const state = fixture();
    const workout = structuredClone(state.history[0]);
    const e = workout.exercises[0];
    e.sets[0] = { ...e.sets[0], actual_grams: 0, actual_reps: 12 };
    e.sets[1] = { ...e.sets[1], actual_grams: null, actual_reps: 20 };
    e.sets[2] = { ...e.sets[2], actual_grams: 100000, actual_reps: 0 };
    const [result] = exerciseProgress([workout], e.exercise_id);
    expect(result).toMatchObject({
      topSet: { kg: 0, reps: 12 },
      reps: 12,
      volume: 0,
      estimated: null,
    });
    e.sets[0].actual_grams = null;
    expect(exerciseProgress([workout], e.exercise_id)).toEqual([]);
  });
  it('compares records at exact rep counts and recalculates corrections', () => {
    const state = fixture();
    const workout = structuredClone(state.history[0]);
    const e = workout.exercises[0];
    e.sets[0] = { ...e.sets[0], actual_grams: 30000, actual_reps: 8 };
    e.sets[1] = { ...e.sets[1], actual_grams: 25000, actual_reps: 10 };
    e.sets[2] = { ...e.sets[2], actual_grams: 32000, actual_reps: 8 };
    let data = exerciseProgress([workout], e.exercise_id);
    expect(exerciseRecords(data)).toMatchObject([
      { kg: 32, reps: 8 },
      { kg: 25, reps: 10 },
    ]);
    expect(data[0].topSet).toEqual({ kg: 32, reps: 8 });
    e.sets[2].actual_grams = 20000;
    data = exerciseProgress([workout], e.exercise_id);
    expect(exerciseRecords(data)[0].kg).toBe(30);
    expect(data[0].topSet.kg).toBe(30);
    e.sets[1].actual_grams = 30000;
    expect(exerciseProgress([workout], e.exercise_id)[0].topSet).toEqual({ kg: 30, reps: 10 });
  });
  it('uses assigned weeks, sums working volume, and leaves missing load observations null', () => {
    const state = fixture();
    const data = exerciseProgress(state.history, state.exercises[0].id);
    const weeks = exerciseWeeks(data, state.serverNow);
    expect(weeks).toHaveLength(8);
    expect(weeks[0]).toMatchObject({
      heaviest: null,
      estimated: null,
      reps: 0,
      sets: 0,
      volume: 0,
    });
    const latest = weeks.at(-1)!;
    expect(latest.current).toBe(true);
    expect(latest.volume).toBe(
      data.filter((d) => d.weekId === latest.id).reduce((n, d) => n + d.volume, 0),
    );
    const shifted = { ...data[0], weekId: '2026-10-12', date: state.serverNow };
    expect(exerciseWeeks([shifted], state.serverNow).at(-2)?.sessions).toBe(1);
    expect(exerciseWeeks([shifted], state.serverNow).at(-1)?.heaviest).toBeNull();
  });
  it('pages older history with eight distinct weeks through DST and year changes', () => {
    const now = Date.parse('2027-01-04T12:00Z');
    const current = exerciseWeeks([], now);
    const older = exerciseWeeks([], now, 1);
    expect(current.at(-1)?.id).toBe('2027-01-04');
    expect(older.at(-1)?.end).toBe(current[0].start);
    expect(new Set([...older, ...current].map((w) => w.id)).size).toBe(16);
    const autumn = exerciseWeeks([], Date.parse('2026-10-26T12:00Z'));
    expect(autumn.at(-2)!.end - autumn.at(-2)!.start).toBe(169 * 3600000);
  });
  it('handles no data and warmup-only workouts without phantom records', () => {
    const state = fixture();
    const workout = structuredClone(state.history[0]);
    const e = workout.exercises[0];
    e.sets.forEach((s) => {
      s.type = 'warmup';
    });
    expect(exerciseProgress([workout], e.exercise_id)).toEqual([]);
    expect(exerciseRecords([])).toEqual([]);
    expect(exerciseWeeks([], state.serverNow).every((w) => w.heaviest === null)).toBe(true);
  });
});
