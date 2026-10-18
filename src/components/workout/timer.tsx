'use client';
import { useState, useEffect, useRef } from 'react';
import { Volume2, Timer } from 'lucide-react';
import type { WorkoutDetail } from '@/domain/types';
import { restDuration, durationLabel } from '@/domain/timing';
export function useNow(serverNow: number) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const start = performance.now();
    const interval = setInterval(() => setNow(serverNow + performance.now() - start), 250);
    return () => clearInterval(interval);
  }, [serverNow]);
  return now;
}
export function RestTimer({
  workout,
  now,
  end,
}: {
  workout: WorkoutDetail;
  now: number;
  end: () => void;
}) {
  const rest = workout.rests.find((r) => r.ended_at === null);
  const [enabled, setEnabled] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const alerted = useRef<string | null>(null);
  const elapsed = rest ? restDuration(rest, workout.pauses, now) : 0;
  const remaining = rest ? rest.planned_ms - elapsed : 0;
  useEffect(() => {
    if (
      !rest ||
      remaining > 0 ||
      workout.status !== 'active' ||
      document.visibilityState !== 'visible' ||
      alerted.current === rest.id
    )
      return;
    alerted.current = rest.id;
    if (enabled) {
      const context = audio.current;
      if (context?.state === 'running') {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.frequency.value = 660;
        gain.gain.setValueAtTime(0.12, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.4);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.4);
      }
      navigator.vibrate?.([150, 80, 150]);
    }
  }, [rest, remaining, workout.status, enabled]);
  if (!rest) return null;
  return (
    <section className={'rest-panel ' + (remaining <= 0 ? 'overtime' : '')} aria-label="Rest timer">
      <div>
        <span className="eyeline">
          <Timer size={13} />{' '}
          {workout.status === 'paused'
            ? 'Rest paused'
            : remaining > 0
              ? 'Recover. Breathe.'
              : 'Rest overtime'}
        </span>
        <div className="rest-clock number">
          {remaining < 0 ? '+' : ''}
          {durationLabel(Math.abs(remaining))}
        </div>
        <p>
          Planned {durationLabel(rest.planned_ms)} · Actual {durationLabel(elapsed)}
        </p>
      </div>
      <div className="stack">
        <button
          onClick={async () => {
            audio.current ??= new AudioContext();
            await audio.current.resume();
            setEnabled(!enabled);
          }}
          className="ghost"
        >
          <Volume2 size={16} />
          {enabled ? 'Sound on' : 'Enable sound'}
        </button>
        <button onClick={end} disabled={workout.status === 'paused'}>
          End rest
        </button>
      </div>
    </section>
  );
}
