const CACHE_NAME = 'excellearn-v1';
self.addEventListener('install', (event) => {
  self.skipWaiting();
});
self.addEventListener('fetch', (event) => {
  // Basic strategy: Network first with fallback
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
