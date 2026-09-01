const CACHE_NAME = 'penomoran-surat-v4';
const ASSETS = [
    './',
    './index.html',
    './app.js',
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

// Intercept Requests
self.addEventListener('fetch', (e) => {
    // Hanya tangani metode GET
    if (e.request.method !== 'GET') return;
    
    // Abaikan API Google Apps Script & URL non-HTTP
    if (e.request.url.includes('script.google.com') || !e.request.url.startsWith('http')) {
        return;
    }

    // Strategi Navigation/Page: Network-First dengan Fallback Offline
    if (e.request.mode === 'navigate' || (e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html'))) {
        e.respondWith(
            fetch(e.request)
                .then((response) => {
                    if (response && response.status === 200) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(e.request).then((res) => res || caches.match('./index.html') || caches.match('./'));
                })
        );
        return;
    }

    // Strategi Asset: Cache First dengan Network Fallback & Background Update
    e.respondWith(
        caches.match(e.request).then((cachedResponse) => {
            const fetchPromise = fetch(e.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const copy = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
                }
                return networkResponse;
            }).catch(() => null);

            return cachedResponse || fetchPromise;
        })
    );
});