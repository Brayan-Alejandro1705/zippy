// ============================================================================
// AccountSwitcher.js — selector "Cambiar de cuenta" compartido.
// Se usa en los 4 perfiles: admin (Layout), cliente (UserLayout),
// vendedor (VendorLayout) y repartidor (RepartidorPage).
//
// Variantes (prop `variant`):
//   "header" → botón con el nombre del usuario (admin, vendedor)
//   "icon"   → botón redondo de solo ícono (cliente, repartidor)
//   "drawer" → ítem de menú con la lista inline (drawer móvil del admin)
//   "inline" → solo la lista, sin botón ni dropdown (va dentro de una tarjeta
//              de Configuración; el vendedor lo usa así)
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icons';
import {
  guardarCuentaActual,
  listarCuentas,
  activarCuenta,
  olvidarCuenta,
  rutaPorTipo,
} from '../utils/cuentas';
import '../styles/AccountSwitcher.css';

const NOMBRE_ROL = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
  domiciliario: 'Repartidor',
  cliente: 'Cliente',
};

const AccountSwitcher = ({ variant = 'header', className = '' }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [cuentas, setCuentas] = useState([]);

  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');

  // Registra la sesión activa en la lista de cuentas guardadas.
  // Esto es lo que hace que la cuenta aparezca luego en los demás perfiles.
  useEffect(() => {
    guardarCuentaActual();
    setCuentas(listarCuentas());
  }, []);

  const refrescar = () => setCuentas(listarCuentas());

  const otrasCuentas = cuentas.filter(c => c.usuario.id !== usuario.id);

  const cambiarACuenta = (usuarioId) => {
    const activado = activarCuenta(usuarioId);
    if (!activado) return;
    // Recarga completa a propósito: limpia el estado en memoria de la cuenta
    // anterior (carrito, contextos, datos cargados) antes de entrar a la nueva.
    window.location.href = rutaPorTipo(activado.tipo_usuario);
  };

  const quitarCuenta = (e, usuarioId) => {
    e.stopPropagation();
    olvidarCuenta(usuarioId);
    refrescar();
  };

  const irAAgregarCuenta = () => {
    setOpen(false);
    navigate('/login?agregar=1');
  };

  const Lista = ({ enDrawer = false, enLinea = false }) => (
    <div
      className={enLinea ? 'acsw-inline-list' : (enDrawer ? 'acsw-drawer-list' : 'acsw-dropdown')}
      onClick={e => e.stopPropagation()}
    >
      <div className="acsw-current">
        <strong>{usuario.nombre} {usuario.apellido}</strong>
        <span>{usuario.email}{enDrawer ? ' (actual)' : ''}</span>
        <span className="acsw-rol">{NOMBRE_ROL[usuario.tipo_usuario] || usuario.tipo_usuario}</span>
      </div>
      {otrasCuentas.length > 0 && (
        <div className="acsw-list">
          {otrasCuentas.map(c => (
            <div key={c.usuario.id} className="acsw-item" onClick={() => cambiarACuenta(c.usuario.id)}>
              <div>
                <strong>{c.usuario.nombre} {c.usuario.apellido}</strong>
                <span>{c.usuario.email}</span>
                <span className="acsw-rol">{NOMBRE_ROL[c.usuario.tipo_usuario] || c.usuario.tipo_usuario}</span>
              </div>
              <button
                className="acsw-remove"
                aria-label="Olvidar esta cuenta"
                onClick={(e) => quitarCuenta(e, c.usuario.id)}
              >
                <Icon name="cerrar" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <button className="acsw-add" onClick={irAAgregarCuenta}>+ Agregar otra cuenta</button>
    </div>
  );

  // ── Variante inline: la lista suelta, para incrustarla en una tarjeta ────
  if (variant === 'inline') {
    return <Lista enLinea />;
  }

  // ── Variante drawer: ítem del menú móvil con lista inline ────────────────
  if (variant === 'drawer') {
    return (
      <>
        <button className={`drawer-item acsw-trigger ${className}`} onClick={() => setOpen(o => !o)}>
          <span className="nav-ico"><Icon name="perfil" size={20} /></span> Cambiar de cuenta
        </button>
        {open && <Lista enDrawer />}
      </>
    );
  }

  // ── Variantes header e icon: botón + dropdown flotante ───────────────────
  const displayName = usuario.nombre || usuario.email || 'Cuenta';

  return (
    <div className={`acsw ${className}`}>
      {variant === 'icon' ? (
        <button
          className="acsw-trigger acsw-trigger--icon"
          onClick={() => setOpen(o => !o)}
          title="Cambiar de cuenta"
          aria-label="Cambiar de cuenta"
        >
          <Icon name="perfil" size={20} />
        </button>
      ) : (
        <button className="admin-label acsw-trigger" onClick={() => setOpen(o => !o)}>
          <Icon name="perfil" size={18} style={{ verticalAlign: '-4px', marginRight: 6 }} />{displayName}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ marginLeft: 6, verticalAlign: '-1px' }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}
      {open && (
        <div className="acsw-overlay" onClick={() => setOpen(false)}>
          <Lista />
        </div>
      )}
    </div>
  );
};

export default AccountSwitcher;