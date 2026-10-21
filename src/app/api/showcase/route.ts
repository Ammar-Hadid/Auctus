import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/server/api';
import { getAuth } from '@/server/auth';
import { getStore } from '@/server/db/connection';
import { requireCondition } from '@/server/errors';
import {
  cleanupShowcases,
  createShowcase,
  deleteShowcase,
  showcaseCookieName,
  showcaseSession,
  SHOWCASE_DURATION,
} from '@/server/showcase';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const expected = new URL(process.env.BETTER_AUTH_URL || 'http://localhost:3105');
    requireCondition(
      request.headers.get('origin') === expected.origin,
      'Request origin is not permitted.',
      403,
    );
    requireCondition(
      request.headers.get('content-type')?.startsWith('application/json'),
      'Expected JSON.',
      415,
    );
    const raw = await request.text();
    requireCondition(raw.length <= 1024, 'Request too large.', 413);
    const input = z
      .discriminatedUnion('action', [
        z.object({ action: z.literal('enter'), code: z.string().trim().min(1).max(128) }).strict(),
        z.object({ action: z.literal('leave') }).strict(),
      ])
      .parse(JSON.parse(raw));
    const store = getStore();
    cleanupShowcases(store);
    const existing = showcaseSession(store, request.headers);
    const response = NextResponse.json(
      { ok: true },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
    let token = '';
    if (input.action === 'enter') {
      requireCondition(
        !(await getAuth().api.getSession({ headers: request.headers })),
        'You are already signed in. Open a private browser window to try the showcase.',
        409,
      );
      const visitor = createShowcase(store, input.code);
      token = visitor.token;
    }
    if (existing) deleteShowcase(store, existing.user.id);
    response.cookies.set(showcaseCookieName(), token, {
      httpOnly: true,
      secure: expected.protocol === 'https:',
      sameSite: 'lax',
      path: '/',
      maxAge: token ? SHOWCASE_DURATION / 1000 : 0,
    });
    return response;
  } catch (error) {
    return apiError(error);
  }
}
