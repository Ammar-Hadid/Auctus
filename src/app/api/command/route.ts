import { requireCondition } from '@/server/errors';
import { getStore, forUser } from '@/server/db/connection';
import { readState } from '@/server/read-state';
import { dispatch } from '@/server/dispatch';
import { authorize, apiError } from '@/server/api';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const auth = await authorize(request, true);
    requireCondition(
      request.headers.get('x-auctus-account') === auth.user.id,
      'The signed-in account changed. Reload before saving.',
      409,
    );
    const text = await request.text();
    if (text.length > 300000)
      return Response.json({ error: 'Request is too large.' }, { status: 413 });
    const store = forUser(getStore(), auth.user.id);
    const result = dispatch(store, JSON.parse(text));
    return Response.json(
      { result, state: readState(store) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return apiError(error);
  }
}
