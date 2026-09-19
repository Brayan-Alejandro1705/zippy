import { LocalNotifications } from '@capacitor/local-notifications';
import { usuariosService } from '../config/api';

let yaRegistrado = false;

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
          }],
        });
      } catch (e) {
        console.warn('No se pudo mostrar la notificacion en primer plano:', e);
      }
    });

    const { token } = await FirebaseMessaging.getToken();
    await guardarToken(token);
    yaRegistrado = true;
  } catch (e) {
    console.warn('Notificaciones push no disponibles:', e);
  }
};
