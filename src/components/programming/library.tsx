'use client';
import { EquipmentField, EquipmentLabel } from '../ui/equipment';
import { equipmentLabel } from '@/domain/equipment';
import { useRef, useState } from 'react';
import { Plus, ArrowUpRight, Archive } from 'lucide-react';
import type { Exercise } from '@/domain/types';
import type { Send } from '../use-model';
import { ExerciseSearch } from '../ui/exercise-search';
import { CreateExerciseDialog } from './create-exercise-dialog';
export function Library({
  exercises,
  send,
  onProgress,
  onPrograms,
}: {
  exercises: Exercise[];
  send: Send;
  onProgress: (id: string) => void;
  onPrograms: () => void;
}) {
  const [query, setQuery] = useState(''),
    [editing, setEditing] = useState<Exercise | null | undefined>(undefined),
    [archiving, setArchiving] = useState<string | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [createName, setCreateName] = useState<string | null>(null);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (
      await send('exercise.save', {
        id: editing?.id,
        name: f.get('name'),
        details: f.get('details'),
        equipment: f.get('equipment'),
      })
    )
      setEditing(undefined);
  }
  return (
    <div className="stack">
      <div className="row between">
        <div>
          <h1>Exercise library</h1>
          <p className="subtitle">Save exercise names, equipment and technique notes here.</p>
        </div>
        <button className="primary" onClick={() => setEditing(null)}>
          <Plus size={18} />
          New exercise
        </button>
      </div>
      <section className="panel stack" aria-label="Exercise setup guide">
        <h2>Sets, reps and rest are set in your workouts</h2>
        <p>
          Go to Programs, open a program, then create or edit a workout. Add an exercise there to
          choose its sets, reps and rest time. The same exercise can have different settings in each
          workout.
        </p>
        <div>
          <button className="ghost" onClick={onPrograms}>
            Go to programs <ArrowUpRight size={16} />
          </button>
        </div>
      </section>
      {editing !== undefined && (
        <form className="panel stack" onSubmit={save} key={editing?.id || 'new'}>
          <div className="row between">
            <h2>{editing ? 'Edit exercise' : 'New exercise'}</h2>
            <button type="button" className="ghost" onClick={() => setEditing(undefined)}>
              Cancel
            </button>
          </div>
          <label>
            Name
            <input name="name" defaultValue={editing?.name} required maxLength={120} autoFocus />
          </label>
          <EquipmentField value={editing?.equipment} />
          <label>
            Details / technique notes
            <textarea name="details" defaultValue={editing?.details} />
          </label>
          <button className="primary">Save exercise</button>
        </form>
      )}
      <div className="exercise-search">
        <ExerciseSearch
          label="Search exercises"
          options={exercises
            .filter((e) => !e.archived_at)
            .map((e) => ({ value: e.id, label: e.name, description: equipmentLabel(e.equipment) }))}
          value=""
          searchQuery={query}
          onSearchQueryChange={setQuery}
          onValueChange={(id) => setQuery(exercises.find((e) => e.id === id)?.name ?? '')}
          onCreate={setCreateName}
          inputRef={searchInput}
        />
      </div>
      {createName !== null && (
        <CreateExerciseDialog
          initialName={createName}
          context="library"
          send={send}
          onCreated={(exercise) => setQuery(exercise.name)}
          onClose={() => setCreateName(null)}
          returnFocus={searchInput}
        />
      )}
      <div className="list">
        {exercises
          .filter(
            (e) =>
              !e.archived_at &&
              [e.name, equipmentLabel(e.equipment)].some((text) =>
                text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
              ),
          )
          .map((e) => (
            <div className="list-row" key={e.id}>
              <div className="grow">
                <h3>{e.name}</h3>
                <EquipmentLabel equipment={e.equipment} />
                <p>{e.details || 'No technique notes'}</p>
              </div>
              <div className="row">
                <button className="small ghost" onClick={() => setEditing(e)}>
                  Edit
                </button>
                <button
                  className="small ghost"
                  onClick={() => onProgress(e.id)}
                  aria-label={`Progress for ${e.name}`}
                >
                  <ArrowUpRight size={18} />
                </button>
                <button
                  className="small ghost"
                  onClick={() => setArchiving(e.id)}
                  aria-label={`Archive ${e.name}`}
                >
                  <Archive size={16} />
                </button>
              </div>
              {archiving === e.id && (
                <div className="inline-confirm">
                  <p>Archive this exercise? Existing templates and history keep it.</p>
                  <button
                    className="danger"
                    onClick={async () => {
                      if (await send('archive', { kind: 'exercise', id: e.id })) setArchiving(null);
                    }}
                  >
                    Archive
                  </button>
                  <button onClick={() => setArchiving(null)}>Keep</button>
                </div>
              )}
            </div>
          ))}
      </div>
      {!exercises.some((e) => !e.archived_at) && (
        <div className="empty">
          <h2>Build your exercise library</h2>
          <p>Add your first exercise, then use it in a workout.</p>
          <button onClick={() => setEditing(null)}>Add exercise</button>
        </div>
      )}
      {exercises.some((e) => e.archived_at) && (
        <details>
          <summary className="muted">
            Archived exercises ({exercises.filter((e) => e.archived_at).length})
          </summary>
          {exercises
            .filter((e) => e.archived_at)
            .map((e) => (
              <p key={e.id}>{e.name} · preserved in history</p>
            ))}
        </details>
      )}
    </div>
  );
}
