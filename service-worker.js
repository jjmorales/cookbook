const CACHE_NAME = 'cookbook-shell-v1';

// List every page/asset that should still work with no connection.
// Update this list as you add real pages (recipe.html, tips.html, etc).
const APP_SHELL = [
  './index.html',
  './recipe.html',
  './add-recipe.html',
  './css/base.css',
  './js/tips-engine.js',
  './manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Cache-first for the app shell, network-first for everything else (so recipe
// data fetched from GitHub stays fresh instead of getting stuck stale).
self.addEventListener('fetch', event => {
  const { request } = event;

  if (APP_SHELL.some(path => request.url.endsWith(path))) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request))
  );
});
