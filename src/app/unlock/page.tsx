'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { passkeyError, type PasskeyStage } from '@/lib/passkey-error';
export default function Unlock() {
  const [enrolled, setEnrolled] = useState<boolean | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [adding, setAdding] = useState(false);
  useEffect(() => {
    void fetch('/api/passkeys')
      .then(async (r) => {
        if (r.status === 401) {
          location.replace(new URL('/login', location.origin).href);
          return;
        }
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setEnrolled(data.enrolled);
        setAdding(new URLSearchParams(location.search).get('add') === '1');
      })
      .catch(() => setError('Unable to load passkey setup. Sign in again.'));
  }, []);
  async function unlock() {
    setBusy(true);
    setError('');
    const kind = !enrolled || adding ? 'register' : 'authenticate';
    let stage: PasskeyStage = 'options';
    try {
      // Keep the native fetch in the click handler before opening the device prompt.
      // Extra asynchronous wrappers here can break user activation in older Safari.
      const r = await fetch('/api/passkeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, action: 'options' }),
      });
      const optionsJSON = await r.json();
      if (!r.ok) throw new Error(optionsJSON.error);
      stage = 'device';
      const response =
        kind === 'register'
          ? await startRegistration({ optionsJSON })
          : await startAuthentication({ optionsJSON });
      stage = 'verify';
      const verification = await fetch('/api/passkeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, action: 'verify', response }),
      });
      const result = await verification.json();
      if (!verification.ok) throw new Error(result.error);
      location.replace(new URL('/', location.origin).href);
    } catch (e) {
      setError(passkeyError(e, stage));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login stack">
      <Link href="/" className="brand">
        AUCTUS /
      </Link>
      <h1>{enrolled && !adding ? 'Unlock your master account' : 'Create your master passkey'}</h1>
      <p>
        {enrolled && !adding
          ? 'Your password was accepted. Verify your passkey to access your account.'
          : 'Use Face ID, Touch ID, your device PIN, or a security key. This passkey will be required after your password whenever you sign in.'}
      </p>
      <p>Your training data and account controls stay locked until verification succeeds.</p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button
        className="primary"
        disabled={busy || enrolled === null}
        onClick={() => void unlock()}
      >
        {busy
          ? 'Waiting for your device…'
          : enrolled && !adding
            ? 'Verify passkey'
            : 'Create passkey'}
      </button>
      <button
        onClick={async () => {
          await fetch('/api/auth/sign-out', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          });
          location.replace(new URL('/login', location.origin).href);
        }}
      >
        Sign out
      </button>
    </main>
  );
}
