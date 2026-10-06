import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import '../styles/UserLayout.css';
import Icon from './Icons';
import AccountSwitcher from './AccountSwitcher';
import { registrarPush, alTocarNotificacion } from '../utils/push';
import ChatBurbuja from './ChatBurbuja';
import { pedidosEspecialesService } from '../config/api';

const fmt = n => `$${n.toLocaleString('es-CO')}`;
const hayCuenta = () => !!localStorage.getItem('access_token');

const NAV_ITEMS = [
  { path: '/tienda',                 icon: 'inicio',       label: 'Inicio'    },
  { path: '/tienda/pedido-especial', icon: 'solicitudes',  label: 'Mandado'   },
  { path: '/tienda/perfil',          icon: 'perfil',       label: 'Perfil'    },
];

const UserLayout = ({ children, onSearch }) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { totalItems, subtotal } = useCart();
  const [query, setQuery] = useState('');

  useEffect(() => { registrarPush(); }, []);

  /*
   * Burbuja del chat del mandado, en TODA la app del cliente.
   *
   * Antes solo aparecia dentro de Pedidos, y ahi casi no sirve: el cliente
   * pide el mandado y se va a mirar otra cosa o deja el telefono. La duda la
   * tiene el repartidor desde la tienda, asi que la respuesta tiene que estar
   * a un toque sin importar en que pantalla ande.
   *
   * Solo se consulta si hay sesion, y cada minuto: no es informacion urgente
   * —para eso esta la notificacion— sino para que la burbuja este ahi cuando
   * el cliente vuelva a mirar.
   */
  const [mandadoActivo, setMandadoActivo] = useState(null);

  useEffect(() => {
    if (!hayCuenta()) return;
    let activo = true;

    const revisar = () => {
      pedidosEspecialesService.misPedidos()
        .then(({ data }) => {
          if (!activo) return;
          const lista = Array.isArray(data) ? data : (data?.items || []);
          // El chat existe desde que un repartidor lo toma y hasta que lo entrega
          const enCurso = lista.find(p => p.domiciliario_id && !['entregada', 'cancelada'].includes(p.estado));
          setMandadoActivo(enCurso || null);
        })
        .catch(() => { if (activo) setMandadoActivo(null); });
    };

    revisar();
    const t = setInterval(revisar, 60000);
    return () => { activo = false; clearInterval(t); };
  }, []);

  /*
   * Notificacion de mensaje tocada: abre el chat de ese mandado de una.
   *
   * Se guarda el id aparte de `mandadoActivo` porque en arranque en frio (la
   * app estaba cerrada y se abrio tocando el aviso) el toque llega antes que
   * la respuesta del servidor, y porque el chat se pide por id: no hace falta
   * tener el pedido completo para abrirlo.
   */
  const [chatPorAviso, setChatPorAviso] = useState(null);
  const [abrirSenal, setAbrirSenal] = useState(0);

  useEffect(() => alTocarNotificacion((datos) => {
    if (String(datos?.tipo || '') !== 'mensaje_mandado') return false;
    const id = String(datos?.relacionado_id || '');
    if (!id) return false;
    setChatPorAviso(id);
    setAbrirSenal(n => n + 1);
    return true;
  }), []);

  const idChat = chatPorAviso || mandadoActivo?.idCompleto || null;
  // El numero corto del mandado (#PE4829). Si el chat se abrio por una
  // notificacion y el pedido todavia no ha llegado del servidor, no hay numero
  // corto: antes se mostraba el UUID entero de 36 caracteres en el titulo.
  const codigoChat = mandadoActivo && String(mandadoActivo.idCompleto) === String(idChat)
    ? mandadoActivo.id
    : null;

  const isCart    = location.pathname === '/tienda/carrito' || location.pathname === '/tienda/checkout';
  const activeNav = NAV_ITEMS.find(n => location.pathname === n.path)?.path || '/tienda';


  return (
    <div className="ulo-container">
      {/* ── Header ─────────────────────────────────────── */}
      <header className="ulo-header">
        <button className="ulo-brand" onClick={() => navigate('/tienda')}>
          <img src="/logo-zippy.jpeg" alt="Zippy Go" className="ulo-brand-logo" />
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

        {hayCuenta() ? (
          <>
            <button className="ulo-profile-btn" onClick={() => navigate('/tienda/perfil')} title="Mi perfil y pedidos" aria-label="Mi perfil">
              <Icon name="perfil" size={20} />
            </button>

            <AccountSwitcher variant="icon" />
          </>
        ) : (
          <button
            className="ulo-profile-btn"
            onClick={() => navigate('/login')}
            title="Iniciar sesión"
            style={{ width: 'auto', padding: '0 12px', fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap' }}
          >Entrar</button>
        )}

        <button className="ulo-cart-btn" onClick={() => navigate('/tienda/carrito')} aria-label="Carrito">
          <Icon name="carrito" size={20} />
          {totalItems > 0 && <span className="ulo-cart-badge">{totalItems}</span>}
        </button>

      </header>

      {/* ── Contenido ──────────────────────────────────── */}
      <main className="ulo-main" style={{ paddingBottom: `calc(${totalItems > 0 && !isCart ? 140 : 80}px + env(safe-area-inset-bottom, 0px))` }}>
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
            <span className="ulo-nav-icon"><Icon name={item.icon} size={22} /></span>
            <span className="ulo-nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      {idChat && (
        <ChatBurbuja
          id={idChat}
          servicio={pedidosEspecialesService}
          titulo={codigoChat ? `Mandado ${codigoChat}` : 'Mandado'}
          arrancaAbierto={false}
          abrirSenal={abrirSenal}
          onCerrar={() => { setChatPorAviso(null); setMandadoActivo(null); }}
        />
      )}
    </div>
  );
};

export default UserLayout;