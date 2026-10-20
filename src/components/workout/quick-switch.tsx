'use client';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeftRight, X } from 'lucide-react';
import type { Exercise, ExerciseSession } from '@/domain/types';
import { equipmentLabel } from '@/domain/equipment';
import { EquipmentLabel } from '../ui/equipment';
import { NotificationHost } from '../ui/notification';

export function QuickSwitch({
  exercise,
  library,
  locked,
  busy,
  onSwitch,
}: {
  exercise: ExerciseSession;
  library: Exercise[];
  locked: boolean;
  busy: boolean;
  onSwitch: (id: string, confirmed: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const available = library.filter((item) => !item.archived_at && item.id !== exercise.exercise_id);
  const matches = available.filter((item) =>
    `${item.name} ${equipmentLabel(item.equipment)}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  const started =
    exercise.sets.some((set) => set.status !== 'pending') ||
    ['completed', 'skipped'].includes(exercise.status);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        setQuery('');
      }}
    >
      <Dialog.Trigger asChild>
        <button
          className="ghost quick-switch-trigger"
          aria-label="Quick Switch"
          title="Quick Switch"
          disabled={busy}
        >
          <ArrowLeftRight size={20} aria-hidden="true" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="exercise-dialog-overlay" />
        <Dialog.Content className="session-dialog-layer">
          <NotificationHost />
          <div className="session-dialog">
            <div className="row between">
              <Dialog.Title>Quick Switch</Dialog.Title>
              <Dialog.Close asChild>
                <button className="ghost" aria-label="Close Quick Switch">
                  <X size={18} />
                </button>
              </Dialog.Close>
            </div>
            <Dialog.Description>
              Replace {exercise.name} for this workout. Sets, rep ranges, and rest times stay the
              same.
            </Dialog.Description>
            {started ? (
              <p>Quick Switch is available before the first set starts.</p>
            ) : locked ? (
              <p>Resume your workout to switch exercises.</p>
            ) : (
              <div className="stack">
                <label>
                  Search exercises
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Name or equipment…"
                  />
                </label>
                <div className="stack" aria-label="Exercise library" aria-busy={busy}>
                  {matches.map((item) => (
                    <button
                      key={item.id}
                      className="ghost quick-switch-option"
                      disabled={busy}
                      onClick={() => onSwitch(item.id, () => setOpen(false))}
                    >
                      <span>{item.name}</span>
                      <EquipmentLabel equipment={item.equipment} />
                    </button>
                  ))}
                  {matches.length === 0 && (
                    <p role="status">
                      {available.length
                        ? 'No exercises found.'
                        : 'No other exercises in your library yet.'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
