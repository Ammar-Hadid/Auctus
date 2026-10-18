import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuth } from '@/server/auth';
import { getStore, forUser } from '@/server/db/connection';
import { passkeyVerified } from '@/server/passkeys';
import { readState } from '@/server/read-state';
import { App } from '@/components/app';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  if (!passkeyVerified(getStore(), session.session.id, session.user.id)) redirect('/unlock');
  return <App initial={readState(forUser(getStore(), session.user.id))} />;
}
