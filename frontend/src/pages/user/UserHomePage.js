import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserLayout from '../../components/UserLayout';
import UserProductModal from '../../components/UserProductModal';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { productosService, negociosService } from '../../config/api';
import ZLoader from '../../components/ZLoader';
import '../../styles/UserHome.css';

/* ── Countdown ──────────────────────────────────────────── */
const useCountdown = () => {
  const [time, setTime] = useState({ h: 0, m: 0, s: 0 });
  useEffect(() => {
    const calc = () => {
      const now = new Date(), midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const d = midnight - now;
      setTime({ h: Math.floor(d / 3600000), m: Math.floor((d % 3600000) / 60000), s: Math.floor((d % 60000) / 1000) });
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
};
const pad = n => String(n).padStart(2, '0');

/* ── Helpers de presentación (no son datos, son solo decoración) ─────────── */
const CAT_ICON = {
  bebidas: '☕', panadería: '🥖', pastelería: '🎂',
  'frutas y verduras': '🥦', lácteos: '🥛', carnes: '🥩', otros: '📦',
};
const CAT_GRADIENT_BASE = [
  'linear-gradient(135deg,#fff3e6,#fed7aa)',
  'linear-gradient(135deg,#ecfdf5,#a7f3d0)',
  'linear-gradient(135deg,#f5f3ff,#ddd6fe)',
  'linear-gradient(135deg,#eff6ff,#bfdbfe)',
  'linear-gradient(135deg,#fdf2f8,#fbcfe8)',
];
const STORE_COLORS = [
  { bg: '#fff3e6', text: '#FF7A00' },
  { bg: '#f0fdf4', text: '#16a34a' },
  { bg: '#f5f3ff', text: '#7c3aed' },
  { bg: '#eff6ff', text: '#2563eb' },
  { bg: '#fdf2f8', text: '#db2777' },
];

const getIcon = (categoria) => CAT_ICON[(categoria || '').toLowerCase()] || '📦';
const getGradient = (categoria, idx) => CAT_GRADIENT_BASE[idx % CAT_GRADIENT_BASE.length];

const fmt = n => `$${Math.round(n).toLocaleString('es-CO')}`;
const esNuevo = (fechaIso) => (Date.now() - new Date(fechaIso).getTime()) < 7 * 86400000;

/* ── Componente ─────────────────────────────────────────── */
const UserHomePage = () => {
  const navigate           = useNavigate();
  const { addItem, items } = useCart();
  const { addToast }       = useToast();
  const countdown          = useCountdown();

  const [tab,          setTab]          = useState('destacados');
  const [query,        setQuery]        = useState('');
  const [tiendaFiltro, setTiendaFiltro] = useState('');
  const [orden,        setOrden]        = useState('relevancia');
  const [saved,        setSaved]        = useState(new Set());
  const [modalProd,    setModalProd]    = useState(null);
  const [precioMin,    setPrecioMin]    = useState('');
  const [precioMax,    setPrecioMax]    = useState('');
  const [showFilters,  setShowFilters]  = useState(false);

  const [loading,   setLoading]   = useState(true);
  const [productos, setProductos] = useState([]);
  const [tiendas,   setTiendas]   = useState([]);
  const [categorias, setCategorias] = useState([]);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const [{ data: productosRaw }, { data: negociosRaw }] = await Promise.all([
          productosService.listar(undefined, { limit: 100 }),
          negociosService.listar({ limit: 100 }),
        ]);

        if (!activo) return;

        const negociosMap = Object.fromEntries(negociosRaw.map(n => [n.id, n]));

        const conteoPorNegocio = {};
        productosRaw.forEach(p => { conteoPorNegocio[p.negocio_id] = (conteoPorNegocio[p.negocio_id] || 0) + 1; });

        const tiendasReales = negociosRaw
          .filter(n => conteoPorNegocio[n.id])
          .map((n, i) => ({
            id: n.id,
            nombre: n.nombre_negocio,
            icon: getIcon(n.categoria),
            color: STORE_COLORS[i % STORE_COLORS.length].bg,
            text: STORE_COLORS[i % STORE_COLORS.length].text,
            count: conteoPorNegocio[n.id] || 0,
            rating: Number(n.calificacion_promedio) || 0,
          }));

        const categoriasReales = [...new Set(productosRaw.map(p => p.categoria).filter(Boolean))]
          .map(cat => ({ id: cat, icon: getIcon(cat), label: cat }));

        const productosMapeados = productosRaw.map((p, i) => ({
          id: p.id,
          nombre: p.nombre,
          descripcion: p.descripcion,
          tienda: negociosMap[p.negocio_id]?.nombre_negocio || 'Tienda',
          negocioId: p.negocio_id,
          precio: Number(p.precio),
          precioOriginal: p.precio_original ? Number(p.precio_original) : null,
          descuento: Number(p.descuento_porcentaje) || 0,
          enOferta: !!p.en_oferta,
          categoria: p.categoria || 'Otros',
          nuevo: esNuevo(p.fecha_creacion),
          rating: Number(p.calificacion_promedio) || 0,
          stock: p.stock,
          foto: p.imagenes?.[0] || null,
          totalVendidos: p.total_vendidos || 0,
          gradIdx: i,
        }));

        setProductos(productosMapeados);
        setTiendas(tiendasReales);
        setCategorias(categoriasReales);
      } catch {
        if (activo) { setProductos([]); setTiendas([]); setCategorias([]); }
      } finally {
        if (activo) setLoading(false);
      }
    })();
    return () => { activo = false; };
  }, []);

  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const hora    = new Date().getHours();
  const saludo  = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';

  const populares = [...productos].sort((a, b) => b.totalVendidos - a.totalVendidos).slice(0, 5);
  const oferta = [...productos].filter(p => p.descuento > 0).sort((a, b) => b.descuento - a.descuento)[0] || null;

  const ratingPromedioTiendas = tiendas.length
    ? (tiendas.reduce((s, t) => s + (Number(t.rating) || 0), 0) / tiendas.length)
    : 0;

  const filtrados = productos
    .filter(p => {
      const matchQ      = !query || p.nombre.toLowerCase().includes(query.toLowerCase()) || p.tienda.toLowerCase().includes(query.toLowerCase());
      const matchTab    = tab === 'destacados' || p.categoria === tab;
      const matchTienda = !tiendaFiltro || p.tienda === tiendaFiltro;
      const matchMin    = !precioMin || p.precio >= Number(precioMin);
      const matchMax    = !precioMax || p.precio <= Number(precioMax);
      return matchQ && matchTab && matchTienda && matchMin && matchMax;
    })
    .sort((a, b) => {
      if (orden === 'precio-asc')  return a.precio - b.precio;
      if (orden === 'precio-desc') return b.precio - a.precio;
      if (orden === 'rating')      return b.rating - a.rating;
      return 0;
    });

  const handleAdd = p => { addItem(p); addToast(`${p.nombre} agregado al carrito`, 'success'); };
  const toggleSave = id => setSaved(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const inCart  = id => items.some(i => i.id === id);
  const cartQty = id => items.find(i => i.id === id)?.qty || 0;

  if (loading) {
    return (
      <UserLayout onSearch={setQuery}>
        <div style={{ padding: 24 }}><ZLoader label="Cargando catálogo..." /></div>
      </UserLayout>
    );
  }

  return (
    <UserLayout onSearch={setQuery}>

      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="uh-hero">
        <div className="uh-hero-content">
          <div className="uh-hero-top">
            <span className="uh-hero-loc">📍 Garzón, Huila</span>
            {usuario.nombre && (
              <span className="uh-hero-greeting">{saludo}, {usuario.nombre.split(' ')[0]} 👋</span>
            )}
          </div>
          <h1 className="uh-hero-title">¿Qué quieres<br/>pedir hoy?</h1>
          <p className="uh-hero-sub">Productos frescos de tiendas locales directo a tu puerta</p>
          <div className="uh-hero-cats">
            <button
              className={`uh-hero-cat ${tab === 'destacados' ? 'uh-hero-cat--active' : ''}`}
              onClick={() => { setTab('destacados'); document.getElementById('uh-productos')?.scrollIntoView({ behavior: 'smooth' }); }}
            >
              <span>🔥</span><span>Destacados</span>
            </button>
            {categorias.map(c => (
              <button
                key={c.id}
                className={`uh-hero-cat ${tab === c.id ? 'uh-hero-cat--active' : ''}`}
                onClick={() => { setTab(c.id); document.getElementById('uh-productos')?.scrollIntoView({ behavior: 'smooth' }); }}
              >
                <span>{c.icon}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="uh-hero-deco">
          <div className="uh-hero-deco-circle">
            <span className="uh-hero-deco-emoji">🛵</span>
          </div>
          <div className="uh-hero-stats">
            <div className="uh-hero-stat">
              <span className="uh-hero-stat-num">{tiendas.length}</span>
              <span className="uh-hero-stat-label">Tiendas</span>
            </div>
            <div className="uh-hero-stat-div" />
            <div className="uh-hero-stat">
              <span className="uh-hero-stat-num">{productos.length}</span>
              <span className="uh-hero-stat-label">Productos</span>
            </div>
            <div className="uh-hero-stat-div" />
            <div className="uh-hero-stat">
              <span className="uh-hero-stat-num">{ratingPromedioTiendas > 0 ? ratingPromedioTiendas.toFixed(1) : '—'}</span>
              <span className="uh-hero-stat-label">Rating</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Más pedidos hoy ─────────────────────────────── */}
      {populares.length > 0 && (
        <div className="uh-section">
          <div className="uh-section-hdr">
            <h2 className="uh-section-title">🔥 Más pedidos</h2>
            <button className="uh-section-link" onClick={() => setTab('destacados')}>Ver todos →</button>
          </div>
          <div className="uh-pop-row">
            {populares.map(p => (
              <button key={p.id} className="uh-pop-card" onClick={() => setModalProd(p)}>
                <div className="uh-pop-photo" style={{ background: getGradient(p.categoria, p.gradIdx) }}>
                  {p.foto ? <img src={p.foto} alt={p.nombre} /> : <span className="uh-pop-emoji">{getIcon(p.categoria)}</span>}
                  {p.rating > 0 && <span className="uh-pop-rating">⭐ {p.rating.toFixed(1)}</span>}
                </div>
                <div className="uh-pop-body">
                  <p className="uh-pop-name">{p.nombre}</p>
                  <p className="uh-pop-tienda">{p.tienda}</p>
                  <div className="uh-pop-footer">
                    <span className="uh-pop-price">{fmt(p.precio)}</span>
                    <span
                      className={`uh-pop-add ${inCart(p.id) ? 'uh-pop-add--in' : ''}`}
                      onClick={e => { e.stopPropagation(); handleAdd(p); }}
                    >
                      {inCart(p.id) ? '✓' : '+'}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Banners: Oferta + Servicios ──────────────────── */}
      <div className="uh-banners">
        {/* Oferta del día */}
        {oferta && (
          <div className="uh-oferta">
            <div className="uh-oferta-left">
              <span className="uh-oferta-tag">⚡ OFERTA DEL DÍA</span>
              <p className="uh-oferta-name">{oferta.nombre}</p>
              <p className="uh-oferta-tienda">{oferta.tienda}</p>
              <div className="uh-oferta-prices">
                <span className="uh-oferta-original">{fmt(oferta.precioOriginal || oferta.precio)}</span>
                <span className="uh-oferta-price">{fmt(oferta.precio)}</span>
                <span className="uh-oferta-pct">-{oferta.descuento}%</span>
              </div>
              <div className="uh-countdown">
                <span className="uh-cd-label">Termina en</span>
                <div className="uh-cd-block"><span>{pad(countdown.h)}</span><small>H</small></div>
                <span className="uh-cd-sep">:</span>
                <div className="uh-cd-block"><span>{pad(countdown.m)}</span><small>M</small></div>
                <span className="uh-cd-sep">:</span>
                <div className="uh-cd-block"><span>{pad(countdown.s)}</span><small>S</small></div>
              </div>
              <button className="uh-oferta-cta" onClick={() => handleAdd(oferta)}>
                {inCart(oferta.id) ? `✓ En carrito (${cartQty(oferta.id)})` : 'Aprovechar oferta →'}
              </button>
            </div>
            <div className="uh-oferta-deco">🎁</div>
          </div>
        )}

        {/* Servicios locales */}
        <div className="uh-servicios-banner" onClick={() => navigate('/tienda/servicios')}>
          <div className="uh-servicios-grid">
            {['🚕', '🚛', '🔧', '⚡', '📦', '🚿'].map((ic, i) => (
              <span key={i} className="uh-servicios-grid-item">{ic}</span>
            ))}
          </div>
          <div className="uh-servicios-body">
            <span className="uh-servicios-tag">DIRECTORIO</span>
            <p className="uh-servicios-title">Servicios locales</p>
            <p className="uh-servicios-sub">Taxi · Acarreos · Mecánico · Electricista y más</p>
          </div>
          <button className="uh-servicios-cta">Ver todos →</button>
        </div>
      </div>

      {/* ── Tiendas ──────────────────────────────────────── */}
      {tiendas.length > 0 && (
        <div className="uh-section">
          <div className="uh-section-hdr">
            <h2 className="uh-section-title">🏪 Tiendas</h2>
            {tiendaFiltro && (
              <button className="uh-clear-link" onClick={() => setTiendaFiltro('')}>Quitar filtro ✕</button>
            )}
          </div>
          <div className="uh-stores-row">
            {tiendas.map(t => (
              <button
                key={t.id}
                className={`uh-store-card ${tiendaFiltro === t.nombre ? 'uh-store-card--active' : ''}`}
                onClick={() => setTiendaFiltro(prev => prev === t.nombre ? '' : t.nombre)}
              >
                <div className="uh-store-avatar" style={{ background: t.color, color: t.text }}>{t.icon}</div>
                <div className="uh-store-info">
                  <p className="uh-store-name">{t.nombre}</p>
                  <p className="uh-store-count">{t.count} producto{t.count !== 1 ? 's' : ''}</p>
                </div>
                {tiendaFiltro === t.nombre && <span className="uh-store-check">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Productos ────────────────────────────────────── */}
      <div id="uh-productos" className="uh-section">
        <div className="uh-productos-layout">

          {/* Sidebar de categorías (desktop) */}
          <aside className="uh-sidebar">
            <p className="uh-sidebar-title">Categorías</p>
            <button
              className={`uh-sidebar-item ${tab === 'destacados' ? 'uh-sidebar-item--active' : ''}`}
              onClick={() => setTab('destacados')}
            >
              <span className="uh-sidebar-icon">🔥</span>
              <span>Destacados</span>
            </button>
            {categorias.map(c => (
              <button
                key={c.id}
                className={`uh-sidebar-item ${tab === c.id ? 'uh-sidebar-item--active' : ''}`}
                onClick={() => setTab(c.id)}
              >
                <span className="uh-sidebar-icon">{c.icon}</span>
                <span>{c.label}</span>
              </button>
            ))}
            <div className="uh-sidebar-divider" />
            <button className="uh-sidebar-item uh-sidebar-all" onClick={() => { setTab('destacados'); setTiendaFiltro(''); }}>
              <span className="uh-sidebar-icon">✦</span>
              <span>Ver todo</span>
            </button>

            {tiendas.length > 0 && (
              <>
                <div className="uh-sidebar-divider" />
                <p className="uh-sidebar-title" style={{ marginTop: 4 }}>Tiendas</p>
                {tiendas.map(t => (
                  <button
                    key={t.id}
                    className={`uh-sidebar-item ${tiendaFiltro === t.nombre ? 'uh-sidebar-item--active' : ''}`}
                    onClick={() => setTiendaFiltro(prev => prev === t.nombre ? '' : t.nombre)}
                  >
                    <span className="uh-sidebar-icon">{t.icon}</span>
                    <span style={{ fontSize: 12 }}>{t.nombre}</span>
                  </button>
                ))}
              </>
            )}
          </aside>

          {/* Contenido principal */}
          <div className="uh-content">
            {/* Header de sección */}
            <div className="uh-content-hdr">
              <div>
                <h2 className="uh-content-title">
                  {tab === 'destacados' ? '🔥 Destacados' : `${getIcon(tab)} ${tab}`}
                  {tiendaFiltro && <span className="uh-filter-active"> · {tiendaFiltro}</span>}
                </h2>
                <p className="uh-content-count">{filtrados.length} producto{filtrados.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="uh-sort-right">
                <button
                  className={`uh-filter-btn ${showFilters ? 'uh-filter-btn--on' : ''}`}
                  onClick={() => setShowFilters(v => !v)}
                >
                  ⚙ Filtros
                </button>
                <select className="uh-sort-sel" value={orden} onChange={e => setOrden(e.target.value)}>
                  <option value="relevancia">Relevancia</option>
                  <option value="precio-asc">Precio ↑</option>
                  <option value="precio-desc">Precio ↓</option>
                  <option value="rating">Mejor valorados</option>
                </select>
              </div>
            </div>

            {showFilters && (
              <div className="uh-filter-panel">
                <p className="uh-filter-label">Rango de precio</p>
                <div className="uh-price-row">
                  <input className="uh-price-inp" type="number" placeholder="Mín" value={precioMin} onChange={e => setPrecioMin(e.target.value)} />
                  <span>—</span>
                  <input className="uh-price-inp" type="number" placeholder="Máx" value={precioMax} onChange={e => setPrecioMax(e.target.value)} />
                  {(precioMin || precioMax) && (
                    <button className="uh-clear-btn" onClick={() => { setPrecioMin(''); setPrecioMax(''); }}>Limpiar</button>
                  )}
                </div>
              </div>
            )}

            {filtrados.length === 0 ? (
              <div className="uh-empty">
                <span>🔍</span>
                <p>{productos.length === 0 ? 'Todavía no hay productos publicados.' : 'Sin resultados para esta combinación de filtros.'}</p>
              </div>
            ) : (
              <div className="uh-grid">
                {filtrados.map(p => (
                  <div key={p.id} className="uh-card" onClick={() => setModalProd(p)}>
                    <div className="uh-photo" style={{ background: getGradient(p.categoria, p.gradIdx) }}>
                      {p.foto
                        ? <img src={p.foto} alt={p.nombre} />
                        : <span className="uh-photo-emoji">{getIcon(p.categoria)}</span>
                      }
                      {p.enOferta && <span className="uh-badge-oferta">🔥 Oferta</span>}
                      {p.nuevo && !p.enOferta && <span className="uh-badge-new">NUEVO</span>}
                      {p.rating >= 4.7 && <span className="uh-badge-top">⭐ Top</span>}
                      {p.rating > 0 && <span className="uh-rating">⭐ {p.rating.toFixed(1)}</span>}
                      {inCart(p.id) && <span className="uh-cart-qty">{cartQty(p.id)}</span>}
                    </div>
                    <div className="uh-info">
                      <p className="uh-nombre">{p.nombre}</p>
                      <p className="uh-tienda">{p.tienda}</p>
                      <div className="uh-card-footer">
                        <div>
                          <p className="uh-precio">{fmt(p.precio)}</p>
                          {p.enOferta && p.precioOriginal && (
                            <p className="uh-precio-original">{fmt(p.precioOriginal)}</p>
                          )}
                        </div>
                        <div className="uh-card-actions" onClick={e => e.stopPropagation()}>
                          <button
                            className={`uh-btn-save ${saved.has(p.id) ? 'uh-btn-save--on' : ''}`}
                            onClick={() => toggleSave(p.id)}
                          >♡</button>
                          <button
                            className={`uh-btn-cart ${inCart(p.id) ? 'uh-btn-cart--added' : ''}`}
                            onClick={() => handleAdd(p)}
                          >
                            {inCart(p.id) ? `✓ ${cartQty(p.id)}` : '+ Agregar'}
                          </button>
                        </div>
                      </div>
                      {p.stock <= 10 && <span className="uh-stock-low">¡Solo {p.stock} disponibles!</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <UserProductModal
        producto={modalProd}
        grad={modalProd ? getGradient(modalProd.categoria, modalProd.gradIdx) : ''}
        emoji={modalProd ? getIcon(modalProd.categoria) : ''}
        onClose={() => setModalProd(null)}
      />
    </UserLayout>
  );
};

export default UserHomePage;