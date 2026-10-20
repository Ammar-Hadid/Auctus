'use client';
import { ActivityStatusLabel } from '../ui/activity-status';
import { useAccount } from '../account-context';
import { AuctusSelect, setTypeOptions } from '../ui/select';
import { useState } from 'react';
import { Check, Play, SkipForward, Trash2 } from 'lucide-react';
import type { SetSession, WorkoutDetail } from '@/domain/types';
import type { Equipment } from '@/domain/equipment';
import type { Send } from '../use-model';
import { repRangeLabel } from '@/domain/reps';

type SetDraft = { kg: string; reps: string; notes: string };

export function SetCard({
  set,
  index,
  workout,
  send,
  onResolved,
  equipment,
}: {
  set: SetSession;
  index: number;
  workout: WorkoutDetail;
  parentActive: boolean;
  send: Send;
  onResolved?: () => void;
  equipment?: Equipment | null;
}) {
  const account = useAccount();
  const key = `auctus.set-draft.${account.id}.${set.id}`;
  const [draft, setDraft] = useState<SetDraft | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const saved = JSON.parse(raw);
          if (
            saved &&
            typeof saved.kg === 'string' &&
            typeof saved.reps === 'string' &&
            typeof saved.notes === 'string'
          )
            return saved;
        }
      } catch {}
    }
    return null;
  });
  const values = draft ?? {
    kg: set.prefill_grams !== null ? String(set.prefill_grams / 1000) : '',
    reps: set.prefill_reps != null ? String(set.prefill_reps) : '',
    notes: '',
  };
  const [confirm, setConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const anotherSetRunning = workout.exercises.some((exercise) =>
    exercise.sets.some(
      (item) =>
        item.id !== set.id &&
        !item.removed_at &&
        (item.status === 'active' || item.status === 'paused'),
    ),
  );
  const canChange = workout.status === 'active' && !saving;
  const kind =
    set.type === 'warmup'
      ? 'Warm-up'
      : set.type === 'normal'
        ? 'Working'
        : set.type === 'dropset'
          ? 'Drop set'
          : 'Failure';

  async function act(
    action: string,
    extra: Record<string, unknown> = {},
    onConfirmed?: () => void,
  ) {
    setSaving(true);
    try {
      return await send(
        'session.action',
        { workout_id: workout.id, version: workout.version, action, id: set.id, ...extra },
        onConfirmed,
      );
    } finally {
      setSaving(false);
    }
  }
  function update(patch: Partial<SetDraft>) {
    const next = { ...values, ...patch };
    setDraft(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  }
  function resolved() {
    try {
      localStorage.removeItem(key);
    } catch {}
    setDraft(null);
    setConfirm(false);
    onResolved?.();
  }
  async function complete(event: React.FormEvent) {
    event.preventDefault();
    if (!canChange || set.status !== 'active') return;
    await act(
      'set.complete',
      {
        actual_grams: Math.round(Number(values.kg) * 1000),
        actual_reps: Number(values.reps),
        notes: values.notes,
      },
      resolved,
    );
  }

  return (
    <div className={`set-card set-focus ${set.status}`} aria-label={`Set ${index + 1}`}>
      <div className="row between">
        <div>
          <strong>
            Set {index + 1} <span className="set-kind">· {kind}</span>
          </strong>
          <p className="set-target">
            Aim for {repRangeLabel(set.min_reps, set.max_reps)} reps · {set.rest_ms / 1000}s rest
          </p>
        </div>
        <ActivityStatusLabel status={set.status} />
      </div>

      {set.status === 'pending' && !editing && (
        <div className="stack">
          {anotherSetRunning && (
            <p className="muted">Finish or skip your current set before starting another set.</p>
          )}
          <button
            className="primary"
            disabled={!canChange || anotherSetRunning}
            onClick={() => act('set.begin', {}, onResolved)}
          >
            <Play size={18} /> Start set {index + 1}
          </button>
        </div>
      )}

      {(set.status === 'active' || set.status === 'paused') && (
        <form className="stack result-form" onSubmit={complete}>
          <div className="field-grid">
            <label>
              {equipment === 'dumbbell' ? 'Weight · kg per dumbbell' : 'Weight · kg'}
              <input
                aria-label={`Set ${index + 1} actual kg`}
                type="number"
                inputMode="decimal"
                min="0"
                max="2000"
                step="0.001"
                value={values.kg}
                placeholder="Enter weight"
                onChange={(event) => update({ kg: event.target.value })}
                required
                disabled={!canChange || set.status === 'paused'}
              />
            </label>
            <label>
              Reps completed
              <input
                aria-label={`Set ${index + 1} actual reps`}
                type="number"
                inputMode="numeric"
                min="0"
                max="1000"
                value={values.reps}
                placeholder="Enter reps"
                onChange={(event) => update({ reps: event.target.value })}
                required
                disabled={!canChange || set.status === 'paused'}
              />
            </label>
          </div>
          <p className="muted">
            {set.prefill_grams !== null
              ? `Latest completed ${kind.toLowerCase()} set: ${set.prefill_grams / 1000} kg${set.prefill_reps != null ? ` × ${set.prefill_reps} reps` : ''}. Adjust if needed.`
              : 'No completed set of this type for this exercise yet. Enter your weight and reps.'}
          </p>

          {set.status === 'paused' && (
            <p className="muted">Resume the exercise to continue this set.</p>
          )}
          <button className="primary" disabled={!canChange || set.status !== 'active'}>
            <Check size={18} /> {saving ? 'Saving set…' : 'Complete set'}
          </button>
          <p className="draft-label">Completing saves your result and starts rest.</p>
          <details className="set-notes">
            <summary>{values.notes ? 'Set notes · draft added' : 'Add a set note'}</summary>
            <label>
              Set notes
              <textarea
                value={values.notes}
                onChange={(event) => update({ notes: event.target.value })}
                maxLength={4000}
                placeholder="Optional"
                disabled={!canChange || set.status === 'paused'}
              />
            </label>
          </details>
        </form>
      )}

      {set.status === 'completed' && !editing && (
        <div>
          <div className="recorded number">
            {(set.actual_grams ?? 0) / 1000}
            <small>kg</small>
            <span>×</span>
            {set.actual_reps}
            <small>reps</small>
          </div>
          {set.notes && <p className="muted">{set.notes}</p>}
        </div>
      )}
      {set.status === 'skipped' && (
        <p className="muted">This set was skipped. No result was recorded.</p>
      )}

      <details className="set-options">
        <summary>Set options</summary>
        <div className="stack">
          {['pending', 'completed'].includes(set.status) && !editing && (
            <button className="ghost" disabled={!canChange} onClick={() => setEditing(true)}>
              {set.status === 'completed' ? 'Correct result' : 'Edit set plan'}
            </button>
          )}
          {editing && (
            <form
              className="stack result-form"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!canChange) return;
                const form = new FormData(event.currentTarget);
                const completed = set.status === 'completed';
                await act(
                  completed ? 'set.edit' : 'set.prescription',
                  completed
                    ? {
                        actual_grams: Math.round(Number(form.get('kg')) * 1000),
                        actual_reps: Number(form.get('reps')),
                        notes: form.get('notes'),
                      }
                    : {
                        type: form.get('type'),
                        min_reps: Number(form.get('min_reps')),
                        max_reps: Number(form.get('max_reps')),
                        rest_ms: Number(form.get('rest')) * 1000,
                      },
                  () => setEditing(false),
                );
              }}
            >
              <div className="field-grid">
                {set.status === 'completed' && (
                  <>
                    <label>
                      Weight · kg
                      <input
                        name="kg"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="2000"
                        step="0.001"
                        defaultValue={set.actual_grams! / 1000}
                        required
                      />
                    </label>
                    <label>
                      Repetitions
                      <input
                        name="reps"
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max="1000"
                        defaultValue={set.actual_reps!}
                        required
                      />
                    </label>
                  </>
                )}
                {set.status === 'pending' && (
                  <>
                    <label>
                      Min reps
                      <input
                        name="min_reps"
                        aria-label={`Set ${index + 1} minimum reps`}
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max="1000"
                        defaultValue={set.min_reps}
                        required
                      />
                    </label>
                    <label>
                      Max reps
                      <input
                        name="max_reps"
                        aria-label={`Set ${index + 1} maximum reps`}
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max="1000"
                        defaultValue={set.max_reps}
                        required
                      />
                    </label>
                    <label>
                      Type
                      <AuctusSelect
                        label="Set type"
                        name="type"
                        defaultValue={set.type}
                        options={setTypeOptions}
                      />
                    </label>
                    <label>
                      Planned rest · seconds
                      <input
                        name="rest"
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max="3600"
                        defaultValue={set.rest_ms / 1000}
                        required
                      />
                    </label>
                  </>
                )}
              </div>
              {set.status === 'completed' && (
                <label>
                  Notes
                  <textarea name="notes" defaultValue={set.notes} maxLength={4000} />
                </label>
              )}
              <div className="row">
                <button className="primary" disabled={!canChange}>
                  Save set changes
                </button>
                <button type="button" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
          {!['completed', 'skipped'].includes(set.status) && (
            <button
              className="ghost"
              disabled={!canChange}
              onClick={() => act('set.skip', {}, resolved)}
            >
              <SkipForward size={15} /> Skip set
            </button>
          )}
          {!['active', 'paused'].includes(set.status) && !confirm && (
            <button
              className="ghost danger"
              disabled={!canChange}
              onClick={() => setConfirm(true)}
              aria-label={`Remove set ${index + 1}`}
            >
              <Trash2 size={15} /> Remove set
            </button>
          )}
          {confirm && (
            <div className="inline-confirm">
              <p>Remove this set from this workout? Any recorded results stay in history.</p>
              <div className="row">
                <button
                  className="danger"
                  disabled={!canChange}
                  onClick={() => act('set.remove', {}, resolved)}
                >
                  Remove
                </button>
                <button onClick={() => setConfirm(false)}>Keep</button>
              </div>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
