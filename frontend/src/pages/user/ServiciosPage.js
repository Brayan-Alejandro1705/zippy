import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UserLayout from '../../components/UserLayout';
import '../../styles/Servicios.css';

/* ── Categorías ─────────────────────────────────────────── */
const CATS = [
  { id: 'todos',       icon: '✦',  label: 'Todos'            },
  { id: 'taxi',        icon: '🚕', label: 'Taxi / Transporte' },
  { id: 'acarreos',    icon: '🚛', label: 'Acarreos / Fletes' },
  { id: 'mensajeria',  icon: '📦', label: 'Mensajería'        },
  { id: 'mecanico',    icon: '🔧', label: 'Mecánico'          },
  { id: 'plomeria',    icon: '🚿', label: 'Plomería'          },
  { id: 'electricista',icon: '⚡', label: 'Electricista'      },
  { id: 'otro',        icon: '🛠️', label: 'Otros'             },
];

/* ── Datos mock ─────────────────────────────────────────── */
const SERVICIOS = [
  {
    id: 1,
    nombre: 'Taxis Los Andes',
    categoria: 'taxi',
    descripcion: 'Servicio de taxi seguro y confiable. Llevamos a cualquier punto de Garzón y municipios vecinos.',
    cobertura: 'Todo Garzón y veredas cercanas',
    horario: 'Lun – Dom, 5:00 am – 11:00 pm',
    telefono: '310-123-4567',
    whatsapp: '3101234567',
    desde: 4000,
    logo: '🚕',
    bg: '#fefce8',
    text: '#854d0e',
    calificacion: 4.8,
    resenas: 47,
    disponible: true,
    destacado: true,
  },
  {
    id: 2,
    nombre: 'Fletes Rápidos Garzón',
    categoria: 'acarreos',
    descripcion: 'Acarreos, mudanzas y transporte de carga pesada. Camión propio, personal capacitado.',
    cobertura: 'Garzón, Altamira, La Jagua, Gigante',
    horario: 'Lun – Sáb, 7:00 am – 6:00 pm',
    telefono: '315-987-6543',
    whatsapp: '3159876543',
    desde: 50000,
    logo: '🚛',
    bg: '#fff7ed',
    text: '#9a3412',
    calificacion: 4.6,
    resenas: 29,
    disponible: true,
    destacado: false,
  },
  {
    id: 3,
    nombre: 'Mensajería Veloz',
    categoria: 'mensajeria',
    descripcion: 'Mandamos documentos, paquetes y encargos dentro de Garzón el mismo día.',
    cobertura: 'Zona urbana de Garzón',
    horario: 'Lun – Sáb, 8:00 am – 7:00 pm',
    telefono: '320-456-7890',
    whatsapp: '3204567890',
    desde: 5000,
    logo: '📦',
    bg: '#eff6ff',
    text: '#1d4ed8',
    calificacion: 4.5,
    resenas: 62,
    disponible: true,
    destacado: false,
  },
  {
    id: 4,
    nombre: 'Mecánico a Domicilio - Carlos',
    categoria: 'mecanico',
    descripcion: 'Diagnóstico y reparación de motos y carros en el lugar donde estés. Repuestos garantizados.',
    cobertura: 'Garzón y alrededores',
    horario: 'Lun – Sáb, 8:00 am – 5:00 pm',
    telefono: '318-321-0987',
    whatsapp: '3183210987',
    desde: 20000,
    logo: '🔧',
    bg: '#f0fdf4',
    text: '#15803d',
    calificacion: 4.9,
    resenas: 38,
    disponible: true,
    destacado: true,
  },
  {
    id: 5,
    nombre: 'Plomería y Construcción Rodríguez',
    categoria: 'plomeria',
    descripcion: 'Reparación de tuberías, instalación de baños, destapes y construcción en general.',
    cobertura: 'Todo Garzón',
    horario: 'Lun – Vie, 7:00 am – 5:00 pm',
    telefono: '311-654-3210',
    whatsapp: '3116543210',
    desde: 30000,
    logo: '🚿',
    bg: '#f0f9ff',
    text: '#0369a1',
    calificacion: 4.4,
    resenas: 21,
    disponible: false,
    destacado: false,
  },
  {
    id: 6,
    nombre: 'Electricista Profesional - Jhon',
    categoria: 'electricista',
    descripcion: 'Instalaciones eléctricas residenciales y comerciales, certificado RETIE.',
    cobertura: 'Garzón y municipios cercanos',
    horario: 'Lun – Sáb, 8:00 am – 6:00 pm',
    telefono: '322-789-0123',
    whatsapp: '3227890123',
    desde: 40000,
    logo: '⚡',
    bg: '#faf5ff',
    text: '#6d28d9',
    calificacion: 4.7,
    resenas: 33,
    disponible: true,
    destacado: false,
  },
  {
    id: 7,
    nombre: 'TransVereda – Transporte Rural',
    categoria: 'taxi',
    descripcion: 'Viajes a veredas y zonas rurales del Huila. Camioneta 4x4 disponible.',
    cobertura: 'Veredas y municipios del Huila',
    horario: 'Todos los días, 5:00 am – 8:00 pm',
    telefono: '317-000-1111',
    whatsapp: '3170001111',
    desde: 15000,
    logo: '🚙',
    bg: '#fef2f2',
    text: '#b91c1c',
    calificacion: 4.3,
    resenas: 18,
    disponible: true,
    destacado: false,
  },
  {
    id: 8,
    nombre: 'Servicios del Hogar – Doña Rosa',
    categoria: 'otro',
    descripcion: 'Aseo de casas, lavado de ropa y servicios del hogar en general. Seria y de confianza.',
    cobertura: 'Zona urbana de Garzón',
    horario: 'Lun – Sáb, 7:00 am – 4:00 pm',
    telefono: '316-222-3333',
    whatsapp: '3162223333',
    desde: 25000,
    logo: '🧹',
    bg: '#fdf4ff',
    text: '#86198f',
    calificacion: 4.6,
    resenas: 55,
    disponible: true,
    destacado: false,
  },
];

/* ── Modal de detalle ───────────────────────────────────── */
const ServicioModal = ({ servicio, onClose }) => {
  if (!servicio) return null;
  const cat = CATS.find(c => c.id === servicio.categoria);
  const waUrl = `https://wa.me/57${servicio.whatsapp}?text=${encodeURIComponent(`Hola, vi tu servicio en Zippy y me gustaría obtener más información sobre ${servicio.nombre}.`)}`;

  return (
    <div className="sv-overlay" onClick={onClose}>
      <div className="sv-modal" onClick={e => e.stopPropagation()}>
        <button className="sv-modal-close" onClick={onClose}>✕</button>

        <div className="sv-modal-hero" style={{ background: servicio.bg }}>
          <span className="sv-modal-logo">{servicio.logo}</span>
          {servicio.destacado && <span className="sv-modal-featured">⭐ Destacado</span>}
          {!servicio.disponible && <span className="sv-modal-closed">Cerrado ahora</span>}
        </div>

        <div className="sv-modal-body">
          <div className="sv-modal-cat" style={{ color: servicio.text, background: servicio.bg }}>
            {cat?.icon} {cat?.label}
          </div>
          <h2 className="sv-modal-name">{servicio.nombre}</h2>

          <div className="sv-modal-rating">
            <span className="sv-stars">{'⭐'.repeat(Math.round(servicio.calificacion))}</span>
            <span className="sv-rating-val">{servicio.calificacion}</span>
            <span className="sv-rating-count">({servicio.resenas} reseñas)</span>
          </div>

          <p className="sv-modal-desc">{servicio.descripcion}</p>

          <div className="sv-modal-details">
            <div className="sv-detail-row">
              <span className="sv-detail-icon">📍</span>
              <div>
                <p className="sv-detail-label">Cobertura</p>
                <p className="sv-detail-val">{servicio.cobertura}</p>
              </div>
            </div>
            <div className="sv-detail-row">
              <span className="sv-detail-icon">🕐</span>
              <div>
                <p className="sv-detail-label">Horario</p>
                <p className="sv-detail-val">{servicio.horario}</p>
              </div>
            </div>
            {servicio.desde > 0 && (
              <div className="sv-detail-row">
                <span className="sv-detail-icon">💰</span>
                <div>
                  <p className="sv-detail-label">Tarifa</p>
                  <p className="sv-detail-val">Desde ${servicio.desde.toLocaleString('es-CO')}</p>
                </div>
              </div>
            )}
          </div>

          <div className="sv-modal-actions">
            <a
              className="sv-btn sv-btn--call"
              href={`tel:${servicio.telefono.replace(/-/g, '')}`}
            >
              📞 Llamar
            </a>
            <a
              className="sv-btn sv-btn--wa"
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              💬 WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Tarjeta de servicio ────────────────────────────────── */
const ServicioCard = ({ servicio, onClick }) => {
  const cat = CATS.find(c => c.id === servicio.categoria);
  const waUrl = `https://wa.me/57${servicio.whatsapp}?text=${encodeURIComponent(`Hola, vi tu servicio en Zippy y me gustaría obtener más información sobre ${servicio.nombre}.`)}`;

  return (
    <div className={`sv-card ${!servicio.disponible ? 'sv-card--closed' : ''}`} onClick={onClick}>
      <div className="sv-card-header" style={{ background: servicio.bg }}>
        <span className="sv-card-logo">{servicio.logo}</span>
        <div className="sv-card-badges">
          {servicio.destacado && <span className="sv-badge-featured">⭐</span>}
          <span
            className="sv-badge-cat"
            style={{ background: servicio.text + '22', color: servicio.text }}
          >
            {cat?.icon} {cat?.label}
          </span>
          <span className={`sv-badge-status ${servicio.disponible ? 'sv-badge-status--open' : 'sv-badge-status--closed'}`}>
            {servicio.disponible ? 'Abierto' : 'Cerrado'}
          </span>
        </div>
      </div>

      <div className="sv-card-body">
        <h3 className="sv-card-name">{servicio.nombre}</h3>
        <p className="sv-card-desc">{servicio.descripcion}</p>

        <div className="sv-card-meta">
          <span className="sv-card-rating">⭐ {servicio.calificacion} <span className="sv-card-resenas">({servicio.resenas})</span></span>
          {servicio.desde > 0 && (
            <span className="sv-card-desde">Desde ${servicio.desde.toLocaleString('es-CO')}</span>
          )}
        </div>

        <p className="sv-card-horario">🕐 {servicio.horario}</p>
      </div>

      <div className="sv-card-actions" onClick={e => e.stopPropagation()}>
        <a
          className="sv-card-btn sv-card-btn--call"
          href={`tel:${servicio.telefono.replace(/-/g, '')}`}
        >
          📞 Llamar
        </a>
        <a
          className="sv-card-btn sv-card-btn--wa"
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          💬 WhatsApp
        </a>
        <button className="sv-card-btn sv-card-btn--info">Ver más</button>
      </div>
    </div>
  );
};

/* ── Página principal ────────────────────────────────────── */
const ServiciosPage = () => {
  const navigate = useNavigate();
  const [catActiva, setCatActiva] = useState('todos');
  const [query, setQuery] = useState('');
  const [detalle, setDetalle] = useState(null);

  const filtrados = SERVICIOS.filter(s => {
    const matchCat = catActiva === 'todos' || s.categoria === catActiva;
    const matchQ   = !query ||
      s.nombre.toLowerCase().includes(query.toLowerCase()) ||
      s.descripcion.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQ;
  });

  const destacados = filtrados.filter(s => s.destacado);
  const resto      = filtrados.filter(s => !s.destacado);

  return (
    <UserLayout>
      <div className="sv-page">

        {/* Header */}
        <div className="sv-page-header">
          <button className="sv-back" onClick={() => navigate('/tienda')}>← Volver</button>
          <div className="sv-title-wrap">
            <span className="sv-page-icon">🛠️</span>
            <div>
              <h1 className="sv-page-title">Servicios locales</h1>
              <p className="sv-page-sub">Negocios y profesionales de Garzón a tu servicio</p>
            </div>
          </div>
        </div>

        {/* Búsqueda */}
        <div className="sv-search-wrap">
          <span className="sv-search-icon">🔍</span>
          <input
            className="sv-search"
            placeholder="Buscar servicio..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button className="sv-search-clear" onClick={() => setQuery('')}>✕</button>
          )}
        </div>

        {/* Tabs de categoría */}
        <div className="sv-cats">
          {CATS.map(c => (
            <button
              key={c.id}
              className={`sv-cat-btn ${catActiva === c.id ? 'sv-cat-btn--active' : ''}`}
              onClick={() => setCatActiva(c.id)}
            >
              <span>{c.icon}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>

        {/* Destacados */}
        {destacados.length > 0 && (
          <div className="sv-group">
            <p className="sv-group-title">⭐ Destacados</p>
            <div className="sv-grid">
              {destacados.map(s => (
                <ServicioCard key={s.id} servicio={s} onClick={() => setDetalle(s)} />
              ))}
            </div>
          </div>
        )}

        {/* Resto */}
        {resto.length > 0 && (
          <div className="sv-group">
            {destacados.length > 0 && <p className="sv-group-title">Todos los servicios</p>}
            <div className="sv-grid">
              {resto.map(s => (
                <ServicioCard key={s.id} servicio={s} onClick={() => setDetalle(s)} />
              ))}
            </div>
          </div>
        )}

        {filtrados.length === 0 && (
          <div className="sv-empty">
            <span>🔍</span>
            <p>No se encontraron servicios.</p>
            <button className="sv-empty-btn" onClick={() => { setCatActiva('todos'); setQuery(''); }}>
              Ver todos
            </button>
          </div>
        )}

        {/* Aviso para proveedores */}
        <div className="sv-proveedor-cta">
          <span className="sv-proveedor-icon">💼</span>
          <div>
            <p className="sv-proveedor-title">¿Ofreces un servicio?</p>
            <p className="sv-proveedor-sub">Anúnciate gratis en Zippy y llega a más clientes en Garzón</p>
          </div>
          <a
            href={`https://wa.me/573001234567?text=${encodeURIComponent('Hola, quiero anunciar mi servicio en Zippy Garzón.')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="sv-proveedor-btn"
          >
            Registrarme
          </a>
        </div>
      </div>

      <ServicioModal servicio={detalle} onClose={() => setDetalle(null)} />
    </UserLayout>
  );
};

export default ServiciosPage;
