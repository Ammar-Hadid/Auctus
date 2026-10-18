'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
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
    async function post(data: unknown) {
      const r = await fetch('/api/passkeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      return result;
    }
    try {
      const optionsJSON = await post({ kind, action: 'options' });
      const response =
        kind === 'register'
          ? await startRegistration({ optionsJSON })
          : await startAuthentication({ optionsJSON });
      await post({ kind, action: 'verify', response });
      location.replace(new URL('/', location.origin).href);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Passkey verification was cancelled. Try again.');
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
