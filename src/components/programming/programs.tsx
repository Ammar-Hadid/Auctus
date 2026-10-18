'use client';
import { useState } from 'react';
import { Plus, ArrowLeft, ArrowUpRight, Check } from 'lucide-react';
import type { State, Program, Template } from '@/domain/types';
import type { Send } from '../use-model';
import { TemplateEditor } from './template-editor';
export function Programs({ state, send, locked }: { state: State; send: Send; locked: boolean }) {
  const [selected, setSelected] = useState<string | null>(null),
    [edit, setEdit] = useState<Program | null | undefined>(undefined),
    [template, setTemplate] = useState<Template | null | undefined>(undefined),
    [archive, setArchive] = useState<{ kind: string; id: string } | null>(null);
  const program = state.programs.find((p) => p.id === selected);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (await send('program.save', { id: edit?.id, name: f.get('name'), notes: f.get('notes') }))
      setEdit(undefined);
  }
  if (template !== undefined && program)
    return (
      <TemplateEditor
        template={template}
        programId={program.id}
        exercises={state.exercises}
        send={send}
        locked={locked}
        close={() => setTemplate(undefined)}
      />
    );
  return (
    <div className="stack">
      {program && (
        <button className="back" onClick={() => setSelected(null)}>
          <ArrowLeft size={16} />
          All programs
        </button>
      )}
      <div className="row between">
        <div>
          <h1>{program?.name ?? 'Your programs'}</h1>
          <p className="subtitle">
            {program?.notes || 'Structure your training. Make it your own.'}
          </p>
        </div>
        <button className="primary" onClick={() => (program ? setTemplate(null) : setEdit(null))}>
          <Plus size={18} />
          {program ? 'New workout' : 'New program'}
        </button>
      </div>
      {edit !== undefined && (
        <form className="panel stack" onSubmit={save} key={edit?.id || 'new'}>
          <h2>{edit ? 'Edit program' : 'New program'}</h2>
          <label>
            Name
            <input name="name" required maxLength={120} defaultValue={edit?.name} />
          </label>
          <label>
            Notes
            <textarea name="notes" defaultValue={edit?.notes} />
          </label>
          <div className="row">
            <button className="primary">Save program</button>
            <button type="button" onClick={() => setEdit(undefined)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {program ? (
        <>
          <div className="row">
            <button onClick={() => setEdit(program)}>Edit program</button>
            <button
              onClick={() => send('program.select', { id: program.id })}
              className={state.selectedProgramId === program.id ? 'ghost' : 'primary'}
            >
              {state.selectedProgramId === program.id ? (
                <>
                  <Check size={16} />
                  Apply to this week
                </>
              ) : (
                'Use this program'
              )}
            </button>
            <button
              className="danger ghost"
              onClick={() => setArchive({ kind: 'program', id: program.id })}
            >
              Archive program
            </button>
          </div>
          <p>
            Apply after adding or removing workouts. Started workouts and completed assignments are
            preserved.
          </p>
          <div className="list">
            {state.templates
              .filter((t) => t.program_id === program.id && !t.archived_at)
              .map((t, i) => (
                <div className="list-row" key={t.id}>
                  <span className="ordinal">{String(i + 1).padStart(2, '0')}</span>
                  <div className="grow">
                    <h2>{t.name}</h2>
                    <p>
                      {t.exercises.length} exercises ·{' '}
                      {t.exercises.reduce((n, e) => n + e.sets.length, 0)} sets
                    </p>
                  </div>
                  <button onClick={() => setTemplate(t)}>
                    Edit workout
                    <ArrowUpRight size={16} />
                  </button>
                  <button
                    className="ghost danger"
                    onClick={() => setArchive({ kind: 'template', id: t.id })}
                  >
                    Archive
                  </button>
                </div>
              ))}
          </div>
        </>
      ) : (
        <div className="list">
          {state.programs
            .filter((p) => !p.archived_at)
            .map((p) => (
              <div className="list-row" key={p.id}>
                <div className="grow">
                  <h2>{p.name}</h2>
                  <p>
                    {p.notes ||
                      `${state.templates.filter((t) => t.program_id === p.id && !t.archived_at).length} workouts`}
                  </p>
                  {state.selectedProgramId === p.id && (
                    <span className="status">Current program</span>
                  )}
                </div>
                <button onClick={() => setSelected(p.id)}>
                  Open program
                  <ArrowUpRight size={16} />
                </button>
              </div>
            ))}
        </div>
      )}
      {archive && (
        <div className="inline-confirm">
          <p>Archive this {archive.kind}? Historical records are preserved.</p>
          <button
            className="danger"
            onClick={async () => {
              if (await send('archive', archive)) {
                setArchive(null);
                if (archive.kind === 'program') setSelected(null);
              }
            }}
          >
            Confirm archive
          </button>
          <button onClick={() => setArchive(null)}>Cancel</button>
        </div>
      )}
      {!state.programs.some((p) => !p.archived_at) && (
        <div className="empty">
          <h2>Your next chapter starts here.</h2>
          <p>Create a program and add the workouts you want to repeat each week.</p>
          <button onClick={() => setEdit(null)}>Create a program</button>
        </div>
      )}
    </div>
  );
}
