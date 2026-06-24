import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import '../styles/UserLayout.css';

const fmt = n => `$${n.toLocaleString('es-CO')}`;

const NAV_ITEMS = [
  { path: '/tienda',               icon: '🏠', label: 'Inicio'    },
  { path: '/tienda/servicios',     icon: '🛠️', label: 'Servicios' },
  { path: '/tienda/pedido-especial', icon: '📋', label: 'Pedido'    },
  { path: '/tienda/perfil',        icon: '👤', label: 'Perfil'    },
];

const UserLayout = ({ children, onSearch }) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { totalItems, subtotal } = useCart();
  const [query, setQuery] = useState('');

  const isCart    = location.pathname === '/tienda/carrito' || location.pathname === '/tienda/checkout';
  const activeNav = NAV_ITEMS.find(n => location.pathname === n.path)?.path || '/tienda';

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('usuario');
    navigate('/login');
  };

  return (
    <div className="ulo-container">
      {/* ── Header ─────────────────────────────────────── */}
      <header className="ulo-header">
        <button className="ulo-brand" onClick={() => navigate('/tienda')}>
          🔥 <span>Zippy</span>
        </button>

        <div className="ulo-search-wrap">
          <svg className="ulo-search-icon" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            className="ulo-search"
            placeholder="Buscar productos..."
            value={query}
            onChange={e => { setQuery(e.target.value); onSearch?.(e.target.value); }}
          />
        </div>

        <button className="ulo-profile-btn" onClick={() => navigate('/tienda/perfil')} title="Mi perfil y pedidos">
          👤
        </button>

        <button className="ulo-cart-btn" onClick={() => navigate('/tienda/carrito')}>
          🛒
          {totalItems > 0 && <span className="ulo-cart-badge">{totalItems}</span>}
        </button>

        <button className="ulo-logout-btn" onClick={handleLogout} title="Cerrar sesión">
          🚪
        </button>
      </header>

      {/* ── Contenido ──────────────────────────────────── */}
      <main className="ulo-main" style={{ paddingBottom: totalItems > 0 && !isCart ? 140 : 80 }}>
        {children}
      </main>

      {/* ── Barra flotante del carrito ─────────────────── */}
      {totalItems > 0 && !isCart && (
        <button className="ulo-cart-bar" onClick={() => navigate('/tienda/carrito')}>
          <div className="ulo-cart-bar-l">
            <span className="ulo-cart-bar-badge">{totalItems}</span>
            <span className="ulo-cart-bar-label">Ver mi carrito</span>
          </div>
          <div className="ulo-cart-bar-r">
            <span className="ulo-cart-bar-total">{fmt(subtotal)}</span>
            <span className="ulo-cart-bar-arrow">→</span>
          </div>
        </button>
      )}

      {/* ── Navegación inferior ────────────────────────── */}
      <nav className="ulo-bottom-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.path}
            className={`ulo-nav-item ${activeNav === item.path ? 'ulo-nav-item--active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="ulo-nav-icon">{item.icon}</span>
            <span className="ulo-nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default UserLayout;
