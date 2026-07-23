import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ordenesService } from '../config/api';
import Icon from './Icons';
import '../styles/OrdenChat.css';

const POLL_MS = 4000;

const AVISO = {
  sin_domiciliario: 'El chat se habilita cuando un repartidor tome tu pedido.',
  cerrado:          'El pedido finalizó. Puedes leer la conversación, pero ya no se pueden enviar mensajes.',
  expirado:         'Esta conversación se eliminó una hora después de la entrega.',
};

const OrdenChat = ({ ordenId }) => {
  const [mensajes, setMensajes] = useState([]);
  const [estado, setEstado]     = useState(null);
  const [texto, setTexto]       = useState('');
  const [sending, setSending]   = useState(false);
  const listRef = useRef(null);

  const activo = estado === 'activo';

  const cargar = useCallback(async () => {
    try {
      const [est, msgs] = await Promise.all([
        ordenesService.estadoChat(ordenId),
        ordenesService.mensajes(ordenId),
      ]);
      setEstado(est.data.estado);
      setMensajes(msgs.data);
    } catch { /* sin permiso o sin conexión */ }
  }, [ordenId]);

  useEffect(() => {
    if (!ordenId) return;
    cargar();
    const interval = setInterval(cargar, POLL_MS);
    return () => clearInterval(interval);
  }, [ordenId, cargar]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [mensajes]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const contenido = texto.trim();
    if (!contenido || sending || !activo) return;
    setSending(true);
    setTexto('');
    try {
      const { data } = await ordenesService.enviarMensaje(ordenId, contenido);
      setMensajes(prev => [...prev, data]);
    } catch (err) {
      setTexto(contenido);
      // Si el pedido se cerró mientras escribía, refrescamos el estado real
      if (err?.response?.status === 403) cargar();
    } finally {
      setSending(false);
    }
  };

  const aviso = !activo && estado ? AVISO[estado] : null;

  return (
    <div className="oc-chat">
      <div className="oc-list" ref={listRef}>
        {mensajes.length === 0 ? (
          <p className="oc-empty">
            {aviso || 'Aún no hay mensajes. Escribe para iniciar la conversación.'}
          </p>
        ) : (
          mensajes.map(m => (
            <div key={m.id} className={`oc-bubble-row ${m.es_mio ? 'oc-bubble-row--mine' : ''}`}>
              <div className={`oc-bubble ${m.es_mio ? 'oc-bubble--mine' : ''}`}>
                <p className="oc-bubble-text">{m.contenido}</p>
                <span className="oc-bubble-time">
                  {new Date(m.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {activo ? (
        <form className="oc-input-row" onSubmit={handleSubmit}>
          <input
            className="oc-input"
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Escribe un mensaje..."
            maxLength={1000}
          />
          <button type="submit" className="oc-send-btn" disabled={sending || !texto.trim()} aria-label="Enviar mensaje">
            <Icon name="enviar" size={17} />
          </button>
        </form>
      ) : mensajes.length > 0 && aviso ? (
        <div className="oc-aviso">
          <Icon name="candado" size={14} />
          <span>{aviso}</span>
        </div>
      ) : null}
    </div>
  );
};

export default OrdenChat;