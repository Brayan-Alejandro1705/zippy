import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../config/api';
import { useToast } from '../context/ToastContext';
import Layout from '../components/Layout';
import Icon from '../components/Icons';
import ConfirmModal from '../components/ConfirmModal';
import '../styles/Usuarios.css';

const MOCK_STATS = {
  total_usuarios: 0,
  vendedores_activos: 0,
  vendedores_suspendidos: 0,
};

const MOCK_USERS = [];


const DashboardPage = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [usuarios, setUsuarios] = useState(MOCK_USERS);
  const [confirm, setConfirm] = useState(null); // { usuario, accion: 'suspender' | 'eliminar' }

  useEffect(() => {
    adminService.estadisticas()
      .then(res => setStats(res.data))
      .catch(() => setStats(MOCK_STATS))
      .finally(() => setLoadingStats(false));
  }, []);

  const s = stats || MOCK_STATS;

  const handleConfirm = () => {
    const { usuario, accion } = confirm;
    setConfirm(null);
    if (accion === 'eliminar') {
      setUsuarios(prev => prev.filter(u => u.id !== usuario.id));
      addToast(`${usuario.nombre} eliminado`, 'success');
    } else {
      const nuevoEstado = usuario.estado === 'Activo' ? 'Suspendido' : 'Activo';
      setUsuarios(prev => prev.map(u => u.id === usuario.id ? { ...u, estado: nuevoEstado } : u));
      addToast(
        `${usuario.nombre} ${nuevoEstado === 'Activo' ? 'activado' : 'suspendido'}`,
        nuevoEstado === 'Activo' ? 'success' : 'warning'
      );
    }
  };

  return (
    <Layout>
      {/* Stats */}
      <div className="us-stats">
        <div className="us-stat-card">
          <div className="us-stat-icon" style={{ background: '#fff3e8', color: '#FF7A00' }}><Icon name="usuarios" size={22} /></div>
          <div>
            <p className="us-stat-num">{loadingStats ? '...' : s.total_usuarios.toLocaleString()}</p>
            <p className="us-stat-label">Total Usuarios</p>
          </div>
        </div>
        <div className="us-stat-card">
          <div className="us-stat-icon" style={{ background: '#dcfce7', color: '#15803d' }}><Icon name="vendedores" size={22} /></div>
          <div>
            <p className="us-stat-num">{loadingStats ? '...' : s.vendedores_activos.toLocaleString()}</p>
            <p className="us-stat-label">Vendedores Activos</p>
          </div>
        </div>
        <div className="us-stat-card" onClick={() => navigate('/vendedores')} style={{ cursor: 'pointer' }}>
          <div className="us-stat-icon" style={{ background: '#fee2e2', color: '#b91c1c' }}><Icon name="bloqueado" size={22} /></div>
          <div>
            <p className="us-stat-num">{loadingStats ? '...' : s.vendedores_suspendidos.toLocaleString()}</p>
            <p className="us-stat-label">Vendedores Suspendidos</p>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="tables-container">
        <section className="table-section">
          <div className="table-header"><span><Icon name="usuarios" size={20} /></span><h2>Usuarios recientes</h2></div>
          <table className="data-table dash-recent-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Fecha de registro</th>
                <th>Último acceso</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((user) => (
                <tr key={user.id}>
                  <td className="us-id">{user.id}</td>
                  <td className="us-nombre">{user.nombre}</td>
                  <td className="us-email">{user.email}</td>
                  <td><span className={`us-rol-badge us-rol-${user.rol.toLowerCase()}`}>{user.rol}</span></td>
                  <td className="us-email">{user.fechaRegistro}</td>
                  <td className="us-email">{user.ultimoAcceso}</td>
                  <td>
                    <span className={`badge ${user.estado === 'Activo' ? 'badge-active' : 'badge-suspended'}`}>
                      {user.estado === 'Activo' ? 'Activo' : 'Suspendido'}
                    </span>
                  </td>
                  <td className="us-actions">
                    <div className="us-row-actions">
                      <a href={`/usuarios/${user.id}`} className="us-toggle-btn us-toggle-view">Ver</a>
                      <button
                        className={`us-toggle-btn ${user.estado === 'Activo' ? 'us-toggle-suspend' : 'us-toggle-activate'}`}
                        onClick={() => setConfirm({ usuario: user, accion: 'suspender' })}
                      >
                        {user.estado === 'Activo' ? 'Suspender' : 'Activar'}
                      </button>
                      <button
                        className="us-toggle-btn us-toggle-delete"
                        onClick={() => setConfirm({ usuario: user, accion: 'eliminar' })}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <ConfirmModal
        isOpen={!!confirm}
        danger={confirm?.accion === 'eliminar' || confirm?.usuario.estado === 'Activo'}
        title={
          confirm?.accion === 'eliminar'
            ? 'Eliminar usuario'
            : confirm?.usuario.estado === 'Activo' ? 'Suspender usuario' : 'Activar usuario'
        }
        message={
          confirm?.accion === 'eliminar'
            ? `¿Eliminar la cuenta de ${confirm?.usuario.nombre}? Esta acción no se puede deshacer.`
            : confirm?.usuario.estado === 'Activo'
              ? `¿Suspender a ${confirm?.usuario.nombre}? No podrá acceder a la plataforma.`
              : `¿Activar la cuenta de ${confirm?.usuario.nombre}?`
        }
        confirmLabel={
          confirm?.accion === 'eliminar'
            ? 'Sí, eliminar'
            : confirm?.usuario.estado === 'Activo' ? 'Sí, suspender' : 'Sí, activar'
        }
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />
    </Layout>
  );
};

export default DashboardPage;