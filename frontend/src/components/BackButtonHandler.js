import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';

// En Android, el boton fisico (o el gesto) de "atras" por defecto cierra la
// app en vez de volver a la pantalla anterior. Este componente hace que
// primero intente retroceder en el historial (como en un navegador) y solo
// cierre la app cuando ya no hay a donde volver (ej: parado en la pantalla
// de inicio).
const BackButtonHandler = () => {
  useEffect(() => {
    let listenerHandle;
    let activo = true;

    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        CapacitorApp.exitApp();
      }
    }).then((handle) => {
      if (activo) listenerHandle = handle;
      else handle.remove();
    });

    return () => {
      activo = false;
      listenerHandle?.remove();
    };
  }, []);

  return null;
};

export default BackButtonHandler;
