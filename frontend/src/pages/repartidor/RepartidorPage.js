import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoadScript, GoogleMap, Marker, InfoWindow, DirectionsRenderer } from '@react-google-maps/api';
import { useTheme } from '../../context/ThemeContext';
import { ordenesService, usuariosService, productosService } from '../../config/api';
import { MAPS_KEY, MAPS_LIBRARIES, GARZON } from '../../config/googleMaps';
import '../../styles/RepartidorPage.css';

const MAP_OPTIONS = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  styles: [
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  ],
};

const ESTADO_CFG = {
  disponible: { label: 'Disponible', bg: '#fef3c7', color: '#b45309', btnLabel: 'Aceptar →',          btnClass: 'rp-btn--orange' },
  en_domicilio: { label: 'En camino',  bg: '#d1fae5', color: '#065f46', btnLabel: '✓ Marcar entregado', btnClass: 'rp-btn--green'  },
  entregada:    { label: 'Entregado ✓', bg: '#f0fdf4', color: '#15803d', btnLabel: null,                  btnClass: ''              },
};
const ESTADO_COLOR = { disponible: '#f59e0b', en_domicilio: '#10b981', entregada: '#94a3b8' };

const PAGO_CFG = {
  efectivo:      { label: 'Efectivo',      icon: '💵', bg: '#fee2e2', color: '#b91c1c' },
  tarjeta:       { label: 'Tarjeta',       icon: '💳', bg: '#dbeafe', color: '#1d4ed8' },
  transferencia: { label: 'Transferencia', icon: '🏦', bg: '#ede9fe', color: '#6d28d9' },
  billetera:     { label: 'Billetera',     icon: '📱', bg: '#dcfce7', color: '#15803d' },
};

const REPORT_REASONS = [
  '📵 Cliente no contesta',
  '📍 Dirección incorrecta',
  '🚪 Cliente no está en el lugar',
  '📦 Pedido incompleto o dañado',
  '❓ Otro problema',
];

const VEHICULOS = [
  { value: 'moto',      label: '🛵 Moto' },
  { value: 'bicicleta', label: '🚲 Bicicleta' },
  { value: 'carro',     label: '🚗 Carro' },
];

const NOTIF_OPTIONS = [
  { id: 'pedidos',  label: 'Pedidos nuevos',         desc: 'Cuando llega una orden disponible' },
  { id: 'mensajes', label: 'Mensajes del cliente',   desc: 'Avisos sobre direcciones e instrucciones' },
  { id: 'promos',   label: 'Noticias y promociones', desc: 'Novedades de Zippy' },
];

/* Posiciones del bottom sheet móvil (fracción de su altura desplazada hacia abajo) */
const SHEET_SNAP = { full: 0.04, half: 0.45, collapsed: 0.78 };

/* Comisión del repartidor sobre el valor de cada pedido entregado.
   No existe un sistema de liquidaciones real en el backend (igual que con los vendedores),
   así que esto es una tasa local, no un valor leído de configuración. */
const COMISION_PCT = 0.15;

const CAT_ICON = {
  bebidas: '☕', panadería: '🥖', pastelería: '🎂',
  'frutas y verduras': '🥦', lácteos: '🥛', carnes: '🥩', otros: '📦',
};
const getIcon = (categoria) => CAT_ICON[(categoria || '').toLowerCase()] || '📦';

const fmt = n => `$${Math.round(n).toLocaleString('es-CO')}`;
const esHoy = iso => new Date(iso).toDateString() === new Date().toDateString();

const haversineKm = (a, b) => {
  if (!a || !b) return 0;
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
};

const geocodeAddress = (direccion) => new Promise(resolve => {
  if (!window.google) { resolve(null); return; }
  const geocoder = new window.google.maps.Geocoder();
  geocoder.geocode({ address: `${direccion}, Garzón, Huila, Colombia` }, (results, status) => {
    if (status === 'OK' && results[0]) {
      const loc = results[0].geometry.location;
      resolve({ lat: loc.lat(), lng: loc.lng() });
    } else {
      resolve(null);
    }
  });
});

const navUrls = position => ({
  maps: `https://www.google.com/maps/dir/?api=1&destination=${position.lat},${position.lng}`,
  waze: `https://waze.com/ul?ll=${position.lat},${position.lng}&navigate=yes`,
});

/* ── Icono SVG para cada marcador ───────────────────────── */
const makeIcon = (color, label, isDone = false, isActive = false) => {
  const opacity = isDone ? '0.5' : '1';
  const W = isActive ? 54 : 42;
  const H = isActive ? 66 : 52;
  const r = isActive ? 24 : 19;
  const cx = W / 2, cy = r + 2;
  const halo = isActive
    ? `<circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="${color}" opacity="0.25"/>`
    : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    ${halo}
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="white" stroke-width="3" opacity="${opacity}"/>
    <text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="white"
      font-size="${isActive ? 13 : 12}" font-weight="bold" font-family="Arial,sans-serif">${label}</text>
    <polygon points="${cx - 7},${cy + r - 3} ${cx + 7},${cy + r - 3} ${cx},${H}" fill="${color}" opacity="${opacity}"/>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(W, H),
    anchor:     new window.google.maps.Point(cx, H),
  };
};

const DRIVER_ICON_FN = () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
    <circle cx="16" cy="16" r="12" fill="#3b82f6" stroke="white" stroke-width="3"/>
    <text x="16" y="21" text-anchor="middle" fill="white" font-size="14">🛵</text>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(32, 32),
    anchor:     new window.google.maps.Point(16, 16),
  };
};

/* ── Componente mapa ─────────────────────────────────────── */
const MapaReal = ({ ordenes, driverPos, selected, onSelectOrden }) => {
  const mapRef      = useRef(null);
  const [infoOpen,  setInfoOpen]  = useState(null);
  const [directions, setDirections] = useState(null);

  const onLoad = useCallback(map => { mapRef.current = map; }, []);

  /* Centrar mapa en el repartidor cuando cambia posición */
  useEffect(() => {
    if (mapRef.current && driverPos) {
      mapRef.current.panTo(driverPos);
    }
  }, [driverPos]);

  /* Trazar ruta sugerida por todas las órdenes activas */
  useEffect(() => {
    if (!driverPos) return;
    const activas = ordenes.filter(o => o.estado !== 'entregada' && o.position);
    if (activas.length === 0) { setDirections(null); return; }

    /* La orden "en camino" siempre va primero (es la próxima parada) */
    const ordenadas = [...activas].sort((a, b) => {
      if (a.estado === 'en_domicilio') return -1;
      if (b.estado === 'en_domicilio') return 1;
      return a.distancia - b.distancia;
    });

    const destino   = ordenadas[ordenadas.length - 1].position;
    const waypoints = ordenadas.slice(0, -1).map(o => ({ location: o.position, stopover: true }));

    const svc = new window.google.maps.DirectionsService();
    svc.route(
      {
        origin:      driverPos,
        destination: destino,
        waypoints,
        optimizeWaypoints: true,
        travelMode:  window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK') setDirections(result);
        else setDirections(null);
      }
    );
  }, [ordenes, driverPos]);

  return (
    <GoogleMap
      mapContainerClassName="rp-gmap"
      center={driverPos || GARZON}
      zoom={15}
      options={MAP_OPTIONS}
      onLoad={onLoad}
    >
      {/* Marcador del repartidor */}
      {driverPos && (
        <Marker
          position={driverPos}
          icon={DRIVER_ICON_FN()}
          zIndex={100}
          title="Tu ubicación"
        />
      )}

      {/* Marcadores de órdenes */}
      {ordenes.filter(o => o.position).map(o => {
        const isActive = o.estado === 'en_domicilio';
        return (
          <Marker
            key={o.id}
            position={o.position}
            icon={makeIcon(ESTADO_COLOR[o.estado], o.id.replace('#', ''), o.estado === 'entregada', isActive)}
            onClick={() => { setInfoOpen(o.id); onSelectOrden(o); }}
            zIndex={isActive ? 60 : (selected?.id === o.id ? 50 : 10)}
          >
            {infoOpen === o.id && (
              <InfoWindow onCloseClick={() => setInfoOpen(null)}>
                <div className="rp-infowindow">
                  <strong>{o.id}</strong> — {o.cliente}<br/>
                  📍 {o.direccion}<br/>
                  <span style={{ color: ESTADO_COLOR[o.estado], fontWeight: 700 }}>
                    {ESTADO_CFG[o.estado].label}
                  </span>
                </div>
              </InfoWindow>
            )}
          </Marker>
        );
      })}

      {/* Ruta sugerida hacia las órdenes activas */}
      {directions && (
        <DirectionsRenderer
          directions={directions}
          options={{
            suppressMarkers: true,
            polylineOptions: { strokeColor: '#10b981', strokeWeight: 5, strokeOpacity: 0.85 },
          }}
        />
      )}
    </GoogleMap>
  );
};

/* ── Modal de reporte de problema ────────────────────────── */
const ReportModal = ({ orden, onClose, onSubmit }) => {
  if (!orden) return null;
  return (
    <div className="rp-modal-overlay" onClick={onClose}>
      <div className="rp-modal" onClick={e => e.stopPropagation()}>
        <h3 className="rp-modal-title">Reportar problema</h3>
        <p className="rp-modal-sub">{orden.id} · {orden.direccion}</p>
        <div className="rp-modal-options">
          {REPORT_REASONS.map(r => (
            <button key={r} className="rp-modal-option" onClick={() => onSubmit(orden, r)}>
              {r}
            </button>
          ))}
        </div>
        <button className="rp-modal-cancel" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
};

/* ── Modal de cierre de turno ────────────────────────────── */
const CierreModal = ({ open, onClose, entregadas, ganado }) => {
  if (!open) return null;

  const porPago = Object.keys(PAGO_CFG).map(key => {
    const ords = entregadas.filter(o => o.pago === key);
    return { key, count: ords.length, total: ords.reduce((s, o) => s + o.total, 0) };
  }).filter(p => p.count > 0);

  const efectivo         = entregadas.filter(o => o.pago === 'efectivo').reduce((s, o) => s + o.total, 0);
  const comisionEfectivo = efectivo * COMISION_PCT;
  const aEntregar        = efectivo - comisionEfectivo;

  return (
    <div className="rp-modal-overlay" onClick={onClose}>
      <div className="rp-modal" onClick={e => e.stopPropagation()}>
        <h3 className="rp-modal-title">📋 Cierre de turno</h3>
        <p className="rp-modal-sub">{entregadas.length} pedido{entregadas.length === 1 ? '' : 's'} entregado{entregadas.length === 1 ? '' : 's'} hoy</p>

        {porPago.length > 0 && (
          <div className="rp-cierre-rows">
            {porPago.map(p => (
              <div className="rp-cierre-row" key={p.key}>
                <span>{PAGO_CFG[p.key].icon} {PAGO_CFG[p.key].label}</span>
                <span>{p.count} · {fmt(p.total)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="rp-cierre-divider" />

        <div className="rp-cierre-row">
          <span>Tu comisión ({Math.round(COMISION_PCT * 100)}%)</span>
          <span className="rp-cierre-positive">+{fmt(Math.round(ganado))}</span>
        </div>
        <div className="rp-cierre-row rp-cierre-total">
          <span>Total a tu favor</span>
          <span>{fmt(Math.round(ganado))}</span>
        </div>

        {efectivo > 0 && (
          <div className="rp-cierre-highlight">
            <span>💵 Debes entregar en efectivo</span>
            <strong>{fmt(Math.round(aEntregar))}</strong>
          </div>
        )}

        <button className="rp-modal-cancel" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
};

/* ── Selector de vehículo (custom) ───────────────────────── */
const VehiculoSelect = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = VEHICULOS.find(v => v.value === value) || VEHICULOS[0];

  useEffect(() => {
    if (!open) return;
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="rp-select" ref={ref}>
      <button
        type="button"
        className={`rp-select-trigger ${open ? 'rp-select-trigger--open' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span>{current.label}</span>
        <span className={`rp-select-arrow ${open ? 'rp-select-arrow--open' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="rp-select-menu">
          {VEHICULOS.map(v => (
            <button
              key={v.value}
              type="button"
              className={`rp-select-option ${v.value === value ? 'rp-select-option--active' : ''}`}
              onClick={() => { onChange(v.value); setOpen(false); }}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Modal de cuenta del repartidor ──────────────────────── */
const CuentaModal = ({ open, usuario, onClose, onSave, onLogout }) => {
  const { isDark, toggle } = useTheme();
  const [form, setForm] = useState({ nombre: '', telefono: '', email: '', vehiculo: 'moto', placa: '' });
  const [notifs, setNotifs] = useState({ pedidos: true, mensajes: true, promos: false });

  useEffect(() => {
    if (!open) return;
    setForm({
      nombre:   usuario.nombre   || '',
      telefono: usuario.telefono || '',
      email:    usuario.email    || '',
      vehiculo: usuario.vehiculo || 'moto',
      placa:    usuario.placa    || '',
    });
    setNotifs(usuario.notifs || { pedidos: true, mensajes: true, promos: false });
  }, [open, usuario]);

  if (!open) return null;

  const handleSubmit = e => {
    e.preventDefault();
    onSave({ ...form, notifs });
  };

  return (
    <div className="rp-modal-overlay" onClick={onClose}>
      <form className="rp-modal" onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3 className="rp-modal-title">Mi cuenta</h3>
        <p className="rp-modal-sub">Datos del repartidor</p>

        <p className="rp-cuenta-section">Información personal</p>
        <div className="rp-field">
          <label>Nombre</label>
          <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Tu nombre" />
        </div>
        <div className="rp-field">
          <label>Teléfono</label>
          <input value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} placeholder="300-000-0000" />
        </div>
        <div className="rp-field">
          <label>Email</label>
          <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="correo@ejemplo.com" />
        </div>

        <p className="rp-cuenta-section">Vehículo</p>
        <div className="rp-field-row">
          <div className="rp-field">
            <label>Tipo</label>
            <VehiculoSelect value={form.vehiculo} onChange={v => setForm(p => ({ ...p, vehiculo: v }))} />
          </div>
          <div className="rp-field">
            <label>Placa</label>
            <input value={form.placa} onChange={e => setForm(p => ({ ...p, placa: e.target.value.toUpperCase() }))} placeholder="ABC12D" />
          </div>
        </div>

        <p className="rp-cuenta-section">Notificaciones</p>
        {NOTIF_OPTIONS.map(n => (
          <div key={n.id} className="rp-notif-row">
            <div>
              <p className="rp-notif-label">{n.label}</p>
              <p className="rp-notif-desc">{n.desc}</p>
            </div>
            <button
              type="button"
              className={`rp-toggle ${notifs[n.id] ? 'rp-toggle--on' : ''}`}
              onClick={() => setNotifs(p => ({ ...p, [n.id]: !p[n.id] }))}
            >
              <span className="rp-toggle-thumb" />
            </button>
          </div>
        ))}

        <p className="rp-cuenta-section">Apariencia</p>
        <div className="rp-notif-row">
          <div>
            <p className="rp-notif-label">Modo oscuro</p>
            <p className="rp-notif-desc">Cambia la apariencia de toda la app</p>
          </div>
          <button
            type="button"
            className={`rp-toggle ${isDark ? 'rp-toggle--on' : ''}`}
            onClick={toggle}
          >
            <span className="rp-toggle-thumb" />
          </button>
        </div>

        <button type="submit" className="rp-cuenta-save">✓ Guardar cambios</button>
        <button type="button" className="rp-cuenta-logout" onClick={onLogout}>🚪 Cerrar sesión</button>
      </form>
    </div>
  );
};

/* ── Order card ─────────────────────────────────────────── */
const OrdenCard = ({ orden, onAvanzar, onSelect, selected, onReport, reported }) => {
  const cfg    = ESTADO_CFG[orden.estado];
  const pago   = PAGO_CFG[orden.pago];
  const nav    = orden.position ? navUrls(orden.position) : null;
  const active = selected?.id === orden.id;
  return (
    <div
      className={`rp-order-card ${active ? 'rp-order-card--active' : ''} ${orden.estado === 'entregada' ? 'rp-order-card--done' : ''}`}
      style={{ borderLeftColor: ESTADO_COLOR[orden.estado] }}
      onClick={() => onSelect(orden)}
    >
      <div className="rp-order-top">
        <div className="rp-order-left">
          <span className="rp-order-id">{orden.id}</span>
          <span className="rp-order-badge" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
          {pago && (
            <span className="rp-pago-badge" style={{ background: pago.bg, color: pago.color }}>
              {pago.icon} {pago.label}
            </span>
          )}
        </div>
        <div className="rp-order-meta">
          {orden.distancia != null && <span className="rp-order-dist">⬥ {orden.distancia.toFixed(1)} km</span>}
          {orden.eta != null && <span className="rp-order-eta">⏱ {orden.eta} min</span>}
        </div>
      </div>

      <div className="rp-order-addr-row">
        <div>
          <p className="rp-order-addr">📍 {orden.direccion}</p>
        </div>
        {nav && (
          <div className="rp-nav-btns">
            <a
              className="rp-nav-btn rp-nav-btn--maps"
              href={nav.maps} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()} title="Abrir en Google Maps"
            >🗺️</a>
            <a
              className="rp-nav-btn rp-nav-btn--waze"
              href={nav.waze} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()} title="Abrir en Waze"
            >🚗</a>
          </div>
        )}
      </div>

      {orden.instrucciones && (
        <p className="rp-order-instructions">🔔 {orden.instrucciones}</p>
      )}

      <div className="rp-order-client">
        <span className="rp-order-name">👤 {orden.cliente || 'Cliente'}</span>
        {orden.telefono && (
          <a className="rp-order-tel" href={`tel:${orden.telefono}`} onClick={e => e.stopPropagation()}>
            📞 {orden.telefono}
          </a>
        )}
      </div>

      <div className="rp-order-products">
        <div className="rp-order-thumb">{orden.emoji}</div>
        <div className="rp-order-items">{orden.items}</div>
      </div>

      {reported && (
        <div className="rp-reported-tag">🚩 Reportado: {reported}</div>
      )}

      <div className="rp-order-footer">
        <span className="rp-order-total">{fmt(orden.total)}</span>
        <div className="rp-order-actions">
          <button
            className="rp-report-btn"
            onClick={e => { e.stopPropagation(); onReport(orden); }}
            title="Reportar problema"
          >⚠️</button>
          {cfg.btnLabel && (
            <button
              className={`rp-action-btn ${cfg.btnClass}`}
              onClick={e => { e.stopPropagation(); onAvanzar(orden); }}
            >
              {cfg.btnLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Pedidos especiales del cliente (todavía solo locales, sin backend) ──── */
const PedidoEspecialCard = ({ pedido, onAdvance }) => {
  const cfg = ESTADO_CFG[pedido.estado] || ESTADO_CFG['disponible'];
  return (
    <div className="rp-order-card rp-order-card--especial" style={{ borderLeftColor: '#8b5cf6' }}>
      <div className="rp-order-top">
        <div className="rp-order-left">
          <span className="rp-order-id">{pedido.id}</span>
          <span className="rp-pago-badge" style={{ background: '#ede9fe', color: '#6d28d9' }}>📋 Pedido especial</span>
          <span className="rp-order-badge" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
        </div>
        <div className="rp-order-meta">
          <span className="rp-order-eta">⏱ {pedido.eta} min</span>
        </div>
      </div>

      <div className="rp-order-addr-row">
        <div>
          <p className="rp-order-addr">📍 {pedido.direccion}</p>
          <p className="rp-order-barrio">{pedido.barrio}</p>
        </div>
      </div>

      <div className="rp-order-client">
        <span className="rp-order-name">👤 {pedido.cliente}</span>
        <a className="rp-order-tel" href={`tel:${pedido.telefono}`} onClick={e => e.stopPropagation()}>
          📞 {pedido.telefono}
        </a>
      </div>

      <div className="rp-especial-items">
        <p className="rp-especial-items-title">Lo que necesita:</p>
        <ul className="rp-especial-list">
          {pedido.items.map((item, i) => (
            <li key={i} className="rp-especial-item">
              <span className="rp-especial-num">{i + 1}</span>
              <span className="rp-especial-desc">{item.descripcion}</span>
              <span className="rp-especial-qty">{item.cantidad} {item.unidad}</span>
            </li>
          ))}
        </ul>
      </div>

      {pedido.notas && (
        <p className="rp-order-instructions">🔔 {pedido.notas}</p>
      )}

      <div className="rp-order-footer">
        <span className="rp-order-total" style={{ color: '#8b5cf6' }}>Pedido especial</span>
        <div className="rp-order-actions">
          {cfg.btnLabel && (
            <button
              className={`rp-action-btn ${cfg.btnClass}`}
              onClick={() => onAdvance(pedido.id)}
            >
              {cfg.btnLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Página principal ────────────────────────────────────── */
const RepartidorPage = () => {
  const navigate = useNavigate();
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: MAPS_KEY,
    libraries: MAPS_LIBRARIES,
  });

  const [usuario, setUsuario] = useState(() => JSON.parse(localStorage.getItem('usuario') || '{}'));

  const [ordenes,  setOrdenes]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [pedidosEspeciales, setPedidosEspeciales] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pedidos_especiales') || '[]'); }
    catch { return []; }
  });
  const [selected,  setSelected]  = useState(null);
  const [online,    setOnline]    = useState(true);
  const [driverPos, setDriverPos] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportedMap,  setReportedMap]  = useState({});
  const [sheetState, setSheetState] = useState('half');
  const [showCierre, setShowCierre] = useState(false);
  const [showCuenta, setShowCuenta] = useState(false);

  const sheetRef  = useRef(null);
  const dragState = useRef(null);

  /* Geolocalización del repartidor */
  useEffect(() => {
    if (!navigator.geolocation) {
      setDriverPos(GARZON);
      return;
    }
    const id = navigator.geolocation.watchPosition(
      pos => setDriverPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      ()  => setDriverPos(GARZON),   // fallback a Garzón si se deniega
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  /* Carga real de pedidos disponibles + mis entregas asignadas */
  const cargarOrdenes = useCallback(async () => {
    try {
      const [{ data: disponiblesRaw }, { data: miasRaw }] = await Promise.all([
        ordenesService.listar({ disponibles: true }),
        ordenesService.listar(),
      ]);
      const crudas = [...disponiblesRaw, ...miasRaw];

      const clienteIds  = [...new Set(crudas.map(o => o.cliente_id))];
      const productoIds = [...new Set(crudas.flatMap(o => o.items.map(it => it.producto_id)))];

      const [clientesPairs, productosPairs] = await Promise.all([
        Promise.all(clienteIds.map(id => usuariosService.obtener(id).then(({ data }) => [id, data]).catch(() => [id, null]))),
        Promise.all(productoIds.map(id => productosService.obtener(id).then(({ data }) => [id, data]).catch(() => [id, null]))),
      ]);
      const clientesMap  = Object.fromEntries(clientesPairs);
      const productosMap = Object.fromEntries(productosPairs);

      const mapear = (o, esDisponible) => {
        const cliente = clientesMap[o.cliente_id];
        const primerProducto = productosMap[o.items[0]?.producto_id];
        return {
          id: `#${o.id.slice(0, 8)}`,
          idCompleto: o.id,
          estado: esDisponible ? 'disponible' : (o.estado === 'entregada' ? 'entregada' : 'en_domicilio'),
          fechaCreacion: o.fecha_creacion,
          direccion: o.direccion_entrega,
          cliente: cliente?.nombre,
          telefono: cliente?.telefono,
          items: o.items.map(it => `${productosMap[it.producto_id]?.nombre || 'Producto'} x${it.cantidad}`).join(', '),
          emoji: getIcon(primerProducto?.categoria),
          total: Number(o.total),
          pago: o.metodo_pago,
          instrucciones: o.notas_cliente || null,
          position: null,
          distancia: null,
          eta: null,
        };
      };

      const disponibles = disponiblesRaw.map(o => mapear(o, true));
      const mias = miasRaw.map(o => mapear(o, false));

      setOrdenes(prev => {
        // Conservar posiciones ya geocodificadas para no volver a pedirlas
        const posMap = Object.fromEntries(prev.map(o => [o.idCompleto, o.position]));
        return [...disponibles, ...mias].map(o => ({ ...o, position: posMap[o.idCompleto] || null }));
      });
    } catch {
      setOrdenes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarOrdenes(); }, [cargarOrdenes]);

  /* Geocodificar direcciones pendientes una vez cargado el mapa */
  useEffect(() => {
    if (!isLoaded) return;
    const pendientes = ordenes.filter(o => !o.position);
    if (pendientes.length === 0) return;

    let activo = true;
    (async () => {
      const resueltos = await Promise.all(
        pendientes.map(async o => ({ id: o.idCompleto, position: await geocodeAddress(o.direccion) || GARZON }))
      );
      if (!activo) return;
      const posMap = Object.fromEntries(resueltos.map(r => [r.id, r.position]));
      setOrdenes(prev => prev.map(o => posMap[o.idCompleto] ? { ...o, position: posMap[o.idCompleto] } : o));
    })();
    return () => { activo = false; };
  }, [isLoaded, ordenes]);

  /* Recalcular distancia/ETA cuando cambia la posición del repartidor o las órdenes se geocodifican */
  useEffect(() => {
    if (!driverPos) return;
    setOrdenes(prev => prev.map(o => {
      if (!o.position) return o;
      const distancia = haversineKm(driverPos, o.position);
      return { ...o, distancia, eta: Math.max(1, Math.round((distancia / 25) * 60)) };
    }));
    // Solo recalcular cuando se mueve el repartidor, no en cada render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverPos]);

  /* Compartir la ubicación real con el backend mientras hay una entrega en curso,
     para que el cliente pueda verla en su seguimiento. Throttled a 1 envío cada 15s. */
  const lastSentRef = useRef(0);
  useEffect(() => {
    if (!driverPos) return;
    const tieneActiva = ordenes.some(o => o.estado === 'en_domicilio');
    if (!tieneActiva) return;
    const ahora = Date.now();
    if (ahora - lastSentRef.current < 15000) return;
    lastSentRef.current = ahora;
    usuariosService.actualizarPerfil({ latitud: driverPos.lat, longitud: driverPos.lng }).catch(() => {});
  }, [driverPos, ordenes]);

  const aceptar = async (orden) => {
    try {
      await ordenesService.actualizar(orden.idCompleto, { domiciliario_id: usuario.id, estado: 'en_domicilio' });
      cargarOrdenes();
    } catch (err) {
      alert(err.response?.data?.detail || 'No se pudo aceptar el pedido. Puede que ya lo haya tomado otro repartidor.');
      cargarOrdenes();
    }
  };

  const marcarEntregado = async (orden) => {
    try {
      await ordenesService.actualizar(orden.idCompleto, { estado: 'entregada' });
      cargarOrdenes();
    } catch (err) {
      alert(err.response?.data?.detail || 'No se pudo marcar como entregado.');
    }
  };

  const avanzar = (orden) => {
    if (orden.estado === 'disponible') return aceptar(orden);
    if (orden.estado === 'en_domicilio') return marcarEntregado(orden);
  };

  const advanceEspecial = id => {
    setPedidosEspeciales(prev => {
      const updated = prev.map(p => (p.id === id ? { ...p, estado: 'entregada' } : p));
      localStorage.setItem('pedidos_especiales', JSON.stringify(updated));
      return updated;
    });
  };

  const handleLogout = () => { localStorage.clear(); navigate('/login'); };

  const handleReportSubmit = (orden, reason) => {
    setReportedMap(prev => ({ ...prev, [orden.id]: reason }));
    setReportTarget(null);
  };

  const handleCuentaSave = data => {
    const updated = { ...usuario, ...data };
    localStorage.setItem('usuario', JSON.stringify(updated));
    setUsuario(updated);
    setShowCuenta(false);
  };

  /* ── Drag del bottom sheet (móvil) ─────────────────────── */
  const handlePointerDown = e => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const height = sheet.offsetHeight;
    dragState.current = {
      startY: e.clientY,
      height,
      current: SHEET_SNAP[sheetState] * height,
    };
    sheet.style.transition = 'none';
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = e => {
    const drag = dragState.current;
    if (!drag) return;
    let translate = (SHEET_SNAP[sheetState] * drag.height) + (e.clientY - drag.startY);
    translate = Math.max(0, Math.min(translate, drag.height * 0.85));
    drag.current = translate;
    sheetRef.current.style.transform = `translateY(${translate}px)`;
  };

  const handlePointerUp = () => {
    const drag = dragState.current;
    if (!drag) return;
    const sheet = sheetRef.current;
    let closest = 'half', minDiff = Infinity;
    Object.entries(SHEET_SNAP).forEach(([key, frac]) => {
      const diff = Math.abs(drag.current - frac * drag.height);
      if (diff < minDiff) { minDiff = diff; closest = key; }
    });
    sheet.style.transition = '';
    sheet.style.transform = '';
    setSheetState(closest);
    dragState.current = null;
  };

  const disponibles = ordenes.filter(o => o.estado === 'disponible');
  const enCamino     = ordenes.filter(o => o.estado === 'en_domicilio');
  const entregadasHoy = ordenes.filter(o => o.estado === 'entregada' && esHoy(o.fechaCreacion));
  const activeOrden  = enCamino[0];
  const ganado    = entregadasHoy.reduce((s, o) => s + o.total * COMISION_PCT, 0);
  const activasCount = disponibles.length + enCamino.length;

  return (
    <div className="rp-page">

      {/* Header */}
      <header className="rp-header">
        <div className="rp-header-left">
          <span className="rp-brand">🔥 Zippy</span>
          <span className="rp-role-badge">REPARTIDOR</span>
        </div>
        <div className="rp-header-right">
          <button
            className={`rp-online-btn ${online ? 'rp-online-btn--on' : ''}`}
            onClick={() => setOnline(v => !v)}
          >
            <span className="rp-online-dot" />
            {online ? 'En línea' : 'Desconectado'}
          </button>
          <button className="rp-cierre-btn" onClick={() => setShowCierre(true)} title="Cierre de turno">
            📋 <span className="rp-cierre-label">Cierre</span>
          </button>
          <div className="rp-user-info" onClick={() => setShowCuenta(true)} title="Mi cuenta">
            <span className="rp-user-avatar">{(usuario.nombre || 'R').charAt(0).toUpperCase()}</span>
            <span className="rp-user-name">{usuario.nombre || 'Repartidor'}</span>
          </div>
          <button className="rp-logout" onClick={handleLogout} title="Cerrar sesión">🚪</button>
        </div>
      </header>

      {/* Stats */}
      <div className="rp-stats">
        <div className="rp-stat">
          <span className="rp-stat-val">{fmt(Math.round(ganado))}</span>
          <span className="rp-stat-label">Ganado hoy</span>
        </div>
        <div className="rp-stat-div"/>
        <div className="rp-stat">
          <span className="rp-stat-val">{entregadasHoy.length}</span>
          <span className="rp-stat-label">Entregados</span>
        </div>
        <div className="rp-stat-div"/>
        <div className="rp-stat">
          <span className="rp-stat-val">{activasCount}</span>
          <span className="rp-stat-label">Activas</span>
        </div>
      </div>

      <div className="rp-body">

        {/* Mapa */}
        <div className="rp-map-section">
          {loadError && (
            <div className="rp-map-error">⚠️ Error cargando el mapa</div>
          )}
          {!isLoaded && !loadError && (
            <div className="rp-map-loading">
              <div className="rp-map-spinner"/>
              <span>Cargando mapa...</span>
            </div>
          )}
          {isLoaded && (
            <MapaReal
              ordenes={ordenes}
              driverPos={driverPos}
              selected={selected}
              onSelectOrden={setSelected}
            />
          )}

          {/* Barra de orden activa */}
          {activeOrden && (
            <div className="rp-active-bar">
              <span>🛵 En camino a {activeOrden.direccion}</span>
              {activeOrden.eta != null && <span className="rp-active-eta">⏱ {activeOrden.eta} min</span>}
            </div>
          )}
        </div>

        {/* Órdenes */}
        <div
          ref={sheetRef}
          className={`rp-orders-section rp-sheet rp-sheet--${sheetState}`}
        >
          <div
            className="rp-sheet-handle"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div className="rp-sheet-handle-bar" />
          </div>

          {activeOrden && (
            <div className="rp-sheet-peek">
              <span>🛵 {activeOrden.id} · {activeOrden.direccion}</span>
              {activeOrden.eta != null && <span className="rp-active-eta">⏱ {activeOrden.eta} min</span>}
            </div>
          )}

          <div className="rp-orders-header">
            <p className="rp-orders-title">
              Órdenes activas
              {activasCount > 0 && <span className="rp-orders-count">{activasCount}</span>}
            </p>
          </div>

          {!online ? (
            <div className="rp-offline-msg">
              <span>😴</span>
              <p>Estás desconectado</p>
              <p className="rp-offline-sub">Activa "En línea" para recibir pedidos</p>
            </div>
          ) : loading ? (
            <p style={{ padding: 16 }}>Cargando pedidos...</p>
          ) : activasCount === 0 ? (
            <div className="rp-offline-msg">
              <span>✅</span>
              <p>¡Todo entregado!</p>
              <p className="rp-offline-sub">Esperando nuevos pedidos...</p>
            </div>
          ) : (
            [...enCamino, ...disponibles].map(o => (
              <OrdenCard
                key={o.id} orden={o} onAvanzar={avanzar} onSelect={setSelected} selected={selected}
                onReport={setReportTarget} reported={reportedMap[o.id]}
              />
            ))
          )}

          {entregadasHoy.length > 0 && (
            <>
              <p className="rp-done-title">Completadas hoy</p>
              {entregadasHoy.map(o => (
                <OrdenCard
                  key={o.id} orden={o} onAvanzar={avanzar} onSelect={setSelected} selected={selected}
                  onReport={setReportTarget} reported={reportedMap[o.id]}
                />
              ))}
            </>
          )}

          {/* Pedidos especiales (todavía locales, sin backend) */}
          {pedidosEspeciales.length > 0 && (
            <>
              <div className="rp-especial-header">
                <span className="rp-especial-header-icon">📋</span>
                <p className="rp-done-title" style={{ margin: 0 }}>Pedidos especiales</p>
                <span className="rp-orders-count" style={{ background: '#8b5cf6' }}>{pedidosEspeciales.filter(p => p.estado !== 'entregada').length}</span>
              </div>
              {pedidosEspeciales.map(p => (
                <PedidoEspecialCard key={p.id} pedido={p} onAdvance={advanceEspecial} />
              ))}
            </>
          )}
        </div>
      </div>

      <ReportModal orden={reportTarget} onClose={() => setReportTarget(null)} onSubmit={handleReportSubmit} />
      <CierreModal open={showCierre} onClose={() => setShowCierre(false)} entregadas={entregadasHoy} ganado={ganado} />
      <CuentaModal open={showCuenta} usuario={usuario} onClose={() => setShowCuenta(false)} onSave={handleCuentaSave} onLogout={handleLogout} />
    </div>
  );
};

export default RepartidorPage;
