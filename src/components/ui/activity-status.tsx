import { Check, Circle, Pause, Play, SkipForward, Square } from 'lucide-react';
import type { ActivityStatus, WorkoutStatus } from '@/domain/types';

type Status = ActivityStatus | WorkoutStatus;
export const activityLabels: Record<Status, string> = {
  pending: 'Not started',
  active: 'In progress',
  paused: 'Paused',
  completed: 'Completed',
  skipped: 'Skipped',
  abandoned: 'Abandoned',
};
const icons = {
  pending: Circle,
  active: Play,
  paused: Pause,
  completed: Check,
  skipped: SkipForward,
  abandoned: Square,
};

export function ActivityIcon({ status, size = 16 }: { status: Status; size?: number }) {
  const Icon = icons[status];
  return (
    <Icon size={size} aria-hidden="true" fill={status === 'active' ? 'currentColor' : 'none'} />
  );
}

export function ActivityStatusLabel({ status }: { status: Status }) {
  return (
    <span className={`activity-status ${status}`}>
      <ActivityIcon status={status} />
      {activityLabels[status]}
    </span>
  );
}
