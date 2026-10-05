import type { CapacitorConfig } from '@capacitor/cli';

// Android carga el frontend desde Render (server.url), por eso los cambios de la
// web llegan al celular sin recompilar ni volver a pasar por Play Store.
//
// iOS no puede trabajar asi: Apple rechaza las apps que cargan toda su interfaz
// desde un servidor web y las que traen codigo de afuera que cambia lo que hace
// la app. Por eso el workflow de iOS compila con CAP_BUNDLED=1, que mete el
// frontend dentro del .ipa.
//
// Eso costaba una revision de Apple por cada boton que cambiara (la primera vez,
// nueve dias de espera). El actualizador lo arregla: en la version empaquetada
// descarga el frontend nuevo y lo aplica la proxima vez que abran la app. Apple
// lo permite porque solo cambia HTML, CSS y JavaScript; un plugin nativo nuevo
// sigue necesitando version nueva y revision.
//
// El plugin es de Capgo pero NO usamos su servicio de pago: apunta a nuestro
// propio servidor (backend/routes_actualizaciones.py), que guarda los paquetes
// en el mismo Supabase donde ya viven las fotos de los productos. Cero
// mensualidad y ninguna dependencia de un tercero.
//
// OJO: estas direcciones quedan grabadas dentro del .ipa. Cambiarlas despues
// obliga a compilar y pasar por Apple otra vez, asi que no son cosa de tocar a
// la ligera.
const empaquetado = process.env.CAP_BUNDLED === '1';

const config: CapacitorConfig = {
  appId: 'com.zippygo.app',
  appName: 'ZIPPYGO',
  webDir: 'build',
  plugins: {
    // Como se muestra una notificacion que llega con la app abierta en iPhone.
    // En Android el sistema no la muestra solo: ahi la dibujamos nosotros con
    // una notificacion local (ver src/utils/push.js).
    FirebaseMessaging: {
      presentationOptions: ['alert', 'badge', 'sound']
    },
    // Solo en la version empaquetada (iOS). En Android el frontend ya viene del
    // servidor, asi que ahi el actualizador no tendria nada que hacer.
    ...(empaquetado ? {
      CapacitorUpdater: {
        // Nuestro servidor, no el de Capgo.
        updateUrl: 'https://zippy-eedd.onrender.com/api/v1/actualizaciones/check',
        statsUrl: 'https://zippy-eedd.onrender.com/api/v1/actualizaciones/stats',
        // Descarga en segundo plano y aplica al reabrir la app: nadie se queda
        // mirando una barra de progreso por un cambio de pantalla.
        autoUpdate: true,
        directUpdate: false,
        // Margen para que la app alcance a decir "arranque bien". Si no lo dice
        // dentro de este tiempo, el plugin vuelve a la version anterior. Se deja
        // holgado porque en un celular lento con la primera carga, 10 segundos
        // se quedan cortos y revertiria actualizaciones que si funcionaban.
        appReadyTimeout: 15000,
        // Limpieza sola: lo que fallo y lo viejo no se quedan ocupando espacio.
        autoDeleteFailed: true,
        autoDeletePrevious: true,
        // Al instalar una version nueva desde la App Store se borra lo bajado
        // por aire. Si no, una actualizacion vieja podria tapar la nueva.
        resetWhenUpdate: true,
      },
    } : {}),
  },
  // En iOS el proyecto se arma con Swift Package Manager. Sin este symlink, el
  // paquete de Firebase que trae el plugin choca por nombre con otro y el
  // proyecto no compila.
  experimental: {
    ios: {
      spm: {
        packageOptions: {
          '@capacitor-firebase/messaging': { symlink: true }
        }
      }
    }
  },
  ...(empaquetado ? {} : {
    server: {
      url: 'https://zippygo-app.onrender.com',
      cleartext: false
    }
  })
};

export default config;
