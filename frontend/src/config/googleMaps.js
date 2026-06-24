// Configuración compartida para useLoadScript. Debe ser el mismo objeto/array
// en todas las páginas que carguen el mapa, porque el loader de Google Maps
// solo acepta una configuración por sesión de página: si dos componentes lo
// llaman con opciones distintas (p. ej. libraries diferentes), reinyecta el
// script y los custom elements de Maps fallan con "already defined".
export const MAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;
export const MAPS_LIBRARIES = ['geometry'];
export const GARZON = { lat: 2.1974, lng: -75.6246 };
