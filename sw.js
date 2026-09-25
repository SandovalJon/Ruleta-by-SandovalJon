// Service worker de autodestrucción.
// Versiones anteriores quedaron atrapadas en caché en algunos dispositivos.
// Este SW borra todas las cachés, se desregistra y recarga la página.
self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
            .then(() => self.registration.unregister())
            .then(() => self.clients.matchAll({ type: 'window' }))
            .then((clients) => {
                clients.forEach((client) => {
                    if ('navigate' in client) client.navigate(client.url);
                });
            })
            .catch(() => {})
    );
});
