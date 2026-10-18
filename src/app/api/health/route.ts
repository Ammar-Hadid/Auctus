import { getStore } from '@/server/db/connection';
export const dynamic = 'force-dynamic';
export function GET() {
  try {
    getStore().sqlite.prepare('SELECT 1').get();
    return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503 });
  }
}
