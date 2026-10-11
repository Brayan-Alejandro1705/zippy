// ============================================================================
// loginSocial.js - "Continuar con Google" y "Continuar con Apple" (solo clientes)
//
// Como funciona:
//   1. El plugin nativo de Firebase abre la ventana de Google o de Apple del
//      propio celular (en un WebView Google ya no deja iniciar sesion).
//   2. Firebase entrega un "ID token" firmado, que se manda al backend
//      (/auth/social). El backend lo verifica y entra o crea la cuenta.
//   3. Se cierra la sesion de Firebase en el celular: a partir de ahi la app
//      usa sus propios tokens, igual que con correo y contrasena.
//
// Los botones solo aparecen en la app instalada y cuando el plugin existe.
// Un APK o una version de iPhone anteriores no lo traen: ahi los botones
// simplemente no salen (el frontend nuevo les llega por aire antes que la app
// nueva), en vez de mostrar un boton que falla.
//
// Apple: solo en iPhone. Su regla 4.8 exige ofrecer "Continuar con Apple" si
// se ofrece Google.
// ============================================================================

import { Capacitor } from '@capacitor/core';
import { authService } from '../config/api';
import { guardarCuentaActual } from './cuentas';

// Solo para tomar fotos de la pantalla en el navegador (npm start): con
// REACT_APP_VER_BOTONES_SOCIALES=ios o =android se dibujan los botones aunque
// no haya plugin. En la app real esta variable no existe.
const forzado = process.env.REACT_APP_VER_BOTONES_SOCIALES || '';

const plataforma = () => forzado || Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

const hayPlugin = () =>
  !!forzado || (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('FirebaseAuthentication'));

export const googleDisponible = () => hayPlugin() && ['ios', 'android'].includes(plataforma());
export const appleDisponible = () => hayPlugin() && plataforma() === 'ios';

const cargarPlugin = async () => (await import('@capacitor-firebase/authentication')).FirebaseAuthentication;

/**
 * Inicia sesion con 'google' o 'apple'. Devuelve { usuario, nuevo } o null si
 * la persona cerro la ventana sin elegir cuenta. Lanza Error con un mensaje
 * para mostrar si algo fallo.
 */
export const entrarConProveedor = async (proveedor) => {
  const FirebaseAuthentication = await cargarPlugin();
  let resultado;
  try {
    resultado = proveedor === 'apple'
      ? await FirebaseAuthentication.signInWithApple({ scopes: ['email', 'name'] })
      : await FirebaseAuthentication.signInWithGoogle();
  } catch (err) {
    const msg = String(err?.message || err || '').toLowerCase();
    // Cerro la ventana o toco "Cancelar": no es un error que haya que mostrar
    if (msg.includes('cancel') || msg.includes('1001') || msg.includes('12501')) return null;
    throw new Error('No se pudo abrir el inicio de sesión. Intenta de nuevo.');
  }

  const { token } = await FirebaseAuthentication.getIdToken({ forceRefresh: false });
  // Apple manda el nombre solo la primera vez: se reenvia para que el backend
  // no cree la cuenta como "Cliente".
  const nombre = resultado?.user?.displayName || resultado?.additionalUserInfo?.profile?.name || '';

  try {
    const { data } = await authService.social(token, nombre);
    guardarCuentaActual(); // conserva la sesion que estaba activa antes
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    guardarCuentaActual(); // registra la cuenta recien ingresada
    return { usuario: data.usuario, nuevo: !!data.nuevo };
  } catch (err) {
    const detalle = err.response?.data?.detail;
    throw new Error((typeof detalle === 'string' && detalle) || 'No pudimos entrar con esa cuenta.');
  } finally {
    // La sesion de Firebase ya no hace falta: la app usa sus propios tokens.
    FirebaseAuthentication.signOut().catch(() => {});
  }
};

/**
 * Apple exige que al eliminar una cuenta creada con su boton se revoque el
 * permiso que la persona dio. Para eso pide entrar otra vez con Apple (asi
 * Apple entrega un codigo nuevo) y se revoca. Si falla no se bloquea el
 * borrado: lo importante es que la cuenta se elimine.
 */
export const revocarApple = async () => {
  if (!appleDisponible() || forzado) return;
  try {
    const FirebaseAuthentication = await cargarPlugin();
    const r = await FirebaseAuthentication.signInWithApple();
    const codigo = r?.credential?.authorizationCode;
    if (codigo) await FirebaseAuthentication.revokeAccessToken({ token: codigo });
    await FirebaseAuthentication.signOut();
  } catch { /* no bloquea la eliminacion */ }
};
