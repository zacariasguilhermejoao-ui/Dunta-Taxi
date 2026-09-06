const CACHE_NAME = 'dunta-v5';
const ASSETS = [
  './',
  './DUNTA_TAXI.html',
  './dunta-core.js',
  './dunta-logo.svg',
  './dunta-icon.svg',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.hostname.includes('supabase') || url.hostname.includes('tile.openstreetmap') || url.hostname.includes('unpkg') || url.hostname.includes('jsdelivr') || url.hostname.includes('cdnjs.cloudflare.com')) return;
  e.respondWith(caches.match(e.request).then((cached) => {
    const fetched = fetch(e.request).then((r) => {
      if (r && r.status === 200 && e.request.method === 'GET') {
        const clone = r.clone();
        caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
      }
      return r;
    }).catch(() => cached);
    return cached || fetched;
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow('./DUNTA_TAXI.html');
  }));
});
