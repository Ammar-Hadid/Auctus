'use client';
import type { ReactNode } from 'react';
import type { WorkoutDetail } from '@/domain/types';
import type { Send } from './use-model';
import { useBottomLayout } from './use-bottom-layout';
import { RestTimer, useNow } from './workout/timer';

export function BottomDock({
  workout,
  serverNow,
  send,
  busy,
  children,
}: {
  workout: WorkoutDetail | null;
  serverNow: number;
  send: Send;
  busy: boolean;
  children: ReactNode;
}) {
  const dock = useBottomLayout();
  return (
    <div ref={dock} className="bottom-dock">
      <div className="bottom-dock-inner">
        {workout && (
          <fieldset disabled={busy} className="dock-fields" aria-busy={busy}>
            <WorkoutTimer workout={workout} serverNow={serverNow} send={send} />
          </fieldset>
        )}
        {children}
      </div>
    </div>
  );
}
function WorkoutTimer({
  workout,
  serverNow,
  send,
}: {
  workout: WorkoutDetail;
  serverNow: number;
  send: Send;
}) {
  const now = useNow(serverNow);
  const act = (action: string, extra: Record<string, unknown> = {}) =>
    send('session.action', { workout_id: workout.id, version: workout.version, action, ...extra });
  return <RestTimer workout={workout} now={now} end={() => act('rest.end')} act={act} />;
}
