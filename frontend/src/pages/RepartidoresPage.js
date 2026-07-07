import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../context/ToastContext';
import { usuariosService } from '../config/api';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import { mapUsuario, ESTADO_LABEL_TO_RAW } from '../utils/usuarios';
import '../styles/Usuarios.css';
import '../styles/Vendedores.css';

const RepartidoresPage = () => {
  const { addToast } = useToast();
  const [repartidores, setRepartidores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);

  const cargarRepartidores = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usuariosService.listar({ tipo: 'domiciliario' });
      setRepartidores((res.data.usuarios ?? []).map(mapUsuario));
    } catch {
      setRepartidores([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarRepartidores(); }, [cargarRepartidores]);

  const totalActivos  = repartidores.filter(r => r.estado === 'Activo').length;
  const totalEntregas = repartidores.reduce((s, r) => s + r.entregas, 0);

  const handleToggle = async () => {
    const r = confirm;
    const nuevo = r.estado === 'Activo' ? 'Suspendido' : 'Activo';
    setConfirm(null);
    try { await usuariosService.cambiarEstado(r.id, ESTADO_LABEL_TO_RAW[nuevo]); } catch { /* mock */ }
    setRepartidores(prev => prev.map(x => x.id === r.id ? { ...x, estado: nuevo } : x));
    addToast(`${r.nombre} ${nuevo === 'Activo' ? 'activado' : 'suspendido'}`, nuevo === 'Activo' ? 'success' : 'warning');
  };

  return (
    <Layout>
      <div className="us-page-header">
        <div>
          <h1 className="us-title">🛵 Repartidores</h1>
          <p className="us-subtitle">Gestiona los repartidores de la plataforma</p>
        </div>
      </div>

      <div className="us-stats-strip">
        <div className="us-stat">
          <span className="us-stat-num">{repartidores.length}</span>
          <span className="us-stat-label">Total</span>
        </div>
        <div className="us-stat us-stat--green">
          <span className="us-stat-num">{totalActivos}</span>
          <span className="us-stat-label">Activos</span>
        </div>
        <div className="us-stat us-stat--red">
          <span className="us-stat-num">{repartidores.length - totalActivos}</span>
          <span className="us-stat-label">Suspendidos</span>
        </div>
        <div className="us-stat us-stat--orange">
          <span className="us-stat-num">{totalEntregas.toLocaleString()}</span>
          <span className="us-stat-label">Entregas</span>
        </div>
      </div>

      <div className="table-section">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th><th>Repartidor</th><th>Ciudad</th><th>Vehículo</th>
              <th>Entregas</th><th>Estado</th><th>Registro</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="us-email">Cargando repartidores...</td></tr>
            ) : repartidores.length === 0 ? (
              <tr><td colSpan={8} className="us-email">No hay repartidores registrados</td></tr>
            ) : repartidores.map(r => (
              <tr key={r.id}>
                <td className="us-id">{r.id}</td>
                <td>
                  <div className="vd-cell">
                    <div className="vd-avatar">{r.nombre.charAt(0)}</div>
                    <div>
                      <div className="vd-nombre">{r.nombre}</div>
                      <div className="vd-negocio">{r.email}</div>
                    </div>
                  </div>
                </td>
                <td>{r.ciudad}</td>
                <td>{r.vehiculo}</td>
                <td><span className="vd-productos-badge">{r.entregas}</span></td>
                <td>
                  <span className={`badge ${r.estado === 'Activo' ? 'badge-active' : 'badge-suspended'}`}>
                    {r.estado === 'Activo' ? '🟢 Activo' : '🔴 Suspendido'}
                  </span>
                </td>
                <td className="us-email">{r.fechaRegistro}</td>
                <td className="us-actions">
                  <div className="us-row-actions">
                    <a href={`/usuarios/${r.id}`} className="us-toggle-btn us-toggle-view">Ver</a>
                    <button
                      className={`us-toggle-btn ${r.estado === 'Activo' ? 'us-toggle-suspend' : 'us-toggle-activate'}`}
                      onClick={() => setConfirm(r)}
                    >
                      {r.estado === 'Activo' ? 'Suspender' : 'Activar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={!!confirm}
        danger={confirm?.estado === 'Activo'}
        title={confirm?.estado === 'Activo' ? 'Suspender repartidor' : 'Activar repartidor'}
        message={
          confirm?.estado === 'Activo'
            ? `¿Suspender a ${confirm?.nombre}? No podrá tomar nuevos pedidos.`
            : `¿Activar la cuenta de ${confirm?.nombre}?`
        }
        confirmLabel={confirm?.estado === 'Activo' ? 'Sí, suspender' : 'Sí, activar'}
        onConfirm={handleToggle}
        onCancel={() => setConfirm(null)}
      />
    </Layout>
  );
};

export default RepartidoresPage;
