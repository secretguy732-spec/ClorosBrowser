/**
 * Cloros Browser — Service Worker
 * Enables PWA install and offline caching of the shell
 */
const CACHE_NAME = 'cloros-v1';
const SHELL_ASSETS = ['/', '/css/style.css', '/js/app.js'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Only cache same-origin shell assets
  if (e.request.url.includes('/proxy')) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
