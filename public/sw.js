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

// Caché aparte para las fotos de producto (vienen de Supabase Storage,
// no del mismo origen). A diferencia del código de la app (que debe
// verse siempre lo último), una foto de producto casi nunca cambia una
// vez subida: aquí interesa justo lo contrario que arriba, servir
// directamente de caché si ya la teníamos (rapidísimo, sin gastar datos
// móviles) y de paso pedirla a la red para refrescarla por si acaso,
// en vez de esperar a la red primero. Con cientos de fotos en el
// catálogo, esto es lo que más nota un cliente que ya ha entrado antes.
// No se borra en cada despliegue (no se incluye en la limpieza del
// "activate" de abajo), para no perder lo ya descargado al actualizar
// la app.
const IMAGES_CACHE_NAME = "cash-lojo-images-v1";
const MAX_IMAGENES_EN_CACHE = 1200;

function esFotoDeProducto(url) {
  return url.hostname.endsWith(".supabase.co") && url.pathname.includes("/storage/v1/object/public/");
}

async function limitarTamanoCache(cacheName, maxEntradas) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntradas) return;
  // Las más antiguas son las primeras en añadirse a la caché; se van
  // borrando hasta volver al límite, para no crecer sin fin.
  const sobrantes = keys.length - maxEntradas;
  for (let i = 0; i < sobrantes; i += 1) {
    await cache.delete(keys[i]);
  }
}

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
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== IMAGES_CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Fotos de producto (Supabase Storage, otro origen): caché primero,
  // refrescando en segundo plano ("stale-while-revalidate").
  if (esFotoDeProducto(url)) {
    event.respondWith(
      caches.open(IMAGES_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        const network = fetch(event.request)
          .then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone());
              limitarTamanoCache(IMAGES_CACHE_NAME, MAX_IMAGENES_EN_CACHE);
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

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

