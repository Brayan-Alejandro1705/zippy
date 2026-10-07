import React, { useState, useEffect } from 'react';

/*
 * Franja de "sin conexión" para la app del cliente.
 *
 * Es el aviso de dentro de la app: la pantalla ya cargó y de pronto se cae la
 * señal, asi que no se recarga nada —no se dispara el service worker— pero los
 * botones dejan de responder y parece que la app se trabó. Esto lo explica.
 *
 * Si la app ni siquiera alcanza a cargar, de eso se encarga public/sw.js con
 * la pantalla sin-internet.html.
 */
const AvisoSinConexion = () => {
  const [sinRed, setSinRed] = useState(() => navigator.onLine === false);

  useEffect(() => {
    const cayo = () => setSinRed(true);
    const volvio = () => setSinRed(false);
    window.addEventListener('offline', cayo);
    window.addEventListener('online', volvio);
    return () => {
      window.removeEventListener('offline', cayo);
      window.removeEventListener('online', volvio);
    };
  }, []);

  if (!sinRed) return null;

  return (
    <div className="aviso-sin-red" role="status">
      Sin internet. Revisa los datos o el wifi.
    </div>
  );
};

export default AvisoSinConexion;
