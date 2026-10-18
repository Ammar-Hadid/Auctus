import { z } from 'zod';
export const id = z.string().min(1).max(100);
export const name = z.string().trim().min(1, 'Enter a name.').max(120);
export const notes = z.string().max(4000).default('');
export const setType = z.enum(['normal', 'warmup', 'dropset', 'failure']);
export const prescription = z.object({
  id: id.optional(),
  type: setType,
  target_reps: z.number().int().min(0).max(1000),
  target_grams: z.number().int().min(0).max(2000000),
  rest_ms: z.number().int().min(0).max(3600000),
});
export const templateInput = z.object({
  id: id.optional(),
  version: z.number().int().nonnegative().optional(),
  program_id: id,
  name,
  notes,
  exercises: z
    .array(z.object({ id: id.optional(), exercise_id: id, sets: z.array(prescription).max(100) }))
    .max(100),
});
