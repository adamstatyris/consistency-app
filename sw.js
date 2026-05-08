/* Minimal service worker for PWA installability (pass-through; no offline cache). */
self.addEventListener('install', function (e) {
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', function (e) {
  // Let the browser handle top-level navigations and reloads. Intercepting them
  // with fetch() can cause refresh / hard-reload to hang or fail on some Chrome
  // desktop + PWA setups while still passing through subresources normally.
  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    return;
  }
  e.respondWith(fetch(e.request));
});
