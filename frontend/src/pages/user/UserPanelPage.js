import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoadScript, GoogleMap, Marker } from '@react-google-maps/api';
import UserLayout from '../../components/UserLayout';
import OrdenChat from '../../components/OrdenChat';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { useTheme } from '../../context/ThemeContext';
import { ordenesService, negociosService, productosService, resenasService, usuariosService } from '../../config/api';
import { MAPS_KEY, MAPS_LIBRARIES, GARZON } from '../../config/googleMaps';
import '../../styles/UserPanel.css';

const MAP_STYLE = { width: '100%', height: '220px', borderRadius: '12px' };

const PASO_LABEL = {
  pendiente:          'Recibido',
  confirmada:          'Confirmado',
  en_preparacion:      'En preparación',
  lista_para_retirar:  'Listo para recoger',
  en_domicilio:        'En camino',
  entregada:           'Entregado',
  cancelada:           'Cancelado',
};

const ESTADO_UI = {
  pendiente:          'Pendiente',
  confirmada:          'Pendiente',
  en_preparacion:      'Pendiente',
  lista_para_retirar:  'Pendiente',
  en_domicilio:        'En camino',
  entregada:           'Entregado',
  cancelada:           'Cancelado',
};
const fmtFecha = iso => new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });

/* ── Mock data (todavía no hay backend para esto) ─────────── */
const GUARDADOS = [
  { id: 1, nombre: 'Café Premium 500g', tienda: 'Café La Montaña',   precio: 18000, emoji: '☕', grad: 'linear-gradient(135deg,#fff3e6,#fed7aa)' },
  { id: 3, nombre: 'Torta Chocolate',   tienda: 'Pastelería Dulce',  precio: 35000, emoji: '🎂', grad: 'linear-gradient(135deg,#f5f3ff,#ddd6fe)' },
  { id: 6, nombre: 'Brownie',           tienda: 'Pastelería Dulce',  precio: 6000,  emoji: '🍫', grad: 'linear-gradient(135deg,#fff3e6,#fed7aa)' },
];

const DIRECCIONES_INIT = [
  { id: 1, label: 'Casa', dir: 'Cra 5 #23-45, Apto 402', ciudad: 'Garzón', principal: true  },
  { id: 2, label: 'Trabajo', dir: 'Calle 10 #7-80, Of. 201', ciudad: 'Garzón', principal: false },
];

const ESTADO_STYLE = {
  Entregado: { bg: '#dcfce7', color: '#15803d' },
  'En camino': { bg: '#fef3c7', color: '#b45309' },
  Cancelado:  { bg: '#fee2e2', color: '#b91c1c' },
  Pendiente:  { bg: '#e0e7ff', color: '#3730a3' },
};

const fmt = n => `$${n.toLocaleString('es-CO')}`;

/* ── Tabs ────────────────────────────────────────────────── */
const TABS = [
  { id: 'pedidos',     icon: '📦', label: 'Pedidos'    },
  { id: 'guardados',   icon: '♥',  label: 'Guardados'  },
  { id: 'direcciones', icon: '📍', label: 'Direcciones'},
  { id: 'cuenta',      icon: '⚙️', label: 'Cuenta'     },
];

/* ── Pedidos ─────────────────────────────────────────────── */
const SeccionPedidos = ({ pedidos, loading, onTrack, onCalificar }) => {
  if (loading) return <p>Cargando pedidos...</p>;
  if (pedidos.length === 0) return (
    <div className="up-empty">
      <span>📦</span>
      <p>Todavía no has hecho ningún pedido</p>
    </div>
  );

  return (
    <div className="up-list">
      {pedidos.map(p => {
        const st = ESTADO_STYLE[p.estado] || ESTADO_STYLE.Pendiente;
        return (
          <div key={p.id} className="up-order-card">
            <div className="up-order-top">
              <span className="up-order-id">{p.id}</span>
              <span className="up-order-badge" style={{ background: st.bg, color: st.color }}>
                {p.estado}
              </span>
            </div>
            <p className="up-order-tienda">🏪 {p.tienda}</p>
            <p className="up-order-items">{p.items}</p>
            <div className="up-order-bottom">
              <span className="up-order-fecha">{p.fecha}</span>
              <span className="up-order-total">{fmt(p.total)}</span>
            </div>
            {(p.estado === 'En camino' || p.estado === 'Pendiente') && (
              <button className="up-track-btn" onClick={() => onTrack(p)}>
                🛵 Ver seguimiento
              </button>
            )}
            {p.estado === 'Entregado' && (
              <button className="up-track-btn" onClick={() => onCalificar(p)}>
                ⭐ Calificar pedido
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ── Calificar pedido (reseña real, recalcula la calificación de la tienda) ─ */
const StarPicker = ({ value, onChange }) => (
  <div className="up-stars">
    {[1, 2, 3, 4, 5].map(n => (
      <button
        key={n}
        type="button"
        className={`up-star ${n <= value ? 'up-star--on' : ''}`}
        onClick={() => onChange(n)}
      >★</button>
    ))}
  </div>
);

const CalificarModal = ({ pedido, onClose }) => {
  const { addToast } = useToast();
  const [loading, setLoading]     = useState(true);
  const [existente, setExistente] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [form, setForm] = useState({ calificacion_general: 0, calificacion_producto: 0, calificacion_entrega: 0, comentario: '' });

  useEffect(() => {
    if (!pedido) return;
    let activo = true;
    setLoading(true);
    setForm({ calificacion_general: 0, calificacion_producto: 0, calificacion_entrega: 0, comentario: '' });
    resenasService.obtenerPorOrden(pedido.idCompleto)
      .then(({ data }) => { if (activo) setExistente(data); })
      .catch(() => { if (activo) setExistente(null); })
      .finally(() => { if (activo) setLoading(false); });
    return () => { activo = false; };
  }, [pedido]);

  if (!pedido) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.calificacion_general) { addToast('Selecciona una calificación general', 'error'); return; }
    setSaving(true);
    try {
      const { data } = await resenasService.crear({
        orden_id: pedido.idCompleto,
        calificacion_general: form.calificacion_general,
        calificacion_producto: form.calificacion_producto || undefined,
        calificacion_entrega: form.calificacion_entrega || undefined,
        comentario: form.comentario || undefined,
      });
      setExistente(data);
      addToast('¡Gracias por tu calificación!', 'success');
    } catch (err) {
      addToast(err.response?.data?.detail || 'No se pudo enviar la calificación', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="up-modal-overlay" onClick={onClose}>
      <div className="up-modal" onClick={e => e.stopPropagation()}>
        <div className="up-modal-header">
          <h3>Calificar {pedido.id}</h3>
          <button className="up-modal-close" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <p style={{ padding: 20 }}>Cargando...</p>
        ) : existente ? (
          <div className="up-track-status" style={{ margin: 16 }}>
            <p>✓ Ya calificaste este pedido con {existente.calificacion_general} ⭐</p>
            {existente.comentario && <p style={{ marginTop: 8 }}>"{existente.comentario}"</p>}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: '4px 20px 20px' }}>
            <div className="up-field">
              <label>Calificación general *</label>
              <StarPicker value={form.calificacion_general} onChange={v => setForm(p => ({ ...p, calificacion_general: v }))} />
            </div>
            <div className="up-field">
              <label>Productos</label>
              <StarPicker value={form.calificacion_producto} onChange={v => setForm(p => ({ ...p, calificacion_producto: v }))} />
            </div>
            <div className="up-field">
              <label>Entrega</label>
              <StarPicker value={form.calificacion_entrega} onChange={v => setForm(p => ({ ...p, calificacion_entrega: v }))} />
            </div>
            <div className="up-field">
              <label>Comentario (opcional)</label>
              <textarea
                rows={3}
                value={form.comentario}
                onChange={e => setForm(p => ({ ...p, comentario: e.target.value }))}
                placeholder="¿Cómo fue tu experiencia?"
              />
            </div>
            <button type="submit" className="up-btn-primary" disabled={saving}>
              {saving ? 'Enviando...' : 'Enviar calificación'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

/* ── Seguimiento de pedido (mapa real + estado real) ──────── */
const SeguimientoModal = ({ pedido, onClose }) => {
  const { isLoaded } = useLoadScript({ googleMapsApiKey: MAPS_KEY, libraries: MAPS_LIBRARIES });
  const [driverPos, setDriverPos] = useState(null);
  const [destino, setDestino]     = useState(null);
  const [ubicacion, setUbicacion] = useState(null);
  const [pasos, setPasos]         = useState([]);

  useEffect(() => {
    if (!pedido) return;
    let activo = true;
    const cargarUbicacion = async () => {
      try {
        const { data } = await ordenesService.ubicacionDomiciliario(pedido.idCompleto);
        if (!activo) return;
        setUbicacion(data);
        if (data.lat != null && data.lng != null) setDriverPos({ lat: data.lat, lng: data.lng });
      } catch { /* sin permiso o sin domiciliario aún */ }
    };
    cargarUbicacion();
    const interval = setInterval(cargarUbicacion, 12000);
    return () => { activo = false; clearInterval(interval); };
  }, [pedido]);

  useEffect(() => {
    if (!pedido) return;
    let activo = true;
    ordenesService.seguimiento(pedido.idCompleto)
      .then(({ data }) => { if (activo) setPasos(data); })
      .catch(() => { if (activo) setPasos([]); });
    return () => { activo = false; };
  }, [pedido]);

  useEffect(() => {
    if (!pedido || !isLoaded || !window.google || !pedido.direccion) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: `${pedido.direccion}, Garzón, Huila, Colombia` }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const loc = results[0].geometry.location;
        setDestino({ lat: loc.lat(), lng: loc.lng() });
      }
    });
  }, [pedido, isLoaded]);

  if (!pedido) return null;

  return (
    <div className="up-modal-overlay" onClick={onClose}>
      <div className="up-modal" onClick={e => e.stopPropagation()}>
        <div className="up-modal-header">
          <h3>Seguimiento {pedido.id}</h3>
          <button className="up-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="up-track-map">
          {!MAPS_KEY ? (
            <div className="up-track-map-msg">Mapa no disponible</div>
          ) : isLoaded ? (
            <GoogleMap mapContainerStyle={MAP_STYLE} center={driverPos || destino || GARZON} zoom={14}>
              {destino   && <Marker position={destino}   label="🏠" />}
              {driverPos && <Marker position={driverPos} label="🛵" />}
            </GoogleMap>
          ) : (
            <div className="up-track-map-msg">Cargando mapa...</div>
          )}
        </div>

        <div className="up-track-status">
          {ubicacion?.asignado ? (
            <>
              <p>🛵 <strong>{ubicacion.domiciliario_nombre || 'Un repartidor'}</strong> va en camino con tu pedido.</p>
              {ubicacion.domiciliario_telefono && (
                <a className="up-track-call-btn" href={`tel:${ubicacion.domiciliario_telefono}`}>
                  📞 Llamar al repartidor
                </a>
              )}
            </>
          ) : pedido.estado === 'En camino' ? (
            <p>🛵 Tu pedido va en camino.</p>
          ) : (
            <p>📦 Tu pedido está siendo preparado. Aún no hay un repartidor asignado.</p>
          )}
        </div>

        {ubicacion?.asignado && <OrdenChat ordenId={pedido.idCompleto} />}

        {pasos.length > 0 && (
          <div className="up-track-steps">
            {pasos.map(s => (
              <div key={s.id} className="up-track-step">
                <span className="up-track-step-dot" />
                <div>
                  <p className="up-track-step-label">{PASO_LABEL[s.estado_nuevo] || s.estado_nuevo}</p>
                  <p className="up-track-step-fecha">{new Date(s.fecha).toLocaleString('es-CO')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Guardados ───────────────────────────────────────────── */
const SeccionGuardados = ({ addItem, addToast }) => {
  const [guardados, setGuardados] = useState(GUARDADOS);

  const quitar = id => setGuardados(prev => prev.filter(g => g.id !== id));

  return guardados.length === 0 ? (
    <div className="up-empty">
      <span>♡</span>
      <p>No tienes productos guardados</p>
    </div>
  ) : (
    <div className="up-saved-grid">
      {guardados.map(p => (
        <div key={p.id} className="up-saved-card">
          <div className="up-saved-photo" style={{ background: p.grad }}>
            <span>{p.emoji}</span>
            <button className="up-saved-remove" onClick={() => quitar(p.id)}>✕</button>
          </div>
          <div className="up-saved-info">
            <p className="up-saved-name">{p.nombre}</p>
            <p className="up-saved-tienda">{p.tienda}</p>
            <p className="up-saved-price">{fmt(p.precio)}</p>
            <button
              className="up-saved-add"
              onClick={() => { addItem(p); addToast(`${p.nombre} agregado`, 'success'); }}
            >
              + Agregar al carrito
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

/* ── Direcciones ─────────────────────────────────────────── */
const SeccionDirecciones = ({ addToast }) => {
  const [dirs, setDirs]         = useState(DIRECCIONES_INIT);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ label: '', dir: '', ciudad: 'Garzón' });

  const agregar = (e) => {
    e.preventDefault();
    if (!form.label || !form.dir) return;
    setDirs(prev => [...prev, { id: Date.now(), ...form, principal: false }]);
    setForm({ label: '', dir: '', ciudad: 'Garzón' });
    setShowForm(false);
    addToast('Dirección agregada', 'success');
  };

  const setPrincipal = id => setDirs(prev => prev.map(d => ({ ...d, principal: d.id === id })));
  const eliminar     = id => setDirs(prev => prev.filter(d => d.id !== id));

  return (
    <div className="up-list">
      {dirs.map(d => (
        <div key={d.id} className={`up-addr-card ${d.principal ? 'up-addr-card--main' : ''}`}>
          <div className="up-addr-top">
            <div>
              <span className="up-addr-label">{d.label}</span>
              {d.principal && <span className="up-addr-chip">Principal</span>}
            </div>
            <div className="up-addr-actions">
              {!d.principal && (
                <button className="up-addr-btn" onClick={() => setPrincipal(d.id)}>Usar</button>
              )}
              <button className="up-addr-btn up-addr-btn--del" onClick={() => eliminar(d.id)}>✕</button>
            </div>
          </div>
          <p className="up-addr-dir">📍 {d.dir}</p>
          <p className="up-addr-ciudad">{d.ciudad}</p>
        </div>
      ))}

      {showForm ? (
        <form className="up-addr-form" onSubmit={agregar}>
          <input
            placeholder="Etiqueta (Casa, Trabajo...)"
            value={form.label}
            onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
            required
          />
          <input
            placeholder="Dirección completa"
            value={form.dir}
            onChange={e => setForm(p => ({ ...p, dir: e.target.value }))}
            required
          />
          <div className="up-addr-form-row">
            <button type="submit" className="up-btn-primary">Guardar</button>
            <button type="button" className="up-btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </form>
      ) : (
        <button className="up-add-dir-btn" onClick={() => setShowForm(true)}>
          + Agregar dirección
        </button>
      )}
    </div>
  );
};

/* ── Cuenta ──────────────────────────────────────────────── */
const SeccionCuenta = ({ addToast }) => {
  const navigate = useNavigate();
  const { isDark, toggle } = useTheme();
  const stored   = JSON.parse(localStorage.getItem('usuario') || '{}');
  const [form, setForm] = useState({ nombre: stored.nombre || '', telefono: stored.telefono || '' });
  const [notifs, setNotifs] = useState({ pedidos: true, ofertas: true, guardados: false });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await usuariosService.actualizarPerfil({ nombre: form.nombre, telefono: form.telefono });
      localStorage.setItem('usuario', JSON.stringify({ ...stored, nombre: form.nombre, telefono: form.telefono }));
      addToast('Perfil actualizado', 'success');
    } catch (err) {
      addToast(err.response?.data?.detail || 'No se pudo actualizar el perfil', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('usuario');
    navigate('/login');
  };

  return (
    <div className="up-list">
      <form className="up-cuenta-card" onSubmit={handleSave}>
        <p className="up-cuenta-section">Información personal</p>
        <div className="up-field">
          <label>Nombre</label>
          <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Tu nombre" />
        </div>
        <div className="up-field">
          <label>Teléfono</label>
          <input value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} placeholder="300-000-0000" />
        </div>
        <div className="up-field">
          <label>Email</label>
          <input type="email" value={stored.email || ''} disabled />
        </div>
        <button type="submit" className="up-btn-primary" disabled={saving}>
          {saving ? 'Guardando...' : '✓ Guardar cambios'}
        </button>
      </form>

      <div className="up-cuenta-card">
        <p className="up-cuenta-section">Notificaciones</p>
        {[
          { id: 'pedidos',   label: 'Estado de mis pedidos', desc: 'Cuando tu orden cambia de estado' },
          { id: 'ofertas',   label: 'Ofertas y promociones', desc: 'Descuentos de tus tiendas favoritas' },
          { id: 'guardados', label: 'Vuelven al stock',      desc: 'Cuando un guardado vuelve a estar disponible' },
        ].map(n => (
          <div key={n.id} className="up-notif-row">
            <div>
              <p className="up-notif-label">{n.label}</p>
              <p className="up-notif-desc">{n.desc}</p>
            </div>
            <button
              className={`up-toggle ${notifs[n.id] ? 'up-toggle--on' : ''}`}
              onClick={() => setNotifs(p => ({ ...p, [n.id]: !p[n.id] }))}
            >
              <span className="up-toggle-thumb" />
            </button>
          </div>
        ))}
      </div>

      <div className="up-cuenta-card">
        <p className="up-cuenta-section">Apariencia</p>
        <div className="up-notif-row">
          <div>
            <p className="up-notif-label">Modo oscuro</p>
            <p className="up-notif-desc">Cambia la apariencia de toda la app</p>
          </div>
          <button
            className={`up-toggle ${isDark ? 'up-toggle--on' : ''}`}
            onClick={() => { toggle(); addToast(isDark ? 'Modo claro activado' : 'Modo oscuro activado', 'info'); }}
          >
            <span className="up-toggle-thumb" />
          </button>
        </div>
      </div>

      <button className="up-logout-btn" onClick={handleLogout}>
        🚪 Cerrar sesión
      </button>
    </div>
  );
};

/* ── Main page ───────────────────────────────────────────── */
const UserPanelPage = () => {
  const navigate    = useNavigate();
  const { addItem } = useCart();
  const { addToast }= useToast();
  const [tab, setTab] = useState('pedidos');

  const [pedidos, setPedidos] = useState([]);
  const [loadingPedidos, setLoadingPedidos] = useState(true);
  const [trackingPedido, setTrackingPedido] = useState(null);
  const [calificarPedido, setCalificarPedido] = useState(null);

  const usuario  = JSON.parse(localStorage.getItem('usuario') || '{}');

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const { data: ordenesRaw } = await ordenesService.listar();

        const negocioIds  = [...new Set(ordenesRaw.map(o => o.negocio_id))];
        const productoIds = [...new Set(ordenesRaw.flatMap(o => o.items.map(it => it.producto_id)))];

        const [negociosPairs, productosPairs] = await Promise.all([
          Promise.all(negocioIds.map(id => negociosService.obtener(id).then(({ data }) => [id, data.nombre_negocio]).catch(() => [id, 'Tienda']))),
          Promise.all(productoIds.map(id => productosService.obtener(id).then(({ data }) => [id, data.nombre]).catch(() => [id, 'Producto']))),
        ]);
        const negociosMap  = Object.fromEntries(negociosPairs);
        const productosMap = Object.fromEntries(productosPairs);

        const pedidosReales = ordenesRaw.map(o => ({
          id: `#${o.id.slice(0, 8)}`,
          idCompleto: o.id,
          fecha: fmtFecha(o.fecha_creacion),
          estado: ESTADO_UI[o.estado] || 'Pendiente',
          items: o.items.map(it => `${productosMap[it.producto_id] || 'Producto'} x${it.cantidad}`).join(', '),
          total: Number(o.total),
          tienda: negociosMap[o.negocio_id] || 'Tienda',
          direccion: o.direccion_entrega,
        }));

        if (activo) setPedidos(pedidosReales);
      } catch {
        if (activo) setPedidos([]);
      } finally {
        if (activo) setLoadingPedidos(false);
      }
    })();
    return () => { activo = false; };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('usuario');
    navigate('/login');
  };
  const inicial  = (usuario.nombre || 'U').charAt(0).toUpperCase();
  const gastado  = pedidos.filter(p => p.estado === 'Entregado').reduce((s, p) => s + p.total, 0);

  const content = {
    pedidos:     <SeccionPedidos pedidos={pedidos} loading={loadingPedidos} onTrack={setTrackingPedido} onCalificar={setCalificarPedido} />,
    guardados:   <SeccionGuardados addItem={addItem} addToast={addToast} />,
    direcciones: <SeccionDirecciones addToast={addToast} />,
    cuenta:      <SeccionCuenta addToast={addToast} />,
  };

  return (
    <UserLayout>
      {/* Profile header */}
      <div className="up-profile">
        <div className="up-profile-avatar">{inicial}</div>
        <div className="up-profile-info">
          <p className="up-profile-name">{usuario.nombre || 'Usuario'}</p>
          <p className="up-profile-email">{usuario.email || 'usuario@zippy.com'}</p>
        </div>
        <div className="up-profile-actions">
          <button className="up-profile-edit" onClick={() => setTab('cuenta')}>✏️</button>
          <button className="up-profile-logout" onClick={handleLogout} title="Cerrar sesión">🚪</button>
        </div>

        <div className="up-stats">
          <div className="up-stat">
            <span className="up-stat-val">{pedidos.length}</span>
            <span className="up-stat-label">Pedidos</span>
          </div>
          <div className="up-stat-div" />
          <div className="up-stat">
            <span className="up-stat-val">{fmt(gastado)}</span>
            <span className="up-stat-label">Gastado</span>
          </div>
          <div className="up-stat-div" />
          <div className="up-stat">
            <span className="up-stat-val">{GUARDADOS.length}</span>
            <span className="up-stat-label">Guardados</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="up-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`up-tab ${tab === t.id ? 'up-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="up-content">
        {content[tab]}
      </div>

      <SeguimientoModal pedido={trackingPedido} onClose={() => setTrackingPedido(null)} />
      <CalificarModal pedido={calificarPedido} onClose={() => setCalificarPedido(null)} />
    </UserLayout>
  );
};

export default UserPanelPage;
