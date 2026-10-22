import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { exerciseWeeks } from '@/domain/exercise-progress';
import type { ExercisePerformance } from '@/domain/metrics';
import { formatNumber, localDate, shortDate } from '@/domain/dashboard';
import { AuctusSelect } from '../../ui/select';
import styles from './progress.module.css';
const metrics = [
  {
    value: 'heaviest',
    label: 'Recorded weight',
    unit: 'kg',
    description: 'Heaviest working set each week. Reps are in the breakdown below.',
  },
  {
    value: 'volume',
    label: 'Working volume',
    unit: 'kg × reps',
    description: 'Sum of recorded weight × reps, excluding warm-ups.',
  },
  {
    value: 'sets',
    label: 'Working sets',
    unit: 'sets',
    description: 'Completed working sets, excluding warm-ups.',
  },
  {
    value: 'reps',
    label: 'Total reps',
    unit: 'reps',
    description: 'Reps across completed working sets, excluding warm-ups.',
  },
  {
    value: 'estimated',
    label: 'Estimated 1RM',
    unit: 'kg, estimated',
    description: 'Best Epley estimate each week, from working sets of 1–10 reps.',
  },
] as const;
type Metric = (typeof metrics)[number]['value'];
function compact(value: number) {
  const rounded = (number: number) => formatNumber(Math.round(number * 10) / 10);
  return value >= 1_000_000
    ? `${rounded(value / 1_000_000)}m`
    : value >= 1000
      ? `${rounded(value / 1000)}k`
      : rounded(value);
}
export function WeeklyChart({ data, now }: { data: ExercisePerformance[]; now: number }) {
  const [metric, setMetric] = useState<Metric>(
    data.some((d) => d.heaviest > 0) ? 'heaviest' : 'reps',
  );
  const [page, setPage] = useState(0);
  const weeks = exerciseWeeks(data, now, page);
  const startYear = localDate(weeks[0].start).year;
  const endYear = localDate(weeks.at(-1)!.start).year;
  const selected = metrics.find((m) => m.value === metric)!;
  const max = Math.max(1, ...weeks.map((w) => w[metric] ?? 0));
  const ceiling = Math.ceil((max * 1.2) / 4) * 4;
  return (
    <section className={styles.panel} aria-labelledby="weekly-progress-heading">
      <div className={styles.heading}>
        <div>
          <span className="eyeline">RECORDED WORK, WEEK BY WEEK</span>
          <h2 id="weekly-progress-heading">Your weekly progress</h2>
        </div>
        <AuctusSelect
          label="Metric"
          value={metric}
          onValueChange={(value) => setMetric(value as Metric)}
          options={metrics.map(({ value, label }) => ({ value, label }))}
          className={styles.metricSelect}
        />
      </div>
      <div className={styles.chartToolbar}>
        <p>
          Weeks of {shortDate(weeks[0].start)}
          {startYear !== endYear ? ` ${startYear}` : ''} – {shortDate(weeks.at(-1)!.start)}{' '}
          {endYear} <span>· {selected.unit}</span>
        </p>
        <div className={styles.paging}>
          <button
            className="ghost"
            aria-label="Earlier eight training weeks"
            disabled={!data.some((d) => d.weekId < weeks[0].id)}
            onClick={() => setPage(page + 1)}
          >
            <ChevronLeft size={17} />
          </button>
          <button
            className="ghost"
            aria-label="Later eight training weeks"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <div
        className={styles.chart}
        role="img"
        aria-label={`${selected.label} by training week. Missing observations are shown with a dash. Exact values and reps are in the weekly breakdown.`}
      >
        <div className={styles.axis}>
          <span>{compact(ceiling)}</span>
          <span>{compact(ceiling / 2)}</span>
          <span>0</span>
        </div>
        <div className={styles.plot}>
          <div className={styles.gridlines}>
            <i />
            <i />
            <i />
          </div>
          {weeks.map((week) => {
            const value = week[metric];
            const missing = value === null || week.sessions === 0;
            return (
              <div key={week.id} className={styles.column}>
                <div className={styles.well}>
                  <div
                    className={`${styles.bar} ${week.current ? styles.currentBar : ''}`}
                    style={{ height: `${missing ? 0 : (value / ceiling) * 100}%` }}
                  >
                    <span className={styles.barValue}>{missing ? '—' : compact(value)}</span>
                  </div>
                  {!missing && value === 0 && <span className={styles.zeroDot} />}
                </div>
                <span className={styles.weekLabel}>
                  {week.current
                    ? 'Now*'
                    : shortDate(week.start)
                        .split(' ')
                        .map((part, i) => <span key={i}>{part}</span>)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <p className={styles.caption}>
        {selected.description} A dash means no qualifying data.{' '}
        {page === 0 && '* Current week is still in progress.'}
      </p>
      <details className={styles.breakdown}>
        <summary>Weekly breakdown · exact values</summary>
        <div className="table-scroll">
          <table>
            <caption>Assigned training weeks · warm-ups excluded</caption>
            <thead>
              <tr>
                <th>Week of</th>
                <th>Heaviest set</th>
                <th>Sets / reps</th>
                <th>Volume</th>
                <th>Est. 1RM</th>
              </tr>
            </thead>
            <tbody>
              {[...weeks].reverse().map((w) => (
                <tr key={w.id}>
                  <td>
                    {w.id}
                    {w.current ? ' · so far' : ''}
                  </td>
                  <td>
                    {w.topSet
                      ? `${formatNumber(w.topSet.kg)} kg × ${w.topSet.reps}`
                      : 'No working sets'}
                  </td>
                  <td>
                    {w.sets} / {w.reps}
                  </td>
                  <td>{formatNumber(w.volume)} kg</td>
                  <td>
                    {w.estimated === null
                      ? '—'
                      : `${formatNumber(Math.round(w.estimated * 10) / 10)} kg`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
