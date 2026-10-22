import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { formatNumber, shortDate, trainingTrend } from '@/domain/dashboard';
import type { State } from '@/domain/types';
import styles from './dashboard.module.css';
const metrics = [
  { key: 'workouts', label: 'Workouts', unit: 'workouts' },
  { key: 'sets', label: 'Sets', unit: 'sets' },
  { key: 'volume', label: 'Volume', unit: 'kg' },
] as const;
export function ActivityChart({ state }: { state: State }) {
  const [metric, setMetric] = useState<(typeof metrics)[number]>(metrics[0]);
  const weeks = trainingTrend(state.history, state.week);
  const max = Math.max(1, ...weeks.map((w) => w[metric.key]));
  const ceiling = Math.ceil(max / 4) * 4;
  const hasData = weeks.some((w) => w.workouts > 0);
  return (
    <section className={styles.panel} aria-labelledby="activity-heading">
      <div className={styles.panelHeading}>
        <div>
          <span className="eyeline">THE BIGGER PICTURE</span>
          <h2 id="activity-heading">Training over time</h2>
        </div>
        <BarChart3 size={20} className="muted" />
      </div>
      <div className={styles.chartControls} role="group" aria-label="Training chart metric">
        {metrics.map((m) => (
          <button key={m.key} aria-pressed={m.key === metric.key} onClick={() => setMetric(m)}>
            {m.label}
          </button>
        ))}
      </div>
      {hasData ? (
        <>
          <svg
            viewBox="0 0 480 205"
            role="img"
            aria-label={`${metric.label} by training week. Exact values in chart data below.`}
            className={styles.chart}
          >
            {[0, 1, 2].map((i) => (
              <g key={i}>
                <line x1="42" x2="470" y1={25 + i * 65} y2={25 + i * 65} stroke="var(--line)" />
                <text x="34" y={29 + i * 65} textAnchor="end">
                  {formatNumber(ceiling * (1 - i / 2))}
                </text>
              </g>
            ))}
            {weeks.map((week, i) => {
              const height = (week[metric.key] / ceiling) * 130;
              return (
                <g key={week.id}>
                  <rect
                    x={54 + i * 52}
                    y={155 - height}
                    width="27"
                    height={height}
                    rx="3"
                    fill={i === 7 ? 'var(--accent)' : 'var(--muted)'}
                    opacity={i === 7 ? 1 : 0.65}
                  />
                  <text x={67.5 + i * 52} y="178" textAnchor="middle">
                    {i === 7 ? 'Now*' : shortDate(week.start)}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className={styles.chartCaption}>
            <span>Last 8 training weeks · {metric.unit}</span>
            <span>* This week so far</span>
          </div>
          <details className={styles.chartData}>
            <summary>View chart data</summary>
            <div className="table-scroll">
              <table>
                <caption>{metric.label} by assigned training week</caption>
                <thead>
                  <tr>
                    <th>Week of</th>
                    <th>
                      {metric.label}
                      {metric.key === 'volume' ? ' (kg)' : ''}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((w, i) => (
                    <tr key={w.id}>
                      <td>
                        {shortDate(w.start)}
                        {i === 7 ? ' · so far' : ''}
                      </td>
                      <td>{formatNumber(w[metric.key])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <div className={styles.chartEmpty}>
          <BarChart3 size={30} strokeWidth={1.3} />
          <h3>Your consistency starts here.</h3>
          <p>Complete a workout to see your training build week by week.</p>
        </div>
      )}
    </section>
  );
}
