import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import GlobalSearch from './GlobalSearch';
import Icon from './Icons';
import { getMatrix } from '../utils/permissions';
import { guardarCuentaActual, listarCuentas, activarCuenta, olvidarCuenta, rutaPorTipo } from '../utils/cuentas';
import '../styles/Dashboard.css';
import '../styles/dark-theme.css';

// permId: null = siempre visible, string = requiere ese permiso
const NAV = [
  { path: '/dashboard',    icon: 'dashboard',    label: 'Dashboard',    permId: null          },
  { path: '/negocios',     icon: 'negocios',     label: 'Negocios',     permId: null          },
  { path: '/vendedores',   icon: 'vendedores',   label: 'Vendedores',   permId: 'vendedores'  },
  { path: '/repartidores', icon: 'repartidores', label: 'Repartidores', permId: 'repartidores'},
  { path: '/usuarios',     icon: 'usuarios',     label: 'Usuarios',     permId: 'usuarios'    },
  { path: '/roles',        icon: 'roles',        label: 'Roles',        permId: 'roles'       },
  { path: '/logs',         icon: 'logs',         label: 'Logs',         permId: 'logs'        },
  { path: '/config',       icon: 'config',       label: 'Config',       permId: 'config'      },
];

const BOTTOM_NAV = [
  { path: '/dashboard',  icon: 'dashboard',  label: 'Inicio'    , permId: null         },
  { path: '/vendedores', icon: 'vendedores', label: 'Vendedores', permId: 'vendedores' },
  { path: '/negocios',   icon: 'negocios',   label: 'Negocios'  , permId: null         },
  { path: '/usuarios',   icon: 'usuarios',   label: 'Usuarios'  , permId: 'usuarios'   },
];

const canSee = (permId, rolKey, matrix) => {
  if (!permId) return true;
  if (rolKey === 'super_admin') return true;
  return matrix[rolKey]?.[permId] ?? false;
};

const getRolKey = (usuario) => {
  if (usuario.es_super_admin) return 'super_admin';
  if (usuario.tipo_usuario === 'admin') return 'admin';
  return 'sin_rol';
};

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [showPwBanner, setShowPwBanner] = useState(
    () => !sessionStorage.getItem('pw_banner_dismissed')
  );

  const usuario  = JSON.parse(localStorage.getItem('usuario') || '{}');
  const matrix   = getMatrix();
  const rolKey   = getRolKey(usuario);
  const displayName = usuario.nombre || usuario.email || 'ADMIN';

  const [cuentas, setCuentas] = useState([]);

  // Registra la sesión activa en la lista de cuentas guardadas (cubre también
  // sesiones que ya existían antes de que existiera el selector de cuentas).
  useEffect(() => {
    guardarCuentaActual();
    setCuentas(listarCuentas());
  }, []);

  const otrasCuentas = cuentas.filter(c => c.usuario.id !== usuario.id);

  const cambiarACuenta = (usuarioId) => {
    const activado = activarCuenta(usuarioId);
    if (!activado) return;
    window.location.href = rutaPorTipo(activado.tipo_usuario);
  };

  const quitarCuentaGuardada = (e, usuarioId) => {
    e.stopPropagation();
    olvidarCuenta(usuarioId);
    setCuentas(listarCuentas());
  };

  const dismissPwBanner = () => {
    sessionStorage.setItem('pw_banner_dismissed', '1');
    setShowPwBanner(false);
  };

  const irACambiarPassword = () => {
    dismissPwBanner();
    navigate('/config');
  };

  const visibleNav    = NAV.filter(({ permId }) => canSee(permId, rolKey, matrix));
  const visibleBottom = BOTTOM_NAV.filter(({ permId }) => canSee(permId, rolKey, matrix));

  const handleLogout = () => {
    olvidarCuenta(usuario.id);
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('usuario');
    navigate('/login');
  };

  const isActive = (path) => {
    if (path === '/usuarios')   return location.pathname.startsWith('/usuarios');
    if (path === '/vendedores') return location.pathname.startsWith('/vendedores');
    return location.pathname === path;
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="logo"><img src="/logo-zippy.jpeg" alt="Zippy Go" style={{ height: 36, width: 'auto', borderRadius: 6, objectFit: 'contain' }} /></div>
          <div className="header-search">
            <GlobalSearch />
          </div>
          <div className="header-right">
            <div className="account-switcher">
              <button className="admin-label account-switcher-trigger" onClick={() => setSwitcherOpen(o => !o)}>
                <Icon name="perfil" size={18} style={{ verticalAlign: '-4px', marginRight: 6 }} />{displayName}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ marginLeft: 6, verticalAlign: '-1px' }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {switcherOpen && (
                <div className="account-switcher-overlay" onClick={() => setSwitcherOpen(false)}>
                  <div className="account-switcher-dropdown" onClick={e => e.stopPropagation()}>
                    <div className="account-switcher-current">
                      <strong>{usuario.nombre} {usuario.apellido}</strong>
                      <span>{usuario.email}</span>
                    </div>
                    {otrasCuentas.length > 0 && (
                      <div className="account-switcher-list">
                        {otrasCuentas.map(c => (
                          <div key={c.usuario.id} className="account-switcher-item" onClick={() => cambiarACuenta(c.usuario.id)}>
                            <div>
                              <strong>{c.usuario.nombre} {c.usuario.apellido}</strong>
                              <span>{c.usuario.email}</span>
                            </div>
                            <button
                              className="account-switcher-remove"
                              aria-label="Olvidar esta cuenta"
                              onClick={(e) => quitarCuentaGuardada(e, c.usuario.id)}
                            >
                              <Icon name="cerrar" size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <a href="/login?agregar=1" className="account-switcher-add">+ Agregar otra cuenta</a>
                  </div>
                </div>
              )}
            </div>
            <button className="menu-hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menú">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Drawer mobile */}
      {menuOpen && (
        <div className="mobile-overlay" onClick={() => setMenuOpen(false)}>
          <div className="mobile-drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <img src="/logo-zippy.jpeg" alt="Zippy Go" style={{ height: 32, width: 'auto', borderRadius: 6, objectFit: 'contain' }} />
              <button onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><Icon name="cerrar" size={20} /></button>
            </div>
            {visibleNav.map(({ path, icon, label }) => (
              <a
                key={path}
                href={path}
                className={`drawer-item ${isActive(path) ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                <span className="nav-ico"><Icon name={icon} size={20} /></span> {label}
              </a>
            ))}

            <button className="drawer-item account-switcher-drawer-toggle" onClick={() => setSwitcherOpen(o => !o)}>
              <span className="nav-ico"><Icon name="perfil" size={20} /></span> Cambiar de cuenta
            </button>
            {switcherOpen && (
              <div className="account-switcher-drawer-list">
                <div className="account-switcher-current">
                  <strong>{usuario.nombre} {usuario.apellido}</strong>
                  <span>{usuario.email} (actual)</span>
                </div>
                {otrasCuentas.map(c => (
                  <div key={c.usuario.id} className="account-switcher-item" onClick={() => cambiarACuenta(c.usuario.id)}>
                    <div>
                      <strong>{c.usuario.nombre} {c.usuario.apellido}</strong>
                      <span>{c.usuario.email}</span>
                    </div>
                    <button
                      className="account-switcher-remove"
                      aria-label="Olvidar esta cuenta"
                      onClick={(e) => quitarCuentaGuardada(e, c.usuario.id)}
                    >
                      <Icon name="cerrar" size={14} />
                    </button>
                  </div>
                ))}
                <a href="/login?agregar=1" className="account-switcher-add">+ Agregar otra cuenta</a>
              </div>
            )}

            <button className="drawer-logout" onClick={handleLogout}>
              <span className="nav-ico"><Icon name="salir" size={20} /></span> Cerrar sesión
            </button>
          </div>
        </div>
      )}

      <div className="dashboard-main">
        {/* Sidebar desktop */}
        <aside className="sidebar">
          <div className="menu">
            <div className="menu-title">MENÚ</div>
            {visibleNav.map(({ path, icon, label }) => (
              <a key={path} href={path} className={`menu-item ${isActive(path) ? 'active' : ''}`}>
                <span className="nav-ico"><Icon name={icon} size={20} /></span> {label}
              </a>
            ))}
          </div>
          <button className="logout-menu-btn" onClick={handleLogout}>
            <span className="nav-ico"><Icon name="salir" size={20} /></span> Cerrar sesión
          </button>
        </aside>

        <main className="dashboard-content">
          {showPwBanner && (
            <div className="pw-banner">
              <span><Icon name="candado" size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} /> Por seguridad, te recomendamos cambiar tu contraseña.</span>
              <div className="pw-banner-actions">
                <button className="pw-banner-btn pw-banner-btn--primary" onClick={irACambiarPassword}>Cambiar ahora</button>
                <button className="pw-banner-btn" onClick={dismissPwBanner}>Ahora no</button>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="bottom-nav">
        {visibleBottom.map(({ path, icon, label }) => (
          <a key={path} href={path} className={`bottom-nav-item ${isActive(path) ? 'active' : ''}`}>
            <span className="bottom-nav-icon"><Icon name={icon} size={22} /></span>
            <span className="bottom-nav-label">{label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
};

export default Layout;