import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/UserLayout.css';
import '../styles/VendorLayout.css';
import Icon from './Icons';
import { registrarPush } from '../utils/push';

// Secciones del panel de vendedor. Ojo: estas rutas son /vendor/*, NO /tienda/*.
// Antes este archivo era una copia literal de UserLayout, asi que el vendedor
// veia la barra del cliente y las paginas de ordenes, ventas, pagos, reportes,
// perfil y configuracion no tenian NINGUN enlace que llevara a ellas.
const NAV_ITEMS = [
  { path: '/vendor/productos', icon: 'paquete',     label: 'Productos' },
  { path: '/vendor/ordenes',   icon: 'solicitudes', label: 'Órdenes'   },
  { path: '/vendor/ventas',    icon: 'dinero',      label: 'Ventas'    },
  { path: '/vendor/pagos',     icon: 'billete',     label: 'Pagos'     },
  { path: '/vendor/reportes',  icon: 'reportes',    label: 'Reportes'  },
];

const VendorLayout = ({ children, onSearch, searchPlaceholder = 'Buscar...' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');

  useEffect(() => { registrarPush(); }, []);

  // startsWith para que /vendor/productos/nuevo siga marcando "Productos"
  const activeNav =
    NAV_ITEMS.find(n => location.pathname.startsWith(n.path))?.path || '/vendor/productos';

  return (
    <div className="ulo-container vlo-container">
      {/* ── Header ─────────────────────────────────────── */}
      <header className="ulo-header">
        <button className="ulo-brand" onClick={() => navigate('/vendor/productos')}>
          <img src="/logo-zippy.jpeg" alt="Zippy Go" className="ulo-brand-logo" />
        </button>

        {/* La barra de busqueda solo se muestra si la pagina realmente la usa.
            Antes salia en todas, pero solo Productos escucha onSearch, asi que
            en el resto era un campo muerto. */}
        {onSearch ? (
          <div className="ulo-search-wrap">
            <svg className="ulo-search-icon" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              className="ulo-search"
              placeholder={searchPlaceholder}
              value={query}
              onChange={e => { setQuery(e.target.value); onSearch(e.target.value); }}
            />
          </div>
        ) : (
          <div className="vlo-spacer" />
        )}

        <button
          className="vlo-icon-btn"
          onClick={() => navigate('/vendor/config')}
          title="Configuración"
          aria-label="Configuración"
        >
          <Icon name="config" size={20} />
        </button>

        <button
          className="vlo-icon-btn"
          onClick={() => navigate('/vendor/perfil')}
          title="Perfil de mi negocio"
          aria-label="Perfil de mi negocio"
        >
          <Icon name="perfil" size={20} />
        </button>
      </header>

      {/* ── Contenido ──────────────────────────────────── */}
      <main className="ulo-main" style={{ paddingBottom: 80 }}>
        {children}
      </main>

      {/* ── Navegación inferior ────────────────────────── */}
      <nav className="ulo-bottom-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.path}
            className={`ulo-nav-item ${activeNav === item.path ? 'ulo-nav-item--active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="ulo-nav-icon"><Icon name={item.icon} size={22} /></span>
            <span className="ulo-nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default VendorLayout;