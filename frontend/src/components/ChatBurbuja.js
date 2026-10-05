import React, { useState, useEffect, useRef } from 'react';
import OrdenChat from './OrdenChat';
import Icon from './Icons';
import '../styles/ChatBurbuja.css';

/*
 * ChatBurbuja - el chat del mandado, como burbuja flotante.
 *
 * Por que burbuja y no una pestaña: en un mandado el repartidor esta parado en
 * la tienda mirando la lista de lo que hay que comprar, y la duda le llega
 * justo ahi ("¿leche de cual?"). Si para escribir tiene que salirse de la
 * pantalla donde esta la lista, no escribe: llama o adivina. La burbuja deja
 * las dos cosas a la vista.
 *
 * Se cierra sola cuando el chat deja de estar activo, no: se queda abierta
 * mostrando el aviso, porque leer lo que se dijo sigue sirviendo.
 */

const POLL_AVISO_MS = 20000;

const ChatBurbuja = ({ id, servicio, titulo = 'Chat', onCerrar }) => {
  const [abierto, setAbierto] = useState(false);
  const [sinLeer, setSinLeer] = useState(0);
  // Cuantos mensajes habia la ultima vez que la persona miro el chat
  const vistos = useRef(0);

  // Mientras esta cerrada, se revisa de vez en cuando si llegaron mensajes.
  // Cada 20 segundos y no cada 4 como el chat abierto: cerrada no hay nadie
  // esperando el mensaje en pantalla, y asi no se gasta bateria ni datos.
  useEffect(() => {
    if (!id || !servicio || abierto) return;
    let activo = true;

    const revisar = () => {
      servicio.mensajes(id)
        .then(({ data }) => {
          if (!activo) return;
          const total = Array.isArray(data) ? data.length : 0;
          setSinLeer(Math.max(0, total - vistos.current));
        })
        .catch(() => {});
    };

    revisar();
    const t = setInterval(revisar, POLL_AVISO_MS);
    return () => { activo = false; clearInterval(t); };
  }, [id, servicio, abierto]);

  // Al abrir se da por leido todo lo que haya
  const abrir = () => {
    setAbierto(true);
    setSinLeer(0);
    servicio.mensajes(id)
      .then(({ data }) => { vistos.current = Array.isArray(data) ? data.length : 0; })
      .catch(() => {});
  };

  const cerrar = () => {
    setAbierto(false);
    servicio.mensajes(id)
      .then(({ data }) => { vistos.current = Array.isArray(data) ? data.length : 0; })
      .catch(() => {});
    if (onCerrar) onCerrar();
  };

  if (!id || !servicio) return null;

  return (
    <>
      {!abierto && (
        <button type="button" className="cb-burbuja" onClick={abrir} aria-label={`Abrir ${titulo}`}>
          <Icon name="chat" size={24} />
          {sinLeer > 0 && <span className="cb-sin-leer">{sinLeer > 9 ? '9+' : sinLeer}</span>}
        </button>
      )}

      {abierto && (
        <div className="cb-panel" role="dialog" aria-label={titulo}>
          <div className="cb-panel-header">
            <span className="cb-panel-titulo">
              <Icon name="chat" size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />
              {titulo}
            </span>
            <button type="button" className="cb-panel-cerrar" onClick={cerrar} aria-label="Cerrar chat">
              <Icon name="equis" size={16} />
            </button>
          </div>
          <div className="cb-panel-cuerpo">
            <OrdenChat ordenId={id} servicio={servicio} />
          </div>
        </div>
      )}
    </>
  );
};

export default ChatBurbuja;
