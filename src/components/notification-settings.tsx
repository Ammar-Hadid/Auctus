'use client';
import { useEffect, useState } from 'react';
import { useRestSound } from './use-rest-sound';
import { testSound, muteSound, stopAlarm } from '@/client/rest-sound';
type PushConfig = { configured: boolean; publicKey: string | null };
async function command(data: Record<string, unknown>) {
  const response = await fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Notifications could not be updated.');
}
export function NotificationSettings() {
  const sound = useRestSound();
  const [config, setConfig] = useState<PushConfig | null>(null);
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let mounted = true;
    const supported =
      window.isSecureContext &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    void (async () => {
      try {
        const response = await fetch('/api/push');
        if (!response.ok) throw new Error('Unable to load notification settings. Reload to retry.');
        const config: PushConfig = await response.json();
        if (mounted) {
          setConfig(config);
          setSupported(supported);
        }
        if (supported && config.configured) {
          const registration = await navigator.serviceWorker.register('/sw.js');
          const subscription = await registration.pushManager.getSubscription();
          if (subscription && Notification.permission === 'granted') {
            await command({ action: 'subscribe', subscription: subscription.toJSON() });
            if (mounted) setEnabled(true);
          }
        }
      } catch (error) {
        if (mounted) setMessage((error as Error).message);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  async function enable() {
    setBusy(true);
    setMessage('');
    try {
      // This permission request must be directly triggered by the user's tap on iOS.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted')
        throw new Error(
          'Notifications are not allowed. You can change this in your device notification settings.',
        );
      await navigator.serviceWorker.register('/sw.js');
      const registration = await navigator.serviceWorker.ready;
      const key = Uint8Array.from(
        atob(config!.publicKey!.replace(/-/g, '+').replace(/_/g, '/')),
        (c) => c.charCodeAt(0),
      );
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        }));
      await command({ action: 'subscribe', subscription: subscription.toJSON() });
      setEnabled(true);
      setMessage('Background rest notifications enabled on this device.');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function manage(action: 'test' | 'unsubscribe') {
    setBusy(true);
    setMessage('');
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) throw new Error('Enable notifications on this device first.');
      await command({ action, endpoint: subscription.endpoint });
      if (action === 'unsubscribe') {
        await subscription.unsubscribe();
        setEnabled(false);
        setMessage('Background notifications disabled.');
      } else setMessage('Test notification sent. Check your device notifications.');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel stack">
      <h2>Rest alerts</h2>
      <p>
        While Auctus is open, the rest alarm repeats until you stop it. Tap Test alarm to enable and
        hear it, then Stop alarm to silence it. Check your device volume if you cannot hear it.
      </p>
      <div className="row">
        <button onClick={() => void testSound()}>Test alarm</button>
        {sound.activeKey && (
          <button className="primary" onClick={() => stopAlarm()}>
            Stop alarm
          </button>
        )}
        {sound.enabled && <button onClick={muteSound}>Mute timer sound</button>}
      </div>
      {sound.error && (
        <p role="alert" className="error">
          {sound.error}
        </p>
      )}
      <h3>When Auctus is in the background</h3>
      <p>
        On iPhone, add Auctus to your Home Screen, open it there, then allow notifications. Alerts
        can appear while you use another app. Delivery may be delayed; this is not a native alarm.
      </p>
      <p>
        Notification sound and haptics follow iOS settings and Focus. Auctus cannot force an iPhone
        to vibrate or play a custom background alarm.
      </p>
      {config && !config.configured && (
        <p className="muted">
          Background alerts become available when Auctus is deployed at an HTTPS address. This local
          address is not ready for iPhone push notifications.
        </p>
      )}
      {config?.configured && !supported && (
        <p className="muted">
          Open the installed Home Screen app on iPhone with iOS 16.4 or later, or use a browser that
          supports push notifications.
        </p>
      )}
      <div className="row">
        {!enabled ? (
          <button
            disabled={busy || !supported || !config?.configured}
            onClick={() => void enable()}
          >
            Enable background alerts
          </button>
        ) : (
          <>
            <button disabled={busy} onClick={() => void manage('test')}>
              Test notification
            </button>
            <button disabled={busy} onClick={() => void manage('unsubscribe')}>
              Disable background alerts
            </button>
          </>
        )}
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
