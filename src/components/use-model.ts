'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import type { State } from '@/domain/types';
export type Send = (action: string, data: Record<string, unknown>) => Promise<boolean>;
type Pending = { requestId: string; action: string; data: Record<string, unknown> };
export function useModel(initial: State) {
  const [state, setState] = useState(initial),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [offline, setOffline] = useState(false),
    [pending, setPending] = useState<Pending | null>(null);
  const lock = useRef(false);
  const refreshSequence = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    try {
      const r = await fetch('/api/state', { cache: 'no-store' });
      if (!r.ok) {
        if (r.status === 401)
          setError('Sign-in expired. Sign in again in another tab, then retry.');
        return;
      }
      const next: State = await r.json();
      if (sequence === refreshSequence.current) {
        setState(next);
        setOffline(false);
      }
    } catch {
      setOffline(true);
    }
  }, []);
  useEffect(() => {
    const recover = () => {
      const raw = localStorage.getItem('auctus.pending');
      if (raw) {
        try {
          setPending(JSON.parse(raw));
        } catch {
          localStorage.removeItem('auctus.pending');
        }
      }
      void refresh();
    };
    const onOffline = () => setOffline(true);
    const visible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    recover();
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible' && !lock.current) void refresh();
    }, 60000);
    window.addEventListener('online', recover);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(poll);
      window.removeEventListener('online', recover);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh]);
  const execute = useCallback(
    async (p: Pending) => {
      if (lock.current) return false;
      lock.current = true;
      setBusy(true);
      setError('');
      setPending(p);
      try {
        localStorage.setItem('auctus.pending', JSON.stringify(p));
        const r = await fetch('/api/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(p),
        });
        const body = await r.json();
        if (!r.ok) {
          if (r.status !== 401 && r.status < 500) {
            localStorage.removeItem('auctus.pending');
            setPending(null);
          }
          if (r.status === 409) await refresh();
          throw new Error(body.error || 'Save failed.');
        }
        if (!body.state)
          throw new Error('Saved response lacked current state. Retry to reconcile.');
        ++refreshSequence.current;
        setState(body.state);
        setOffline(false);
        localStorage.removeItem('auctus.pending');
        setPending(null);
        return true;
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Connection failed. This action is not confirmed saved.',
        );
        return false;
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [refresh],
  );
  const send: Send = useCallback(
    (action, data) => {
      if (pending) {
        setError(
          'Resolve the unconfirmed action first: retry it or discard the local request after checking your records.',
        );
        return Promise.resolve(false);
      }
      return execute({ requestId: crypto.randomUUID(), action, data });
    },
    [execute, pending],
  );
  return {
    state,
    error,
    busy,
    offline,
    pending,
    refresh,
    send,
    retry: () => (pending ? execute(pending) : Promise.resolve(false)),
    discard: () => {
      localStorage.removeItem('auctus.pending');
      setPending(null);
      setError('');
      void refresh();
    },
  };
}
