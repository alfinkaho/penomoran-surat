const CACHE_NAME = 'penomoran-surat-v7';
const ASSETS = [
    './',
    './index.html',
    './app.js?v=1.0.3',
    './manifest.json'
];

// Install Service Worker & Cache essential assets securely
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            for (const asset of ASSETS) {
                try {
                    await cache.add(asset);
                } catch (err) {
                    console.warn('Gagal memuat cache asset:', asset, err);
                }
            }
        })
    );
    self.skipWaiting();
});

// Activate Service Worker & Delete Old Caches
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

// Intercept Requests (Network First Strategy)
self.addEventListener('fetch', (e) => {
    // Hanya tangani metode GET
    if (e.request.method !== 'GET') return;
    
    // Abaikan API Google Apps Script & URL non-HTTP
    if (e.request.url.includes('script.google.com') || !e.request.url.startsWith('http')) {
        return;
    }

    // Strategi Network-First untuk semua resource lokal agar pembaruan kode selalu terambil fresh dari server
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