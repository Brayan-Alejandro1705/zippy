import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import GlobalSearch from './GlobalSearch';
import Icon from './Icons';
import { getMatrix } from '../utils/permissions';
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
  const [showPwBanner, setShowPwBanner] = useState(
    () => !sessionStorage.getItem('pw_banner_dismissed')
  );

  const usuario  = JSON.parse(localStorage.getItem('usuario') || '{}');
  const matrix   = getMatrix();
  const rolKey   = getRolKey(usuario);
  const displayName = usuario.nombre || usuario.email || 'ADMIN';

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
            <span className="admin-label"><Icon name="perfil" size={18} style={{ verticalAlign: '-4px', marginRight: 6 }} />{displayName}</span>
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