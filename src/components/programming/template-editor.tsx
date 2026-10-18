'use client';
import { AuctusSelect, setTypeOptions } from '../ui/select';
import { ExercisePicker } from './exercise-picker';
import { useState } from 'react';
import { ArrowUp, ArrowDown, Plus, X } from 'lucide-react';
import type { Template, Exercise, TemplateExercise, Prescription } from '@/domain/types';
import type { Send } from '../use-model';
export const defaultSet = (): Prescription => ({
  type: 'normal',
  min_reps: 8,
  max_reps: 8,
  rest_ms: 90000,
});
export function move<T>(items: T[], index: number, delta: number) {
  const next = [...items];
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
export function TemplateEditor({
  template,
  programId,
  exercises,
  send,
  close,
}: {
  template: Template | null;
  programId: string;
  exercises: Exercise[];
  send: Send;
  close: () => void;
}) {
  const [items, setItems] = useState<TemplateExercise[]>(template?.exercises ?? []),
    [selection, setSelection] = useState('');
  function setPrescription(ei: number, si: number, patch: Partial<Prescription>) {
    setItems(
      items.map((e, i) =>
        i === ei ? { ...e, sets: e.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) } : e,
      ),
    );
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (
      await send('template.save', {
        id: template?.id,
        version: template?.version,
        program_id: programId,
        name: f.get('name'),
        notes: f.get('notes'),
        exercises: items,
      })
    )
      close();
  }
  return (
    <form className="stack" onSubmit={save}>
      <div className="row between">
        <h1>{template ? 'Edit workout' : 'New workout'}</h1>
        <button type="button" onClick={close}>
          Cancel
        </button>
      </div>
      <p className="subtitle">
        Add exercises below, then enter minimum reps, maximum reps and rest for each set. For 6–8
        reps, enter 6 and 8. For exactly 8 reps, enter 8 in both fields. Each row is one set; use
        Add set to add more.
      </p>
      <div className="panel stack">
        <label>
          Workout name
          <input
            name="name"
            defaultValue={template?.name}
            required
            maxLength={120}
            placeholder="e.g. Full Body A"
          />
        </label>
        <label>
          Workout notes
          <textarea name="notes" defaultValue={template?.notes} />
        </label>
        <p className="muted">
          Workout duration is recorded automatically from Start to Finish when you train. Pauses are
          excluded from active time. Weight is entered during training, prefilled from the same set
          in your previous workout when available. Warm-up and working sets keep their own weights.
        </p>
      </div>
      {items.map((e, ei) => (
        <section className="panel stack" key={ei}>
          <div className="row between">
            <h2>
              <span className="muted">{String(ei + 1).padStart(2, '0')} / </span>
              {exercises.find((x) => x.id === e.exercise_id)?.name}
            </h2>
            <div className="row">
              <button
                type="button"
                className="small"
                disabled={ei === 0}
                aria-label="Move exercise up"
                onClick={() => setItems(move(items, ei, -1))}
              >
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                className="small"
                disabled={ei === items.length - 1}
                aria-label="Move exercise down"
                onClick={() => setItems(move(items, ei, 1))}
              >
                <ArrowDown size={16} />
              </button>
              <button
                type="button"
                className="small danger"
                aria-label="Remove exercise"
                onClick={() => setItems(items.filter((_, i) => i !== ei))}
              >
                <X size={16} />
              </button>
            </div>
          </div>
          {e.sets.map((s, si) => (
            <div className="prescription" key={si}>
              <span className="set-index">{si + 1}</span>
              <label>
                Type
                <AuctusSelect
                  label={`Set ${si + 1} type`}
                  value={s.type}
                  options={setTypeOptions}
                  onValueChange={(type) =>
                    setPrescription(ei, si, { type: type as Prescription['type'] })
                  }
                />
              </label>

              <label>
                Min reps
                <input
                  aria-label={`Set ${si + 1} minimum reps`}
                  type="number"
                  min="0"
                  max="1000"
                  required
                  value={s.min_reps}
                  onChange={(ev) => setPrescription(ei, si, { min_reps: Number(ev.target.value) })}
                />
              </label>
              <label>
                Max reps
                <input
                  aria-label={`Set ${si + 1} maximum reps`}
                  type="number"
                  min={s.min_reps}
                  max="1000"
                  required
                  value={s.max_reps}
                  onChange={(ev) => setPrescription(ei, si, { max_reps: Number(ev.target.value) })}
                />
              </label>
              <label>
                Rest · sec
                <input
                  aria-label={`Set ${si + 1} rest seconds`}
                  type="number"
                  min="0"
                  max="3600"
                  value={s.rest_ms / 1000}
                  onChange={(ev) =>
                    setPrescription(ei, si, { rest_ms: Number(ev.target.value) * 1000 })
                  }
                />
              </label>
              <div className="row">
                <button
                  type="button"
                  className="small"
                  disabled={si === 0}
                  aria-label="Move set up"
                  onClick={() =>
                    setItems(
                      items.map((x, i) => (i === ei ? { ...x, sets: move(x.sets, si, -1) } : x)),
                    )
                  }
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  className="small danger"
                  aria-label="Remove set"
                  onClick={() =>
                    setItems(
                      items.map((x, i) =>
                        i === ei ? { ...x, sets: x.sets.filter((_, j) => j !== si) } : x,
                      ),
                    )
                  }
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="ghost"
            onClick={() =>
              setItems(
                items.map((x, i) => (i === ei ? { ...x, sets: [...x.sets, defaultSet()] } : x)),
              )
            }
          >
            <Plus size={16} />
            Add set
          </button>
        </section>
      ))}
      <div className="panel stack">
        <ExercisePicker
          exercises={exercises}
          value={selection}
          onValueChange={setSelection}
          send={send}
        />
        <button
          type="button"
          disabled={!selection}
          onClick={() => {
            setItems([
              ...items,
              { exercise_id: selection, sets: [defaultSet(), defaultSet(), defaultSet()] },
            ]);
            setSelection('');
          }}
        >
          <Plus size={16} />
          Add exercise
        </button>
      </div>
      <div className="sticky-actions">
        <p>Loads per dumbbell · unilateral reps per side</p>
        <button className="primary">Save workout</button>
      </div>
    </form>
  );
}
