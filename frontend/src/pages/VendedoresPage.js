import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { vendedoresService } from '../config/api';
import { useToast } from '../context/ToastContext';
import Layout from '../components/Layout';
import Icon from '../components/Icons';
import ConfirmModal from '../components/ConfirmModal';
import Pagination from '../components/Pagination';
import '../styles/Usuarios.css';
import '../styles/Vendedores.css';

const CIUDADES  = ['Todas', 'Garzón', 'Neiva', 'Pitalito', 'La Plata', 'Campoalegre'];
const ESTADOS   = ['Todos', 'Activo', 'Suspendido'];
const PAGE_SIZE = 10;

const MOCK = [];

const exportCSV = (data) => {
  const headers = ['ID', 'Nombre', 'Negocio', 'Email', 'Ciudad', 'Productos', 'Estado', 'Registro'];
  const rows = data.map(v => [v.id, v.nombre, v.negocio, v.email, v.ciudad, v.productos, v.estado, v.fechaRegistro]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `vendedores_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const VendedoresPage = () => {
  const navigate      = useNavigate();
  const { addToast }  = useToast();

  const [vendedores, setVendedores] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [busqueda, setBusqueda]     = useState('');
  const [ciudadFiltro, setCiudad]   = useState('Todas');
  const [estadoFiltro, setEstado]   = useState('Todos');
  const [page, setPage]             = useState(1);
  const [confirm, setConfirm]       = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await vendedoresService.listar();
      setVendedores(res.data.results ?? res.data);
    } catch {
      setVendedores(MOCK);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setPage(1); }, [busqueda, ciudadFiltro, estadoFiltro]);

  const handleToggle = async () => {
    const v = confirm;
    const nuevo = v.estado === 'Activo' ? 'Suspendido' : 'Activo';
    setConfirm(null);
    try { await vendedoresService.cambiarEstado(v.id, nuevo); } catch {}
    setVendedores(prev => prev.map(x => x.id === v.id ? { ...x, estado: nuevo } : x));
    addToast(`${v.nombre} ${nuevo === 'Activo' ? 'activado' : 'suspendido'}`, nuevo === 'Activo' ? 'success' : 'warning');
  };

  const filtrados = vendedores.filter(v => {
    const q = busqueda.toLowerCase();
    const coincide = !q || v.nombre.toLowerCase().includes(q) || v.negocio.toLowerCase().includes(q) || v.email.toLowerCase().includes(q);
    return coincide
      && (ciudadFiltro === 'Todas'  || v.ciudad === ciudadFiltro)
      && (estadoFiltro === 'Todos'  || v.estado === estadoFiltro);
  });

  const totalPages   = Math.ceil(filtrados.length / PAGE_SIZE);
  const paginados    = filtrados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalActivos = vendedores.filter(v => v.estado === 'Activo').length;
  const totalProds   = vendedores.reduce((s, v) => s + (v.productos || 0), 0);

  return (
    <Layout>
      {/* Header */}
      <div className="us-page-header">
        <div>
          <h1 className="us-title"><Icon name="vendedores" size={26} style={{ verticalAlign: '-5px', marginRight: 8 }} />Vendedores</h1>
          <p className="us-subtitle">Gestiona los vendedores activos en la plataforma</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="us-export-btn" onClick={() => { exportCSV(filtrados); addToast('CSV exportado', 'info'); }}>
            ⬇Exportar CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="us-stats-strip">
        <div className="us-stat">
          <span className="us-stat-num">{vendedores.length}</span>
          <span className="us-stat-label">Total</span>
        </div>
        <div className="us-stat us-stat--green">
          <span className="us-stat-num">{totalActivos}</span>
          <span className="us-stat-label">Activos</span>
        </div>
        <div className="us-stat us-stat--red">
          <span className="us-stat-num">{vendedores.length - totalActivos}</span>
          <span className="us-stat-label">Suspendidos</span>
        </div>
        <div className="us-stat us-stat--orange">
          <span className="us-stat-num">{totalProds.toLocaleString()}</span>
          <span className="us-stat-label">Productos</span>
        </div>
      </div>

      {/* Filters */}
      <div className="us-filters">
        <input
          type="text"
          className="us-search"
          placeholder="Buscar por nombre, negocio o email..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <select className="us-select" value={ciudadFiltro} onChange={e => setCiudad(e.target.value)}>
          {CIUDADES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select className="us-select" value={estadoFiltro} onChange={e => setEstado(e.target.value)}>
          {ESTADOS.map(e => <option key={e}>{e}</option>)}
        </select>
        <button className="us-refresh-btn" onClick={cargar} title="Recargar">↻</button>
      </div>

      {/* Table */}
      <div className="table-section">
        {loading ? (
          <div className="us-loading">{[1,2,3,4,5].map(i => <div key={i} className="us-skeleton-row" />)}</div>
        ) : filtrados.length === 0 ? (
          <div className="us-empty"><p>No se encontraron vendedores con los filtros aplicados.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Vendedor</th>
                <th>Ciudad</th>
                <th>Productos</th>
                <th>Estado</th>
                <th>Registro</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginados.map(v => (
                <tr key={v.id}>
                  <td className="us-id">{v.id}</td>
                  <td>
                    <div className="vd-cell">
                      <div className="vd-avatar">{v.nombre.charAt(0)}</div>
                      <div>
                        <div className="vd-nombre">{v.nombre}</div>
                        <div className="vd-negocio">{v.negocio}</div>
                      </div>
                    </div>
                  </td>
                  <td>{v.ciudad}</td>
                  <td>
                    <span className="vd-productos-badge">{v.productos}</span>
                  </td>
                  <td>
                    <span className={`badge ${v.estado === 'Activo' ? 'badge-active' : 'badge-suspended'}`}>
                      {v.estado === 'Activo' ? 'Activo' : 'Suspendido'}
                    </span>
                  </td>
                  <td className="us-email">{v.fechaRegistro}</td>
                  <td className="us-actions">
                    <a href={`/usuarios/${v.id}`} className="action-link" style={{ marginRight: 12 }}>Ver →</a>
                    <button
                      className={`us-toggle-btn ${v.estado === 'Activo' ? 'us-toggle-suspend' : 'us-toggle-activate'}`}
                      onClick={() => setConfirm(v)}
                    >
                      {v.estado === 'Activo' ? 'Suspender' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && filtrados.length > 0 && (
          <Pagination page={page} totalPages={totalPages} total={filtrados.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        )}
      </div>

      <ConfirmModal
        isOpen={!!confirm}
        danger={confirm?.estado === 'Activo'}
        title={confirm?.estado === 'Activo' ? 'Suspender vendedor' : 'Activar vendedor'}
        message={
          confirm?.estado === 'Activo'
            ? `¿Suspender a ${confirm?.nombre}? No podrá acceder ni publicar productos.`
            : `¿Activar la cuenta de ${confirm?.nombre}?`
        }
        confirmLabel={confirm?.estado === 'Activo' ? 'Sí, suspender' : 'Sí, activar'}
        onConfirm={handleToggle}
        onCancel={() => setConfirm(null)}
      />
    </Layout>
  );
};

export default VendedoresPage;