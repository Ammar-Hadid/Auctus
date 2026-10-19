'use client';
import { useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Play,
  Pause,
  Check,
  ArrowUp,
  ArrowDown,
  Plus,
  List,
  X,
  ArrowRight,
  SlidersHorizontal,
} from 'lucide-react';
import { WorkoutRequirement } from '../ui/workout-requirement';
import { EquipmentLabel } from '../ui/equipment';
import { ActivityIcon, ActivityStatusLabel, activityLabels } from '../ui/activity-status';
import { NotificationHost } from '../ui/notification';
import { ExercisePicker } from '../programming/exercise-picker';
import type { State } from '@/domain/types';
import type { Send } from '../use-model';
import { activeDuration, durationLabel } from '@/domain/timing';
import { repRangeLabel } from '@/domain/reps';
import { useNow } from './timer';
import { SetCard } from './set-card';
import { defaultSet } from '../programming/template-editor';

function reorderVisible<T extends { id: string; removed_at: number | null }>(
  items: T[],
  id: string,
  delta: number,
) {
  const visible = items.filter((item) => !item.removed_at);
  const neighbor = visible[visible.findIndex((item) => item.id === id) + delta];
  const result = items.map((item) => item.id);
  if (neighbor) {
    const from = result.indexOf(id),
      to = result.indexOf(neighbor.id);
    [result[from], result[to]] = [result[to], result[from]];
  }
  return result;
}

export function ActiveWorkout({
  state,
  send,
  finished,
  busy = false,
}: {
  state: State;
  send: Send;
  finished: () => void;
  busy?: boolean;
}) {
  const w = state.activeWorkout!;
  const [focused, setFocused] = useState<string | null>(null);
  const [selectedSet, setSelectedSet] = useState<string | null>(null);
  const [overview, setOverview] = useState(false);
  const [workoutOptions, setWorkoutOptions] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [confirm, setConfirm] = useState<'complete' | 'abandon' | 'remove' | null>(null);
  const [add, setAdd] = useState(false);
  const [selection, setSelection] = useState('');
  const focusArea = useRef<HTMLDivElement>(null);
  const overviewTrigger = useRef<HTMLButtonElement>(null);
  const selectedFromOverview = useRef(false);
  const now = useNow(state.serverNow);
  const exercises = w.exercises.filter((x) => !x.removed_at);
  const activeExercise = exercises.find((x) =>
    x.sets.some((s) => !s.removed_at && ['active', 'paused'].includes(s.status)),
  );
  const rest = w.rests.find((r) => r.ended_at === null);
  const e =
    exercises.find((x) => x.id === focused) ??
    activeExercise ??
    exercises.find((x) => x.status === 'active' || x.id === w.resume_exercise_id) ??
    exercises.find((x) => rest && x.sets.some((s) => s.id === rest.set_id)) ??
    exercises.find((x) => !['completed', 'skipped'].includes(x.status)) ??
    exercises[0];
  const sets = e?.sets.filter((s) => !s.removed_at) ?? [];
  const current =
    sets.find((s) => s.id === selectedSet) ??
    sets.find((s) => ['active', 'paused'].includes(s.status)) ??
    sets.find((s) => s.status === 'pending');
  const total = exercises.flatMap((x) => x.sets).filter((s) => !s.removed_at);
  const done = total.filter((s) => s.status === 'completed').length;
  const skipped = total.filter((s) => s.status === 'skipped').length;
  const remaining = total.length - done - skipped;
  const next = exercises.find(
    (x) => x.id !== e?.id && x.sets.some((s) => !s.removed_at && s.status === 'pending'),
  );
  const previous = e
    ? state.history
        .filter((h) => h.status === 'completed')
        .flatMap((h) => h.exercises)
        .find(
          (x) => !x.removed_at && x.exercise_id === e.exercise_id && x.equipment === e.equipment,
        )
    : null;
  const act = (action: string, extra: Record<string, unknown> = {}, onConfirmed?: () => void) =>
    send('session.action', { workout_id: w.id, version: w.version, action, ...extra }, onConfirmed);
  function orient() {
    focusArea.current?.focus({ preventScroll: true });
    focusArea.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  function inspect(id: string) {
    setFocused(id);
    setSelectedSet(null);
    if (overview) {
      selectedFromOverview.current = true;
      setOverview(false);
    } else orient();
  }
  const locked = w.status === 'paused';
  const allResolved = sets.every((s) => ['completed', 'skipped'].includes(s.status));
  return (
    <div className="workout-focus">
      <header className="workout-context">
        <div className="workout-context-title">
          <div>
            <span className="eyeline">Your workout</span>
            <h1>{w.name}</h1>
          </div>
          <div className="workout-clock number">
            {durationLabel(activeDuration(w, now))}
            <small>active time</small>
          </div>
        </div>
        <div className="workout-progress-copy">
          <span>
            {done} / {total.length} sets completed{skipped > 0 ? ` · ${skipped} skipped` : ''}
          </span>
          <WorkoutRequirement mandatory={w.mandatory} />
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-label="Completed sets"
          aria-valuemin={0}
          aria-valuemax={total.length || 1}
          aria-valuenow={done}
        >
          <div style={{ width: `${total.length ? (done / total.length) * 100 : 0}%` }} />
        </div>
      </header>
      <div className="workout-toolbar">
        <button ref={overviewTrigger} className="ghost" onClick={() => setOverview(true)}>
          <List size={18} />
          Workout overview
        </button>
        <Dialog.Root open={workoutOptions} onOpenChange={setWorkoutOptions}>
          <Dialog.Trigger asChild>
            <button className="ghost workout-options-trigger">Workout options</button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="exercise-dialog-overlay" />
            <Dialog.Content className="session-dialog-layer">
              <NotificationHost />
              <div className="session-dialog">
                <div className="row between">
                  <Dialog.Title>Workout options</Dialog.Title>
                  <Dialog.Close asChild>
                    <button className="ghost" aria-label="Close workout options">
                      <X size={18} />
                    </button>
                  </Dialog.Close>
                </div>
                <Dialog.Description>Manage your workout, notes, and finish.</Dialog.Description>
                <fieldset disabled={busy}>
                  <div className="stack">
                    <button
                      onClick={() =>
                        act(locked ? 'workout.resume' : 'workout.pause', {}, () =>
                          setWorkoutOptions(false),
                        )
                      }
                    >
                      {locked ? <Play size={16} /> : <Pause size={16} />}
                      {locked ? 'Resume' : 'Pause'}
                    </button>
                    <button
                      disabled={locked || !!activeExercise}
                      onClick={() => {
                        setWorkoutOptions(false);
                        setConfirm('complete');
                      }}
                    >
                      Finish workout
                    </button>
                    {!!activeExercise && (
                      <p className="muted">Complete or skip your active set before finishing.</p>
                    )}
                    <details>
                      <summary>Workout notes</summary>
                      <form
                        className="stack"
                        onSubmit={(ev) => {
                          ev.preventDefault();
                          void act('workout.notes', {
                            notes: new FormData(ev.currentTarget).get('notes'),
                          });
                        }}
                      >
                        <label>
                          Notes
                          <textarea name="notes" defaultValue={w.notes} />
                        </label>
                        <button>Save notes</button>
                      </form>
                    </details>
                    <button
                      className="ghost danger"
                      onClick={() => {
                        setWorkoutOptions(false);
                        setConfirm('abandon');
                      }}
                    >
                      Abandon workout
                    </button>
                  </div>
                </fieldset>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
      {locked && (
        <div className="workout-paused-notice" role="status">
          <Pause size={20} />
          <div>
            <strong>Workout paused</strong>
            <p>Your time and rest countdown are stopped.</p>
          </div>
          <button onClick={() => act('workout.resume')}>Resume workout</button>
        </div>
      )}
      {activeExercise &&
        (activeExercise.id !== e?.id ||
          (current && !['active', 'paused'].includes(current.status))) && (
          <button className="return-to-set" onClick={() => inspect(activeExercise.id)}>
            <Play size={16} />
            Return to your {locked ? 'paused' : 'active'} set · {activeExercise.name}
          </button>
        )}
      {selectedSet &&
        !activeExercise &&
        current &&
        ['completed', 'skipped'].includes(current.status) && (
          <button
            className="return-to-set"
            onClick={() => {
              setSelectedSet(null);
              orient();
            }}
          >
            <ArrowRight size={16} />
            {sets.some((s) => s.status === 'pending')
              ? 'Back to next set'
              : 'Back to exercise summary'}
          </button>
        )}
      <div ref={focusArea} tabIndex={-1} className="exercise-focus-area">
        {e ? (
          <>
            <section
              className={`exercise-focus-heading ${e.status}`}
              aria-labelledby="current-exercise-name"
            >
              <div className="row between">
                <span className="eyeline">
                  Exercise {exercises.indexOf(e) + 1} of {exercises.length}
                </span>
                <ActivityStatusLabel status={e.status} />
              </div>
              <h2 id="current-exercise-name">{e.name}</h2>
              <EquipmentLabel equipment={e.equipment} />
              <p className="exercise-conventions">
                {e.equipment === 'dumbbell' ? 'Weight per dumbbell · ' : ''}Unilateral reps per side
              </p>
            </section>
            <div className="exercise-work-area">
              {current ? (
                <>
                  <div className="set-instruction" role="status">
                    {current.status === 'active'
                      ? 'Perform your set, then record what you did.'
                      : current.status === 'paused'
                        ? 'Resume your workout to finish this set.'
                        : current.status === 'pending'
                          ? rest
                            ? 'Rest, then start when you’re ready.'
                            : 'Ready for your next set.'
                          : 'Reviewing a recorded set.'}
                  </div>
                  <SetCard
                    key={current.id}
                    set={current}
                    index={sets.indexOf(current)}
                    workout={w}
                    parentActive={e.status === 'active'}
                    equipment={e.equipment}
                    send={send}
                    onResolved={() => {
                      setFocused(e.id);
                      setSelectedSet(null);
                      orient();
                    }}
                  />
                </>
              ) : (
                <div className={`exercise-finished ${e.status}`} role="status">
                  <ActivityIcon status={e.status} size={28} />
                  <h3>
                    {e.status === 'skipped'
                      ? 'Exercise skipped'
                      : allResolved
                        ? 'Exercise finished'
                        : 'No sets yet'}
                  </h3>
                  <p>
                    {sets.filter((s) => s.status === 'completed').length} of {sets.length} sets
                    completed
                    {sets.some((s) => s.status === 'skipped')
                      ? ' · skipped sets kept separate'
                      : ''}
                    .
                  </p>
                  {allResolved &&
                    sets.length > 0 &&
                    !['completed', 'skipped'].includes(e.status) && (
                      <button
                        disabled={locked}
                        onClick={() => act('exercise.complete', { id: e.id })}
                      >
                        Complete exercise
                      </button>
                    )}
                  {next ? (
                    <>
                      <p>
                        {rest ? 'Take your rest. Up next:' : 'Up next:'}{' '}
                        <strong>{next.name}</strong>
                      </p>
                      <button
                        className="primary"
                        disabled={locked || !!activeExercise}
                        onClick={() =>
                          act(
                            'set.begin',
                            {
                              id: next.sets.find((s) => !s.removed_at && s.status === 'pending')!
                                .id,
                            },
                            () => inspect(next.id),
                          )
                        }
                      >
                        Start next exercise
                        <ArrowRight size={18} />
                      </button>
                    </>
                  ) : (
                    remaining === 0 && (
                      <button
                        className="primary"
                        disabled={locked || !!activeExercise}
                        onClick={() => setConfirm('complete')}
                      >
                        Finish workout
                        <Check size={18} />
                      </button>
                    )
                  )}
                </div>
              )}
              <section className="set-ledger" aria-label="Exercise sets">
                <div className="set-ledger-heading">
                  <h3>Sets</h3>
                  <span>Tap a row to view or edit</span>
                </div>
                <div className="set-ledger-labels" aria-hidden="true">
                  <span>Set</span>
                  <span>Plan</span>
                  <span>Result / status</span>
                </div>
                {sets.map((s, i) => (
                  <button
                    key={s.id}
                    className={`set-ledger-row ${s.status} ${current?.id === s.id ? 'selected' : ''}`}
                    aria-label={`View set ${i + 1}, ${activityLabels[s.status]}`}
                    aria-current={current?.id === s.id ? 'step' : undefined}
                    onClick={() => {
                      setSelectedSet(s.id);
                      orient();
                    }}
                  >
                    <span className="set-ledger-number">
                      {i + 1}
                      <small>
                        {s.type === 'normal'
                          ? 'Working'
                          : s.type === 'warmup'
                            ? 'Warm-up'
                            : s.type === 'dropset'
                              ? 'Drop'
                              : 'Failure'}
                      </small>
                    </span>
                    <span>
                      {repRangeLabel(s.min_reps, s.max_reps)} reps
                      <small>{s.rest_ms / 1000}s rest</small>
                    </span>
                    <span className="set-ledger-result">
                      {s.status === 'completed'
                        ? `${(s.actual_grams ?? 0) / 1000} kg × ${s.actual_reps}`
                        : activityLabels[s.status]}
                      <ActivityIcon status={s.status} size={16} />
                    </span>
                  </button>
                ))}
              </section>
              <details className="exercise-tools">
                <summary>
                  <SlidersHorizontal size={16} />
                  Exercise options
                </summary>
                <div className="stack">
                  <p className="muted">Changes here apply to this workout only.</p>
                  <div className="row">
                    <button
                      disabled={locked}
                      onClick={() =>
                        act('set.add', { id: e.id, ...defaultSet() }, () => {
                          setSelectedSet(null);
                        })
                      }
                    >
                      <Plus size={16} />
                      Add set
                    </button>
                    {!['completed', 'skipped'].includes(e.status) && (
                      <button
                        disabled={
                          locked || e.sets.some((s) => ['active', 'paused'].includes(s.status))
                        }
                        onClick={() =>
                          act('exercise.skip', { id: e.id }, () => {
                            setSelectedSet(null);
                            setFocused(e.id);
                          })
                        }
                      >
                        Skip exercise
                      </button>
                    )}
                    <button
                      className="ghost danger"
                      disabled={
                        locked ||
                        e.status === 'active' ||
                        e.sets.some((s) => ['active', 'paused'].includes(s.status))
                      }
                      onClick={() => setConfirm('remove')}
                    >
                      Remove exercise
                    </button>
                  </div>
                  <details>
                    <summary>Reorder sets</summary>
                    <div className="stack">
                      {sets.map((s, i) => (
                        <div className="row between" key={s.id}>
                          <span>
                            Set {i + 1} · {s.type === 'normal' ? 'Working' : s.type}
                          </span>
                          <div className="row">
                            <button
                              className="small ghost"
                              aria-label={`Move set ${i + 1} up`}
                              disabled={locked || i === 0}
                              onClick={() =>
                                act('set.reorder', {
                                  id: e.id,
                                  ids: reorderVisible(e.sets, s.id, -1),
                                })
                              }
                            >
                              <ArrowUp size={16} />
                            </button>
                            <button
                              className="small ghost"
                              aria-label={`Move set ${i + 1} down`}
                              disabled={locked || i === sets.length - 1}
                              onClick={() =>
                                act('set.reorder', {
                                  id: e.id,
                                  ids: reorderVisible(e.sets, s.id, 1),
                                })
                              }
                            >
                              <ArrowDown size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                  <details>
                    <summary>Previous workout & technique</summary>
                    <p>
                      {previous
                        ? previous.sets
                            .filter((s) => !s.removed_at && s.status === 'completed')
                            .map((s) => `${(s.actual_grams ?? 0) / 1000} kg × ${s.actual_reps}`)
                            .join(' / ') || 'No completed sets.'
                        : 'Your first recorded workout for this exercise.'}
                    </p>
                    <p>
                      {state.exercises.find((x) => x.id === e.exercise_id)?.details ||
                        'No technique notes.'}
                    </p>
                  </details>
                </div>
              </details>
            </div>
          </>
        ) : (
          <div className="empty">
            <h2>No exercises remaining</h2>
            <button
              onClick={() => {
                setOverview(true);
                setAdd(true);
              }}
            >
              Add exercise
            </button>
            <button disabled={locked} onClick={() => setConfirm('complete')}>
              Finish workout
            </button>
          </div>
        )}
      </div>
      <Dialog.Root open={overview} onOpenChange={setOverview}>
        <Dialog.Portal>
          <Dialog.Overlay className="exercise-dialog-overlay" />
          <Dialog.Content
            className="session-dialog-layer"
            onCloseAutoFocus={(ev) => {
              ev.preventDefault();
              if (selectedFromOverview.current) {
                selectedFromOverview.current = false;
                orient();
              } else overviewTrigger.current?.focus({ preventScroll: true });
            }}
          >
            <NotificationHost />
            <div className="session-dialog">
              <div className="row between">
                <Dialog.Title>Workout overview</Dialog.Title>
                <Dialog.Close asChild>
                  <button className="ghost" aria-label="Close workout overview">
                    <X size={18} />
                  </button>
                </Dialog.Close>
              </div>
              <Dialog.Description>
                {w.name}. Choose an exercise to view it. Your current set keeps its place.
              </Dialog.Description>
              <fieldset disabled={busy} className="stack">
                <div className="row between">
                  <span>
                    {done} completed · {skipped} skipped · {remaining} remaining sets
                  </span>
                  <button className="small ghost" onClick={() => setReordering(!reordering)}>
                    {reordering ? 'Done reordering' : 'Reorder exercises'}
                  </button>
                </div>
                <div className="workout-overview-list">
                  {exercises.map((x, i) => (
                    <div className={`overview-exercise ${x.status}`} key={x.id}>
                      <button
                        className="overview-exercise-select"
                        onClick={() => inspect(x.id)}
                        aria-current={e?.id === x.id ? 'true' : undefined}
                      >
                        <span className="overview-index">
                          {x.status === 'completed' ? <Check size={18} /> : i + 1}
                        </span>
                        <span>
                          <strong>{x.name}</strong>
                          <small>
                            {activityLabels[x.status]} ·{' '}
                            {x.sets.filter((s) => !s.removed_at && s.status === 'completed').length}
                            /{x.sets.filter((s) => !s.removed_at).length} sets
                          </small>
                        </span>
                        <ArrowRight size={16} />
                      </button>
                      {reordering && (
                        <div className="row">
                          <button
                            aria-label={`Move ${x.name} up`}
                            disabled={locked || i === 0}
                            onClick={() =>
                              act('exercise.reorder', {
                                ids: reorderVisible(w.exercises, x.id, -1),
                              })
                            }
                          >
                            <ArrowUp size={16} />
                          </button>
                          <button
                            aria-label={`Move ${x.name} down`}
                            disabled={locked || i === exercises.length - 1}
                            onClick={() =>
                              act('exercise.reorder', {
                                ids: reorderVisible(w.exercises, x.id, 1),
                              })
                            }
                          >
                            <ArrowDown size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <button className="ghost" disabled={locked} onClick={() => setAdd(!add)}>
                  <Plus size={16} />
                  Add exercise
                </button>
                {add && (
                  <div className="stack">
                    <ExercisePicker
                      label="Exercise"
                      exercises={state.exercises}
                      value={selection}
                      onValueChange={setSelection}
                      send={send}
                      disabled={locked}
                    />
                    <button
                      disabled={!selection || locked}
                      onClick={() =>
                        act(
                          'exercise.add',
                          { exercise_id: selection, sets: [defaultSet()] },
                          () => {
                            setAdd(false);
                            setSelection('');
                          },
                        )
                      }
                    >
                      Add to workout
                    </button>
                  </div>
                )}
              </fieldset>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="exercise-dialog-overlay" />
          <Dialog.Content className="session-dialog-layer">
            <NotificationHost />
            <div className="session-dialog session-confirm">
              <Dialog.Title>
                {confirm === 'complete'
                  ? 'Finish your workout?'
                  : confirm === 'remove'
                    ? 'Remove this exercise?'
                    : 'Abandon this workout?'}
              </Dialog.Title>
              <Dialog.Description>
                {confirm === 'complete'
                  ? `${done} sets completed. ${remaining ? `${remaining} unfinished sets will be marked skipped.` : 'Your recorded results will be saved in history.'}`
                  : confirm === 'remove'
                    ? 'The exercise leaves this workout. Recorded results stay in history.'
                    : 'Recorded results stay in history; unfinished activity is marked skipped.'}
              </Dialog.Description>
              <fieldset disabled={busy} className="row">
                <button
                  className={confirm === 'complete' ? 'primary' : 'danger'}
                  onClick={() =>
                    act(
                      confirm === 'remove'
                        ? 'exercise.remove'
                        : confirm === 'complete'
                          ? 'workout.complete'
                          : 'workout.abandon',
                      confirm === 'remove' ? { id: e?.id } : { skipRemaining: true },
                      () => {
                        setConfirm(null);
                        if (confirm === 'remove') {
                          setFocused(null);
                          setSelectedSet(null);
                        } else finished();
                      },
                    )
                  }
                >
                  {confirm === 'complete'
                    ? 'Confirm finish'
                    : confirm === 'remove'
                      ? 'Confirm remove'
                      : 'Confirm abandon'}
                </button>
                <Dialog.Close asChild>
                  <button>Keep training</button>
                </Dialog.Close>
              </fieldset>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
