'use client';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Volume2, Timer, Pause, Play } from 'lucide-react';
import { useRestSound } from '../use-rest-sound';
import { enableSound, muteSound, playRestSound, stopAlarm } from '@/client/rest-sound';
import type { WorkoutDetail } from '@/domain/types';
import { restDuration, restRemaining, durationLabel } from '@/domain/timing';
export function useNow(serverNow: number) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const offset = serverNow - Date.now();
    const tick = () => setNow(Date.now() + offset);
    const interval = setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
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
  const sound = useRestSound();
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
    if (!rest || timerPaused || workout.status !== 'active' || !sound.enabled) {
      if (sound.activeKey) stopAlarm(false);
      return;
    }
    if (remaining > 0) {
      if (sound.activeKey) stopAlarm(false);
      return;
    }
    if (document.visibilityState !== 'visible') return;
    // Muted or suspended audio must not consume the completion alert.
    playRestSound(`${rest.id}:${rest.added_ms}`);
  }, [rest, remaining, workout.status, sound, timerPaused]);
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
            onClick={() => (sound.enabled && sound.ready ? muteSound() : void enableSound())}
            className="ghost"
          >
            <Volume2 size={16} />
            {sound.enabled && sound.ready ? 'Sound on' : 'Enable sound'}
          </button>
          <button
            className="primary"
            onClick={() => {
              stopAlarm();
              end();
            }}
            disabled={workout.status === 'paused'}
          >
            End rest
          </button>
        </div>
        {sound.error && (
          <p role="alert" className="error">
            {sound.error}
          </p>
        )}
      </section>
    </div>
  );
}
