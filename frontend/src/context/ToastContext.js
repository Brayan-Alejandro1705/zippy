import React, { createContext, useContext, useState, useCallback } from 'react';
import '../styles/Toast.css';

const ToastContext = createContext(null);

export const useToast = () => useContext(ToastContext);

const ICONS = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

const ToastContainer = ({ toasts, onRemove }) => (
  <div className="toast-container">
    {toasts.map(t => (
      <div key={t.id} className={`toast toast--${t.type}`}>
        <span className="toast-icon">{ICONS[t.type]}</span>
        <span className="toast-message">{t.message}</span>
        <button className="toast-close" onClick={() => onRemove(t.id)}>×</button>
      </div>
    ))}
  </div>
);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success', duration = 3500) => {
    // 'message' deberia ser siempre un string, pero varios catch() de la app
    // pasan err.response?.data?.detail directo -- y en un 422 de validacion
    // de FastAPI/Pydantic, 'detail' es una LISTA de objetos {type,loc,msg,...},
    // no un string. Renderizar eso directo en el <span> de abajo tumbaba toda
    // la app (React no puede pintar un objeto como hijo). Lo normalizamos aca,
    // en un solo lugar, para que ningun catch() en ninguna pantalla vuelva a
    // provocar esto.
    let texto = message;
    if (typeof message !== 'string') {
      if (Array.isArray(message)) {
        texto = message.map(m => (m && m.msg) ? m.msg : JSON.stringify(m)).join(' · ');
      } else if (message && typeof message === 'object') {
        texto = message.msg || message.detail || JSON.stringify(message);
      } else {
        texto = String(message);
      }
    }
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message: texto, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};