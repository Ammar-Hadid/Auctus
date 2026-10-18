import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import type { Store } from './db/connection';
import { profile, requireMaster } from './accounts';
import { requireCondition } from './errors';
export function passkeyVerified(store: Store, sessionId: string, userId: string) {
  return (
    profile(store, userId).role !== 'master' ||
    !!store.sqlite
      .prepare('SELECT session_id FROM session_verification WHERE session_id=?')
      .get(sessionId)
  );
}
function relyingParty() {
  const url = new URL(process.env.BETTER_AUTH_URL || 'http://localhost:3105');
  return { rpID: url.hostname, origin: url.origin };
}
export function hasPasskey(store: Store, userId: string) {
  return !!store.sqlite.prepare('SELECT id FROM passkey WHERE user_id=?').get(userId);
}
function requireEnrollment(store: Store, sessionId: string, userId: string) {
  // First enrollment requires a fresh password login; additional keys require an existing passkey.
  const row = store.sqlite
    .prepare('SELECT created_at FROM session WHERE id=? AND user_id=? AND expires_at>?')
    .get(sessionId, userId, Date.now()) as { created_at: number } | undefined;
  requireCondition(row, 'Sign in again.', 401);
  const enrolled = hasPasskey(store, userId);
  requireCondition(
    enrolled ? passkeyVerified(store, sessionId, userId) : Date.now() - row.created_at < 300000,
    enrolled
      ? 'Sign in again and verify your existing passkey before adding a passkey.'
      : 'Sign in again to create your first passkey. Enrollment requires a password login from the last five minutes.',
    403,
  );
}
export async function passkeyOptions(
  store: Store,
  sessionId: string,
  userId: string,
  kind: 'register' | 'authenticate',
) {
  requireMaster(store, userId);
  const user = profile(store, userId),
    { rpID } = relyingParty();
  const keys = store.sqlite.prepare('SELECT id FROM passkey WHERE user_id=?').all(userId) as {
    id: string;
  }[];
  if (kind === 'register') requireEnrollment(store, sessionId, userId);
  else requireCondition(keys.length, 'Create your first passkey.', 400);
  const options =
    kind === 'register'
      ? await generateRegistrationOptions({
          rpName: 'Auctus',
          rpID,
          userName: user.email,
          userID: new TextEncoder().encode(userId),
          attestationType: 'none',
          excludeCredentials: keys,
          authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
          supportedAlgorithmIDs: [-7, -257],
        })
      : await generateAuthenticationOptions({
          rpID,
          // All enrolled keys are discoverable. Let the device/password manager
          // offer its saved passkeys, including ones synced from another device.
          // Verification below still binds the chosen key to the signed-in user.
          allowCredentials: [],
          userVerification: 'required',
        });
  store.sqlite
    .prepare(
      'INSERT INTO passkey_challenge VALUES (?,?,?,?) ON CONFLICT(session_id) DO UPDATE SET challenge=excluded.challenge,kind=excluded.kind,expires_at=excluded.expires_at',
    )
    .run(sessionId, options.challenge, kind, Date.now() + 300000);
  return options;
}
export async function verifyPasskey(
  store: Store,
  sessionId: string,
  userId: string,
  kind: 'register' | 'authenticate',
  response: RegistrationResponseJSON | AuthenticationResponseJSON,
) {
  requireMaster(store, userId);
  if (kind === 'register') requireEnrollment(store, sessionId, userId);
  const challenge = store.sqlite
    .prepare('DELETE FROM passkey_challenge WHERE session_id=? RETURNING *')
    .get(sessionId) as { challenge: string; kind: string; expires_at: number } | undefined;
  requireCondition(
    challenge && challenge.kind === kind && challenge.expires_at > Date.now(),
    'Passkey challenge expired. Try again.',
    400,
  );
  const { rpID, origin } = relyingParty();
  if (kind === 'register') {
    const result = await verifyRegistrationResponse({
      response: response as RegistrationResponseJSON,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    requireCondition(
      result.verified && result.registrationInfo,
      'Passkey verification failed.',
      403,
    );
    const key = result.registrationInfo.credential;
    store.sqlite
      .transaction(() => {
        requireEnrollment(store, sessionId, userId);
        store.sqlite
          .prepare('INSERT INTO passkey VALUES (?,?,?,?,?)')
          .run(key.id, userId, Buffer.from(key.publicKey), key.counter, Date.now());
        store.sqlite
          .prepare('INSERT OR REPLACE INTO session_verification VALUES (?,?)')
          .run(sessionId, Date.now());
      })
      .immediate();
  } else {
    const key = store.sqlite
      .prepare('SELECT id,public_key,counter FROM passkey WHERE id=? AND user_id=?')
      .get(response.id, userId) as { id: string; public_key: Buffer; counter: number } | undefined;
    requireCondition(key, 'Passkey not found.', 403);
    const result = await verifyAuthenticationResponse({
      response: response as AuthenticationResponseJSON,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: { id: key.id, publicKey: new Uint8Array(key.public_key), counter: key.counter },
      requireUserVerification: true,
    });
    requireCondition(result.verified, 'Passkey verification failed.', 403);
    store.sqlite
      .transaction(() => {
        requireCondition(
          store.sqlite
            .prepare('SELECT id FROM session WHERE id=? AND user_id=? AND expires_at>?')
            .get(sessionId, userId, Date.now()),
          'Sign in again.',
          401,
        );
        const changed = store.sqlite
          .prepare('UPDATE passkey SET counter=? WHERE id=? AND counter=?')
          .run(result.authenticationInfo.newCounter, key.id, key.counter);
        requireCondition(changed.changes, 'Passkey changed. Try again.', 409);
        store.sqlite
          .prepare('INSERT OR REPLACE INTO session_verification VALUES (?,?)')
          .run(sessionId, Date.now());
      })
      .immediate();
  }
  return { ok: true };
}
