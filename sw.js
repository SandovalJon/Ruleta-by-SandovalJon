const CACHE_NAME = 'ruleta-v20';
const urlsToCache = [
    '/Ruleta-by-SandovalJon/',
    '/Ruleta-by-SandovalJon/index.html',
    '/Ruleta-by-SandovalJon/manifest.json',
    '/Ruleta-by-SandovalJon/icon-192.png',
    '/Ruleta-by-SandovalJon/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // No cachear peticiones externas (Firebase, CDN, etc.)
    if (url.origin !== location.origin) {
        return;
    }

    // Navegación (HTML): network-first con fallback a caché
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request).then((cached) => {
                        return cached || caches.match('/Ruleta-by-SandovalJon/index.html');
                    });
                })
        );
        return;
    }

    // Otros assets locales: stale-while-revalidate
    event.respondWith(
        caches.match(event.request).then((cached) => {
            const networkFetch = fetch(event.request)
                .then((response) => {
                    if (response && response.status === 200) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
                    }
                    return response;
                })
                .catch(() => cached);
            return cached || networkFetch;
        })
    );
});
