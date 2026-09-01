const CACHE_NAME = 'penomoran-surat-v17';
const ASSETS = [
    './',
    './index.html',
    './app.js?v=1.1.3',
    './manifest.json'
];

// Install Service Worker & Pre-cache essential app shell assets
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate Service Worker & Clear Stale Caches
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Intercept Requests (Stale-While-Revalidate for Fonts/CDN, Network-First for App Assets)
self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;

    // Abaikan API Google Apps Script & URL non-http
    if (e.request.url.includes('script.google.com') || !e.request.url.startsWith('http')) {
        return;
    }

    // Strategi Stale-While-Revalidate untuk Fonts & CDN CSS (FontAwesome, Google Fonts, Tailwind)
    if (e.request.url.includes('fonts.googleapis.com') || 
        e.request.url.includes('fonts.gstatic.com') || 
        e.request.url.includes('cdnjs.cloudflare.com') ||
        e.request.url.includes('cdn.tailwindcss.com')) {
        e.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                const cachedResponse = await cache.match(e.request);
                const fetchPromise = fetch(e.request).then((networkResponse) => {
                    if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
                        cache.put(e.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => null);
                return cachedResponse || fetchPromise;
            })
        );
        return;
    }

    // Network-First untuk asset aplikasi utama dengan fallback cache
    e.respondWith(
        fetch(e.request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const copy = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(e.request).then((cachedResponse) => {
                    return cachedResponse || (e.request.mode === 'navigate' ? caches.match('./index.html') : null);
                });
            })
    );
});