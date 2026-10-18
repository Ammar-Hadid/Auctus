'use client';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import type { Ref } from 'react';
export const setTypeOptions = [
  { value: 'normal', label: 'Normal' },
  { value: 'warmup', label: 'Warm-up' },
  { value: 'dropset', label: 'Dropset' },
  { value: 'failure', label: 'Failure' },
];
const CREATE = '__auctus_create__';
export function AuctusSelect({
  label,
  options,
  value,
  defaultValue,
  onValueChange,
  name,
  id,
  disabled,
  placeholder = 'Choose an option',
  className = '',
  onCreate,
  triggerRef,
  creating = false,
}: {
  label: string;
  options: { value: string; label: string }[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  onCreate?: () => void;
  triggerRef?: Ref<HTMLButtonElement>;
  creating?: boolean;
}) {
  return (
    <Select.Root
      value={value}
      defaultValue={defaultValue}
      name={name}
      disabled={disabled}
      onValueChange={(next) => (next === CREATE ? onCreate?.() : onValueChange?.(next))}
    >
      <Select.Trigger
        ref={triggerRef}
        id={id}
        aria-label={label}
        className={`auctus-select ${className}`}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="select-chevron">
          <ChevronDown size={16} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          aria-label={label}
          className="select-menu"
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          onCloseAutoFocus={(event) => {
            if (creating) event.preventDefault();
          }}
        >
          <Select.ScrollUpButton className="select-scroll">
            <ChevronUp size={16} />
          </Select.ScrollUpButton>
          <Select.Viewport className="select-viewport">
            {options.length === 0 && (
              <div className="select-empty">
                No exercises yet. Create your first movement below.
              </div>
            )}
            {options.map((option) => (
              <Select.Item key={option.value} value={option.value} className="select-option">
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className="select-check">
                  <Check size={16} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
            {onCreate && (
              <>
                {options.length > 0 && <Select.Separator className="select-divider" />}
                <Select.Item
                  value={CREATE}
                  className="select-option select-create"
                  textValue="Create exercise"
                >
                  <Plus size={17} />
                  <Select.ItemText>Create exercise</Select.ItemText>
                </Select.Item>
              </>
            )}
          </Select.Viewport>
          <Select.ScrollDownButton className="select-scroll">
            <ChevronDown size={16} />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
