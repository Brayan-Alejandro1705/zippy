import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import GlobalSearch from './GlobalSearch';
import { getMatrix } from '../utils/permissions';
import '../styles/Dashboard.css';
import '../styles/dark-theme.css';

// permId: null = siempre visible, string = requiere ese permiso
const NAV = [
  { path: '/dashboard',    icon: '📊', label: 'Dashboard',    permId: null          },
  { path: '/negocios',     icon: '🏬', label: 'Negocios',     permId: null          },
  { path: '/vendedores',   icon: '🏪', label: 'Vendedores',   permId: 'vendedores'  },
  { path: '/repartidores', icon: '🛵', label: 'Repartidores', permId: 'repartidores'},
  { path: '/usuarios',     icon: '👥', label: 'Usuarios',     permId: 'usuarios'    },
  { path: '/roles',        icon: '🔐', label: 'Roles',        permId: 'roles'       },
  { path: '/logs',         icon: '📜', label: 'Logs',         permId: 'logs'        },
  { path: '/config',       icon: '⚙️', label: 'Config',       permId: 'config'      },
];

const BOTTOM_NAV = [
  { path: '/dashboard',  icon: '📊', label: 'Inicio'    , permId: null         },
  { path: '/vendedores', icon: '🏪', label: 'Vendedores', permId: 'vendedores' },
  { path: '/negocios',   icon: '🏬', label: 'Negocios'  , permId: null         },
  { path: '/usuarios',   icon: '👥', label: 'Usuarios'  , permId: 'usuarios'   },
];

const canSee = (permId, rolKey, matrix) => {
  if (!permId) return true;
  if (rolKey === 'super_admin') return true;
  return matrix[rolKey]?.[permId] ?? false;
};

const getRolKey = (usuario) => {
  if (usuario.es_super_admin) return 'super_admin';
  if (usuario.tipo_usuario === 'admin') return 'admin';
  return 'soporte';
};

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const usuario  = JSON.parse(localStorage.getItem('usuario') || '{}');
  const matrix   = getMatrix();
  const rolKey   = getRolKey(usuario);
  const displayName = usuario.nombre || usuario.email || 'ADMIN';

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
            <span className="admin-label">👤 {displayName}</span>
            <button className="menu-hamburger" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
          </div>
        </div>
      </header>

      {/* Drawer mobile */}
      {menuOpen && (
        <div className="mobile-overlay" onClick={() => setMenuOpen(false)}>
          <div className="mobile-drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <img src="/logo-zippy.jpeg" alt="Zippy Go" style={{ height: 32, width: 'auto', borderRadius: 6, objectFit: 'contain' }} />
              <button onClick={() => setMenuOpen(false)}>✕</button>
            </div>
            {visibleNav.map(({ path, icon, label }) => (
              <a
                key={path}
                href={path}
                className={`drawer-item ${isActive(path) ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                <span>{icon}</span> {label}
              </a>
            ))}
            <button className="drawer-logout" onClick={handleLogout}>🚪 Cerrar sesión</button>
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
                <span>{icon}</span> {label}
              </a>
            ))}
          </div>
          <button className="logout-menu-btn" onClick={handleLogout}>
            🚪 Cerrar sesión
          </button>
        </aside>

        <main className="dashboard-content">
          {children}
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="bottom-nav">
        {visibleBottom.map(({ path, icon, label }) => (
          <a key={path} href={path} className={`bottom-nav-item ${isActive(path) ? 'active' : ''}`}>
            <span className="bottom-nav-icon">{icon}</span>
            <span className="bottom-nav-label">{label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
};

export default Layout;
