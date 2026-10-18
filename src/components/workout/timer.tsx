'use client';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Volume2, Timer, Pause, Play } from 'lucide-react';
import type { WorkoutDetail } from '@/domain/types';
import { restDuration, restRemaining, durationLabel } from '@/domain/timing';
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
  act,
}: {
  workout: WorkoutDetail;
  now: number;
  end: () => void;
  act: (action: string, data: Record<string, unknown>) => unknown;
}) {
  const rest = workout.rests.find((r) => r.ended_at === null);
  const [enabled, setEnabled] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const alerted = useRef<string | null>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const [position, setPosition] = useState({ left: 12, width: 0 });
  const restId = rest?.id;
  useLayoutEffect(() => {
    if (!restId || !anchor.current || !panel.current) return;
    const main = anchor.current.closest('main');
    function measure() {
      const box = anchor.current!.getBoundingClientRect();
      const height = panel.current!.getBoundingClientRect().height;
      main?.style.setProperty('--rest-panel-height', `${height}px`);
      setPosition((previous) =>
        previous.left === box.left && previous.width === box.width
          ? previous
          : { left: box.left, width: box.width },
      );
    }
    const observer = new ResizeObserver(measure);
    observer.observe(anchor.current);
    observer.observe(panel.current);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer.disconnect();
      main?.style.removeProperty('--rest-panel-height');
      window.removeEventListener('resize', measure);
    };
  }, [restId]);
  const elapsed = rest ? restDuration(rest, workout.pauses, now) : 0;
  const remaining = rest ? restRemaining(rest, workout.pauses, now) : 0;
  const timerPaused = rest?.timer_paused_at != null;
  useEffect(() => {
    if (remaining > 0) alerted.current = null;
    if (
      !rest ||
      remaining > 0 ||
      timerPaused ||
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
  }, [rest, remaining, workout.status, enabled, timerPaused]);
  if (!rest) return null;
  return (
    <div ref={anchor}>
      <section
        ref={panel}
        style={{ left: position.left, width: position.width || undefined }}
        className={'rest-panel ' + (remaining <= 0 ? 'overtime' : '')}
        aria-label="Rest timer"
      >
        <div>
          <span className="eyeline">
            <Timer size={13} />{' '}
            {workout.status === 'paused' || timerPaused
              ? 'Rest paused'
              : remaining > 0
                ? 'Recover. Breathe.'
                : 'Rest overtime'}
          </span>
          <div className="rest-clock number" role="timer" aria-label="Rest remaining">
            {remaining < 0 ? '+' : ''}
            {durationLabel(Math.abs(remaining))}
          </div>
          <p>
            Planned {durationLabel(rest.planned_ms)}
            {rest.added_ms > 0 && ` + ${durationLabel(rest.added_ms)}`} · Actual{' '}
            {durationLabel(elapsed)}
          </p>
        </div>
        <div className="rest-controls">
          <button
            aria-label={timerPaused ? 'Resume rest timer' : 'Pause rest timer'}
            disabled={workout.status === 'paused'}
            onClick={() => act(timerPaused ? 'rest.resume' : 'rest.pause', { id: rest.id })}
          >
            {timerPaused ? <Play size={16} /> : <Pause size={16} />}
            {timerPaused ? 'Resume' : 'Pause'}
          </button>
          <button
            disabled={workout.status === 'paused'}
            onClick={() => act('rest.extend', { id: rest.id, ms: 5000 })}
          >
            +5s
          </button>
          <button
            disabled={workout.status === 'paused'}
            onClick={() => act('rest.extend', { id: rest.id, ms: 15000 })}
          >
            +15s
          </button>
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
    </div>
  );
}
