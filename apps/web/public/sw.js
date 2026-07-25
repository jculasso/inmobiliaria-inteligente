/* eslint-disable no-undef -- corre en el Service Worker, no en el browser ni en Node. */

/**
 * Service worker de la app instalable.
 *
 * Regla de oro: acá NO se cachea nada que dependa de quién está logueado.
 * La caché del service worker es por dispositivo, no por usuario: si se
 * guardaran respuestas de la API, en un celular compartido (o después de un
 * cambio de sesión) una persona podría ver datos de otra. Por eso solo se
 * cachea lo estático — archivos que son iguales para todo el mundo.
 *
 * Estrategias:
 *  - Estáticos con hash en el nombre (/_next/static) e íconos → cache-first.
 *    Nunca cambian sin cambiar de nombre, así que no se quedan viejos.
 *  - Todo lo demás (páginas, API, datos) → directo a la red, siempre.
 *    Cuando no hay conexión, las navegaciones muestran la pantalla offline.
 */

const VERSION = 'v2';
const CACHE_ESTATICOS = `estaticos-${VERSION}`;
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_ESTATICOS).then((cache) => cache.addAll([OFFLINE_URL, '/icons/icon-192.png'])),
  );
  // Toma el control apenas se instala: sin esto habría que cerrar todas las
  // pestañas para estrenar una versión nueva.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(claves.filter((c) => c !== CACHE_ESTATICOS).map((c) => caches.delete(c))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Solo se cachea lo que es idéntico para cualquier usuario. */
function esEstatico(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/'))
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (esEstatico(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            // Solo se guardan respuestas completas y correctas.
            if (res.ok && res.status === 200) {
              const copia = res.clone();
              caches.open(CACHE_ESTATICOS).then((cache) => cache.put(request, copia));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Navegaciones: siempre a la red, para que un cambio publicado se vea al
  // instante. Sin conexión, se muestra la pantalla offline.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Datos de la API y todo lo demás: sin caché, sin excepciones.
});

/** La página avisa cuando el usuario acepta estrenar la versión nueva. */
self.addEventListener('message', (event) => {
  if (event.data === 'ACTUALIZAR') self.skipWaiting();
});
