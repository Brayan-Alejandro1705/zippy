import { LocalNotifications } from '@capacitor/local-notifications';
import { usuariosService, API_BASE_URL } from '../config/api';
import {
  listarCuentas,
  activarCuenta,
  actualizarAccessCuenta,
  guardarCuentaActual,
  olvidarCuenta,
  rutaPorTipo,
} from './cuentas';

let yaRegistrado = false;

// Token de Firebase de ESTE celular y las cuentas guardadas que ya lo tienen
// en el servidor (son las que muestran "Recibe avisos" en Cambiar de cuenta).
const TOKEN_KEY   = 'push_token';
const CUENTAS_KEY = 'push_cuentas';
// Aviso tocado que obligo a cambiar de cuenta: se atiende despues de recargar.
const PENDIENTE_KEY = 'push_pendiente';

const leerJSON = (clave, defecto) => {
  try { return JSON.parse(localStorage.getItem(clave)) ?? defecto; } catch { return defecto; }
};
const usuarioActualId = () => leerJSON('usuario', {})?.id || null;

/** Ids de las cuentas guardadas que reciben avisos en este celular. */
export const cuentasConAvisos = () => leerJSON(CUENTAS_KEY, []);
const marcarCuenta = (id, recibe) => {
  const ids = new Set(cuentasConAvisos());
  if (recibe) ids.add(id); else ids.delete(id);
  localStorage.setItem(CUENTAS_KEY, JSON.stringify([...ids]));
};

/*
 * Llama al servidor EN NOMBRE de una cuenta guardada que puede no ser la
 * activa. No usa el cliente `api` a proposito: ese le pone el token de la
 * sesion activa y, si recibe un 401, renueva la sesion activa; aqui hay que
 * hablar con las llaves de esa otra cuenta.
 */
const comoCuenta = async (cuenta, ruta, metodo, cuerpo) => {
  const enviar = (accessToken) => fetch(`${API_BASE_URL}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(cuerpo),
    // Sigue viva aunque la pantalla cambie (al cerrar sesion se sale de una)
    keepalive: true,
  });
  try {
    let r = await enviar(cuenta.access_token);
    if (r.status === 401 && cuenta.refresh_token) {
      const rr = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: cuenta.refresh_token }),
      });
      if (!rr.ok) return false;
      const { access_token } = await rr.json();
      if (!access_token) return false;
      actualizarAccessCuenta(cuenta.usuario.id, access_token);
      r = await enviar(access_token);
    }
    return r.ok;
  } catch (e) {
    return false;
  }
};

const ponerTokenEnCuenta = (cuenta, fcmToken) =>
  comoCuenta(cuenta, '/usuarios/me/', 'PUT', { fcm_token: fcmToken });

// Borra el token solo si en el servidor sigue siendo el de ESTE celular: si
// la cuenta ya entro desde otro telefono, ese otro sigue recibiendo.
const quitarTokenDeCuenta = (cuenta, fcmToken) =>
  comoCuenta(cuenta, '/usuarios/me/soltar-push/', 'POST', { fcm_token: fcmToken });

/*
 * A donde lleva la notificacion cuando la tocan.
 *
 * Antes tocar el aviso solo abria la app en la pantalla de inicio, y el
 * cliente tenia que ir a buscar el mandado para contestarle al repartidor.
 * El aviso ya trae en `data` el tipo y el id de lo relacionado (lo manda
 * backend/push.py), asi que la pantalla que sepa atenderlo abre el chat de
 * una.
 *
 * Por que una lista de suscriptores y no navegar aqui mismo: este archivo se
 * carga antes que React y no tiene el router a mano, y de todas formas quien
 * sabe que hacer con el aviso es la pantalla (la del cliente abre su burbuja,
 * la del repartidor la suya).
 *
 * `pendiente` es para el arranque en frio: si la app estaba cerrada, el toque
 * llega antes de que se monte cualquier pantalla. Se guarda y se le entrega
 * al primero que lo reclame devolviendo true.
 */
let pendiente = null;
let suscriptores = [];

const repartirToque = (datos) => {
  if (!datos) return;

  // El aviso es de otra cuenta guardada en este celular (por ejemplo, llega
  // un "Pedido por validar" mientras la persona esta en su perfil de
  // cliente): se pasa a esa cuenta y el aviso se atiende al recargar.
  const destino = datos.usuario_id;
  if (destino && usuarioActualId() && destino !== usuarioActualId()) {
    const usuario = activarCuenta(destino);
    if (usuario) {
      sessionStorage.setItem(PENDIENTE_KEY, JSON.stringify({ ...datos, cambio_cuenta: '1' }));
      window.location.replace(rutaPorTipo(usuario.tipo_usuario));
      return;
    }
    // Si esa cuenta ya no esta guardada aqui, se atiende con la actual.
  }

  const reclamado = suscriptores.some((fn) => {
    try {
      return fn(datos) === true;
    } catch (e) {
      return false;
    }
  });
  pendiente = reclamado ? null : datos;
};

/**
 * Avisa cuando la persona toca una notificacion. El callback recibe el `data`
 * del aviso ({ tipo, relacionado_id }) y devuelve true si lo atendio; si
 * devuelve false el aviso queda guardado para la siguiente pantalla.
 * Devuelve la funcion para darse de baja.
 */
export const alTocarNotificacion = (fn) => {
  suscriptores.push(fn);
  if (pendiente) {
    let reclamado = false;
    try {
      reclamado = fn(pendiente) === true;
    } catch (e) {
      reclamado = false;
    }
    if (reclamado) pendiente = null;
  }
  return () => { suscriptores = suscriptores.filter((s) => s !== fn); };
};

/**
 * Guarda en el backend el token de este dispositivo (PUT /usuarios/me/, campo
 * fcm_token). Es la direccion a la que Firebase le manda las notificaciones.
 *
 * Oct 2026: se guarda en TODAS las cuentas guardadas en este celular, no solo
 * en la activa. Asi el aviso de super admin suena aunque la persona este en
 * su perfil de cliente, de negocio o de repartidor.
 */
const guardarToken = async (token) => {
  if (!token) return;
  localStorage.setItem(TOKEN_KEY, token);

  const actual = usuarioActualId();
  try {
    await usuariosService.actualizarPerfil({ fcm_token: token });
    if (actual) marcarCuenta(actual, true);
  } catch (e) {
    console.warn('No se pudo guardar el token de push:', e);
  }

  for (const cuenta of listarCuentas()) {
    const id = cuenta?.usuario?.id;
    if (!id || id === actual) continue;
    // eslint-disable-next-line no-await-in-loop
    const ok = await ponerTokenEnCuenta(cuenta, token);
    marcarCuenta(id, ok);
  }
};

/*
 * Deja de sonar en este celular para una cuenta: se usa al cerrar sesion y al
 * quitar una cuenta de "Cambiar de cuenta". Antes, quien cerraba sesion en un
 * celular le seguian llegando ahi los avisos de su cuenta.
 *
 * Solo se borra si el token guardado es el de este celular (ver
 * quitarTokenDeCuenta).
 */
export const dejarDeAvisar = (cuenta) => {
  const id = cuenta?.usuario?.id;
  if (!id) return;
  marcarCuenta(id, false);
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  quitarTokenDeCuenta(cuenta, token);
};

/** Igual que dejarDeAvisar, para la sesion activa (llamarlo ANTES de borrarla). */
export const dejarDeAvisarCuentaActual = () => {
  const usuario = leerJSON('usuario', null);
  const access_token = localStorage.getItem('access_token');
  if (!usuario?.id || !access_token) return;
  dejarDeAvisar({ usuario, access_token, refresh_token: localStorage.getItem('refresh_token') });
};

/*
 * Para los botones de "Cerrar sesion": este celular deja de recibir los avisos
 * de la cuenta y la cuenta sale de "Cambiar de cuenta". Si se quedara en la
 * lista, la proxima vez que se abriera la app volveria a recibir avisos.
 * Llamarlo ANTES de borrar la sesion.
 */
export const cerrarSesionAqui = () => {
  const id = usuarioActualId();
  dejarDeAvisarCuentaActual();
  if (id) olvidarCuenta(id);
};

/**
 * Pide permiso de notificaciones y registra el token de este dispositivo. Se
 * usa en las pantallas de los cuatro perfiles (cliente, vendedor, repartidor
 * y, desde oct 2026, super admin).
 *
 * Usa @capacitor-firebase/messaging en vez de @capacitor/push-notifications
 * porque aquel devolvia el token de APNs en iPhone, y el backend manda las
 * notificaciones por Firebase, que solo entiende tokens de FCM. Este plugin
 * devuelve token de FCM en los dos sistemas.
 *
 * No hace nada en web (Capacitor.isNativePlatform() = false) ni si ya se
 * registro una vez en esta sesion de la app.
 */
export const registrarPush = async () => {
  if (yaRegistrado) return;
  if (!window.Capacitor?.isNativePlatform?.()) return;
  // La sesion activa tiene que estar en la lista para recibir el token junto
  // con las demas cuentas del celular.
  guardarCuentaActual();

  try {
    // Se carga aparte a proposito: el SDK de Firebase pesa bastante y asi no
    // entra en el paquete principal, que es el que baja el celular al abrir.
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');

    let permiso = await FirebaseMessaging.checkPermissions();
    if (permiso.receive !== 'granted') {
      permiso = await FirebaseMessaging.requestPermissions();
    }
    if (permiso.receive !== 'granted') return;

    // Firebase renueva el token por su cuenta cada cierto tiempo; si no lo
    // volvemos a guardar, el telefono deja de recibir avisos.
    await FirebaseMessaging.addListener('tokenReceived', (evento) => {
      guardarToken(evento?.token);
    });

    // Con la app en primer plano Android NO muestra la notificacion solo, hay
    // que dibujarla con una notificacion local. En iPhone de eso se encarga
    // presentationOptions (ver capacitor.config.ts), asi que ahi no se repite.
    await FirebaseMessaging.addListener('notificationReceived', async (evento) => {
      const aviso = evento?.notification || {};
      // Las pantallas abiertas se enteran al instante (Validacion recarga su
      // lista y el menu del admin su contador) sin esperar su revision.
      try {
        window.dispatchEvent(new CustomEvent('zippy-aviso', { detail: aviso.data || {} }));
      } catch (e) { /* navegador viejo: no pasa nada, se enteran en su revision */ }
      if (window.Capacitor?.getPlatform?.() !== 'android') return;
      try {
        await LocalNotifications.schedule({
          notifications: [{
            id: Date.now() % 2147483647,
            title: aviso.title || 'Zippy',
            body: aviso.body || '',
            smallIcon: 'ic_launcher',
            sound: 'default',
            // Se copia el `data` del aviso para que al tocarlo tambien se
            // pueda abrir el chat; esta notificacion la dibujamos nosotros y
            // Firebase ya no sabe nada de ella.
            extra: aviso.data || {},
          }],
        });
      } catch (e) {
        console.warn('No se pudo mostrar la notificacion en primer plano:', e);
      }
    });

    // Toque del aviso con la app cerrada o en segundo plano
    await FirebaseMessaging.addListener('notificationActionPerformed', (evento) => {
      repartirToque(evento?.notification?.data);
    });

    // En Android con la app abierta el aviso lo dibuja LocalNotifications (ver
    // arriba), asi que el toque lo avisa ese plugin y no Firebase.
    try {
      await LocalNotifications.addListener('localNotificationActionPerformed', (evento) => {
        repartirToque(evento?.notification?.extra);
      });
    } catch (e) {
      console.warn('No se pudo escuchar el toque de la notificacion local:', e);
    }

    // Aviso tocado que nos hizo cambiar de cuenta y recargar: ahora que ya
    // estamos en la cuenta correcta, se le entrega a la pantalla que lo atienda.
    const pendienteTrasCambio = sessionStorage.getItem(PENDIENTE_KEY);
    if (pendienteTrasCambio) {
      sessionStorage.removeItem(PENDIENTE_KEY);
      try { repartirToque(JSON.parse(pendienteTrasCambio)); } catch (e) { /* aviso danado */ }
    }

    const { token } = await FirebaseMessaging.getToken();
    yaRegistrado = true;
    await guardarToken(token);
  } catch (e) {
    console.warn('Notificaciones push no disponibles:', e);
  }
};
