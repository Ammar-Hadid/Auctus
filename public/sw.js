const CACHE = 'auctus-shell-v1';
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(['/offline.html', '/icon-192.png', '/icon-512.png'])),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      ),
  );
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin)
    return;
  if (event.request.mode === 'navigate')
    event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')));
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {}
  // Safari requires every received push to produce a visible notification.
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Auctus', {
      body: payload.body || 'Open Auctus to continue your workout.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.tag || 'auctus-rest',
      renotify: true,
      silent: false,
      vibrate: [200, 100, 200, 100, 300],
      data: { url: '/' },
    }),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (existing) return existing.focus();
      return self.clients.openWindow('/');
    })(),
  );
});
