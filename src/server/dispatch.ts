import { z } from 'zod';
import { editHistory } from './history';
import { Sessions } from './sessions';
import { Programming } from './programming';
import { command } from './commands';
import { DomainError } from './errors';
import type { Store } from './db/connection';
export function dispatch(store: Store, body: unknown, now = Date.now()) {
  const c = z
    .object({
      requestId: z.string().uuid(),
      action: z.string(),
      data: z.record(z.string(), z.unknown()),
    })
    .parse(body);
  return command(store, c.requestId, { action: c.action, data: c.data }, now, () => {
    const p = new Programming(store, () => now);
    switch (c.action) {
      case 'history.edit':
        return editHistory(store, c.data);
      case 'workout.start':
        return new Sessions(store, () => now).start(
          z.string().parse(c.data.assignment_id),
          c.data.repeat === true,
        );
      case 'workout.cancel':
        return new Sessions(store, () => now).cancel(c.data);
      case 'session.action':
        return new Sessions(store, () => now).act(c.data);
      case 'exercise.save':
        return p.saveExercise(c.data);
      case 'program.save':
        return p.saveProgram(c.data);
      case 'template.save':
        return p.saveTemplate(c.data);
      case 'program.select':
        return p.selectProgram(z.string().nullable().parse(c.data.id));
      case 'schedule.apply':
        return p.applySchedule();
      case 'archive':
        return p.archive(
          z.enum(['exercise', 'program', 'template']).parse(c.data.kind),
          z.string().parse(c.data.id),
        );
      default:
        throw new DomainError('Unknown action.');
    }
  });
}
