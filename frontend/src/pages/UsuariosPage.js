import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usuariosService } from '../config/api';
import { useToast } from '../context/ToastContext';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import Pagination from '../components/Pagination';
import '../styles/Usuarios.css';

const PAGE_SIZE = 8;

const MOCK_USERS = [];

const ROL_CFG = {
  Vendedor:   { bg: '#fff3e0', color: '#e65100', icon: '🏪' },
  Cliente:    { bg: '#e3f2fd', color: '#0d47a1', icon: '👤' },
  Repartidor: { bg: '#f3e5f5', color: '#6a1b9a', icon: '🛵' },
};

const TABS = [
  { id: 'Todos',      icon: '✦', label: 'Todos'       },
  { id: 'Vendedor',   icon: '🏪', label: 'Vendedores'  },
  { id: 'Cliente',    icon: '👤', label: 'Clientes'    },
  { id: 'Repartidor', icon: '🛵', label: 'Repartidores'},
  { id: 'Suspendido', icon: '🚫', label: 'Suspendidos' },
];

const initials = nombre =>
  (nombre || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

const avatarBg = nombre => {
  const colors = ['#FF7A00','#10b981','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#06b6d4'];
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
};

const exportCSV = data => {
  const headers = ['ID','Nombre','Email','Rol','Ciudad','Estado','Productos'];
  const rows = data.map(u => [u.id, u.nombre, u.email, u.rol, u.ciudad || '', u.estado, u.productos]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `usuarios_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
};

/* ── Menú de acciones por fila ───────────────────────────── */
const RowMenu = ({ usuario, onToggle, onView }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="us-row-menu" ref={ref}>
      <button className="us-dots-btn" onClick={() => setOpen(v => !v)} title="Acciones">
        ⋮
      </button>
      {open && (
        <div className="us-dropdown">
          <button className="us-dd-item" onClick={() => { onView(usuario.id); setOpen(false); }}>
            <span>👁️</span> Ver perfil
          </button>
          <button
            className={`us-dd-item ${usuario.estado === 'Activo' ? 'us-dd-item--danger' : 'us-dd-item--success'}`}
            onClick={() => { onToggle(usuario); setOpen(false); }}
          >
            <span>{usuario.estado === 'Activo' ? '🚫' : '✅'}</span>
            {usuario.estado === 'Activo' ? 'Suspender' : 'Activar'}
          </button>
        </div>
      )}
    </div>
  );
};

/* ── Página ──────────────────────────────────────────────── */
const UsuariosPage = () => {
  const { addToast } = useToast();
  const navigate     = useNavigate();

  const [usuarios, setUsuarios]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [busqueda, setBusqueda]   = useState('');
  const [tab, setTab]             = useState('Todos');
  const [page, setPage]           = useState(1);
  const [confirm, setConfirm]     = useState(null);

  const cargarUsuarios = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usuariosService.listar();
      setUsuarios(res.data.results ?? res.data);
    } catch {
      setUsuarios(MOCK_USERS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarUsuarios(); }, [cargarUsuarios]);
  useEffect(() => { setPage(1); }, [busqueda, tab]);

  const handleToggleEstado = async () => {
    const u = confirm;
    const nuevo = u.estado === 'Activo' ? 'Suspendido' : 'Activo';
    setConfirm(null);
    try { await usuariosService.cambiarEstado(u.id, nuevo); } catch { /* mock */ }
    setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, estado: nuevo } : x));
    addToast(`${u.nombre} ${nuevo === 'Activo' ? 'activado' : 'suspendido'}`, nuevo === 'Activo' ? 'success' : 'warning');
  };

  const filtrados = usuarios.filter(u => {
    const q = busqueda.toLowerCase();
    const matchQ   = !q || u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.id.toLowerCase().includes(q);
    const matchTab = tab === 'Todos' || (tab === 'Suspendido' ? u.estado === 'Suspendido' : u.rol === tab);
    return matchQ && matchTab;
  });

  const totalPages = Math.ceil(filtrados.length / PAGE_SIZE);
  const paginados  = filtrados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const conteo = id => {
    if (id === 'Todos')      return usuarios.length;
    if (id === 'Suspendido') return usuarios.filter(u => u.estado === 'Suspendido').length;
    return usuarios.filter(u => u.rol === id).length;
  };

  const totalActivos    = usuarios.filter(u => u.estado === 'Activo').length;
  const totalSuspendidos= usuarios.filter(u => u.estado === 'Suspendido').length;
  const totalVendedores = usuarios.filter(u => u.rol === 'Vendedor').length;
  const totalRepartidores = usuarios.filter(u => u.rol === 'Repartidor').length;

  return (
    <Layout>
      {/* ── Header ─────────────────────────────────────── */}
      <div className="us-header">
        <div className="us-header-left">
          <div className="us-header-icon">👥</div>
          <div>
            <h1 className="us-title">Usuarios</h1>
            <p className="us-subtitle">{usuarios.length} usuarios registrados en la plataforma</p>
          </div>
        </div>
        <div className="us-header-actions">
          <button className="us-btn-secondary" onClick={() => { exportCSV(filtrados); addToast('CSV exportado', 'info'); }}>
            ⬇ Exportar
          </button>
          <a href="/vendedores/nuevo" className="us-btn-primary">+ Nuevo vendedor</a>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────── */}
      <div className="us-stats">
        <div className="us-stat-card">
          <div className="us-stat-icon" style={{ background: '#fff3e8', color: '#FF7A00' }}>👥</div>
          <div>
            <p className="us-stat-num">{usuarios.length}</p>
            <p className="us-stat-label">Total usuarios</p>
          </div>
        </div>
        <div className="us-stat-card">
          <div className="us-stat-icon" style={{ background: '#dcfce7', color: '#15803d' }}>✅</div>
          <div>
            <p className="us-stat-num">{totalActivos}</p>
            <p className="us-stat-label">Activos</p>
          </div>
        </div>
        <div className="us-stat-card">
          <div className="us-stat-icon" style={{ background: '#fee2e2', color: '#b91c1c' }}>🚫</div>
          <div>
            <p className="us-stat-num">{totalSuspendidos}</p>
            <p className="us-stat-label">Suspendidos</p>
          </div>
        </div>
        <div className="us-stat-card">
          <div className="us-stat-icon" style={{ background: '#fff3e0', color: '#e65100' }}>🏪</div>
          <div>
            <p className="us-stat-num">{totalVendedores}</p>
            <p className="us-stat-label">Vendedores</p>
          </div>
        </div>
        <div className="us-stat-card">
          <div className="us-stat-icon" style={{ background: '#f3e5f5', color: '#6a1b9a' }}>🛵</div>
          <div>
            <p className="us-stat-num">{totalRepartidores}</p>
            <p className="us-stat-label">Repartidores</p>
          </div>
        </div>
      </div>

      {/* ── Menú de tabs ───────────────────────────────── */}
      <div className="us-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`us-tab ${tab === t.id ? 'us-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="us-tab-icon">{t.icon}</span>
            <span className="us-tab-label">{t.label}</span>
            <span className={`us-tab-badge ${tab === t.id ? 'us-tab-badge--active' : ''}`}>
              {conteo(t.id)}
            </span>
          </button>
        ))}
      </div>

      {/* ── Barra de búsqueda ──────────────────────────── */}
      <div className="us-search-bar">
        <div className="us-search-wrap">
          <span className="us-search-icon">🔍</span>
          <input
            className="us-search"
            placeholder="Buscar por nombre, email o ID..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button className="us-search-clear" onClick={() => setBusqueda('')}>✕</button>
          )}
        </div>
        <button className="us-refresh" onClick={cargarUsuarios} title="Recargar">↻</button>
      </div>

      {/* ── Lista de usuarios ───────────────────────────── */}
      <div className="us-list-wrap">
        {loading ? (
          <div className="us-skeletons">
            {[1,2,3,4,5].map(i => <div key={i} className="us-skeleton" />)}
          </div>
        ) : paginados.length === 0 ? (
          <div className="us-empty">
            <span>🔍</span>
            <p>No se encontraron usuarios</p>
            <button onClick={() => { setBusqueda(''); setTab('Todos'); }}>Limpiar filtros</button>
          </div>
        ) : (
          <div className="us-cards">
            {paginados.map(u => {
              const rol = ROL_CFG[u.rol] || {};
              return (
                <div key={u.id} className="us-user-card">
                  {/* Avatar */}
                  <div className="us-avatar" style={{ background: avatarBg(u.nombre) }}>
                    {initials(u.nombre)}
                  </div>

                  {/* Info principal */}
                  <div className="us-user-info">
                    <div className="us-user-name-row">
                      <span className="us-user-name">{u.nombre}</span>
                      <span
                        className="us-rol-pill"
                        style={{ background: rol.bg, color: rol.color }}
                      >
                        {rol.icon} {u.rol}
                      </span>
                    </div>
                    <span className="us-user-email">{u.email}</span>
                    <div className="us-user-meta">
                      <span className="us-meta-item">🪪 {u.id}</span>
                      {u.ciudad && <span className="us-meta-item">📍 {u.ciudad}</span>}
                      {u.fecha && <span className="us-meta-item">📅 {u.fecha}</span>}
                      {u.productos > 0 && <span className="us-meta-item">📦 {u.productos} productos</span>}
                    </div>
                  </div>

                  {/* Estado */}
                  <div className="us-user-right">
                    <span className={`us-estado ${u.estado === 'Activo' ? 'us-estado--active' : 'us-estado--suspended'}`}>
                      {u.estado === 'Activo' ? '● Activo' : '● Suspendido'}
                    </span>
                    <RowMenu
                      usuario={u}
                      onToggle={setConfirm}
                      onView={id => navigate(`/usuarios/${id}`)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && filtrados.length > PAGE_SIZE && (
          <Pagination page={page} totalPages={totalPages} total={filtrados.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        )}
      </div>

      <ConfirmModal
        isOpen={!!confirm}
        danger={confirm?.estado === 'Activo'}
        title={confirm?.estado === 'Activo' ? 'Suspender usuario' : 'Activar usuario'}
        message={
          confirm?.estado === 'Activo'
            ? `¿Suspender a ${confirm?.nombre}? No podrá acceder a la plataforma.`
            : `¿Activar la cuenta de ${confirm?.nombre}?`
        }
        confirmLabel={confirm?.estado === 'Activo' ? 'Sí, suspender' : 'Sí, activar'}
        onConfirm={handleToggleEstado}
        onCancel={() => setConfirm(null)}
      />
    </Layout>
  );
};

export default UsuariosPage;
