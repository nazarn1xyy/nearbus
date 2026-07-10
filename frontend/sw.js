// sw.js — Service Worker for PWA offline support
// Caches app shell and map tiles for poor connectivity

var CACHE_VERSION = 'v26';
var SHELL_CACHE = 'bus-shell-' + CACHE_VERSION;
var TILE_CACHE = 'bus-tiles-' + CACHE_VERSION;

var SHELL_FILES = [
  './',
  './schedule.html',
  './style.css',
  './tokens.css',
  './manifest.json',
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      return cache.addAll(SHELL_FILES).catch(function () {});
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) {
          return key !== SHELL_CACHE && key !== TILE_CACHE;
        }).map(function (key) {
          return caches.delete(key);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;

  // Only handle GET
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // Map tiles — cache-first with network update (CARTO + OpenStreetMap)
  if (url.hostname.endsWith('cartocdn.com') || url.hostname.endsWith('tile.openstreetmap.org')) {
    e.respondWith(
      caches.open(TILE_CACHE).then(function (cache) {
        return cache.match(req).then(function (cached) {
          var fetchPromise = fetch(req).then(function (resp) {
            if (resp.ok) cache.put(req, resp.clone());
            return resp;
          }).catch(function () {
            return cached;
          });
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // App shell — cache-first
  if (url.origin === self.location.origin || SHELL_FILES.indexOf(req.url) !== -1) {
    e.respondWith(
      caches.match(req).then(function (cached) {
        if (cached) return cached;
        return fetch(req).then(function (resp) {
          if (resp.ok) {
            var respClone = resp.clone();
            caches.open(SHELL_CACHE).then(function (cache) {
              cache.put(req, respClone).catch(function () {});
            });
          }
          return resp;
        }).catch(function () {
          return caches.match('./schedule.html');
        });
      })
    );
    return;
  }

  // CDN resources (Leaflet) — cache-first
  if (url.hostname === 'unpkg.com') {
    e.respondWith(
      caches.match(req).then(function (cached) {
        if (cached) return cached;
        return fetch(req).then(function (resp) {
          if (resp.ok) {
            var respClone = resp.clone();
            caches.open(SHELL_CACHE).then(function (cache) {
              cache.put(req, respClone).catch(function () {});
            });
          }
          return resp;
        });
      })
    );
    return;
  }
});
