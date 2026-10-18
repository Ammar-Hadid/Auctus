'use client';
import { AuctusSelect, setTypeOptions } from '../ui/select';
import { useState } from 'react';
import { Check, Play, SkipForward, Trash2 } from 'lucide-react';
import type { SetSession, WorkoutDetail } from '@/domain/types';
import type { Send } from '../use-model';
export function SetCard({
  set,
  index,
  workout,
  parentActive,
  send,
}: {
  set: SetSession;
  index: number;
  workout: WorkoutDetail;
  parentActive: boolean;
  send: Send;
}) {
  const key = 'auctus.set-draft.' + set.id;
  const [values, setValues] = useState<{ kg: string; reps: string; notes: string }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const d = localStorage.getItem(key);
        if (d) return JSON.parse(d);
      } catch {}
    }
    return { kg: '', reps: '', notes: '' };
  });
  const [confirm, setConfirm] = useState(false),
    [editing, setEditing] = useState(false);
  const act = (action: string, extra: Record<string, unknown> = {}) =>
    send('session.action', {
      workout_id: workout.id,
      version: workout.version,
      action,
      id: set.id,
      ...extra,
    });
  function update(patch: Partial<typeof values>) {
    const next = { ...values, ...patch };
    setValues(next);
    localStorage.setItem(key, JSON.stringify(next));
  }
  async function complete(e: React.FormEvent) {
    e.preventDefault();
    if (
      await act('set.complete', {
        actual_grams: Math.round(Number(values.kg) * 1000),
        actual_reps: Number(values.reps),
        notes: values.notes,
      })
    ) {
      localStorage.removeItem(key);
    }
  }
  return (
    <div className={'set-card ' + (set.status === 'active' ? 'active' : '')}>
      <div className="row between">
        <div className="row">
          <span className="set-badge">
            {set.status === 'completed' ? <Check size={17} /> : index + 1}
          </span>
          <div>
            <strong>
              {set.type === 'warmup'
                ? 'Warm-up'
                : set.type.charAt(0).toUpperCase() + set.type.slice(1)}{' '}
              set
            </strong>
            <p className="set-target">
              Target {set.target_grams / 1000} kg × {set.target_reps} reps · {set.rest_ms / 1000}s
              rest
            </p>
          </div>
        </div>
        <span className="status">{set.status}</span>
      </div>
      {set.status === 'completed' && !editing && (
        <div className="recorded number">
          {(set.actual_grams ?? 0) / 1000}
          <small>kg</small>
          <span>×</span>
          {set.actual_reps}
          <small>reps</small>
        </div>
      )}
      {(set.status === 'active' || set.status === 'paused') && (
        <form className="stack result-form" onSubmit={complete}>
          <div className="field-grid">
            <label>
              Actual weight · kg
              <input
                aria-label={`Set ${index + 1} actual kg`}
                type="number"
                inputMode="decimal"
                min="0"
                max="2000"
                step="0.001"
                value={values.kg}
                placeholder={String(set.target_grams / 1000)}
                onChange={(e) => update({ kg: e.target.value })}
                required
                disabled={set.status === 'paused'}
              />
            </label>
            <label>
              Actual repetitions
              <input
                aria-label={`Set ${index + 1} actual reps`}
                type="number"
                inputMode="numeric"
                min="0"
                max="1000"
                value={values.reps}
                placeholder={String(set.target_reps)}
                onChange={(e) => update({ reps: e.target.value })}
                required
                disabled={set.status === 'paused'}
              />
            </label>
          </div>
          <label>
            Set notes
            <input
              value={values.notes}
              onChange={(e) => update({ notes: e.target.value })}
              maxLength={4000}
              placeholder="Optional"
            />
          </label>
          <p className="draft-label">Draft · results are saved when you complete the set.</p>
          <button className="primary" disabled={set.status !== 'active'}>
            <Check size={18} />
            Complete set
          </button>
        </form>
      )}
      {editing && (
        <form
          className="stack result-form"
          onSubmit={async (ev) => {
            ev.preventDefault();
            const f = new FormData(ev.currentTarget);
            const completed = set.status === 'completed';
            if (
              await act(
                completed ? 'set.edit' : 'set.prescription',
                completed
                  ? {
                      actual_grams: Math.round(Number(f.get('kg')) * 1000),
                      actual_reps: Number(f.get('reps')),
                      notes: f.get('notes'),
                    }
                  : {
                      type: f.get('type'),
                      target_grams: Math.round(Number(f.get('kg')) * 1000),
                      target_reps: Number(f.get('reps')),
                      rest_ms: Number(f.get('rest')) * 1000,
                    },
              )
            )
              setEditing(false);
          }}
        >
          <div className="field-grid">
            <label>
              {set.status === 'completed' ? 'Actual' : 'Target'} kg
              <input
                name="kg"
                type="number"
                min="0"
                max="2000"
                step="0.001"
                defaultValue={
                  (set.status === 'completed' ? set.actual_grams! : set.target_grams) / 1000
                }
                required
              />
            </label>
            <label>
              Repetitions
              <input
                name="reps"
                type="number"
                min="0"
                max="1000"
                defaultValue={set.status === 'completed' ? set.actual_reps! : set.target_reps}
                required
              />
            </label>
            {set.status === 'pending' && (
              <>
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
              <input name="notes" defaultValue={set.notes} />
            </label>
          )}
          <div className="row">
            <button className="primary">Save set changes</button>
            <button type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      <div className="row set-actions">
        {['pending', 'completed'].includes(set.status) && (
          <button
            className="small ghost"
            onClick={() => setEditing(!editing)}
            disabled={workout.status !== 'active'}
          >
            {set.status === 'completed' ? 'Correct result' : 'Edit targets'}
          </button>
        )}
        {set.status === 'pending' && (
          <button
            className="primary"
            disabled={!parentActive || workout.status !== 'active'}
            onClick={() => act('set.start')}
          >
            <Play size={15} />
            Start set {index + 1}
          </button>
        )}
        {!['completed', 'skipped'].includes(set.status) && (
          <button
            className="ghost"
            disabled={workout.status !== 'active'}
            onClick={() => act('set.skip')}
          >
            <SkipForward size={15} />
            Skip
          </button>
        )}
        {!['active', 'paused'].includes(set.status) && (
          <button
            className="ghost danger"
            disabled={workout.status !== 'active'}
            onClick={() => setConfirm(true)}
            aria-label={`Remove set ${index + 1}`}
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
      {confirm && (
        <div className="inline-confirm">
          <p>Remove this set from the plan? Any recorded results stay in history.</p>
          <button onClick={() => act('set.remove')}>Remove</button>
          <button onClick={() => setConfirm(false)}>Keep</button>
        </div>
      )}
    </div>
  );
}
