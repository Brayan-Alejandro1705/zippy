import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import VendorLayout from '../../components/VendorLayout';
import { productosService, negociosService } from '../../config/api';
import { useToast } from '../../context/ToastContext';
import ZLoader from '../../components/ZLoader';
import '../../styles/VendorProductos.css';

const productoDeApi = (p) => ({
  id: p.id,
  nombre: p.nombre,
  categoria: p.categoria || 'Otros',
  precio: Number(p.precio),
  stock: p.stock,
  foto: p.imagenes?.[0] || null,
  pausado: !p.es_visible,
  vendidos: p.total_vendidos || 0,
});

const CATEGORY_ICONS = {
  'Bebidas':    '☕',
  'Panadería':  '🥐',
  'Pastelería': '🍰',
};
const DEFAULT_CAT_ICON = '🛍️';

const FILTROS = [
  { id: 'todos',      label: 'Todos'      },
  { id: 'disponible', label: 'Disponible' },
  { id: 'stock-bajo', label: 'Stock Bajo' },
  { id: 'pausados',   label: 'Pausados'   },
];

const ORDENES = [
  { id: 'default',       label: 'Más reciente'         },
  { id: 'precio-desc',   label: 'Precio: mayor a menor' },
  { id: 'precio-asc',    label: 'Precio: menor a mayor' },
  { id: 'stock-desc',    label: 'Stock: mayor a menor'  },
  { id: 'stock-asc',     label: 'Stock: menor a mayor'  },
  { id: 'vendidos-desc', label: 'Más vendidos'          },
];

const fmt = (n) => `$${n.toLocaleString('es-CO')}`;

const stockStatus = (stock) => {
  if (stock <= 10) return { label: 'Stock bajo', color: '#ef4444', bg: '#fef2f2' };
  if (stock <= 30) return { label: 'Stock medio', color: '#f59e0b', bg: '#fffbeb' };
  return { label: 'Disponible', color: '#10b981', bg: '#ecfdf5' };
};

const VendorProductosPage = () => {
  const navigate  = useNavigate();
  const { addToast } = useToast();
  const [query, setQuery]         = useState('');
  const [productos, setProductos] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filtro, setFiltro]       = useState('todos');
  const [orden, setOrden]         = useState('default');
  const [vista, setVista]         = useState('grid');

  useEffect(() => {
    const cargar = async () => {
      try {
        const { data: negocio } = await negociosService.miNegocio();
        const { data } = await productosService.listar(negocio.id);
        setProductos(data.map(productoDeApi));
      } catch {
        addToast('No se pudieron cargar tus productos', 'error');
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [addToast]);

  const togglePausado = async (id) => {
    const actual = productos.find(p => p.id === id);
    if (!actual) return;
    try {
      await productosService.actualizar(id, { es_visible: actual.pausado });
      setProductos(prev => prev.map(p => p.id === id ? { ...p, pausado: !p.pausado } : p));
    } catch {
      addToast('No se pudo actualizar el producto', 'error');
    }
  };

  const counts = {
    todos:        productos.length,
    disponible:   productos.filter(p => !p.pausado && p.stock > 10).length,
    'stock-bajo': productos.filter(p => p.stock <= 10).length,
    pausados:     productos.filter(p => p.pausado).length,
  };

  const filtrados = productos
    .filter(p => p.nombre.toLowerCase().includes(query.toLowerCase()))
    .filter(p => {
      if (filtro === 'disponible') return !p.pausado && p.stock > 10;
      if (filtro === 'stock-bajo') return p.stock <= 10;
      if (filtro === 'pausados')   return p.pausado;
      return true;
    })
    .sort((a, b) => {
      switch (orden) {
        case 'precio-desc':   return b.precio - a.precio;
        case 'precio-asc':    return a.precio - b.precio;
        case 'stock-desc':    return b.stock - a.stock;
        case 'stock-asc':     return a.stock - b.stock;
        case 'vendidos-desc': return b.vendidos - a.vendidos;
        default:              return 0;
      }
    });

  const stockBajoCount = counts['stock-bajo'];

  return (
    <VendorLayout searchPlaceholder="Buscar producto..." onSearch={setQuery}>
      <div className="vp-header">
        <div>
          <h1 className="vp-title">Mis Productos</h1>
          <p className="vp-subtitle">{filtrados.length} producto{filtrados.length !== 1 ? 's' : ''} en tu catálogo</p>
        </div>
        <button className="vp-new-btn" onClick={() => navigate('/vendor/productos/nuevo')}>
          + Nuevo Producto
        </button>
      </div>

      {stockBajoCount > 0 && (
        <div className="vp-banner">
          <span className="vp-banner-icon">⚠️</span>
          <span className="vp-banner-text">
            Tienes <strong>{stockBajoCount}</strong> producto{stockBajoCount !== 1 ? 's' : ''} por agotarse
          </span>
          <button className="vp-banner-btn" onClick={() => setFiltro('stock-bajo')}>Ver productos</button>
        </div>
      )}

      <div className="vp-toolbar">
        <div className="vp-filters">
          {FILTROS.map(f => (
            <button
              key={f.id}
              className={`vp-filter-btn ${filtro === f.id ? 'vp-filter-btn--active' : ''}`}
              onClick={() => setFiltro(f.id)}
            >
              {f.label} <span className="vp-filter-count">{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <div className="vp-toolbar-right">
          <select className="vp-sort-select" value={orden} onChange={e => setOrden(e.target.value)}>
            {ORDENES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <div className="vp-view-toggle">
            <button
              className={`vp-view-btn ${vista === 'grid' ? 'vp-view-btn--active' : ''}`}
              onClick={() => setVista('grid')}
              title="Vista de grilla"
              aria-label="Vista de grilla"
            >▦</button>
            <button
              className={`vp-view-btn ${vista === 'lista' ? 'vp-view-btn--active' : ''}`}
              onClick={() => setVista('lista')}
              title="Vista de lista"
              aria-label="Vista de lista"
            >☰</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="vp-empty">
          <ZLoader label="Cargando productos..." />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="vp-empty">
          <div className="vp-empty-icon">📦</div>
          <p>No se encontraron productos.</p>
        </div>
      ) : vista === 'grid' ? (
        <div className="vp-grid">
          {filtrados.map(p => {
            const st = stockStatus(p.stock);
            const lowStock = p.stock <= 10;
            return (
              <div key={p.id} className={`vp-card ${lowStock ? 'vp-card--low-stock' : ''} ${p.pausado ? 'vp-card--pausado' : ''}`}>
                <div className="vp-photo">
                  {p.foto ? (
                    <>
                      <img src={p.foto} alt={p.nombre} />
                      <span className="vp-cat-badge">{p.categoria}</span>
                    </>
                  ) : (
                    <div className="vp-photo-placeholder">
                      <span className="vp-photo-icon-emoji">{CATEGORY_ICONS[p.categoria] || DEFAULT_CAT_ICON}</span>
                      <span className="vp-photo-cat-label">{p.categoria}</span>
                    </div>
                  )}
                  {p.pausado && <span className="vp-paused-tag">Pausado</span>}
                </div>
                <div className="vp-info">
                  <p className="vp-nombre">{p.nombre}</p>
                  <p className="vp-precio">{fmt(p.precio)}</p>
                  <div className="vp-bottom">
                    <span className="vp-stock">
                      <span className="vp-stock-dot" style={{ background: st.color }} />
                      {p.stock} uds.
                    </span>
                    <span className="vp-stock-badge" style={{ color: st.color, background: st.bg }}>
                      {st.label}
                    </span>
                  </div>
                  <div className="vp-sold">
                    <span className="vp-sold-icon">🔥</span> {p.vendidos} vendidos esta semana
                  </div>
                  <div className="vp-actions">
                    <button className="vp-action-btn vp-action-btn--edit" onClick={() => navigate(`/vendor/productos/${p.id}/editar`)}>
                      ✏️ Editar
                    </button>
                    <button
                      className={`vp-action-btn ${p.pausado ? 'vp-action-btn--activate' : 'vp-action-btn--pause'}`}
                      onClick={() => togglePausado(p.id)}
                    >
                      {p.pausado ? '▶ Activar' : '⏸ Pausar'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="vp-list">
          {filtrados.map(p => {
            const st = stockStatus(p.stock);
            const lowStock = p.stock <= 10;
            return (
              <div key={p.id} className={`vp-list-row ${lowStock ? 'vp-list-row--low-stock' : ''} ${p.pausado ? 'vp-list-row--pausado' : ''}`}>
                <div className="vp-list-photo">
                  {p.foto ? <img src={p.foto} alt={p.nombre} /> : <span className="vp-list-icon">{CATEGORY_ICONS[p.categoria] || DEFAULT_CAT_ICON}</span>}
                </div>
                <div className="vp-list-info">
                  <p className="vp-list-nombre">{p.nombre}</p>
                  <span className="vp-list-cat">{p.categoria}</span>
                  {p.pausado && <span className="vp-paused-tag vp-paused-tag--inline">Pausado</span>}
                </div>
                <div className="vp-list-precio">{fmt(p.precio)}</div>
                <div className="vp-list-stock">
                  <span className="vp-stock">
                    <span className="vp-stock-dot" style={{ background: st.color }} />
                    {p.stock} uds.
                  </span>
                  <span className="vp-stock-badge" style={{ color: st.color, background: st.bg }}>
                    {st.label}
                  </span>
                </div>
                <div className="vp-list-sold">
                  <span className="vp-sold-icon">🔥</span> {p.vendidos} vendidos
                </div>
                <div className="vp-list-actions">
                  <button className="vp-action-btn vp-action-btn--edit" onClick={() => navigate(`/vendor/productos/${p.id}/editar`)}>
                    ✏️ Editar
                  </button>
                  <button
                    className={`vp-action-btn ${p.pausado ? 'vp-action-btn--activate' : 'vp-action-btn--pause'}`}
                    onClick={() => togglePausado(p.id)}
                  >
                    {p.pausado ? '▶ Activar' : '⏸ Pausar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </VendorLayout>
  );
};

export default VendorProductosPage;
