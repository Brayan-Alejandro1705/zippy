import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ordenesService } from '../config/api';
import '../styles/OrdenChat.css';

const POLL_MS = 4000;

const OrdenChat = ({ ordenId }) => {
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto]       = useState('');
  const [sending, setSending]   = useState(false);
  const listRef = useRef(null);

  const cargar = useCallback(async () => {
    try {
      const { data } = await ordenesService.mensajes(ordenId);
      setMensajes(data);
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
    if (!contenido || sending) return;
    setSending(true);
    setTexto('');
    try {
      const { data } = await ordenesService.enviarMensaje(ordenId, contenido);
      setMensajes(prev => [...prev, data]);
    } catch {
      setTexto(contenido);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="oc-chat">
      <div className="oc-list" ref={listRef}>
        {mensajes.length === 0 ? (
          <p className="oc-empty">Aún no hay mensajes. Escribe para iniciar la conversación.</p>
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

      <form className="oc-input-row" onSubmit={handleSubmit}>
        <input
          className="oc-input"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Escribe un mensaje..."
          maxLength={1000}
        />
        <button type="submit" className="oc-send-btn" disabled={sending || !texto.trim()}>➤</button>
      </form>
    </div>
  );
};

export default OrdenChat;
