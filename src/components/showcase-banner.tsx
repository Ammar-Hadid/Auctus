'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight, FlaskConical } from 'lucide-react';
export function ShowcaseBanner({ expiresAt }: { expiresAt: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const timer = setTimeout(
      () => location.replace('/login?expired=1'),
      Math.max(0, expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [expiresAt]);
  async function leave() {
    setBusy(true);
    try {
      const response = await fetch('/api/showcase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave' }),
      });
      if (!response.ok) throw new Error();
      location.replace('/');
    } catch {
      setError('Unable to leave. Reconnect and try again.');
      setBusy(false);
    }
  }
  return (
    <div className="showcase-banner">
      <FlaskConical size={18} aria-hidden="true" />
      <p>
        <strong>Showcase mode</strong>
        <span> Your own demo. Explore freely. Changes are temporary.</span>
      </p>
      <button className="small ghost" disabled={busy} onClick={leave}>
        {busy ? 'Leaving…' : 'Exit demo'}
        <ArrowUpRight size={15} />
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
