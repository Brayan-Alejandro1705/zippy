import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserLayout from '../../components/UserLayout';
import '../../styles/Servicios.css';
import Icon from '../../components/Icons';
import { negociosService } from '../../config/api';

/* ── Categorías ─────────────────────────────────────────── */
const CATS = [
  { id: 'todos',       icon: 'filtro',        label: 'Todos'             },
  { id: 'taxi',        icon: 'taxi',          label: 'Taxi / Transporte' },
  { id: 'acarreos',    icon: 'camion',        label: 'Acarreos / Fletes' },
  { id: 'mensajeria',  icon: 'paquete',       label: 'Mensajería'        },
  { id: 'mecanico',    icon: 'llave_inglesa', label: 'Mecánico'          },
  { id: 'plomeria',    icon: 'ducha',         label: 'Plomería'          },
  { id: 'electricista',icon: 'rayo',          label: 'Electricista'      },
  { id: 'otro',        icon: 'herramientas',  label: 'Otros'             },
];

/* ── Datos mock ─────────────────────────────────────────── */

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
          <span className="sv-modal-logo"><Icon name={servicio.logo} size={34} strokeWidth={1.4} /></span>
          {servicio.destacado && <span className="sv-modal-featured"><Icon name="estrella" size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />Destacado</span>}
          {!servicio.disponible && <span className="sv-modal-closed">Cerrado ahora</span>}
        </div>

        <div className="sv-modal-body">
          <div className="sv-modal-cat" style={{ color: servicio.text, background: servicio.bg }}>
            {cat && <Icon name={cat.icon} size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />}{cat?.label}
          </div>
          <h2 className="sv-modal-name">{servicio.nombre}</h2>

          <div className="sv-modal-rating">
            <span className="sv-stars">{Array.from({ length: Math.round(servicio.calificacion) }).map((_, i) => (
              <Icon key={i} name="estrella" size={14} />
            ))}</span>
            <span className="sv-rating-val">{servicio.calificacion}</span>
            <span className="sv-rating-count">({servicio.resenas} reseñas)</span>
          </div>

          <p className="sv-modal-desc">{servicio.descripcion}</p>

          <div className="sv-modal-details">
            <div className="sv-detail-row">
              <span className="sv-detail-icon"><Icon name="ubicacion" size={17} /></span>
              <div>
                <p className="sv-detail-label">Cobertura</p>
                <p className="sv-detail-val">{servicio.cobertura}</p>
              </div>
            </div>
            <div className="sv-detail-row">
              <span className="sv-detail-icon"><Icon name="reloj" size={17} /></span>
              <div>
                <p className="sv-detail-label">Horario</p>
                <p className="sv-detail-val">{servicio.horario}</p>
              </div>
            </div>
            {servicio.desde > 0 && (
              <div className="sv-detail-row">
                <span className="sv-detail-icon"><Icon name="dinero" size={17} /></span>
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
              <Icon name="telefono" size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />Llamar
            </a>
            <a
              className="sv-btn sv-btn--wa"
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="whatsapp" size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />WhatsApp
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
        <span className="sv-card-logo"><Icon name={servicio.logo} size={26} strokeWidth={1.4} /></span>
        <div className="sv-card-badges">
          {servicio.destacado && <span className="sv-badge-featured"><Icon name="estrella" size={13} /></span>}
          <span
            className="sv-badge-cat"
            style={{ background: servicio.text + '22', color: servicio.text }}
          >
            {cat && <Icon name={cat.icon} size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />}{cat?.label}
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
          <span className="sv-card-rating"><Icon name="estrella" size={13} style={{ verticalAlign: '-2px', marginRight: 3 }} />{servicio.calificacion} <span className="sv-card-resenas">({servicio.resenas})</span></span>
          {servicio.desde > 0 && (
            <span className="sv-card-desde">Desde ${servicio.desde.toLocaleString('es-CO')}</span>
          )}
        </div>

        <p className="sv-card-horario"><Icon name="reloj" size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />{servicio.horario}</p>
      </div>

      <div className="sv-card-actions" onClick={e => e.stopPropagation()}>
        <a
          className="sv-card-btn sv-card-btn--call"
          href={`tel:${servicio.telefono.replace(/-/g, '')}`}
        >
          <Icon name="telefono" size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />Llamar
        </a>
        <a
          className="sv-card-btn sv-card-btn--wa"
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="whatsapp" size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />WhatsApp
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

  const [servicios, setServicios] = useState([]);
  const [cargando, setCargando]   = useState(true);

  useEffect(() => {
    negociosService.listarServicios()
      .then(({ data }) => {
        const lista = Array.isArray(data) ? data : (data.negocios ?? []);
        setServicios(lista.map(n => ({
          id: n.id,
          nombre: n.nombre_negocio,
          categoria: (n.categoria || 'otro').toLowerCase(),
          descripcion: n.descripcion || '',
          cobertura: n.ciudad || 'Garzón',
          horario: n.horario || 'Horario no especificado',
          telefono: n.telefono || '',
          whatsapp: (n.whatsapp || n.telefono || '').replace(/\D/g, ''),
          desde: n.precio_desde || 0,
          logo: 'maletin',
          bg: '#f8fafc',
          text: '#334155',
          calificacion: n.calificacion_promedio || 0,
          resenas: n.total_resenas || 0,
          destacado: false,
          abierto: n.estado === 'activo',
        })));
      })
      .catch(() => setServicios([]))
      .finally(() => setCargando(false));
  }, []);

  const filtrados = servicios.filter(s => {
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
<div className="sv-title-wrap">
            <span className="sv-page-icon"><Icon name="herramientas" size={24} /></span>
            <div>
              <h1 className="sv-page-title">Servicios locales</h1>
              <p className="sv-page-sub">Negocios y profesionales de Garzón a tu servicio</p>
            </div>
          </div>
        </div>

        {/* Búsqueda */}
        <div className="sv-search-wrap">
          <span className="sv-search-icon"><Icon name="buscar" size={18} /></span>
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
              <span><Icon name={c.icon} size={17} /></span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>

        {/* Destacados */}
        {destacados.length > 0 && (
          <div className="sv-group">
            <p className="sv-group-title"><Icon name="estrella" size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />Destacados</p>
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

        {cargando && (
          <div className="sv-empty"><p>Cargando servicios…</p></div>
        )}

        {!cargando && filtrados.length === 0 && (
          <div className="sv-empty">
            <span><Icon name="buscar" size={38} strokeWidth={1.2} /></span>
            <p>{servicios.length === 0
              ? 'Todavía no hay servicios registrados en Garzón.'
              : 'No se encontraron servicios con esos filtros.'}</p>
            <button className="sv-empty-btn" onClick={() => { setCatActiva('todos'); setQuery(''); }}>
              Ver todos
            </button>
          </div>
        )}

        {/* Aviso para proveedores */}
        <div className="sv-proveedor-cta">
          <span className="sv-proveedor-icon"><Icon name="maletin" size={18} /></span>
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