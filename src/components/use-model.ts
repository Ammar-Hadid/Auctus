'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import type { State } from '@/domain/types';
export type Send = (
  action: string,
  data: Record<string, unknown>,
  onConfirmed?: (result: unknown) => void,
) => Promise<false | { result: unknown }>;
type Pending = { requestId: string; action: string; data: Record<string, unknown> };
export function useModel(initial: State) {
  const [state, setState] = useState(initial),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [offline, setOffline] = useState(false),
    [pending, setPending] = useState<Pending | null>(null);
  const pendingKey = `auctus.pending.${initial.account.id}`;
  const lock = useRef(false);
  // Keep the original editor's completion action when an uncertain write is retried.
  const confirmation = useRef<{ requestId: string; callback: (result: unknown) => void } | null>(
    null,
  );
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
      if (next.account.id !== initial.account.id) {
        location.replace(new URL('/', location.origin).href);
        return;
      }
      if (sequence === refreshSequence.current) {
        setState(next);
        setOffline(false);
      }
    } catch {
      setOffline(true);
    }
  }, [initial.account.id]);
  useEffect(() => {
    const recover = () => {
      const raw = localStorage.getItem(pendingKey);
      if (raw) {
        try {
          setPending(JSON.parse(raw));
        } catch {
          localStorage.removeItem(pendingKey);
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
  }, [refresh, pendingKey]);
  const execute = useCallback(
    async (p: Pending) => {
      if (lock.current) return false;
      lock.current = true;
      setBusy(true);
      setError('');
      setPending(p);
      try {
        localStorage.setItem(pendingKey, JSON.stringify(p));
        const r = await fetch('/api/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-auctus-account': initial.account.id },
          body: JSON.stringify(p),
        });
        const body = await r.json();
        if (!r.ok) {
          if (r.status !== 401 && r.status < 500) {
            localStorage.removeItem(pendingKey);
            setPending(null);
            confirmation.current = null;
          }
          if (r.status === 409) await refresh();
          throw new Error(body.error || 'Save failed.');
        }
        if (!body.state)
          throw new Error('Saved response lacked current state. Retry to reconcile.');
        ++refreshSequence.current;
        setState(body.state);
        setOffline(false);
        localStorage.removeItem(pendingKey);
        setPending(null);
        const callback =
          confirmation.current?.requestId === p.requestId ? confirmation.current.callback : null;
        confirmation.current = null;
        callback?.(body.result);
        return { result: body.result as unknown };
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
    [refresh, pendingKey, initial.account.id],
  );
  const send: Send = useCallback(
    (action, data, onConfirmed) => {
      if (pending) {
        setError(
          'Resolve the unconfirmed action first: retry it or discard the local request after checking your records.',
        );
        return Promise.resolve(false);
      }
      if (lock.current) return Promise.resolve(false);
      const requestId = crypto.randomUUID();
      confirmation.current = onConfirmed ? { requestId, callback: onConfirmed } : null;
      return execute({ requestId, action, data });
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
      confirmation.current = null;
      localStorage.removeItem(pendingKey);
      setPending(null);
      setError('');
      void refresh();
    },
  };
}
