import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import VendorLayout from '../../components/VendorLayout';
import { productosService, negociosService } from '../../config/api';
import { useToast } from '../../context/ToastContext';
import ZLoader from '../../components/ZLoader';
import '../../styles/VendorProductos.css';
import Icon from '../../components/Icons';
import { cx, titulo, subtitulo, btn, chip, chipsFila } from '../../ui/tw';
import { urlImagen } from '../../utils/media';

const productoDeApi = (p) => ({
  id: p.id,
  nombre: p.nombre,
  categoria: p.categoria || 'Otros',
  precio: Number(p.precio),
  precioOriginal: p.precio_original ? Number(p.precio_original) : null,
  enOferta: !!p.en_oferta,
  ofertaExpira: p.oferta_expira || null,
  stock: p.stock,
  foto: p.imagenes?.[0] || null,
  pausado: !p.es_visible,
  vendidos: p.total_vendidos || 0,
});

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

const DURACIONES_RAPIDAS = [
  { label: '1 hora',   horas: 1 },
  { label: '6 horas',  horas: 6 },
  { label: '24 horas', horas: 24 },
  { label: '3 días',   horas: 72 },
  { label: '7 días',   horas: 168 },
];

const fmtFecha = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

// ── Modal de oferta ───────────────────────────────────────────────────────────
const OfertaModal = ({ producto, onClose, onCreada, onCancelada }) => {
  const { addToast } = useToast();
  const [precioOferta, setPrecioOferta] = useState('');
  const [duracion, setDuracion] = useState(24);
  const [personalizada, setPersonalizada] = useState(false);
  const [fechaFin, setFechaFin] = useState('');
  const [saving, setSaving] = useState(false);

  if (!producto) return null;

  const handleCrear = async () => {
    const precio = Number(precioOferta);
    if (!precio || precio <= 0) { addToast('Ingresa un precio de oferta válido', 'error'); return; }
    if (precio >= producto.precio) { addToast('El precio de oferta debe ser menor al precio actual', 'error'); return; }
    if (personalizada && !fechaFin) { addToast('Elige la fecha y hora de fin', 'error'); return; }

    setSaving(true);
    try {
      const payload = personalizada
        ? { precio_oferta: precio, fecha_fin: new Date(fechaFin).toISOString() }
        : { precio_oferta: precio, horas: duracion };
      const { data } = await productosService.crearOferta(producto.id, payload);
      onCreada(producto.id, data);
      addToast('Oferta creada ✓', 'success');
      onClose();
    } catch (err) {
      addToast(err.response?.data?.detail || 'No se pudo crear la oferta', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelar = async () => {
    setSaving(true);
    try {
      const { data } = await productosService.cancelarOferta(producto.id);
      onCancelada(producto.id, data);
      addToast('Oferta cancelada', 'info');
      onClose();
    } catch (err) {
      addToast(err.response?.data?.detail || 'No se pudo cancelar la oferta', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="vp-modal-overlay" onClick={onClose}>
      <div className="vp-modal" onClick={e => e.stopPropagation()}>
        <div className="vp-modal-header">
          <h3>Oferta · {producto.nombre}</h3>
          <button className="vp-modal-close" onClick={onClose}>✕</button>
        </div>

        {producto.enOferta ? (
          <div className="vp-modal-body">
            <p>Esta oferta está activa hasta <strong>{fmtFecha(producto.ofertaExpira)}</strong>.</p>
            <p>Precio de oferta actual: <strong>{fmt(producto.precio)}</strong> (normal: {fmt(producto.precioOriginal)})</p>
            <button className="vp-action-btn vp-action-btn--pause" disabled={saving} onClick={handleCancelar} style={{ width: '100%', marginTop: 12 }}>
              {saving ? 'Cancelando...' : 'Cancelar oferta'}
            </button>
          </div>
        ) : (
          <div className="vp-modal-body">
            <label className="vp-modal-label">Precio de oferta (actual: {fmt(producto.precio)})</label>
            <input
              type="number"
              className="vp-modal-input"
              placeholder="Ej: 15000"
              value={precioOferta}
              onChange={e => setPrecioOferta(e.target.value)}
            />

            <label className="vp-modal-label" style={{ marginTop: 14 }}>Duración</label>
            <div className="vp-modal-duraciones">
              {DURACIONES_RAPIDAS.map(d => (
                <button
                  key={d.horas}
                  type="button"
                  className={`vp-modal-dur-btn ${!personalizada && duracion === d.horas ? 'vp-modal-dur-btn--active' : ''}`}
                  onClick={() => { setPersonalizada(false); setDuracion(d.horas); }}
                >
                  {d.label}
                </button>
              ))}
              <button
                type="button"
                className={`vp-modal-dur-btn ${personalizada ? 'vp-modal-dur-btn--active' : ''}`}
                onClick={() => setPersonalizada(true)}
              >
                Personalizada
              </button>
            </div>

            {personalizada && (
              <input
                type="datetime-local"
                className="vp-modal-input"
                style={{ marginTop: 10 }}
                value={fechaFin}
                onChange={e => setFechaFin(e.target.value)}
              />
            )}

            <button className="vp-new-btn" disabled={saving} onClick={handleCrear} style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}>
              {saving ? 'Creando...' : '✓ Activar oferta'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
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
  const [ofertaModalProd, setOfertaModalProd] = useState(null);

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

  const actualizarProductoLocal = (id, dataApi) => {
    setProductos(prev => prev.map(p => p.id === id ? {
      ...p,
      precio: Number(dataApi.precio),
      precioOriginal: dataApi.precio_original ? Number(dataApi.precio_original) : null,
      enOferta: !!dataApi.en_oferta,
      ofertaExpira: dataApi.oferta_expira || null,
    } : p));
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
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className={titulo}>Mis Productos</h1>
          <p className={subtitulo}>{filtrados.length} producto{filtrados.length !== 1 ? 's' : ''} en tu catálogo</p>
        </div>
        {/* En celulares pequenos solo "+ Nuevo" para que no empuje el titulo */}
        <button className={cx(btn.principal, 'shrink-0 shadow-md shadow-zippy/30')} onClick={() => navigate('/vendor/productos/nuevo')}>
          + Nuevo<span className="hidden sm:inline">&nbsp;producto</span>
        </button>
      </div>

      {stockBajoCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border-[1.5px] border-l-4 border-solid border-amber-200 border-l-amber-500 bg-amber-50 p-3 text-amber-800 dark:border-amber-500/30 dark:border-l-amber-500 dark:bg-amber-500/10 dark:text-amber-200">
          <span className="shrink-0 text-amber-600"><Icon name="alerta" size={20} /></span>
          <span className="min-w-0 flex-1 text-[13.5px] leading-snug">
            Tienes <strong>{stockBajoCount}</strong> producto{stockBajoCount !== 1 ? 's' : ''} por agotarse
          </span>
          <button className={cx(btn.principal, 'border-0 bg-amber-500 px-3 py-1.5 text-[13px] hover:bg-amber-600')} onClick={() => setFiltro('stock-bajo')}>Ver productos</button>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-2.5">
        <div className={chipsFila}>
          {FILTROS.map(f => (
            <button key={f.id} className={chip(filtro === f.id)} onClick={() => setFiltro(f.id)}>
              {f.label} <span className="ml-1 rounded-full bg-black/10 px-1.5 text-[11px]">{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <div className="vp-toolbar-right flex w-full items-center gap-2 sm:w-auto">
          <select className="vp-sort-select min-w-0 flex-1" value={orden} onChange={e => setOrden(e.target.value)}>
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
          <div className="vp-empty-icon text-slate-400"><Icon name="paquete" size={40} /></div>
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
                      <img src={urlImagen(p.foto)} alt={p.nombre} loading="lazy" />
                      <span className="vp-cat-badge">{p.categoria}</span>
                    </>
                  ) : (
                    <div className="vp-photo-placeholder">
                      <span className="vp-photo-icon-emoji flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70 text-indigo-400 dark:bg-white/10"><Icon name="paquete" size={28} /></span>
                      <span className="vp-photo-cat-label">{p.categoria}</span>
                    </div>
                  )}
                  {p.pausado && <span className="vp-paused-tag">Pausado</span>}
                </div>
                <div className="vp-info">
                  <p className="vp-nombre">{p.nombre}</p>
                  {p.enOferta ? (
                    <p className="vp-precio">
                      {fmt(p.precio)} <span style={{ textDecoration: 'line-through', color: '#9ca3af', fontSize: 13, fontWeight: 400 }}>{fmt(p.precioOriginal)}</span>
                      <span className="vp-oferta-badge">En oferta</span>
                    </p>
                  ) : (
                    <p className="vp-precio">{fmt(p.precio)}</p>
                  )}
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
                    <span className="vp-sold-icon inline-flex"><Icon name="carrito" size={13} /></span> {p.vendidos} vendidos esta semana
                  </div>
                  <div className="vp-actions flex-wrap [&>button]:inline-flex [&>button]:min-w-[80px] [&>button]:items-center [&>button]:justify-center [&>button]:gap-1">
                    <button className="vp-action-btn vp-action-btn--edit" onClick={() => navigate(`/vendor/productos/${p.id}/editar`)}>
                      <Icon name="editar" size={14} /> Editar
                    </button>
                    <button
                      className={`vp-action-btn ${p.pausado ? 'vp-action-btn--activate' : 'vp-action-btn--pause'}`}
                      onClick={() => togglePausado(p.id)}
                    >
                      {p.pausado ? 'Activar' : 'Pausar'}
                    </button>
                    <button className="vp-action-btn" onClick={() => setOfertaModalProd(p)}>
                      <Icon name="rayo" size={14} /> {p.enOferta ? 'Ver oferta' : 'Oferta'}
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
                  {p.foto ? <img src={urlImagen(p.foto)} alt={p.nombre} loading="lazy" /> : <span className="vp-list-icon text-indigo-400"><Icon name="paquete" size={22} /></span>}
                </div>
                <div className="vp-list-info">
                  <p className="vp-list-nombre">{p.nombre}</p>
                  <span className="vp-list-cat">{p.categoria}</span>
                  {p.pausado && <span className="vp-paused-tag vp-paused-tag--inline">Pausado</span>}
                </div>
                <div className="vp-list-precio">
                  {p.enOferta ? (
                    <>
                      {fmt(p.precio)} <span style={{ textDecoration: 'line-through', color: '#9ca3af', fontSize: 12 }}>{fmt(p.precioOriginal)}</span>
                    </>
                  ) : fmt(p.precio)}
                </div>
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
                  <span className="vp-sold-icon inline-flex"><Icon name="carrito" size={13} /></span> {p.vendidos} vendidos
                </div>
                <div className="vp-list-actions">
                  <button className="vp-action-btn vp-action-btn--edit" onClick={() => navigate(`/vendor/productos/${p.id}/editar`)}>
                    <Icon name="editar" size={14} /> Editar
                  </button>
                  <button
                    className={`vp-action-btn ${p.pausado ? 'vp-action-btn--activate' : 'vp-action-btn--pause'}`}
                    onClick={() => togglePausado(p.id)}
                  >
                    {p.pausado ? 'Activar' : 'Pausar'}
                  </button>
                  <button className="vp-action-btn" onClick={() => setOfertaModalProd(p)}>
                    <Icon name="rayo" size={14} /> {p.enOferta ? 'Ver oferta' : 'Oferta'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <OfertaModal
        producto={ofertaModalProd}
        onClose={() => setOfertaModalProd(null)}
        onCreada={actualizarProductoLocal}
        onCancelada={actualizarProductoLocal}
      />
    </VendorLayout>
  );
};

export default VendorProductosPage;