'use client';
import { Notification } from '@/components/ui/notification';
import { useEffect, useState } from 'react';
import type { State } from '@/domain/types';
export function AccountManagement() {
  const [accounts, setAccounts] = useState<State['account'][]>([]),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  async function load() {
    const r = await fetch('/api/accounts');
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    return data as State['account'][];
  }
  useEffect(() => {
    void load()
      .then(setAccounts)
      .catch(() => setError('Unable to load accounts. Refresh to retry.'));
  }, []);
  return (
    <section className="panel stack">
      <h2>Manage accounts</h2>
      <p>
        Only your master account can create accounts. Each account has its own exercises, programs
        and workout history. Public signup is disabled.
      </p>
      <ul>
        {accounts.map((a) => (
          <li key={a.id}>
            {a.name} · {a.email} · {a.role === 'master' ? 'Master' : 'Member'}
          </li>
        ))}
      </ul>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget,
            data = new FormData(form);
          setBusy(true);
          setError('');
          setMessage('');
          try {
            const r = await fetch('/api/accounts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(Object.fromEntries(data)),
            });
            const result = await r.json();
            if (!r.ok) throw new Error(result.error);
            form.reset();
            setMessage(`Account created for ${result.email}. Share its password privately.`);
            setAccounts(await load());
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Account could not be created.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <h3>Create account</h3>
        <label>
          Name
          <input name="name" required maxLength={80} autoComplete="off" />
        </label>
        <label>
          Email
          <input name="email" type="email" required autoComplete="off" />
        </label>
        <label>
          New account password
          <input
            name="password"
            type="password"
            minLength={16}
            maxLength={128}
            required
            autoComplete="new-password"
          />
        </label>
        <p>Use a password-manager-generated password of at least 16 characters.</p>
        <label>
          Your master password
          <input
            name="masterPassword"
            type="password"
            maxLength={128}
            required
            autoComplete="current-password"
          />
        </label>
        {error && (
          <Notification key={error} onDismiss={() => setError('')}>
            {error}
          </Notification>
        )}
        {message && (
          <Notification key={message} tone="success" onDismiss={() => setMessage('')}>
            {message}
          </Notification>
        )}
        <button className="primary" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <a href="/unlock?add=1">Add a backup passkey</a>
    </section>
  );
}
