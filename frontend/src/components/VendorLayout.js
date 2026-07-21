import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/VendorLayout.css';
import Icon from './Icons';

const NAV = [
  { path: '/vendor/productos', icon: 'paquete',     label: 'Productos'       },
  { path: '/vendor/ordenes',   icon: 'solicitudes', label: 'Órdenes'         },
  { path: '/vendor/ventas',    icon: 'dashboard',   label: 'Ventas'          },
  { path: '/vendor/reportes',  icon: 'reportes',    label: 'Reportes'        },
  { path: '/vendor/perfil',    icon: 'vendedores',  label: 'Perfil de tienda'},
  { path: '/vendor/pagos',     icon: 'dinero',      label: 'Pagos'           },
  { path: '/vendor/config',    icon: 'config',      label: 'Config'          },
];

const VendorLayout = ({ children, searchPlaceholder = 'Buscar...', onSearch }) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [query, setQuery] = useState('');

  const usuario   = JSON.parse(localStorage.getItem('usuario') || '{}');
  const negocio   = usuario.negocio || 'Tu negocio';
  const nombre    = usuario.nombre  || 'NOMBRE';


  const isActive = (path) => location.pathname === path;

  return (
    <div className="vl-container">
      {/* Header */}
      <header className="vl-header">
        <div className="vl-header-inner">
          <div className="vl-brand">
            <img src="/logo-zippy.jpeg" alt="Zippy Go" style={{ height: 32, width: 'auto', borderRadius: 6, objectFit: 'contain' }} />
            <div>
              <span className="vl-brand-name">{nombre}</span>
              <span className="vl-brand-neg">{negocio}</span>
            </div>
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
        </div>
      </header>

      <div className="vl-body">
        {/* Sidebar */}
        <aside className="vl-sidebar">
          {NAV.map(({ path, icon, label }) => (
            <a key={path} href={path} className={`vl-nav-item ${isActive(path) ? 'vl-nav-item--active' : ''}`}>
              <span className="vl-nav-icon"><Icon name={icon} size={20} /></span>
              <span>{label}</span>
            </a>
          ))}
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