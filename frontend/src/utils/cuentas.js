// Selector de cuentas guardadas: permite tener varias sesiones en el mismo
// dispositivo (ej. admin y súper admin) y saltar entre ellas sin volver a
// escribir la contraseña.

const KEY = 'cuentas_guardadas';
const MAX_CUENTAS = 5;

const leer = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
};

const escribir = (lista) => localStorage.setItem(KEY, JSON.stringify(lista));

/** Guarda la sesión activa actual (la que hay en localStorage) en la lista de cuentas. */
export const guardarCuentaActual = () => {
  const access_token  = localStorage.getItem('access_token');
  const refresh_token = localStorage.getItem('refresh_token');
  const usuarioRaw    = localStorage.getItem('usuario');
  if (!access_token || !usuarioRaw) return;

  let usuario;
  try { usuario = JSON.parse(usuarioRaw); } catch { return; }
  if (!usuario?.id) return;

  const lista = leer().filter(c => c.usuario.id !== usuario.id);
  lista.unshift({ usuario, access_token, refresh_token });
  escribir(lista.slice(0, MAX_CUENTAS));
};

export const listarCuentas = () => leer();

/**
 * Cuando el access token de la sesión activa se renueva (auto-refresh en
 * api.js), actualiza también la copia guardada en la lista de cuentas.
 * Sin esto, al volver a esta cuenta se restauraba un token ya vencido.
 */
export const sincronizarAccessToken = (accessToken) => {
  const usuarioRaw = localStorage.getItem('usuario');
  if (!usuarioRaw || !accessToken) return;

  let usuario;
  try { usuario = JSON.parse(usuarioRaw); } catch { return; }
  if (!usuario?.id) return;

  const lista = leer();
  const cuenta = lista.find(c => c.usuario.id === usuario.id);
  if (!cuenta) return;
  cuenta.access_token = accessToken;
  escribir(lista);
};

/** Activa una cuenta guardada como la sesión actual. Devuelve el usuario activado, o null. */
export const activarCuenta = (usuarioId) => {
  const cuenta = leer().find(c => c.usuario.id === usuarioId);
  if (!cuenta) return null;

  localStorage.setItem('access_token',  cuenta.access_token);
  localStorage.setItem('refresh_token', cuenta.refresh_token);
  localStorage.setItem('usuario',       JSON.stringify(cuenta.usuario));
  return cuenta.usuario;
};

export const olvidarCuenta = (usuarioId) => {
  escribir(leer().filter(c => c.usuario.id !== usuarioId));
};

export const rutaPorTipo = (tipo) => {
  if (tipo === 'admin')        return '/dashboard';
  if (tipo === 'vendedor')     return '/vendor/productos';
  if (tipo === 'domiciliario') return '/repartidor';
  return '/tienda';
};
