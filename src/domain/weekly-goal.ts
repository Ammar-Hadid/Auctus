import type { Assignment } from './types';
export function weeklyGoal(assignments: Assignment[]) {
  const available = assignments.filter((a) => !a.withdrawn_at);
  const mandatory = available.filter((a) => a.mandatory);
  const optional = available.filter((a) => !a.mandatory);
  return {
    total: mandatory.length,
    completed: mandatory.filter((a) => a.completed > 0).length,
    optionalTotal: optional.length,
    optionalCompleted: optional.filter((a) => a.completed > 0).length,
  };
}
