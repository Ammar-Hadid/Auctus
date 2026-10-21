import { getAuth } from './auth';
import { getStore } from './db/connection';
import { showcaseSession } from './showcase';

export async function viewerSession(headers: Headers) {
  // A demo cookie can never downgrade or bypass a permanent account's passkey.
  const account = await getAuth().api.getSession({ headers });
  return account ? { ...account, showcase: false as const } : showcaseSession(getStore(), headers);
}
