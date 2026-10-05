/*
 * Horas y fechas que llegan del servidor.
 *
 * El backend las guarda con datetime.utcnow(), o sea en hora universal, y las
 * manda en texto SIN la Z del final ("2026-10-05T22:30:00"). El navegador, al
 * no ver esa Z, da por hecho que ya es hora de aqui y no corrige nada: por eso
 * un mensaje escrito a la 1 de la tarde aparecia marcado a las 6.
 *
 * Toda fecha que venga del servidor pasa por aqui. Si ya trae zona horaria (Z
 * o +05:00) se respeta tal cual, para que el dia que el backend empiece a
 * mandarla completa esto siga funcionando sin tocar nada.
 */

// Termina en Z, en +05:00 o en -0500
const TIENE_ZONA = /(Z|[+-]\d{2}:?\d{2})$/i;
// Solo la fecha, sin hora: "2026-10-05". Esas el navegador ya las lee como
// universales, y agregarles la Z las volveria invalidas.
const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Convierte lo que mande el servidor en un Date de verdad, o null. */
export const fechaServidor = (valor) => {
  if (!valor) return null;
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
  const texto = String(valor).trim();
  const completo = (TIENE_ZONA.test(texto) || SOLO_FECHA.test(texto)) ? texto : `${texto}Z`;
  const fecha = new Date(completo);
  return isNaN(fecha.getTime()) ? null : fecha;
};

/** 3:05 p. m. */
export const hora = (valor) => {
  const f = fechaServidor(valor);
  return f ? f.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '';
};

/** 05/10/2026 */
export const fechaCorta = (valor) => {
  const f = fechaServidor(valor);
  return f ? f.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
};

/** 05 oct, 3:05 p. m. */
export const fechaHoraCorta = (valor) => {
  const f = fechaServidor(valor);
  return f ? f.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
};

/** 5/10/2026, 3:05:12 p. m. */
export const fechaHoraLarga = (valor) => {
  const f = fechaServidor(valor);
  return f ? f.toLocaleString('es-CO') : '';
};

/** Cuantos minutos han pasado desde ese momento. Nunca negativo. */
export const minutosDesde = (valor) => {
  const f = fechaServidor(valor);
  if (!f) return 0;
  return Math.max(0, Math.round((Date.now() - f.getTime()) / 60000));
};

/** Si eso paso hoy, en la hora de aqui y no en la del servidor. */
export const esHoy = (valor) => {
  const f = fechaServidor(valor);
  return !!f && f.toDateString() === new Date().toDateString();
};
