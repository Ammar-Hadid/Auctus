import { ArrowUpRight, Check, Clock, Dumbbell, Layers, Weight } from 'lucide-react';
import type { State } from '@/domain/types';
import { formatNumber, shortDate } from '@/domain/dashboard';
import { summarize } from '@/domain/metrics';
import type { Send } from './use-model';
import { WorkoutRequirement } from './ui/workout-requirement';
import { ActivityStatusLabel } from './ui/activity-status';
import { Attendance } from './dashboard/attendance';
import { WeeklyPlan } from './dashboard/weekly-plan';
import { ActivityChart } from './dashboard/activity-chart';
import { StrengthChart } from './dashboard/strength-chart';
import styles from './dashboard/dashboard.module.css';

export function Dashboard({
  state,
  send,
  navigate,
  onHistory,
  onProgress,
}: {
  state: State;
  send: Send;
  navigate: (view: string) => void;
  onHistory: (id: string) => void;
  onProgress: (id: string) => void;
}) {
  const metrics = [
    {
      label: 'Workouts',
      value: state.current.workouts,
      previous: state.previous.workouts,
      unit: '',
      icon: Dumbbell,
    },
    {
      label: 'Completed sets',
      value: state.current.sets,
      previous: state.previous.sets,
      unit: '',
      icon: Layers,
    },
    {
      label: 'Logged volume',
      value: state.current.volume,
      previous: state.previous.volume,
      unit: 'kg',
      icon: Weight,
    },
    {
      label: 'Training time',
      value: Math.round(state.current.duration / 60000),
      previous: Math.round(state.previous.duration / 60000),
      unit: 'min',
      icon: Clock,
    },
  ];
  const recent = state.history
    .filter((w) => w.status === 'completed')
    .sort((a, b) => b.started_at - a.started_at)
    .slice(0, 3);
  return (
    <div className={styles.dashboard}>
      <header className="row between">
        <div>
          <span className="eyeline">YOUR TRAINING, AT A GLANCE</span>
          <h1>Make today count.</h1>
          <p className="subtitle">A clear view of your week. A longer view of your progress.</p>
        </div>
        <span className="week-label">
          {new Intl.DateTimeFormat('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            timeZone: 'Europe/Amsterdam',
          }).format(state.serverNow)}
        </span>
      </header>
      {state.activeWorkout && (
        <section className={`resume-banner row between ${state.activeWorkout.status}`}>
          <div>
            <ActivityStatusLabel status={state.activeWorkout.status} />
            <h2>{state.activeWorkout.name}</h2>
            <WorkoutRequirement mandatory={state.activeWorkout.mandatory} />
            <p>Your session is saved. Pick up where you left off.</p>
          </div>
          <button className="primary" onClick={() => navigate('workout')}>
            Continue workout
            <ArrowUpRight size={18} />
          </button>
        </section>
      )}
      <div className={styles.topGrid}>
        <Attendance state={state} onHistory={onHistory} />
        <WeeklyPlan state={state} send={send} navigate={navigate} />
      </div>
      <section aria-labelledby="totals-heading" className={styles.totals}>
        <div className={styles.totalsHeading}>
          <h2 id="totals-heading">This week so far</h2>
          <span>Training week of {shortDate(state.week.start)}</span>
        </div>
        <div className={styles.metrics}>
          {metrics.map((m) => (
            <div key={m.label} className={styles.metric}>
              <span>
                <m.icon size={15} />
                {m.label}
              </span>
              <strong className="number">
                {formatNumber(m.value)}
                <small>{m.unit}</small>
              </strong>
              <p>
                {formatNumber(m.previous)} {m.unit} last full week
              </p>
            </div>
          ))}
        </div>
        <details className={styles.metricNotes}>
          <summary>How these numbers work</summary>
          <p>
            Totals count completed workouts in their assigned training week. Repeats count as
            workouts, but each workout in your plan is checked off only once. Weeks reset Monday at
            03:00 Amsterdam time.
          </p>
          <p>
            Sets and volume include warm-ups. Volume is entered kg × reps; dumbbell loads are per
            dumbbell and unilateral reps are per side. Training time includes rest and excludes
            workout pauses. Attendance uses the actual date you started each completed session,
            which can differ from its assigned week.
          </p>
        </details>
      </section>
      <div className={styles.chartGrid}>
        <ActivityChart state={state} />
        <StrengthChart state={state} onProgress={onProgress} />
      </div>
      {recent.length > 0 && (
        <section className={styles.recent} aria-labelledby="recent-heading">
          <div className={styles.panelHeading}>
            <div>
              <span className="eyeline">THE WORK BEHIND THE NUMBERS</span>
              <h2 id="recent-heading">Recent sessions</h2>
            </div>
            <button className={styles.inlineLink} onClick={() => navigate('history')}>
              All history
              <ArrowUpRight size={15} />
            </button>
          </div>
          <div className={styles.recentGrid}>
            {recent.map((w) => {
              const totals = summarize([w]);
              return (
                <button key={w.id} className={styles.recentSession} onClick={() => onHistory(w.id)}>
                  <span className={styles.recentDate}>
                    <Check size={13} />
                    {shortDate(w.started_at)}
                  </span>
                  <strong>{w.name}</strong>
                  <span>
                    {totals.sets} sets · {Math.round(totals.duration / 60000)} min
                    <ArrowUpRight size={16} />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
