'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import * as Toast from '@radix-ui/react-toast';
import { CircleAlert, Check, Info, X } from 'lucide-react';

const ViewportHostContext = createContext<(host: HTMLDivElement | null) => void>(() => {});

export function Notifications({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const viewport = <Toast.Viewport className="toast-viewport" label="Notifications (F8)" />;
  return (
    <ViewportHostContext.Provider value={setHost}>
      <Toast.Provider duration={5000} announcerContainer={host ?? undefined}>
        {children}
        {host ? createPortal(viewport, host) : viewport}
      </Toast.Provider>
    </ViewportHostContext.Provider>
  );
}

// Keep notifications inside an open modal's focus and accessibility boundary.
export function NotificationHost() {
  const setHost = useContext(ViewportHostContext);
  return <div ref={setHost} />;
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
