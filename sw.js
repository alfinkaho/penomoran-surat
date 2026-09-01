const CACHE_NAME = 'penomoran-surat-v11';
const ASSETS = [
    './',
    './index.html',
    './app.js?v=1.0.7',
    './manifest.json',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200'
];

// Install Service Worker & Pre-cache essential assets
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            for (const asset of ASSETS) {
                try {
                    await cache.add(asset);
                } catch (err) {
                    console.warn('Pre-cache asset notice:', asset);
                }
            }
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

    // Abaikan API Google Apps Script
    if (e.request.url.includes('script.google.com') || !e.request.url.startsWith('http')) {
        return;
    }

    // Strategi Stale-While-Revalidate untuk Fonts & CDN CSS (Loading 0ms)
    if (e.request.url.includes('fonts.googleapis.com') || 
        e.request.url.includes('fonts.gstatic.com') || 
        e.request.url.includes('cdnjs.cloudflare.com') ||
        e.request.url.includes('cdn.tailwindcss.com')) {
        e.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                const cachedResponse = await cache.match(e.request);
                const fetchPromise = fetch(e.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
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