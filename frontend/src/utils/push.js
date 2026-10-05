import { LocalNotifications } from '@capacitor/local-notifications';
import { usuariosService } from '../config/api';

let yaRegistrado = false;

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
 */
const guardarToken = async (token) => {
  if (!token) return;
  try {
    await usuariosService.actualizarPerfil({ fcm_token: token });
  } catch (e) {
    console.warn('No se pudo guardar el token de push:', e);
  }
};

/**
 * Pide permiso de notificaciones y registra el token de este dispositivo. Se
 * usa en las pantallas de cliente, vendedor y repartidor, que son las que
 * reciben avisos de pedidos.
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
      if (window.Capacitor?.getPlatform?.() !== 'android') return;
      const aviso = evento?.notification || {};
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

    const { token } = await FirebaseMessaging.getToken();
    await guardarToken(token);
    yaRegistrado = true;
  } catch (e) {
    console.warn('Notificaciones push no disponibles:', e);
  }
};
