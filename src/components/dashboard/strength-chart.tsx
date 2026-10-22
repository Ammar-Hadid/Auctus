import { useState } from 'react';
import { ArrowUpRight, TrendingUp } from 'lucide-react';
import { formatNumber, shortDate, strengthTrend } from '@/domain/dashboard';
import type { State } from '@/domain/types';
import { AuctusSelect } from '../ui/select';
import styles from './dashboard.module.css';
export function StrengthChart({
  state,
  onProgress,
}: {
  state: State;
  onProgress: (id: string) => void;
}) {
  const options = state.exercises
    .map((e) => ({ exercise: e, points: strengthTrend(state.history, e.id) }))
    .filter((e) => e.points.length);
  const [exerciseId, setExerciseId] = useState('');
  const selected = options.find((e) => e.exercise.id === exerciseId) ?? options[0];
  const points = selected?.points ?? [];
  const latest = points.at(-1);
  const ceiling = Math.ceil(Math.max(1, ...points.map((p) => p.kg)) / 4) * 4;
  return (
    <section className={styles.panel} aria-labelledby="strength-heading">
      <div className={styles.panelHeading}>
        <div>
          <span className="eyeline">ONE EXERCISE AT A TIME</span>
          <h2 id="strength-heading">What you’re lifting</h2>
        </div>
        <TrendingUp size={20} className="muted" />
      </div>
      {selected && latest ? (
        <>
          <AuctusSelect
            label="Exercise for strength trend"
            value={selected.exercise.id}
            onValueChange={setExerciseId}
            options={options.map(({ exercise }) => ({ value: exercise.id, label: exercise.name }))}
          />
          <div className={styles.liftHeadline}>
            <strong>
              {formatNumber(latest.kg)} <small>kg × {latest.reps} reps</small>
            </strong>
            <span>Latest top set</span>
          </div>
          {points.length >= 2 ? (
            <svg
              viewBox="0 0 480 160"
              role="img"
              aria-label={`${selected.exercise.name}: heaviest working set in the last ${points.length} sessions. Exact weights and reps in chart data below.`}
              className={styles.chart}
            >
              {[0, 1, 2].map((i) => (
                <g key={i}>
                  <line x1="42" x2="458" y1={15 + i * 55} y2={15 + i * 55} stroke="var(--line)" />
                  <text x="34" y={19 + i * 55} textAnchor="end">
                    {formatNumber(ceiling * (1 - i / 2))}
                  </text>
                </g>
              ))}
              <polyline
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeLinejoin="round"
                points={points
                  .map(
                    (p, i) =>
                      `${50 + (i / (points.length - 1)) * 400},${125 - (p.kg / ceiling) * 110}`,
                  )
                  .join(' ')}
              />
              {points.map((p, i) => (
                <circle
                  key={p.workoutId}
                  cx={50 + (i / (points.length - 1)) * 400}
                  cy={125 - (p.kg / ceiling) * 110}
                  r="4"
                  fill="var(--accent)"
                  stroke="var(--surface)"
                  strokeWidth="2"
                />
              ))}
              <text x="42" y="151">
                {shortDate(points[0].date)}
              </text>
              <text x="458" y="151" textAnchor="end">
                {shortDate(latest.date)}
              </text>
            </svg>
          ) : (
            <p className={styles.firstLift}>
              Your first point is logged. Complete another session with this exercise to see a
              trend.
            </p>
          )}
          <p className={styles.footnote}>
            Heaviest working set · kg · last {points.length}{' '}
            {points.length === 1 ? 'session' : 'sessions'}. Warm-ups excluded.
          </p>
          <div className={styles.strengthFooter}>
            <details className={styles.chartData}>
              <summary>View chart data</summary>
              <div className="table-scroll">
                <table>
                  <caption>Heaviest recorded working set per session</caption>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Weight</th>
                      <th>Reps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((p) => (
                      <tr key={p.workoutId}>
                        <td>{shortDate(p.date)}</td>
                        <td>{formatNumber(p.kg)} kg</td>
                        <td>{p.reps}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <button className={styles.inlineLink} onClick={() => onProgress(selected.exercise.id)}>
              Exercise history
              <ArrowUpRight size={14} />
            </button>
          </div>
        </>
      ) : (
        <div className={styles.chartEmpty}>
          <TrendingUp size={30} strokeWidth={1.3} />
          <h3>A starting point awaits.</h3>
          <p>
            Log a working set with weight and reps in a completed workout to follow that exercise
            here.
          </p>
        </div>
      )}
    </section>
  );
}
