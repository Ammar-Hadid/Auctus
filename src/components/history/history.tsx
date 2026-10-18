'use client';
import { AuctusSelect } from '../ui/select';
import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, Clock, Check, Edit3 } from 'lucide-react';
import type { WorkoutDetail } from '@/domain/types';
import type { Send } from '../use-model';
import { activeDuration, durationLabel, restDuration } from '@/domain/timing';
import { trainingWeek } from '@/domain/calendar';
import { EditRecord } from './edit-record';
import { repRangeLabel } from '@/domain/reps';
export function HistoryView({
  workouts,
  send,
  onProgress,
}: {
  workouts: WorkoutDetail[];
  send: Send;
  onProgress: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null),
    [filter, setFilter] = useState('all'),
    [editing, setEditing] = useState<{ kind: 'set' | 'rest' | 'workout'; id?: string } | null>(
      null,
    );
  const w = workouts.find((w) => w.id === selected);
  const week = (w: WorkoutDetail) => w.week_id ?? trainingWeek(w.started_at).id;
  const weeks = [...new Set(workouts.map(week))];
  const date = (time: number) =>
    new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/Amsterdam',
    }).format(time);
  if (w)
    return (
      <div className="stack">
        <button
          className="back"
          onClick={() => {
            setSelected(null);
            setEditing(null);
          }}
        >
          <ArrowLeft size={16} />
          All workouts
        </button>
        <div className="row between">
          <div>
            <span className="status">
              {w.status} · {date(w.started_at)}
            </span>
            <h1>{w.name}</h1>
          </div>
          <button onClick={() => setEditing({ kind: 'workout' })}>
            <Edit3 size={15} />
            Edit workout
          </button>
        </div>
        <p>
          <Clock size={14} className="inline-icon" />{' '}
          {durationLabel(activeDuration(w, w.ended_at!))} active ·{' '}
          {durationLabel(w.ended_at! - w.started_at)} elapsed · Training week {week(w)}
        </p>
        {w.notes && <p className="notice">{w.notes}</p>}
        {editing?.kind === 'workout' && (
          <EditRecord key={w.version} workout={w} send={send} close={() => setEditing(null)} />
        )}
        {w.exercises.map((e, i) => (
          <section className="panel stack" key={e.id}>
            <div className="row between">
              <div>
                <span className="status">
                  {String(i + 1).padStart(2, '0')} · {e.status}
                  {e.removed_at ? ' · removed from plan' : ''}
                </span>
                <h2>{e.name}</h2>
              </div>
              <button className="ghost" onClick={() => onProgress(e.exercise_id)}>
                Progress
                <ArrowUpRight size={15} />
              </button>
            </div>
            <div className="history-sets">
              {e.sets.map((s, j) => (
                <div className="history-set" key={s.id}>
                  <div className="row between">
                    <div>
                      <strong>
                        {j + 1}. {s.type === 'warmup' ? 'Warm-up' : s.type}
                      </strong>
                      <span className="status">
                        {' '}
                        · {s.status}
                        {s.removed_at ? ' · removed' : ''}
                      </span>
                      <p>
                        Planned {repRangeLabel(s.min_reps, s.max_reps)} reps · rest{' '}
                        {s.rest_ms / 1000}s
                      </p>
                    </div>
                    <div className="row">
                      <strong className="number">
                        {s.status === 'completed'
                          ? `${(s.actual_grams ?? 0) / 1000} kg × ${s.actual_reps}`
                          : '—'}
                      </strong>
                      <button
                        className="small ghost"
                        aria-label={`Edit set ${j + 1}`}
                        onClick={() => setEditing({ kind: 'set', id: s.id })}
                      >
                        <Edit3 size={15} />
                      </button>
                    </div>
                  </div>
                  {s.notes && <p>{s.notes}</p>}
                  {s.started_at !== null && (
                    <p className="timestamp">
                      {date(s.started_at)} → {s.ended_at !== null ? date(s.ended_at) : 'Unfinished'}
                    </p>
                  )}
                  {editing?.kind === 'set' && editing.id === s.id && (
                    <EditRecord
                      key={w.version}
                      workout={w}
                      set={s}
                      send={send}
                      close={() => setEditing(null)}
                    />
                  )}
                  {w.rests
                    .filter((r) => r.set_id === s.id)
                    .map((r) => (
                      <div key={r.id} className="rest-record">
                        <div className="row between">
                          <p>
                            Rest · {durationLabel(restDuration(r, w.pauses, r.ended_at!))} actual /{' '}
                            {durationLabel(r.planned_ms)} planned
                            <br />
                            <span className="timestamp">
                              {durationLabel(r.ended_at! - r.started_at)} wall time ·{' '}
                              {r.reason?.replaceAll('_', ' ')}
                            </span>
                          </p>
                          <button
                            className="small ghost"
                            aria-label={`Edit rest after set ${j + 1}`}
                            onClick={() => setEditing({ kind: 'rest', id: r.id })}
                          >
                            <Edit3 size={14} />
                          </button>
                        </div>
                        {editing?.kind === 'rest' && editing.id === r.id && (
                          <EditRecord
                            key={w.version}
                            workout={w}
                            rest={r}
                            send={send}
                            close={() => setEditing(null)}
                          />
                        )}
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  return (
    <div className="stack">
      <div className="row between">
        <div>
          <h1>Your training, recorded.</h1>
          <p className="subtitle">Every session. Every step forward.</p>
        </div>
        <label>
          Training week
          <AuctusSelect
            label="Training week"
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: 'all', label: 'All weeks' },
              ...weeks.map((w) => ({ value: w, label: `Week of ${w}` })),
            ]}
          />
        </label>
      </div>
      {!workouts.length ? (
        <div className="empty">
          <h2>Your story is just beginning.</h2>
          <p>Completed and abandoned workouts appear here, with every recorded set preserved.</p>
        </div>
      ) : (
        <div className="list">
          {workouts
            .filter((w) => filter === 'all' || week(w) === filter)
            .map((w) => (
              <div className="list-row" key={w.id}>
                <div className="history-mark">
                  {w.status === 'completed' ? <Check size={22} /> : <Clock size={22} />}
                </div>
                <div className="grow">
                  <span className="status">
                    {date(w.started_at)} · {w.status}
                  </span>
                  <h2>{w.name}</h2>
                  <p>
                    {
                      w.exercises.flatMap((e) => e.sets).filter((s) => s.status === 'completed')
                        .length
                    }{' '}
                    completed sets · {durationLabel(activeDuration(w, w.ended_at!))} active
                  </p>
                </div>
                <button onClick={() => setSelected(w.id)}>
                  View workout
                  <ArrowUpRight size={15} />
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
