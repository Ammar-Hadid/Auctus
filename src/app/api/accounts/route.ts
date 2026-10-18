import { authorize, apiError } from '@/server/api';
import { getStore } from '@/server/db/connection';
import { requireMaster, confirmPassword, createMember } from '@/server/accounts';
import { requireCondition } from '@/server/errors';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const auth = await authorize(request),
      store = getStore();
    requireMaster(store, auth.user.id);
    return Response.json(
      store.sqlite
        .prepare(
          'SELECT u.id,u.name,u.email,a.role FROM user u JOIN account_access a ON a.user_id=u.id ORDER BY u.created_at',
        )
        .all(),
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const auth = await authorize(request, true),
      store = getStore();
    requireMaster(store, auth.user.id);
    const raw = await request.text();
    requireCondition(raw.length < 8192, 'Request too large.', 413);
    const v = z
      .object({
        name: z.string(),
        email: z.string(),
        password: z.string().min(16).max(128),
        masterPassword: z.string().min(1).max(128),
      })
      .strict()
      .parse(JSON.parse(raw));
    await confirmPassword(store, auth.user.id, v.masterPassword);
    const input = { name: v.name, email: v.email, password: v.password };
    const result = await createMember(store, auth.user.id, input);
    return Response.json(result, {
      status: 201,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return apiError(error);
  }
}
