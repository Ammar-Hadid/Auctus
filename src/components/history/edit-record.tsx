'use client';
import { AuctusSelect, setTypeOptions } from '../ui/select';
import type { WorkoutDetail, SetSession, Rest } from '@/domain/types';
import type { Send } from '../use-model';
export function localInput(timestamp: number) {
  const date = new Date(timestamp);
  return new Date(timestamp - date.getTimezoneOffset() * 60000).toISOString().slice(0, 23);
}
export function EditRecord({
  workout,
  set,
  rest,
  send,
  close,
}: {
  workout: WorkoutDetail;
  set?: SetSession;
  rest?: Rest;
  send: Send;
  close: () => void;
}) {
  const start = set ? set.started_at : (rest?.started_at ?? workout.started_at);
  const end = set ? set.ended_at : (rest?.ended_at ?? workout.ended_at!);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {
      workout_id: workout.id,
      version: workout.version,
      kind: set ? 'set' : rest ? 'rest' : 'workout',
      id: set?.id ?? rest?.id,
      started_at: f.get('start') ? new Date(String(f.get('start'))).getTime() : null,
      ended_at: f.get('end') ? new Date(String(f.get('end'))).getTime() : null,
      notes: f.get('notes') ?? '',
    };
    if (set)
      Object.assign(data, {
        actual_grams: Math.round(Number(f.get('kg')) * 1000),
        actual_reps: Number(f.get('reps')),
        type: f.get('type'),
        status: f.get('status'),
      });
    if (await send('history.edit', data)) close();
  }
  return (
    <form className="panel stack history-edit" onSubmit={save}>
      <div className="row between">
        <h3>Edit {set ? 'set' : rest ? 'rest' : 'workout'}</h3>
        <button type="button" onClick={close}>
          Cancel
        </button>
      </div>
      {set && (
        <>
          <div className="field-grid">
            <label>
              Actual weight · kg
              <input
                name="kg"
                aria-label="Corrected weight"
                type="number"
                min="0"
                max="2000"
                step="0.001"
                defaultValue={(set.actual_grams ?? 0) / 1000}
                required
              />
            </label>
            <label>
              Actual repetitions
              <input
                name="reps"
                aria-label="Corrected repetitions"
                type="number"
                min="0"
                max="1000"
                defaultValue={set.actual_reps ?? 0}
                required
              />
            </label>
            <label>
              Set type
              <AuctusSelect
                label="Set type"
                name="type"
                defaultValue={set.type}
                options={setTypeOptions}
              />
            </label>
            <label>
              Status
              <AuctusSelect
                label="Status"
                name="status"
                defaultValue={set.status === 'completed' ? 'completed' : 'skipped'}
                options={[
                  { value: 'completed', label: 'Completed' },
                  { value: 'skipped', label: 'Skipped' },
                ]}
              />
            </label>
          </div>
        </>
      )}
      <div className="field-grid">
        <label>
          Started · device timezone
          <input
            type="datetime-local"
            step="0.001"
            name="start"
            defaultValue={start === null ? '' : localInput(start)}
            required={!set}
          />
        </label>
        <label>
          Finished · device timezone
          <input
            type="datetime-local"
            step="0.001"
            name="end"
            defaultValue={end === null ? '' : localInput(end)}
            required={!set}
          />
        </label>
      </div>
      {!rest && (
        <label>
          Notes
          <textarea name="notes" defaultValue={set?.notes ?? workout.notes} />
        </label>
      )}
      <p className="muted">
        Completed sets require both times; unstarted skipped sets may have no start time. Times must
        remain within the workout and cannot overlap another set or rest. Statistics update after
        saving.
      </p>
      <button className="primary">Save correction</button>
    </form>
  );
}
