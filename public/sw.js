// v2: red primero, caché solo como respaldo sin conexión. Antes, los
// archivos que no eran la navegación principal (JS, CSS, index.html
// precacheado en la instalación) se servían directamente desde la
// caché sin esperar a la red ("cached || network"), y en el móvil
// instalado en pantalla de inicio (iOS en concreto) las peticiones no
// siempre se detectan como "navigate", así que caían en esa rama y
// se quedaban ancladas para siempre en la versión con la que se
// instaló la app la primera vez, aunque hubiera una nueva desplegada.
// Con red primero en TODO, la app siempre coge lo último si hay
// conexión, y la caché solo entra en juego sin internet.
const CACHE_NAME = "cash-lojo-shell-v2";
const APP_SHELL = ["/logo192.png", "/logo512.png", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const esNavegacion = event.request.mode === "navigate";

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Sin conexión y sin nada guardado de esta URL: en una
          // navegación (abrir la app), al menos se intenta servir el
          // index.html que hubiera en caché, para no dejar la pantalla
          // en blanco.
          return esNavegacion ? caches.match("/index.html") : undefined;
        })
      )
  );
});

