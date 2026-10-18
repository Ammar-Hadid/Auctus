import { getStore, forUser } from '@/server/db/connection';
import { readState } from '@/server/read-state';
import { authorize, apiError } from '@/server/api';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const auth = await authorize(request);
    return Response.json(readState(forUser(getStore(), auth.user.id)), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return apiError(error);
  }
}
