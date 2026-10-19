'use client';
import { EquipmentField } from '../ui/equipment';
import { NotificationHost } from '../ui/notification';
import { useRef, useState, type RefObject } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Plus, X } from 'lucide-react';
import type { Exercise } from '@/domain/types';
import type { Send } from '../use-model';

export function CreateExerciseDialog({
  initialName,
  send,
  onCreated,
  onClose,
  returnFocus,
  context = 'workout',
}: {
  initialName: string;
  send: Send;
  onCreated: (exercise: Exercise) => void;
  onClose: () => void;
  returnFocus: RefObject<HTMLInputElement | null>;
  context?: 'workout' | 'library';
}) {
  const [saving, setSaving] = useState(false);
  const savingLock = useRef(false);
  const nameInput = useRef<HTMLInputElement>(null);
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation(); // The dialog is portalled out of the workout template's form.
    if (savingLock.current) return;
    savingLock.current = true;
    setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
      const saved = await send('exercise.save', {
        name: form.get('exercise-name'),
        details: form.get('exercise-details'),
        equipment: form.get('equipment'),
      });
      if (
        saved &&
        saved.result &&
        typeof saved.result === 'object' &&
        'id' in saved.result &&
        typeof saved.result.id === 'string'
      ) {
        onCreated(saved.result as Exercise);
        onClose();
      }
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  }
  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!saving && !next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="exercise-dialog-overlay" />
        <Dialog.Content
          className="exercise-dialog-layer"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            nameInput.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus();
          }}
          onPointerDownOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            if (saving) event.preventDefault();
          }}
        >
          <NotificationHost />
          <div className="exercise-dialog stack">
            <div className="row between">
              <div>
                <span className="eyeline accent">Exercise library</span>
                <Dialog.Title>Create exercise</Dialog.Title>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="small ghost"
                  aria-label="Close create exercise"
                  disabled={saving}
                >
                  <X size={18} />
                </button>
              </Dialog.Close>
            </div>
            <Dialog.Description className="muted">
              {context === 'library'
                ? 'Save the exercise name, equipment and technique notes. You can add it to a workout later to set its sets, reps and rest.'
                : 'Save the exercise name, equipment and technique notes here. Then add it to this workout to set its sets, reps and rest. Your workout edits are kept.'}
            </Dialog.Description>
            <form className="stack" onSubmit={create}>
              <label>
                Exercise name
                <input
                  ref={nameInput}
                  name="exercise-name"
                  defaultValue={initialName}
                  placeholder="e.g. Incline dumbbell press"
                  required
                  maxLength={120}
                  disabled={saving}
                />
              </label>
              <EquipmentField disabled={saving} />
              <label>
                Details / technique notes
                <textarea
                  name="exercise-details"
                  maxLength={5000}
                  placeholder="Setup or technique cues (optional)"
                  disabled={saving}
                />
              </label>
              <div className="row dialog-actions">
                <Dialog.Close asChild>
                  <button type="button" disabled={saving}>
                    Cancel
                  </button>
                </Dialog.Close>
                <button className="primary" disabled={saving}>
                  <Plus size={17} />
                  {saving
                    ? 'Creating…'
                    : context === 'library'
                      ? 'Save exercise'
                      : 'Create and select'}
                </button>
              </div>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
