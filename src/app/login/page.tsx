'use client';
import Link from 'next/link';
import { useState } from 'react';
export default function Login() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.get('email'), password: data.get('password') }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? 'Too many attempts. Try again in a minute.'
            : 'Sign-in failed. Check your email and password.',
        );
      location.replace(new URL('/', location.origin).href);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to connect. Please retry.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login stack">
      <Link href="/" className="brand">
        AUCTUS<span> /</span>
      </Link>
      <div style={{ height: 24 }} />
      <h1>
        Back to your
        <br />
        stronger self.
      </h1>
      <p>Your training. Your progress. One private space.</p>
      <form onSubmit={submit} className="stack panel">
        <h2>Sign in</h2>
        <label>
          Email
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p style={{ fontSize: 13 }}>
        Accounts are created by the master administrator. Public signup is disabled.
      </p>
    </main>
  );
}
