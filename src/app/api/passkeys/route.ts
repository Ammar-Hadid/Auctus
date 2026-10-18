import { authorize, apiError } from '@/server/api';
import { getStore } from '@/server/db/connection';
import { requireMaster } from '@/server/accounts';
import { hasPasskey, passkeyOptions, verifyPasskey } from '@/server/passkeys';
import { requireCondition, DomainError } from '@/server/errors';
import { z } from 'zod';
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/server';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const auth = await authorize(request, false, true);
    requireMaster(getStore(), auth.user.id);
    return Response.json(
      { enrolled: hasPasskey(getStore(), auth.user.id) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const auth = await authorize(request, true, true),
      store = getStore();
    requireMaster(store, auth.user.id);
    const raw = await request.text();
    requireCondition(raw.length < 65536, 'Request too large.', 413);
    const v = z
      .object({
        kind: z.enum(['register', 'authenticate']),
        action: z.enum(['options', 'verify']),
        response: z
          .object({ id: z.string().max(2048) })
          .passthrough()
          .optional(),
      })
      .strict()
      .parse(JSON.parse(raw));
    if (v.action === 'options')
      return Response.json(await passkeyOptions(store, auth.session.id, auth.user.id, v.kind), {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    requireCondition(v.response, 'Passkey response is required.');
    try {
      return Response.json(
        await verifyPasskey(
          store,
          auth.session.id,
          auth.user.id,
          v.kind,
          v.response as unknown as RegistrationResponseJSON | AuthenticationResponseJSON,
        ),
      );
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError('Passkey could not be verified. Try again.', 403);
    }
  } catch (error) {
    return apiError(error);
  }
}
