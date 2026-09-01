import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { usuariosService } from '../config/api';

let yaRegistrado = false;

/**
 * Pide permiso de notificaciones y registra el token de este dispositivo en
 * el backend (PUT /usuarios/me/, campo fcm_token). Se usa en las pantallas de cliente, vendedor y repartidor, que son las que reciben avisos de pedidos.
 *
 * No hace nada en web (Capacitor.isNativePlatform() = false) ni si ya se
 * registró una vez en esta sesión de la app.
 */
export const registrarPush = async () => {
  if (yaRegistrado) return;
  if (!window.Capacitor?.isNativePlatform?.()) return;

  try {
    let permiso = await PushNotifications.checkPermissions();
    if (permiso.receive !== 'granted') {
      permiso = await PushNotifications.requestPermissions();
    }
    if (permiso.receive !== 'granted') return;

    // El listener debe registrarse antes de llamar a register()
    PushNotifications.addListener('registration', async (token) => {
      try {
        await usuariosService.actualizarPerfil({ fcm_token: token.value });
      } catch (e) {
        console.warn('No se pudo guardar el token de push:', e);
      }
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.warn('Error registrando push:', err);
    });

    // Con la app en primer plano, Android/iOS NO muestran la notificacion
    // sola en la barra -- hay que mostrarla nosotros con una notificacion
    // local. En segundo plano o con la app cerrada, el sistema ya la
    // muestra automatico y este listener no se dispara.
    PushNotifications.addListener('pushNotificationReceived', async (notification) => {
      try {
        await LocalNotifications.schedule({
          notifications: [{
            id: Date.now() % 2147483647,
            title: notification.title || 'Zippy',
            body: notification.body || '',
            smallIcon: 'ic_launcher',
            sound: 'default',
          }],
        });
      } catch (e) {
        console.warn('No se pudo mostrar la notificacion en primer plano:', e);
      }
    });

    await PushNotifications.register();
    yaRegistrado = true;
  } catch (e) {
    console.warn('Notificaciones push no disponibles:', e);
  }
};