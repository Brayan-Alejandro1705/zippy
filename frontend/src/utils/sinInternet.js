/*
 * Registra el service worker que muestra nuestra pantalla de "sin internet"
 * en vez del aviso gris del navegador. Lo que hace ese worker esta explicado
 * en public/sw.js, y es a proposito lo minimo posible.
 *
 * Solo se registra sobre https, que es como Android carga el frontend desde
 * Render. En iPhone la app va empaquetada y se abre con capacitor://, donde no
 * hay service workers — y tampoco hacen falta: ahi la pantalla ya viene dentro
 * del telefono y nunca falla por falta de red.
 */
export const registrarSinInternet = () => {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (window.location.protocol !== 'https:') return;

    // Se espera al load para no pelearse por la red con la primera pantalla.
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((e) => {
        console.warn('No se pudo registrar la pantalla de sin internet:', e);
      });
    });
  } catch (e) {
    console.warn('No se pudo registrar la pantalla de sin internet:', e);
  }
};
