/*
 * Service worker de ZIPPYGO — hace UNA sola cosa.
 *
 * Android carga el frontend desde Render (server.url en capacitor.config.ts),
 * asi que sin internet la app mostraba el aviso gris del navegador: "Pagina
 * web no disponible · net::ERR_INTERNET_DISCONNECTED". Para el repartidor en
 * la calle eso parece que la app se dañó, no que se le fue la señal.
 *
 * Este archivo guarda sin-internet.html y la devuelve cuando la carga de una
 * pantalla falla por falta de red.
 *
 * MUY IMPORTANTE, no ampliar esto a cachear la app entera: los cambios de la
 * web le llegan a Android sin recompilar justamente porque NO hay nada
 * guardado. Si aqui se empieza a servir JS o CSS del cache, el celular se
 * queda con una version vieja y no hay forma facil de sacarlo de ahi.
 *
 * Por eso:
 *   - Solo se interceptan las navegaciones (request.mode === 'navigate').
 *   - Todo lo demas (JS, CSS, imagenes, API) pasa derecho a la red.
 *   - Solo se responde del cache cuando la red FALLA.
 */

// Al subir este numero se descarta el cache anterior.
const CACHE = 'zippy-sin-internet-v1';
const PAGINA = '/sin-internet.html';

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll([PAGINA]))
      // Entra a trabajar de una, sin esperar a que cierren la app.
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(
        nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
      .catch(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;

  // Solo las navegaciones: abrir la app o cambiar de pantalla con recarga.
  if (peticion.mode !== 'navigate') return;

  evento.respondWith(
    // Siempre se intenta la red primero: la app nunca se sirve del cache.
    fetch(peticion).catch(() =>
      caches.match(PAGINA).then((guardada) =>
        guardada || new Response(
          '<h1>Sin conexión</h1><p>Revisa los datos o el wifi.</p>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
        )
      )
    )
  );
});
