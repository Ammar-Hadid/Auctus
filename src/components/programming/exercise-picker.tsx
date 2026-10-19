'use client';
import { equipmentLabel } from '@/domain/equipment';
import { useRef, useState } from 'react';
import type { Exercise } from '@/domain/types';
import type { Send } from '../use-model';
import { ExerciseSearch } from '../ui/exercise-search';
import { CreateExerciseDialog } from './create-exercise-dialog';

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
  const trigger = useRef<HTMLInputElement>(null);
  const [draftName, setDraftName] = useState('');
  return (
    <>
      <div className="exercise-search">
        <ExerciseSearch
          label={label}
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          options={exercises
            .filter((e) => !e.archived_at)
            .map((e) => ({ value: e.id, label: e.name, description: equipmentLabel(e.equipment) }))}
          inputRef={trigger}
          onCreate={(query) => {
            setDraftName(query);
            setOpen(true);
          }}
        />
      </div>
      {open && (
        <CreateExerciseDialog
          initialName={draftName}
          send={send}
          onCreated={(exercise) => onValueChange(exercise.id)}
          onClose={() => setOpen(false)}
          returnFocus={trigger}
        />
      )}
    </>
  );
}
