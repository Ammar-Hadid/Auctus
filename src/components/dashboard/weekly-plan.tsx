import { ArrowUpRight, Check, Play } from 'lucide-react';
import { weeklyGoal } from '@/domain/weekly-goal';
import type { State } from '@/domain/types';
import type { Send } from '../use-model';
import { WorkoutRequirement } from '../ui/workout-requirement';
import styles from './dashboard.module.css';

export function WeeklyPlan({
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
  return (
    <section className={styles.panel} aria-labelledby="weekly-plan-heading">
      <div className={styles.panelHeading}>
        <div>
          <span className="eyeline">THE PLAN</span>
          <h2 id="weekly-plan-heading">This week’s workouts</h2>
        </div>
        <span className={styles.planCount}>
          {goal.completed}
          <span> / {goal.total}</span>
        </span>
      </div>
      <p className={styles.programName}>{program?.name ?? 'A little structure goes a long way.'}</p>
      {available.length ? (
        <>
          <div
            className={styles.goalTrack}
            role="progressbar"
            aria-label="Weekly workout progress"
            aria-valuemin={0}
            aria-valuemax={goal.total || 1}
            aria-valuenow={goal.completed}
            aria-valuetext={`${goal.completed} of ${goal.total} workouts completed`}
          >
            <div style={{ width: `${goal.total ? (goal.completed / goal.total) * 100 : 0}%` }} />
          </div>
          <div className={styles.planList}>
            {available.map((a) => {
              const template = state.templates.find((t) => t.id === a.template_id);
              return (
                <div key={a.id} className={styles.planRow}>
                  <span
                    className={`${styles.planMark} ${a.completed ? styles.planDone : ''}`}
                    aria-label={a.completed ? 'Completed' : 'Not completed'}
                  >
                    {a.completed ? <Check size={15} /> : <span />}
                  </span>
                  <div className={styles.planName}>
                    <h3>{a.name}</h3>
                    <WorkoutRequirement mandatory={a.mandatory} />
                    <span>{template?.exercises.length ?? 0} exercises</span>
                  </div>
                  <button
                    className={a.completed ? 'small ghost' : 'small primary'}
                    disabled={
                      !!state.activeWorkout ||
                      !template ||
                      !!template.archived_at ||
                      template.program_id !== state.selectedProgramId
                    }
                    onClick={async () => {
                      if (
                        await send('workout.start', {
                          assignment_id: a.id,
                          repeat: a.completed > 0,
                        })
                      )
                        navigate('workout');
                    }}
                  >
                    <Play size={14} />
                    <span>{a.completed ? 'Repeat' : 'Start workout'}</span>
                  </button>
                </div>
              );
            })}
          </div>
          <p className={styles.footnote}>
            {goal.weekDone && <strong className="accent">Week done. </strong>}
            {goal.mandatoryTotal
              ? `${goal.mandatoryCompleted} of ${goal.mandatoryTotal} mandatory workouts completed.`
              : 'Every workout counts toward your weekly progress.'}
          </p>
        </>
      ) : (
        <div className={styles.planEmpty}>
          <h3>Give your week a plan.</h3>
          <p>Create a program, add workouts, and apply it to this week.</p>
          <button className="primary" onClick={() => navigate('programs')}>
            Build your program
            <ArrowUpRight size={16} />
          </button>
        </div>
      )}
    </section>
  );
}
