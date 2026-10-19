import { weeklyGoal } from '@/domain/weekly-goal';
import { WorkoutRequirement } from './ui/workout-requirement';
import { ActivityStatusLabel } from './ui/activity-status';
import { ArrowUpRight, Check, Play } from 'lucide-react';
import type { State } from '@/domain/types';
import type { Send } from './use-model';
export function Dashboard({
  state,
  send,
  navigate,
}: {
  state: State;
  send: Send;
  navigate: (view: string) => void;
}) {
  const program = state.programs.find((p) => p.id === state.selectedProgramId);
  const available = state.assignments.filter((a) => !a.withdrawn_at);
  const goal = weeklyGoal(state.assignments);
  const weekLabel = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Amsterdam',
  }).format(state.week.start);
  const metrics = [
    ['Workouts', state.current.workouts, state.previous.workouts, ''],
    ['Volume', Math.round(state.current.volume), Math.round(state.previous.volume), 'kg'],
    ['Sets', state.current.sets, state.previous.sets, ''],
    [
      'Training',
      Math.round(state.current.duration / 60000),
      Math.round(state.previous.duration / 60000),
      'min',
    ],
  ];
  return (
    <div className="stack">
      <div className="row between">
        <div>
          <h1>Make today count.</h1>
          <p className="subtitle">Your training week, starting {weekLabel}.</p>
        </div>
        <span className="week-label">
          {new Intl.DateTimeFormat('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            timeZone: 'Europe/Amsterdam',
          }).format(state.serverNow)}
        </span>
      </div>
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
      <div className="metrics">
        {metrics.map(([label, value, previous, unit]) => (
          <div key={label} className="metric">
            <span>{label}</span>
            <strong className="number">
              {Number(value).toLocaleString()}
              <small>{unit}</small>
            </strong>
            <p>
              {previous} {unit} last week
            </p>
          </div>
        ))}
      </div>
      <div className="row between section-heading">
        <div>
          <h2>This week’s workouts</h2>
          <p>{program?.name ?? 'Select a program to get started'}</p>
        </div>
        <span className="completion-count">
          {goal.completed}
          <span> / {goal.total} mandatory</span>
        </span>
      </div>
      <div className="progress-track">
        <div style={{ width: `${goal.total ? (goal.completed / goal.total) * 100 : 0}%` }} />
      </div>
      {available.length > 0 && (
        <p className="muted weekly-goal-summary">
          {goal.total === 0
            ? 'No mandatory workouts this week.'
            : `${goal.completed} of ${goal.total} mandatory workouts completed.`}
          {goal.optionalTotal > 0 &&
            ` ${goal.optionalCompleted} of ${goal.optionalTotal} optional workouts completed.`}
        </p>
      )}
      {available.length ? (
        <div className="list">
          {available.map((a, i) => {
            const t = state.templates.find((t) => t.id === a.template_id);
            return (
              <div className="workout-row" key={a.id}>
                <span className="ordinal">{String(i + 1).padStart(2, '0')}</span>
                <div className="grow">
                  <span className={'status ' + (a.completed ? 'done' : '')}>
                    {a.completed ? (
                      <>
                        <Check size={12} />
                        Completed
                      </>
                    ) : (
                      'Ready when you are'
                    )}
                  </span>
                  <h2>{a.name}</h2>
                  <WorkoutRequirement mandatory={a.mandatory} />
                  <p>
                    {t?.exercises.length ?? 0} exercises ·{' '}
                    {t?.exercises.reduce((n, e) => n + e.sets.length, 0) ?? 0} sets
                  </p>
                </div>
                <button
                  className={a.completed ? 'ghost' : 'primary'}
                  disabled={
                    !!state.activeWorkout ||
                    !!t?.archived_at ||
                    t?.program_id !== state.selectedProgramId
                  }
                  onClick={async () => {
                    if (
                      await send('workout.start', { assignment_id: a.id, repeat: a.completed > 0 })
                    )
                      navigate('workout');
                  }}
                >
                  <Play size={16} />
                  {a.completed ? 'Repeat' : 'Start workout'}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          <h2>Give your week a plan.</h2>
          <p>Create a program, add workouts, and apply it to this week.</p>
          <button className="primary" onClick={() => navigate('programs')}>
            Build your program
            <ArrowUpRight size={16} />
          </button>
        </div>
      )}
      <div className="week-footer">
        <p>New week. Fresh opportunities.</p>
        <span>Resets Monday · 03:00 Amsterdam</span>
      </div>
    </div>
  );
}
