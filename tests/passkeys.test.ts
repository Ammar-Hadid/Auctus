import { it, expect } from 'vitest';
import { openDatabase } from './test-store';
import { passkeyOptions, verifyPasskey, passkeyVerified } from '../src/server/passkeys';
it('requires fresh first enrollment, consumes challenges once, and revokes verification with the session', async () => {
  const store = openDatabase(':memory:');
  const sql = store.sqlite,
    now = Date.now(),
    user = 'test-owner';
  try {
    sql
      .prepare(
        'INSERT INTO session (id,user_id,token,created_at,updated_at,expires_at) VALUES (?,?,?,?,?,?)',
      )
      .run('s', user, 'token', now - 301000, now, now + 3600000);
    await expect(passkeyOptions(store, 's', user, 'register')).rejects.toThrow('Sign in again');
    sql.prepare('UPDATE session SET created_at=?').run(now);
    const options = await passkeyOptions(store, 's', user, 'register');
    expect(options).toMatchObject({
      authenticatorSelection: { userVerification: 'required', residentKey: 'required' },
    });
    sql.prepare('UPDATE passkey_challenge SET expires_at=?').run(now - 1);
    await expect(
      verifyPasskey(store, 's', user, 'register', { id: 'invalid' } as never),
    ).rejects.toThrow('expired');
    expect(sql.prepare('SELECT * FROM passkey_challenge').all()).toEqual([]);
    expect(passkeyVerified(store, 's', user)).toBe(false);
    sql.prepare('INSERT INTO passkey VALUES (?,?,?,?,?)').run('key', user, Buffer.alloc(0), 0, now);
    const authentication = await passkeyOptions(store, 's', user, 'authenticate');
    expect(authentication).toMatchObject({ allowCredentials: [], userVerification: 'required' });
    // A discoverable chooser must not authorize an unrecognized/other account's key.
    sql
      .prepare(
        "INSERT INTO user (id,name,email,created_at,updated_at) VALUES ('other','Other','other@example.test',0,0)",
      )
      .run();
    sql
      .prepare('INSERT INTO passkey VALUES (?,?,?,?,?)')
      .run('another-account-key', 'other', Buffer.alloc(0), 0, now);
    await expect(
      verifyPasskey(store, 's', user, 'authenticate', { id: 'another-account-key' } as never),
    ).rejects.toThrow('Passkey not found');
    expect(passkeyVerified(store, 's', user)).toBe(false);
    await expect(passkeyOptions(store, 's', user, 'register')).rejects.toThrow('existing passkey');
    sql.prepare('INSERT INTO session_verification VALUES (?,?)').run('s', now);
    expect(passkeyVerified(store, 's', user)).toBe(true);
    sql.prepare('DELETE FROM session WHERE id=?').run('s');
    expect(passkeyVerified(store, 's', user)).toBe(false);
    expect(sql.prepare('SELECT * FROM session_verification').all()).toEqual([]);
  } finally {
    sql.close();
  }
});
