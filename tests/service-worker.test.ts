import { it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
it('displays every push and focuses Auctus when tapped', async () => {
  const handlers: Record<string, (event: unknown) => void> = {};
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const focus = vi.fn().mockResolvedValue(undefined);
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    URL,
    self: {
      addEventListener: (name: string, fn: (event: unknown) => void) => (handlers[name] = fn),
      registration: { showNotification },
      location: { origin: 'https://auctus.example' },
      clients: {
        matchAll: async () => [{ url: 'https://auctus.example/', focus }],
        openWindow: vi.fn(),
      },
    },
  });
  let pending: Promise<unknown> = Promise.resolve();
  handlers.push({
    data: { json: () => ({ title: 'Rest complete', body: 'Ready', tag: 'rest-1' }) },
    waitUntil: (p: Promise<unknown>) => (pending = p),
  });
  await pending;
  expect(showNotification).toHaveBeenCalledWith(
    'Rest complete',
    expect.objectContaining({
      silent: false,
      vibrate: [200, 100, 200, 100, 300],
      data: { url: '/' },
    }),
  );
  handlers.notificationclick({
    notification: { close: vi.fn() },
    waitUntil: (p: Promise<unknown>) => (pending = p),
  });
  await pending;
  expect(focus).toHaveBeenCalledOnce();
});
