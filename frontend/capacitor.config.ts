import type { CapacitorConfig } from '@capacitor/cli';

// Android carga el frontend desde Render (server.url), por eso los cambios de la
// web llegan al celular sin recompilar ni volver a pasar por Play Store.
//
// iOS no puede trabajar asi: Apple rechaza las apps que cargan toda su interfaz
// desde un servidor web y las que traen codigo de afuera que cambia lo que hace
// la app. Por eso el workflow de iOS compila con CAP_BUNDLED=1, que mete el
// frontend dentro del .ipa. El costo es que en iPhone cada cambio necesita una
// version nueva revisada por Apple.
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
    }
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
