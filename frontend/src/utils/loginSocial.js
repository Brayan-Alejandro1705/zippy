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
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
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

// OJO: el plugin se importa normal, no con import() dentro de una funcion
// async. Los plugins de Capacitor son un "Proxy" que responde a cualquier
// nombre, incluido "then"; al devolverlo desde una funcion async, JavaScript
// lo confunde con una promesa, llama a plugin.then() en el celular (metodo que
// no existe) y se queda esperando para siempre. Eso era el "Conectando…"
// infinito del boton de Google.

const esCancelacion = (err) => {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('cancel') || msg.includes('1001') || msg.includes('12501');
};

// Google en Android. Primero se intenta con Credential Manager (la ventanita
// nueva de Google). En algunos celulares esa llamada no muestra nada y nunca
// responde: el boton se quedaba en "Conectando…" para siempre. Por eso:
//   - Si en 8 segundos no se abrio ninguna ventana (la app no paso a segundo
//     plano), se usa el selector de cuentas clasico de Google.
//   - Si Credential Manager falla (por ejemplo, no hay cuentas guardadas),
//     tambien se usa el selector clasico, que deja agregar una cuenta.
const googleEnAndroid = async (FirebaseAuthentication) => {
  const { App } = await import('@capacitor/app');
  let seAbrioVentana = false;
  const escucha = await App.addListener('pause', () => { seAbrioVentana = true; });
  try {
    const intento = FirebaseAuthentication.signInWithGoogle()
      .then(valor => ({ valor }), error => ({ error }));
    const primero = await Promise.race([
      intento,
      new Promise(listo => setTimeout(() => listo({ sinRespuesta: true }), 8000)),
    ]);

    let r = primero;
    // Hubo ventana pero la persona sigue eligiendo: se espera lo que tarde
    if (primero.sinRespuesta && seAbrioVentana) r = await intento;

    if (r.valor) return r.valor;
    if (r.error && esCancelacion(r.error)) throw r.error;
    // Sin ventana o con error: selector clasico
    // Si tampoco abre nada en 20 s, se corta (si abre, la app pasa a segundo
    // plano y el reloj se detiene mientras la persona elige).
    seAbrioVentana = false;
    const clasico = FirebaseAuthentication.signInWithGoogle({ useCredentialManager: false });
    const r2 = await Promise.race([
      clasico.then(valor => ({ valor }), error => ({ error })),
      new Promise(listo => setTimeout(() => listo({ sinRespuesta: true }), 20000)),
    ]);
    if (r2.sinRespuesta && seAbrioVentana) return await clasico;
    if (r2.valor) return r2.valor;
    if (r2.error) throw r2.error;
    const e = new Error('sin respuesta en "google"');
    e.code = r.error ? `google-${r.error.code || 'error'}` : 'sin-respuesta-google';
    throw e;
  } finally {
    escucha.remove();
  }
};

/**
 * Inicia sesion con 'google' o 'apple'. Devuelve { usuario, nuevo } o null si
 * la persona cerro la ventana sin elegir cuenta. Lanza Error con un mensaje
 * para mostrar si algo fallo.
 */
// Si un paso no responde en el tiempo dado, se corta con un error que dice
// cual fue. Asi el boton nunca se queda en "Conectando…" para siempre y la
// captura del mensaje dice exactamente donde se trabo.
const conLimite = (promesa, ms, paso) => Promise.race([
  promesa,
  new Promise((_, mal) => setTimeout(() => {
    const e = new Error(`sin respuesta en "${paso}"`);
    e.code = `sin-respuesta-${paso}`;
    mal(e);
  }, ms)),
]);

export const entrarConProveedor = async (proveedor) => {
  try {
    // Prueba rapida: si el plugin nativo no contesta ni esto, el problema es
    // el plugin (no la ventana de Google).
    await conLimite(FirebaseAuthentication.getCurrentUser(), 6000, 'plugin');
  } catch (err) {
    throw new Error(`No se pudo abrir el inicio de sesión. (${err.code || err.message})`);
  }
  let resultado;
  try {
    if (proveedor === 'apple') {
      resultado = await FirebaseAuthentication.signInWithApple({ scopes: ['email', 'name'] });
    } else if (plataforma() === 'android') {
      resultado = await googleEnAndroid(FirebaseAuthentication);
    } else {
      resultado = await FirebaseAuthentication.signInWithGoogle();
    }
  } catch (err) {
    // Cerro la ventana o toco "Cancelar": no es un error que haya que mostrar
    if (esCancelacion(err)) return null;
    // El codigo entre parentesis ayuda a saber que paso si alguien lo reporta
    const codigo = err?.code || String(err?.message || '').slice(0, 60);
    throw new Error(`No se pudo abrir el inicio de sesión. Intenta de nuevo.${codigo ? ` (${codigo})` : ''}`);
  }

  let token;
  try {
    ({ token } = await conLimite(FirebaseAuthentication.getIdToken({ forceRefresh: false }), 15000, 'token'));
  } catch (err) {
    FirebaseAuthentication.signOut().catch(() => {});
    throw new Error(`No se pudo completar el inicio de sesión. (${err.code || err.message})`);
  }
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
    const r = await FirebaseAuthentication.signInWithApple();
    const codigo = r?.credential?.authorizationCode;
    if (codigo) await FirebaseAuthentication.revokeAccessToken({ token: codigo });
    await FirebaseAuthentication.signOut();
  } catch { /* no bloquea la eliminacion */ }
};
