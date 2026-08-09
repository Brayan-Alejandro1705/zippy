import { PushNotifications } from '@capacitor/push-notifications';
import { usuariosService } from '../config/api';

let yaRegistrado = false;

/**
 * Pide permiso de notificaciones y registra el token de este dispositivo en
 * el backend (PUT /usuarios/me/, campo fcm_token). Se usa en las pantallas
 * de vendedor y repartidor, que son las que reciben avisos de pedidos.
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

    await PushNotifications.register();
    yaRegistrado = true;
  } catch (e) {
    console.warn('Notificaciones push no disponibles:', e);
  }
};