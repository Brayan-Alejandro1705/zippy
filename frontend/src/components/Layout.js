import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import GlobalSearch from './GlobalSearch';
import '../styles/Dashboard.css';
import '../styles/dark-theme.css';

const NAV = [
  { path: '/dashboard',    icon: '📊', label: 'Dashboard'        },
  { path: '/vendedores',   icon: '🏪', label: 'Vendedores'       },
  { path: '/solicitudes',  icon: '📋', label: 'Solicitudes'      },
  { path: '/repartidores', icon: '🛵', label: 'Repartidores'     },
  { path: '/usuarios',     icon: '👥', label: 'Usuarios'         },
  { path: '/roles',        icon: '🔐', label: 'Roles y permisos' },
  { path: '/logs',         icon: '📜', label: 'Logs de actividad'},
  { path: '/config',       icon: '⚙️', label: 'Config'           },
];

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const displayName = usuario.nombre || usuario.email || 'ADMIN';

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
      <header className="dashboard-header">
        <div className="header-content">
          <div className="logo">Zippy Admin</div>
          <GlobalSearch />
          <div className="header-right">
            <span className="admin-label">👤 {displayName}</span>
          </div>
        </div>
      </header>

      <div className="dashboard-main">
        <aside className="sidebar">
          <div className="menu">
            <div className="menu-title">MENÚ</div>
            {NAV.map(({ path, icon, label }) => (
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
    </div>
  );
};

export default Layout;
