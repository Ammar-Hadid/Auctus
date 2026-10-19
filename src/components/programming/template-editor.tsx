'use client';
import { EquipmentLabel } from '../ui/equipment';
import { AuctusSelect, setTypeOptions } from '../ui/select';
import { ExercisePicker } from './exercise-picker';
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, Plus, X, FileCheck2, Pencil, LoaderCircle } from 'lucide-react';
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
type EditorExercise = TemplateExercise & { editorKey: string; collapsed: boolean };
export function TemplateEditor({
  template,
  programId,
  exercises,
  send,
  locked,
  close,
}: {
  template: Template | null;
  programId: string;
  exercises: Exercise[];
  send: Send;
  locked: boolean;
  close: () => void;
}) {
  const [items, setItems] = useState<EditorExercise[]>(() =>
    (template?.exercises ?? []).map((e, i) => ({
      ...e,
      editorKey: e.id ?? `existing-${i}`,
      collapsed: true,
    })),
  );
  const [selection, setSelection] = useState('');
  const [savedTemplate, setSavedTemplate] = useState(template);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const form = useRef<HTMLFormElement>(null);
  const controls = useRef(new Map<string, HTMLButtonElement>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function setPrescription(ei: number, si: number, patch: Partial<Prescription>) {
    setItems(
      items.map((e, i) =>
        i === ei ? { ...e, sets: e.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) } : e,
      ),
    );
  }
  async function save(collapseKey?: string) {
    if (savingKey || locked || !form.current?.reportValidity()) return;
    const f = new FormData(form.current);
    const snapshot = items;
    setSavingKey(collapseKey ?? 'workout');
    setAnnouncement('');
    try {
      const response = await send(
        'template.save',
        {
          id: savedTemplate?.id,
          version: savedTemplate?.version,
          program_id: programId,
          name: f.get('name'),
          notes: f.get('notes'),
          exercises: snapshot.map((e) => ({ id: e.id, exercise_id: e.exercise_id, sets: e.sets })),
        },
        (result) => {
          if (!mounted.current) return;
          const saved = result as Template;
          setSavedTemplate(saved);
          setItems(
            saved.exercises.map((e, i) => ({
              ...e,
              editorKey: snapshot[i].editorKey,
              collapsed: snapshot[i].editorKey === collapseKey || snapshot[i].collapsed,
            })),
          );
          if (collapseKey) {
            setAnnouncement('Workout changes saved. Exercise collapsed.');
            requestAnimationFrame(() => controls.current.get(collapseKey)?.focus());
          } else close();
        },
      );
      if (!response && mounted.current)
        setAnnouncement('Save not confirmed. Your edits are kept open.');
    } finally {
      if (mounted.current) setSavingKey(null);
    }
  }
  return (
    <form
      ref={form}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <fieldset className="app-fields stack" disabled={locked || savingKey !== null}>
        <div className="row between">
          <h1>{savedTemplate ? 'Edit workout' : 'New workout'}</h1>
          <button type="button" onClick={close}>
            {savedTemplate ? 'Back to workouts' : 'Cancel'}
          </button>
        </div>
        <p className="subtitle">
          Add exercises below, then enter minimum reps, maximum reps and rest for each set. For 6–8
          reps, enter 6 and 8. For exactly 8 reps, enter 8 in both fields. Each row is one set; use
          Add set to add more. Use the document icon to save your changes and collapse an exercise.
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
            Workout duration is recorded automatically from Start to Finish when you train. Pauses
            are excluded from active time. Weight is entered during training, prefilled from the
            same set in your previous workout when available. Warm-up and working sets keep their
            own weights.
          </p>
        </div>
        {items.map((e, ei) => {
          const source = exercises.find((x) => x.id === e.exercise_id);
          const exerciseName = source?.name ?? 'Exercise';
          const warmups = e.sets.filter((s) => s.type === 'warmup').length;
          return (
            <section
              className="panel stack"
              key={e.editorKey}
              aria-label={`Exercise ${ei + 1}: ${exerciseName}`}
            >
              <div className="exercise-editor-heading">
                <div className="exercise-editor-title">
                  <h2>
                    <span className="muted">{String(ei + 1).padStart(2, '0')} / </span>
                    {exerciseName}
                  </h2>
                  <EquipmentLabel equipment={source?.equipment ?? null} />
                  {e.collapsed && (
                    <p className="exercise-editor-summary">
                      {e.sets.length} {e.sets.length === 1 ? 'set' : 'sets'}
                      {warmups > 0 ? ` · ${warmups} warm-up` : ''} · Saved
                    </p>
                  )}
                </div>
                <div className="row exercise-editor-actions">
                  <button
                    type="button"
                    className="exercise-document"
                    ref={(node) => {
                      if (node) controls.current.set(e.editorKey, node);
                      else controls.current.delete(e.editorKey);
                    }}
                    aria-label={
                      e.collapsed ? `Edit ${exerciseName}` : `Save ${exerciseName} and collapse`
                    }
                    title={
                      e.collapsed
                        ? 'Edit exercise'
                        : 'Save workout changes and collapse this exercise'
                    }
                    aria-expanded={!e.collapsed}
                    aria-controls={`exercise-fields-${e.editorKey}`}
                    onClick={() =>
                      e.collapsed
                        ? setItems(
                            items.map((x) =>
                              x.editorKey === e.editorKey ? { ...x, collapsed: false } : x,
                            ),
                          )
                        : void save(e.editorKey)
                    }
                  >
                    {savingKey === e.editorKey ? (
                      <LoaderCircle size={20} aria-hidden="true" />
                    ) : e.collapsed ? (
                      <Pencil size={20} aria-hidden="true" />
                    ) : (
                      <FileCheck2 size={20} aria-hidden="true" />
                    )}
                  </button>
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
              <div
                id={`exercise-fields-${e.editorKey}`}
                hidden={e.collapsed}
                className="stack exercise-editor-details"
              >
                {!e.collapsed && (
                  <>
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
                            onChange={(ev) =>
                              setPrescription(ei, si, { min_reps: Number(ev.target.value) })
                            }
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
                            onChange={(ev) =>
                              setPrescription(ei, si, { max_reps: Number(ev.target.value) })
                            }
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
                                items.map((x, i) =>
                                  i === ei ? { ...x, sets: move(x.sets, si, -1) } : x,
                                ),
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
                          items.map((x, i) =>
                            i === ei ? { ...x, sets: [...x.sets, defaultSet()] } : x,
                          ),
                        )
                      }
                    >
                      <Plus size={16} />
                      Add set
                    </button>
                  </>
                )}
              </div>
            </section>
          );
        })}
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
                {
                  exercise_id: selection,
                  sets: [defaultSet(), defaultSet(), defaultSet()],
                  editorKey: crypto.randomUUID(),
                  collapsed: false,
                },
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
      </fieldset>
      <p className="sr-only" role="status">
        {announcement}
      </p>
    </form>
  );
}
