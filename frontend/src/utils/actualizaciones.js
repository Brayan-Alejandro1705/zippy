/*
 * actualizaciones.js - Avisarle a Capgo que la app arranco bien.
 *
 * Por que existe esto:
 *
 * En Android el frontend se carga desde el servidor, asi que un cambio de
 * pantalla llega al celular solo con publicar. En iPhone no se puede: Apple
 * rechaza las apps que cargan toda su interfaz desde una web, asi que la
 * nuestra lleva el frontend empaquetado por dentro. Resultado: cada vez que
 * cambiabamos un boton, los usuarios de iPhone tenian que esperar a que Apple
 * revisara una version nueva. La primera vez fueron nueve dias.
 *
 * Capgo resuelve eso: descarga el frontend nuevo por encima y lo aplica la
 * proxima vez que abran la app. Es legal ante Apple porque solo cambia HTML,
 * CSS y JavaScript; cualquier cosa nativa (un plugin nuevo, por ejemplo) sigue
 * necesitando version nueva y revision.
 *
 * El seguro que trae: si una actualizacion deja la app rota, el codigo nuevo
 * nunca alcanza a decir "arranque bien" y el plugin devuelve la version
 * anterior solo. Por eso esta funcion tiene que correr TEMPRANO y es lo
 * primero que hacemos al montar la app. Si se nos olvidara llamarla, todas las
 * actualizaciones se revertirian aunque estuvieran perfectas.
 */

export const avisarQueArranco = async () => {
  // En el navegador no hay plugin que avisar, y en Android no se usa Capgo
  // porque el frontend ya viene del servidor.
  if (!window.Capacitor?.isNativePlatform?.()) return;

  try {
    const modulo = await import('@capgo/capacitor-updater');
    await modulo.CapacitorUpdater.notifyAppReady();
  } catch (e) {
    // Que falle este aviso no puede tumbar la app. En el peor caso el plugin
    // decide volver a la version anterior, que es justo lo que debe hacer.
    console.warn('[actualizaciones] no se pudo avisar que la app arranco:', e);
  }
};

export default avisarQueArranco;
