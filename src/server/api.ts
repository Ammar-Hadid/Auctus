import { getAuth } from './auth';
import { DomainError } from './errors';
import { ZodError } from 'zod';
export async function authorize(request: Request, write = false) {
  if (write) {
    const expected = new URL(process.env.BETTER_AUTH_URL || 'http://127.0.0.1:3105').origin;
    if (request.headers.get('origin') !== expected)
      throw new DomainError('Request origin is not permitted.', 403);
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      throw new DomainError('Expected JSON.', 415);
  }
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session)
    throw new DomainError('Your sign-in expired. Sign in again; your draft is kept.', 401);
  return session;
}
export function apiError(error: unknown) {
  if (error instanceof SyntaxError)
    return Response.json({ error: 'Invalid JSON request.' }, { status: 400 });
  if (error instanceof DomainError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError)
    return Response.json(
      { error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') },
      { status: 400 },
    );
  console.error('Request failed:', error instanceof Error ? error.message : 'Unknown error');
  return Response.json(
    { error: 'The action could not be saved. Retry or reload to check its status.' },
    { status: 500 },
  );
}
