'use client';
import { useMemo } from 'react';
import { ArrowLeft, ArrowUpRight, TrendingUp } from 'lucide-react';
import { EquipmentLabel } from '../ui/equipment';
import type { Exercise, WorkoutDetail } from '@/domain/types';
import { exerciseProgress, heaviestSet } from '@/domain/metrics';
import { formatNumber, shortDate } from '@/domain/dashboard';
import { WeeklyChart } from './exercise-progress/weekly-chart';
import { RepRecords } from './exercise-progress/records';
import { ExerciseSessions } from './exercise-progress/session-list';
import styles from './exercise-progress/progress.module.css';
function change(value: number, unit: string) {
  return `${value > 0 ? '+' : ''}${formatNumber(value)} ${unit === 'reps' && Math.abs(value) === 1 ? 'rep' : unit}`;
}
export function ProgressView({
  exercise,
  workouts,
  now,
  onHistory,
  back,
}: {
  exercise: Exercise;
  workouts: WorkoutDetail[];
  now: number;
  onHistory: (id: string) => void;
  back: () => void;
}) {
  const data = useMemo(() => exerciseProgress(workouts, exercise.id), [workouts, exercise.id]);
  const latest = data.at(-1);
  const previous = data.at(-2);
  const workingSets = data.flatMap((d) => d.workingSets);
  const best = heaviestSet(workingSets);
  const mostReps = workingSets.reduce<(typeof workingSets)[number] | null>(
    (best, set) =>
      !best || set.reps > best.reps || (set.reps === best.reps && set.kg > best.kg) ? set : best,
    null,
  );
  const estimates = data.map((d) => d.estimated).filter((n): n is number => n !== null);
  return (
    <div className={styles.progress}>
      <button className="back" onClick={back}>
        <ArrowLeft size={16} />
        Exercise library
      </button>
      <header>
        <span className="eyeline">YOUR EXERCISE, OVER TIME</span>
        <h1>{exercise.name}</h1>
        <EquipmentLabel equipment={exercise.equipment} />
        <p className="subtitle">Follow your weights, reps, and the work behind them.</p>
      </header>
      {latest && best && mostReps ? (
        <>
          <section className={styles.comparison} aria-labelledby="latest-set-heading">
            <div className={styles.latest}>
              <h2 id="latest-set-heading">Latest top set</h2>
              <strong>
                {formatNumber(latest.topSet.kg)} <small>kg × {latest.topSet.reps} reps</small>
              </strong>
              <span>
                {shortDate(latest.date)} · {latest.name}
              </span>
            </div>
            <div className={styles.previous}>
              {previous ? (
                <>
                  <span>Previous session · {shortDate(previous.date)}</span>
                  <strong>
                    {formatNumber(previous.topSet.kg)} kg × {previous.topSet.reps} reps
                  </strong>
                  <p>
                    {change(latest.topSet.kg - previous.topSet.kg, 'kg')} ·{' '}
                    {change(latest.topSet.reps - previous.topSet.reps, 'reps')}
                  </p>
                </>
              ) : (
                <>
                  <strong>Your starting point is logged.</strong>
                  <p>Complete another session to compare your recorded weight and reps.</p>
                </>
              )}
            </div>
            <button className="small ghost" onClick={() => onHistory(latest.workoutId)}>
              View session
              <ArrowUpRight size={15} />
            </button>
            <p className={styles.comparisonNote}>
              Heaviest working set in each session. Compare weight and reps together; a heavier set
              with fewer reps is not a like-for-like improvement.
            </p>
          </section>
          <section className={styles.stats} aria-label="All-time exercise statistics">
            <div>
              <span>Heaviest completed set</span>
              <strong>
                {formatNumber(best.kg)}
                <small>kg</small>
              </strong>
              <p>{best.reps} reps · warm-ups excluded</p>
            </div>
            <div>
              <span>Most reps in a set</span>
              <strong>
                {mostReps.reps}
                <small>reps</small>
              </strong>
              <p>At {formatNumber(mostReps.kg)} kg</p>
            </div>
            <div>
              <span>Sessions logged</span>
              <strong>{data.length}</strong>
              <p>{workingSets.length} completed working sets</p>
            </div>
            <div>
              <span>Estimated one-rep max</span>
              <strong>
                {estimates.length
                  ? formatNumber(Math.round(Math.max(...estimates) * 10) / 10)
                  : '—'}
                <small>kg</small>
              </strong>
              <p>Best Epley estimate · 1–10 reps</p>
            </div>
          </section>
          <WeeklyChart data={data} now={now} />
          <div className={styles.lowerGrid}>
            <RepRecords data={data} onHistory={onHistory} />
            <ExerciseSessions data={data} onHistory={onHistory} />
          </div>
          <details className={styles.notes}>
            <summary>How exercise statistics are calculated</summary>
            <p>
              Only completed working sets with recorded weight and positive reps in completed
              workouts count. Warm-ups, skipped sets, unfinished workouts and abandoned workouts are
              excluded. Completed sets removed from a plan still count as recorded work. This
              differs from the overview’s totals, which include warm-ups.
            </p>
            <p>
              Weekly totals follow the assigned training week, resetting Monday at 03:00 Amsterdam
              time. Session dates show when you actually started. Missing weeks have no recorded
              weight; a zero is shown only when you logged zero kg.
            </p>
            <p>
              Volume is logged kg × reps. Dumbbells are recorded per dumbbell, unilateral reps per
              side. Bodyweight is not added, and assistance is not converted to resistance. More
              recorded weight or volume is not automatically better performance.
            </p>
            <p>
              Estimated one-rep max uses Epley: kg × (1 + reps / 30) for 2–10 reps; a single rep
              uses its recorded weight. Zero-load and higher-rep sets do not produce estimates. It
              is an estimate, not a measured lift.
            </p>
          </details>
        </>
      ) : (
        <section className={styles.empty}>
          <TrendingUp size={38} strokeWidth={1.3} />
          <h2>Your first working set starts the story.</h2>
          <p>
            Complete a workout with this exercise and log its weight and reps. Your weekly trends,
            rep records, and sessions will appear here.
          </p>
          <button className="primary" onClick={back}>
            Back to your library
            <ArrowUpRight size={16} />
          </button>
        </section>
      )}
    </div>
  );
}
