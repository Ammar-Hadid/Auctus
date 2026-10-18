'use client';
import { useState } from 'react';
import type { State } from '@/domain/types';
import { AccountManagement } from './account-management';
import { NotificationSettings } from './notification-settings';
export function Settings({ account }: { account: State['account'] }) {
  const [error, setError] = useState('');
  return (
    <div className="stack">
      <h1>Your space</h1>
      <p>
        Signed in as {account.email} ·{' '}
        {account.role === 'master' ? 'Master account' : 'Private account'}
      </p>
      <NotificationSettings />
      {account.role === 'master' && <AccountManagement />}
      <section className="panel stack">
        <h2>Training conventions</h2>
        <p>
          Weights are kilograms. Dumbbell loads are per dumbbell; unilateral repetitions are per
          side. Volume uses entered load × reps without doubling.
        </p>
        <p>
          The training week starts Monday at 03:00 in Europe/Amsterdam. A workout crossing the
          boundary stays in its original week.
        </p>
      </section>
      <section className="panel stack">
        <h2>Install Auctus</h2>
        <p>
          On iPhone: open this site in Safari, tap Share, then Add to Home Screen. HTTPS is required
          in production.
        </p>
        <p>
          Confirmed records live on your server. An internet connection is required to save changes.
          Timers recover when you return, but background sound and vibration are not guaranteed.
        </p>
      </section>
      <section className="panel stack">
        <h2>Private account</h2>
        <p>
          {account.role === 'master'
            ? 'Your master account requires a password and passkey. The server owner command can reset your password; it does not remove your passkey.'
            : 'Your training data belongs only to this account. Contact the master administrator for account recovery.'}
        </p>
        {error && <p className="error">{error}</p>}
        <button
          onClick={async () => {
            try {
              const r = await fetch('/api/auth/sign-out', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}',
              });
              if (!r.ok) throw new Error('Sign out failed.');
              location.reload();
            } catch {
              setError('Unable to sign out. Reconnect and retry.');
            }
          }}
        >
          Sign out
        </button>
      </section>
    </div>
  );
}
