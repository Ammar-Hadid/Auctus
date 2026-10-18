import { z } from 'zod';
import { authorize, apiError } from '@/server/api';
import { getStore } from '@/server/db/connection';
import { pushSubject, pushKeys, saveSubscription, sender, subscriptionId } from '@/server/push';
import { requireCondition } from '@/server/errors';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    await authorize(request);
    const configured = !!pushSubject();
    return Response.json(
      { configured, publicKey: configured ? pushKeys(getStore()).public_key : null },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const auth = await authorize(request, true);
    const text = await request.text();
    requireCondition(text.length < 8192, 'Request too large.', 413);
    const data = z
      .object({
        action: z.enum(['subscribe', 'unsubscribe', 'test']),
        subscription: z.unknown().optional(),
        endpoint: z.string().max(2048).optional(),
      })
      .parse(JSON.parse(text));
    const store = getStore();
    if (data.action === 'unsubscribe') {
      store.sqlite
        .prepare('DELETE FROM push_subscription WHERE id=? AND session_id=?')
        .run(subscriptionId(data.endpoint ?? ''), auth.session.id);
    } else {
      const subject = pushSubject();
      requireCondition(subject, 'Background notifications require an HTTPS deployment.', 409);
      if (data.action === 'subscribe') saveSubscription(store, auth.session.id, data.subscription);
      else {
        const saved = store.sqlite
          .prepare('SELECT subscription FROM push_subscription WHERE id=? AND session_id=?')
          .get(subscriptionId(data.endpoint ?? ''), auth.session.id) as
          { subscription: string } | undefined;
        requireCondition(saved, 'Enable notifications on this device first.', 404);
        await sender(store, subject)(JSON.parse(saved.subscription), {
          title: 'Auctus notifications are ready',
          body: 'This is a test notification. Sound and vibration follow your device settings.',
          tag: 'auctus-test',
          url: '/',
        });
      }
    }
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
