/**
 * PDFNova Service Worker
 * Enables 100% offline access, PWA installation, and client-side asset caching
 */

const CACHE_NAME = 'pdfnova-app-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './tool.html',
  './editor.html',
  './login.html',
  './signup.html',
  './about.html',
  './faq.html',
  './privacy.html',
  './404.html',
  './manifest.json',
  './css/main.css',
  './js/tools-data.js',
  './js/api.js',
  './js/auth.js',
  './js/main.js',
  './js/tool-page.js',
  './js/editor.js',
  './js/offline-engine.js',
  './vendor/pdfjs/pdf.min.js',
  './vendor/pdfjs/pdf.worker.min.js',
  './vendor/pdflib/pdf-lib.min.js'
];

// Install: Cache critical static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Purge older cache versions and take immediate control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Stale-While-Revalidate for app assets, Network-First for API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignore non-GET requests (file uploads, POST /api)
  if (event.request.method !== 'GET') {
    return;
  }

  // API Requests: Network first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({
            success: false,
            offline: true,
            error: {
              code: 'OFFLINE_MODE',
              message: 'You are currently offline. Running local client-side PDF engine.'
            }
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }

  // App Shell & Static Assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback for navigation requests when totally disconnected
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html') || caches.match('./tool.html');
        }
      });

      return cachedResponse || fetchPromise;
    })
  );
});
