import type { Assignment } from './types';
export function weeklyGoal(assignments: Assignment[]) {
  const available = assignments.filter((a) => !a.withdrawn_at);
  const mandatory = available.filter((a) => a.mandatory);
  const mandatoryCompleted = mandatory.filter((a) => a.completed > 0).length;
  return {
    total: available.length,
    completed: available.filter((a) => a.completed > 0).length,
    mandatoryTotal: mandatory.length,
    mandatoryCompleted,
    weekDone: mandatory.length > 0 && mandatoryCompleted === mandatory.length,
  };
}
