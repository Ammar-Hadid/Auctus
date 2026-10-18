'use client';
import { useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Plus, X } from 'lucide-react';
import type { Exercise } from '@/domain/types';
import type { Send } from '../use-model';
import { AuctusSelect } from '../ui/select';

export function ExercisePicker({
  exercises,
  value,
  onValueChange,
  send,
  label = 'Add exercise',
  disabled,
}: {
  exercises: Exercise[];
  value: string;
  onValueChange: (id: string) => void;
  send: Send;
  label?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const savingLock = useRef(false);
  const nameInput = useRef<HTMLInputElement>(null);
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation(); // The dialog is portalled out of the workout template's form.
    if (savingLock.current) return;
    savingLock.current = true;
    setSaving(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const saved = await send('exercise.save', {
        name: form.get('exercise-name'),
        details: form.get('exercise-details'),
      });
      if (
        saved &&
        saved.result &&
        typeof saved.result === 'object' &&
        'id' in saved.result &&
        typeof saved.result.id === 'string'
      ) {
        onValueChange(saved.result.id);
        setOpen(false);
      } else {
        setError(
          'Creation could not be confirmed. Your details are kept here. Close this dialog to check the page error or retry an unconfirmed save.',
        );
      }
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  }
  return (
    <>
      <label>
        {label}
        <AuctusSelect
          label={label}
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          options={exercises
            .filter((e) => !e.archived_at)
            .map((e) => ({ value: e.id, label: e.name }))}
          placeholder="Choose an exercise"
          triggerRef={trigger}
          creating={open}
          onCreate={() => {
            setError('');
            setOpen(true);
          }}
        />
      </label>
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          if (!saving) setOpen(next);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="exercise-dialog-overlay" />
          <Dialog.Content
            className="exercise-dialog stack"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              nameInput.current?.focus();
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              trigger.current?.focus();
            }}
            onPointerDownOutside={(event) => event.preventDefault()}
            onEscapeKeyDown={(event) => {
              if (saving) event.preventDefault();
            }}
          >
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
              Save the exercise name and technique notes here. Then add it to this workout to set
              its sets, reps and rest. Your workout edits are kept.
            </Dialog.Description>
            <form className="stack" onSubmit={create}>
              <label>
                Exercise name
                <input
                  ref={nameInput}
                  name="exercise-name"
                  placeholder="e.g. Incline dumbbell press"
                  required
                  maxLength={120}
                  disabled={saving}
                />
              </label>
              <label>
                Details / technique notes
                <textarea
                  name="exercise-details"
                  maxLength={5000}
                  placeholder="Equipment, setup or cues (optional)"
                  disabled={saving}
                />
              </label>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <div className="row dialog-actions">
                <Dialog.Close asChild>
                  <button type="button" disabled={saving}>
                    Cancel
                  </button>
                </Dialog.Close>
                <button className="primary" disabled={saving}>
                  <Plus size={17} />
                  {saving ? 'Creating…' : 'Create and select'}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
