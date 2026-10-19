'use client';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import * as Toast from '@radix-ui/react-toast';
import { CircleAlert, Check, Info, X } from 'lucide-react';

type RegisterHost = (host: HTMLDivElement) => () => void;
const ViewportHostContext = createContext<RegisterHost>(() => () => {});

export function Notifications({ children }: { children: ReactNode }) {
  const [hosts, setHosts] = useState<HTMLDivElement[]>([]);
  const registerHost = useCallback<RegisterHost>((host) => {
    setHosts((current) => [...current.filter((item) => item !== host), host]);
    return () => setHosts((current) => current.filter((item) => item !== host));
  }, []);
  const host = hosts.at(-1);
  const viewport = <Toast.Viewport className="toast-viewport" label="Notifications (F8)" />;
  return (
    <ViewportHostContext.Provider value={registerHost}>
      <Toast.Provider duration={5000} announcerContainer={host ?? undefined}>
        {children}
        {host ? createPortal(viewport, host) : viewport}
      </Toast.Provider>
    </ViewportHostContext.Provider>
  );
}

// Keep notifications inside an open modal's focus and accessibility boundary.
export function NotificationHost() {
  const registerHost = useContext(ViewportHostContext);
  const hostRef = useCallback(
    (host: HTMLDivElement | null) => {
      if (host) return registerHost(host);
    },
    [registerHost],
  );
  return <div ref={hostRef} />;
}

export function Notification({
  children,
  tone = 'error',
  onDismiss,
  persistent = false,
}: {
  children: ReactNode;
  tone?: 'error' | 'success' | 'info' | 'warning';
  onDismiss?: () => void;
  persistent?: boolean;
}) {
  const Icon =
    tone === 'error' || tone === 'warning' ? CircleAlert : tone === 'success' ? Check : Info;
  return (
    <Toast.Root
      className={`toast ${tone}`}
      type={tone === 'error' || tone === 'warning' ? 'foreground' : 'background'}
      duration={persistent ? Infinity : undefined}
      open={persistent ? true : undefined}
      onOpenChange={(open) => {
        if (!open) onDismiss?.();
      }}
      onEscapeKeyDown={(event) => {
        if (persistent) event.preventDefault();
      }}
    >
      <Icon size={20} aria-hidden="true" className="toast-icon" />
      <Toast.Description asChild>
        <div className="toast-content">{children}</div>
      </Toast.Description>
      {!persistent && (
        <Toast.Close asChild>
          <button type="button" className="toast-close ghost" aria-label="Dismiss notification">
            <X size={18} />
          </button>
        </Toast.Close>
      )}
    </Toast.Root>
  );
}
