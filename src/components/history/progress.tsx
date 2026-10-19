'use client';
import { EquipmentLabel } from '../ui/equipment';
import { AuctusSelect } from '../ui/select';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Exercise, WorkoutDetail } from '@/domain/types';
import { exerciseProgress } from '@/domain/metrics';
export function ProgressView({
  exercise,
  workouts,
  back,
}: {
  exercise: Exercise;
  workouts: WorkoutDetail[];
  back: () => void;
}) {
  const data = exerciseProgress(workouts, exercise.id);
  const [metric, setMetric] = useState<'heaviest' | 'estimated'>('heaviest');
  const eligible = data.filter((d) => d[metric] !== null);
  const max = Math.max(1, ...eligible.map((d) => d[metric]!));
  const heavy = data.flatMap((d) => (d.heaviest === null ? [] : [d.heaviest]));
  const estimates = data.flatMap((d) => (d.estimated === null ? [] : [d.estimated]));
  return (
    <div className="stack">
      <button className="back" onClick={back}>
        <ArrowLeft size={16} />
        Exercise library
      </button>
      <div>
        <h1>{exercise.name}</h1>
        <EquipmentLabel equipment={exercise.equipment} />
        <p className="subtitle">Progress earned, one session at a time.</p>
      </div>
      <div className="record-grid">
        <div className="panel">
          <span className="eyeline">Heaviest completed set</span>
          <strong className="record-value number">
            {heavy.length ? Math.max(...heavy).toLocaleString() : '—'}
            <small>kg</small>
          </strong>
          <p>Recorded load · excludes warm-ups</p>
        </div>
        <div className="panel">
          <span className="eyeline">Estimated one-rep max</span>
          <strong className="record-value number">
            {estimates.length ? Math.max(...estimates).toFixed(1) : '—'}
            <small>kg</small>
          </strong>
          <p>Epley estimate · sets of 1–10 reps</p>
        </div>
      </div>
      {data.length ? (
        <>
          <section className="panel stack">
            <div className="row between">
              <h2>Strength over time</h2>
              <label className="sr-only" htmlFor="progress-metric">
                Metric
              </label>
              <AuctusSelect
                id="progress-metric"
                label="Metric"
                className="chart-select"
                value={metric}
                onValueChange={(value) => setMetric(value as typeof metric)}
                options={[
                  { value: 'heaviest', label: 'Heaviest load' },
                  { value: 'estimated', label: 'Estimated 1RM' },
                ]}
              />
            </div>
            {eligible.length >= 2 ? (
              <svg
                viewBox="0 0 600 220"
                role="img"
                aria-label={`${metric === 'heaviest' ? 'Heaviest load' : 'Estimated one-rep max'} over ${eligible.length} sessions. Exact values are in the table below.`}
                className="progress-chart"
              >
                {[0, 1, 2, 3].map((i) => (
                  <g key={i}>
                    <line x1="40" x2="580" y1={20 + i * 53} y2={20 + i * 53} stroke="var(--line)" />
                    <text x="0" y={24 + i * 53} fill="var(--muted)" fontSize="10">
                      {Math.round(max * (1 - i / 3))}
                    </text>
                  </g>
                ))}
                <polyline
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2.5"
                  points={eligible
                    .map(
                      (d, i) =>
                        `${40 + (i / (eligible.length - 1)) * 540},${179 - (d[metric]! / max) * 159}`,
                    )
                    .join(' ')}
                />
                {eligible.map((d, i) => (
                  <circle
                    key={d.workoutId + '-' + i}
                    cx={40 + (i / (eligible.length - 1)) * 540}
                    cy={179 - (d[metric]! / max) * 159}
                    r="4"
                    fill="var(--accent)"
                  />
                ))}
                <text x="40" y="211" fill="var(--muted)" fontSize="10">
                  {new Date(eligible[0].date).toLocaleDateString('en-GB')}
                </text>
                <text x="580" y="211" textAnchor="end" fill="var(--muted)" fontSize="10">
                  {new Date(eligible.at(-1)!.date).toLocaleDateString('en-GB')}
                </text>
              </svg>
            ) : (
              <p>Record two qualifying sessions to see your trend.</p>
            )}
          </section>
          <div className="table-scroll">
            <table>
              <caption>Recorded performance</caption>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Sets · kg × reps</th>
                  <th>Volume</th>
                  <th>Heaviest</th>
                  <th>Est. 1RM</th>
                </tr>
              </thead>
              <tbody>
                {[...data].reverse().map((d, i) => (
                  <tr key={d.workoutId + '-' + i}>
                    <td>
                      {new Date(d.date).toLocaleDateString('en-GB', {
                        timeZone: 'Europe/Amsterdam',
                      })}
                    </td>
                    <td>
                      {d.sets
                        .map((s) => `${(s.actual_grams ?? 0) / 1000} × ${s.actual_reps}`)
                        .join(' / ')}
                    </td>
                    <td>{d.volume.toLocaleString()} kg</td>
                    <td>{d.heaviest ?? '—'}</td>
                    <td>{d.estimated?.toFixed(1) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="empty">
          <h2>A starting point awaits.</h2>
          <p>Complete a workout with this exercise to build your progress history.</p>
        </div>
      )}
      <p>
        Volume includes warm-ups and uses entered kg × reps. Dumbbells are recorded per dumbbell,
        unilateral reps per side. Abandoned workouts are excluded. Estimated 1RM is an estimate, not
        a measured lift.
      </p>
    </div>
  );
}
