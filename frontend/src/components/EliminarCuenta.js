// ============================================================================
// EliminarCuenta.js — bloque "Eliminar mi cuenta" compartido.
//
// Google Play exige que toda app que permita crear cuentas ofrezca una via
// para eliminarlas DENTRO de la app (ademas de una URL publica). Este
// componente es esa via, y se usa en la configuracion de los 4 perfiles.
//
// Pide la contrasena y una confirmacion escrita a proposito: es irreversible.
// ============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../config/api';
import { useToast } from '../context/ToastContext';
import Icon from './Icons';
import '../styles/EliminarCuenta.css';

const PALABRA = 'ELIMINAR';

const EliminarCuenta = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [abierto, setAbierto] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [enviando, setEnviando] = useState(false);

  const puedeEliminar = password.length > 0 && confirmacion.trim().toUpperCase() === PALABRA;

  const cancelar = () => {
    setAbierto(false);
    setPassword('');
    setConfirmacion('');
  };

  const eliminar = async () => {
    if (!puedeEliminar || enviando) return;
    setEnviando(true);
    try {
      const { data } = await authService.eliminarCuenta(password);
      // Se limpia todo el rastro local, incluidas las demas sesiones guardadas
      // por el selector de cuentas: dejarlas seria ofrecer una sesion muerta.
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('usuario');
      localStorage.removeItem('cuentas_guardadas');
      addToast(data?.mensaje || 'Tu cuenta fue eliminada', 'success');
      navigate('/login', { replace: true });
    } catch (err) {
      const detalle = err.response?.data?.detail;
      addToast(
        (typeof detalle === 'string' && detalle) || 'No se pudo eliminar la cuenta',
        'error'
      );
      setEnviando(false);
    }
  };

  if (!abierto) {
    return (
      <div className="elc">
        <p className="elc-intro">
          Al eliminar tu cuenta se borran tus datos personales, tus direcciones
          guardadas y tus favoritos. Los registros de pedidos se conservan sin tus
          datos, porque la ley obliga a guardar ese soporte. Esta acción no se
          puede deshacer.
        </p>
        <button className="elc-btn-abrir" onClick={() => setAbierto(true)}>
          <Icon name="cerrar" size={16} /> Eliminar mi cuenta
        </button>
      </div>
    );
  }

  return (
    <div className="elc">
      <p className="elc-aviso">
        Esta acción es permanente. No podrás recuperar la cuenta ni su historial.
      </p>

      <div className="elc-campo">
        <label>Tu contraseña</label>
        <input
          type="password"
          value={password}
          autoComplete="current-password"
          placeholder="••••••••"
          onChange={e => setPassword(e.target.value)}
        />
      </div>

      <div className="elc-campo">
        <label>Escribe {PALABRA} para confirmar</label>
        <input
          type="text"
          value={confirmacion}
          placeholder={PALABRA}
          onChange={e => setConfirmacion(e.target.value)}
        />
      </div>

      <div className="elc-acciones">
        <button className="elc-btn-cancelar" onClick={cancelar} disabled={enviando}>
          Cancelar
        </button>
        <button className="elc-btn-confirmar" onClick={eliminar} disabled={!puedeEliminar || enviando}>
          {enviando ? 'Eliminando...' : 'Eliminar definitivamente'}
        </button>
      </div>
    </div>
  );
};

export default EliminarCuenta;