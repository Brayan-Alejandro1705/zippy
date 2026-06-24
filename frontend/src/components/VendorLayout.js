import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/VendorLayout.css';

const NAV = [
  { path: '/vendor/productos', icon: '📦', label: 'Productos'      },
  { path: '/vendor/ordenes',   icon: '📋', label: 'Órdenes'        },
  { path: '/vendor/ventas',    icon: '📊', label: 'Ventas'         },
  { path: '/vendor/reportes',  icon: '📈', label: 'Reportes'       },
  { path: '/vendor/perfil',    icon: '🏪', label: 'Perfil de tienda' },
  { path: '/vendor/pagos',     icon: '💰', label: 'Pagos'          },
  { path: '/vendor/config',    icon: '⚙️', label: 'Config'         },
];

const VendorLayout = ({ children, searchPlaceholder = 'Buscar...', onSearch }) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [query, setQuery] = useState('');

  const usuario   = JSON.parse(localStorage.getItem('usuario') || '{}');
  const negocio   = usuario.negocio || 'Tu negocio';
  const nombre    = usuario.nombre  || 'NOMBRE';

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('usuario');
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="vl-container">
      {/* Header */}
      <header className="vl-header">
        <div className="vl-header-inner">
          <div className="vl-brand">
            <span className="vl-brand-name">{nombre}</span>
            <span className="vl-brand-neg">{negocio}</span>
          </div>
          <div className="vl-search-wrap">
            <svg className="vl-search-icon" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              className="vl-search"
              placeholder={searchPlaceholder}
              value={query}
              onChange={e => { setQuery(e.target.value); onSearch?.(e.target.value); }}
            />
          </div>
          <div className="vl-user">
            <span className="vl-user-icon">👤</span>
            <span className="vl-user-name">{nombre.toUpperCase()}</span>
          </div>
        </div>
      </header>

      <div className="vl-body">
        {/* Sidebar */}
        <aside className="vl-sidebar">
          {NAV.map(({ path, icon, label }) => (
            <a key={path} href={path} className={`vl-nav-item ${isActive(path) ? 'vl-nav-item--active' : ''}`}>
              <span className="vl-nav-icon">{icon}</span>
              <span>{label}</span>
            </a>
          ))}
          <button className="vl-logout" onClick={handleLogout}>
            🚪 Cerrar sesión
          </button>
        </aside>

        {/* Content */}
        <main className="vl-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default VendorLayout;
