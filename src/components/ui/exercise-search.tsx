'use client';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import * as Popper from '@radix-ui/react-popper';
import { Check, Plus, Search } from 'lucide-react';

export function ExerciseSearch({
  label,
  options,
  value,
  onValueChange,
  onCreate,
  inputRef,
  disabled,
  searchQuery,
  onSearchQueryChange,
}: {
  label: string;
  options: { value: string; label: string; description?: string }[];
  value: string;
  onValueChange: (value: string) => void;
  onCreate: (query: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  disabled?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const menu = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const search = searchQuery ?? query ?? '';
  const trimmed = search.trim();
  const normalized = trimmed.toLocaleLowerCase();
  const matches = options.filter((option) =>
    [option.label, option.description ?? ''].some((text) =>
      text.toLocaleLowerCase().includes(normalized),
    ),
  );
  const canCreate =
    !normalized ||
    !options.some((option) => option.label.trim().toLocaleLowerCase() === normalized);
  const optionCount = matches.length + (canCreate ? 1 : 0);
  const activeIndex = active < optionCount ? active : -1;
  function close() {
    setOpen(false);
    setActive(-1);
  }
  function choose(index: number) {
    close();
    if (canCreate && index === matches.length) onCreate(trimmed);
    else if (matches[index]) {
      onValueChange(matches[index].value);
      setQuery(null);
    }
  }
  useEffect(() => {
    if (open && activeIndex >= 0)
      menu.current
        ?.querySelectorAll('[role="option"]')
        [activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !menu.current?.contains(event.target) &&
        event.target !== inputRef.current
      ) {
        setOpen(false);
        setActive(-1);
      }
    }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open, inputRef]);
  return (
    <Popper.Root>
      <label htmlFor={id}>{label}</label>
      <Popper.Anchor asChild>
        <div className="exercise-search-field">
          <Search size={17} aria-hidden="true" />
          <input
            id={id}
            ref={inputRef}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={open ? `${id}-list` : undefined}
            aria-activedescendant={
              open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined
            }
            autoComplete="off"
            placeholder="Search exercises…"
            value={searchQuery ?? query ?? selected?.label ?? ''}
            disabled={disabled}
            onFocus={() => setActive(-1)}
            onClick={() => setOpen(true)}
            onBlur={() => {
              close();
              setQuery(null);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              onSearchQueryChange?.(event.target.value);
              if (value) onValueChange('');
              setOpen(true);
              setActive(-1);
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                setOpen(true);
                setActive(
                  event.key === 'ArrowDown'
                    ? (open ? activeIndex + 1 : 0) % optionCount
                    : activeIndex <= 0
                      ? optionCount - 1
                      : activeIndex - 1,
                );
              } else if (event.key === 'Enter') {
                event.preventDefault(); // Searching must never submit the workout form.
                if (open && activeIndex >= 0) choose(activeIndex);
              } else if (event.key === 'Escape' && open) {
                event.preventDefault();
                event.stopPropagation();
                close();
              } else if (event.key === 'Tab') close();
            }}
          />
        </div>
      </Popper.Anchor>
      {open &&
        !disabled &&
        createPortal(
          <Popper.Content
            className="select-menu exercise-search-menu"
            sideOffset={6}
            collisionPadding={12}
            align="start"
            ref={menu}
            onMouseDown={(event) => event.preventDefault()}
          >
            <div id={`${id}-list`} role="listbox" aria-label={label}>
              <div className="exercise-search-results select-viewport">
                {matches.length === 0 && <div className="select-empty">No exercises found.</div>}
                {matches.map((option, index) => (
                  <div
                    key={option.value}
                    id={`${id}-option-${index}`}
                    role="option"
                    aria-label={option.label}
                    aria-describedby={option.description ? `${id}-description-${index}` : undefined}
                    aria-selected={value === option.value}
                    data-state={value === option.value ? 'checked' : undefined}
                    data-highlighted={activeIndex === index ? '' : undefined}
                    className="select-option"
                    onPointerMove={() => setActive(index)}
                    onClick={() => choose(index)}
                  >
                    <span>
                      {option.label}
                      {option.description && (
                        <small
                          id={`${id}-description-${index}`}
                          className="exercise-option-equipment"
                        >
                          {option.description}
                        </small>
                      )}
                    </span>
                    {value === option.value && (
                      <span className="select-check">
                        <Check size={16} />
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {canCreate && (
                <div className="exercise-search-create">
                  <div
                    id={`${id}-option-${matches.length}`}
                    role="option"
                    aria-selected={false}
                    data-highlighted={activeIndex === matches.length ? '' : undefined}
                    className="select-option select-create"
                    onPointerMove={() => setActive(matches.length)}
                    onClick={() => choose(matches.length)}
                  >
                    <Plus size={17} aria-hidden="true" />
                    <span>{trimmed ? `Add “${trimmed}”` : 'Create exercise'}</span>
                  </div>
                </div>
              )}
            </div>
            <p className="sr-only" role="status">
              {matches.length} exercises found.
            </p>
          </Popper.Content>,
          document.body,
        )}
    </Popper.Root>
  );
}
