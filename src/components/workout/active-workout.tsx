'use client';
import { WorkoutRequirement } from '../ui/workout-requirement';
import { EquipmentLabel } from '../ui/equipment';
import { ActivityIcon, ActivityStatusLabel, activityLabels } from '../ui/activity-status';
import { ExercisePicker } from '../programming/exercise-picker';
import { useState } from 'react';
import { Play, Pause, Check, ArrowUp, ArrowDown, Plus } from 'lucide-react';
import type { State } from '@/domain/types';
import type { Send } from '../use-model';
import { activeDuration, durationLabel } from '@/domain/timing';
import { useNow } from './timer';
import { SetCard } from './set-card';
import { defaultSet, move } from '../programming/template-editor';

export function ActiveWorkout({
  state,
  send,
  finished,
}: {
  state: State;
  send: Send;
  finished: () => void;
}) {
  const w = state.activeWorkout!;
  const [focused, setFocused] = useState<string | null>(null),
    [confirm, setConfirm] = useState<string | null>(null),
    [add, setAdd] = useState(false),
    [selection, setSelection] = useState('');
  const now = useNow(state.serverNow);
  const e =
    w.exercises.find((e) => e.id === focused && !e.removed_at) ??
    w.exercises.find((e) => e.status === 'active') ??
    w.exercises.find((e) => e.id === w.resume_exercise_id && !e.removed_at) ??
    w.exercises.find((e) => !e.removed_at);
  const act = (action: string, extra: Record<string, unknown> = {}) =>
    send('session.action', { workout_id: w.id, version: w.version, action, ...extra });
  const total = w.exercises.flatMap((e) => e.sets).filter((s) => !s.removed_at);
  const done = total.filter((s) => s.status === 'completed').length;
  const previous = e
    ? state.history
        .filter((h) => h.status === 'completed')
        .flatMap((h) => h.exercises)
        .find((x) => x.exercise_id === e.exercise_id && x.equipment === e.equipment)
    : null;
  return (
    <div className="stack">
      <div className="row between">
        <div>
          <span className={`activity-status ${w.status}`}>
            <ActivityIcon status={w.status} />
            {w.status === 'paused' ? 'Workout paused' : 'Session in progress'}
          </span>
          <h1>{w.name}</h1>
          <WorkoutRequirement mandatory={w.mandatory} />
        </div>
        <div className="session-time number">
          {durationLabel(activeDuration(w, now))}
          <span>active time</span>
        </div>
      </div>
      <div className="row between">
        <p>
          {done} / {total.length} sets recorded
        </p>
        <div className="row">
          <button onClick={() => act(w.status === 'paused' ? 'workout.resume' : 'workout.pause')}>
            {w.status === 'paused' ? <Play size={16} /> : <Pause size={16} />}{' '}
            {w.status === 'paused' ? 'Resume' : 'Pause'}
          </button>
          <button
            className="primary"
            disabled={w.status === 'paused'}
            onClick={() => setConfirm('complete')}
          >
            Finish workout
            <Check size={16} />
          </button>
        </div>
      </div>
      {w.status === 'paused' && (
        <div className="workout-paused-notice" role="status">
          <Pause size={20} aria-hidden="true" />
          <div>
            <strong>Workout paused</strong>
            <p>Active time and rest countdown are stopped. Resume to continue.</p>
          </div>
        </div>
      )}
      <div className="progress-track">
        <div style={{ width: `${total.length ? (done / total.length) * 100 : 0}%` }} />
      </div>
      {confirm && (
        <div className="inline-confirm">
          <p>
            {confirm === 'complete'
              ? 'Finish this workout? Any unfinished exercises and pending sets will be marked skipped. Complete or skip an active set first.'
              : 'Abandon this workout? Recorded results stay in history; unfinished activity is marked skipped.'}
          </p>
          <button
            className={confirm === 'complete' ? 'primary' : 'danger'}
            onClick={async () => {
              if (
                await act(confirm === 'complete' ? 'workout.complete' : 'workout.abandon', {
                  skipRemaining: true,
                })
              )
                finished();
            }}
          >
            {confirm === 'complete' ? 'Confirm finish' : 'Confirm abandon'}
          </button>
          <button onClick={() => setConfirm(null)}>Keep training</button>
        </div>
      )}
      <div className="training-layout">
        <aside className="exercise-rail">
          <div className="row between">
            <h2>Exercises</h2>
            <button className="small ghost" onClick={() => setAdd(!add)} aria-label="Add exercise">
              <Plus size={17} />
            </button>
          </div>
          {w.exercises
            .filter((x) => !x.removed_at)
            .map((x, i) => (
              <div
                className={`exercise-choice ${x.status} ${e?.id === x.id ? 'selected' : ''}`}
                key={x.id}
              >
                <button
                  className="exercise-select"
                  aria-current={e?.id === x.id ? 'true' : undefined}
                  onClick={() => setFocused(x.id)}
                >
                  <span className="exercise-mark" aria-hidden="true">
                    <ActivityIcon status={x.status} size={22} />
                  </span>
                  <span className="grow">
                    <span className="exercise-number">
                      Exercise {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="exercise-name">{x.name}</span>
                    <EquipmentLabel equipment={x.equipment} />
                    <span className={`exercise-state ${x.status}`}>{activityLabels[x.status]}</span>
                    <small>
                      {x.sets.filter((s) => !s.removed_at && s.status === 'completed').length} /{' '}
                      {x.sets.filter((s) => !s.removed_at).length} sets recorded
                    </small>
                  </span>
                </button>
                <div className="row exercise-order">
                  <button
                    className="small ghost"
                    aria-label={`Move ${x.name} up`}
                    disabled={w.exercises.indexOf(x) === 0 || w.status === 'paused'}
                    onClick={() =>
                      act('exercise.reorder', {
                        ids: move(w.exercises, w.exercises.indexOf(x), -1).map((e) => e.id),
                      })
                    }
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    className="small ghost"
                    aria-label={`Move ${x.name} down`}
                    disabled={
                      w.exercises.indexOf(x) === w.exercises.length - 1 || w.status === 'paused'
                    }
                    onClick={() =>
                      act('exercise.reorder', {
                        ids: move(w.exercises, w.exercises.indexOf(x), 1).map((e) => e.id),
                      })
                    }
                  >
                    <ArrowDown size={13} />
                  </button>
                </div>
              </div>
            ))}
        </aside>
        <section className="stack exercise-detail">
          {add && (
            <div className="panel stack">
              <ExercisePicker
                label="Exercise"
                exercises={state.exercises}
                value={selection}
                onValueChange={setSelection}
                send={send}
                disabled={w.status === 'paused'}
              />
              <button
                disabled={!selection || w.status === 'paused'}
                onClick={async () => {
                  if (await act('exercise.add', { exercise_id: selection, sets: [defaultSet()] })) {
                    setAdd(false);
                    setSelection('');
                  }
                }}
              >
                Add to workout
              </button>
            </div>
          )}
          {e ? (
            <>
              <div className={`row between exercise-detail-heading ${e.status}`}>
                <div className="exercise-heading-copy">
                  <span className="eyeline">
                    Exercise{' '}
                    {String(
                      w.exercises.filter((x) => !x.removed_at).findIndex((x) => x.id === e.id) + 1,
                    ).padStart(2, '0')}
                  </span>
                  <h2>{e.name}</h2>
                  <EquipmentLabel equipment={e.equipment} />
                  <ActivityStatusLabel status={e.status} />
                </div>
                {['pending', 'paused'].includes(e.status) && (
                  <button
                    className="primary"
                    disabled={w.status === 'paused'}
                    onClick={() => act('exercise.start', { id: e.id })}
                  >
                    <Play size={16} />
                    {e.status === 'paused'
                      ? 'Resume exercise'
                      : w.exercises.some((x) => x.status === 'active')
                        ? 'Switch to exercise'
                        : 'Start exercise'}
                  </button>
                )}
              </div>
              <div className="previous-performance">
                <span className="eyeline">Last time</span>
                <p>
                  {previous
                    ? previous.sets
                        .filter((s) => s.status === 'completed')
                        .map((s) => `${(s.actual_grams ?? 0) / 1000} kg × ${s.actual_reps}`)
                        .join('  /  ') || 'No completed sets'
                    : 'Your first recorded session for this exercise.'}
                </p>
              </div>
              <div className="row between sets-heading">
                <h3>Sets</h3>
                <span>
                  {e.sets.filter((s) => !s.removed_at && s.status === 'completed').length} /{' '}
                  {e.sets.filter((s) => !s.removed_at).length} recorded
                </span>
              </div>
              <div className="stack exercise-sets">
                {e.sets
                  .filter((s) => !s.removed_at)
                  .map((s, i) => (
                    <div key={s.id}>
                      <SetCard
                        set={s}
                        index={i}
                        workout={w}
                        parentActive={e.status === 'active'}
                        send={send}
                      />
                      <div className="row set-order">
                        <button
                          className="small ghost"
                          disabled={e.sets.indexOf(s) === 0 || w.status === 'paused'}
                          aria-label={`Move set ${i + 1} up`}
                          onClick={() =>
                            act('set.reorder', {
                              id: e.id,
                              ids: move(e.sets, e.sets.indexOf(s), -1).map((s) => s.id),
                            })
                          }
                        >
                          <ArrowUp size={13} />
                          Move up
                        </button>
                        <button
                          className="small ghost"
                          disabled={
                            e.sets.indexOf(s) === e.sets.length - 1 || w.status === 'paused'
                          }
                          aria-label={`Move set ${i + 1} down`}
                          onClick={() =>
                            act('set.reorder', {
                              id: e.id,
                              ids: move(e.sets, e.sets.indexOf(s), 1).map((s) => s.id),
                            })
                          }
                        >
                          <ArrowDown size={13} />
                          Move down
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
              {!['completed', 'skipped'].includes(e.status) && (
                <>
                  <button
                    className="ghost"
                    disabled={w.status === 'paused'}
                    onClick={() => act('set.add', { id: e.id, ...defaultSet() })}
                  >
                    <Plus size={16} />
                    Add set
                  </button>
                  <div className="row">
                    <button
                      disabled={e.status !== 'active' || w.status === 'paused'}
                      onClick={() => act('exercise.complete', { id: e.id })}
                    >
                      Complete exercise
                    </button>
                    <button
                      className="ghost"
                      disabled={w.status === 'paused'}
                      onClick={() => act('exercise.skip', { id: e.id })}
                    >
                      Skip exercise
                    </button>
                    <button
                      className="ghost danger"
                      disabled={w.status === 'paused' || e.status === 'active'}
                      onClick={() => act('exercise.remove', { id: e.id })}
                    >
                      Remove
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="empty">
              <h2>No exercises remaining</h2>
              <p>Add an exercise or finish the workout.</p>
            </div>
          )}
        </section>
      </div>
      <details className="panel">
        <summary>Workout notes</summary>
        <form
          className="stack"
          onSubmit={(ev) => {
            ev.preventDefault();
            void act('workout.notes', { notes: new FormData(ev.currentTarget).get('notes') });
          }}
        >
          <textarea name="notes" defaultValue={w.notes} />
          <button>Save notes</button>
        </form>
      </details>
      <button className="ghost danger" onClick={() => setConfirm('abandon')}>
        Abandon workout
      </button>
    </div>
  );
}
