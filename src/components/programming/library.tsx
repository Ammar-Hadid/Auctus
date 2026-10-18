'use client';
import { useState } from 'react';
import { Plus, Search, ArrowUpRight, Archive } from 'lucide-react';
import type { Exercise } from '@/domain/types';
import type { Send } from '../use-model';
export function Library({
  exercises,
  send,
  onProgress,
}: {
  exercises: Exercise[];
  send: Send;
  onProgress: (id: string) => void;
}) {
  const [query, setQuery] = useState(''),
    [editing, setEditing] = useState<Exercise | null | undefined>(undefined),
    [archiving, setArchiving] = useState<string | null>(null);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (
      await send('exercise.save', {
        id: editing?.id,
        name: f.get('name'),
        details: f.get('details'),
      })
    )
      setEditing(undefined);
  }
  return (
    <div className="stack">
      <div className="row between">
        <div>
          <h1>Exercise library</h1>
          <p className="subtitle">The movements behind your progress.</p>
        </div>
        <button className="primary" onClick={() => setEditing(null)}>
          <Plus size={18} />
          New exercise
        </button>
      </div>
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
          <label>
            Details / technique notes
            <textarea name="details" defaultValue={editing?.details} />
          </label>
          <button className="primary">Save exercise</button>
        </form>
      )}
      <label className="search">
        <Search size={18} />
        <input
          aria-label="Search exercises"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a movement…"
        />
      </label>
      <div className="list">
        {exercises
          .filter((e) => !e.archived_at && e.name.toLowerCase().includes(query.toLowerCase()))
          .map((e) => (
            <div className="list-row" key={e.id}>
              <div className="grow">
                <h3>{e.name}</h3>
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
          <h2>Build your movement library</h2>
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
