import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../config/api';
import { useToast } from '../context/ToastContext';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import { MOCK_SOLICITUDES } from './SolicitudesPage';
import '../styles/Usuarios.css';

const MOCK_STATS = {
  total_usuarios: 0,
  vendedores_activos: 0,
  vendedores_suspendidos: 0,
  solicitudes_pendientes: MOCK_SOLICITUDES.length,
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
      <div className="stats-grid">
        <div className="stat-card green">
          <div className="stat-number">{loadingStats ? '...' : s.total_usuarios.toLocaleString()}</div>
          <div className="stat-label">Total Usuarios</div>
          <div className="stat-subtitle">Usuarios registrados en la plataforma</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-number">{loadingStats ? '...' : s.vendedores_activos.toLocaleString()}</div>
          <div className="stat-label">Vendedores Activos</div>
          <div className="stat-subtitle">Operando con normalidad</div>
        </div>
        <div className="stat-card red" onClick={() => navigate('/vendedores')} style={{ cursor: 'pointer' }}>
          <div className="stat-number">{loadingStats ? '...' : s.vendedores_suspendidos.toLocaleString()}</div>
          <div className="stat-label">Vendedores Suspendidos</div>
          <div className="stat-subtitle">Cuentas con acceso restringido</div>
        </div>
        <div className="stat-card purple" onClick={() => navigate('/solicitudes')} style={{ cursor: 'pointer' }}>
          <div className="stat-number">{loadingStats ? '...' : s.solicitudes_pendientes.toLocaleString()}</div>
          <div className="stat-label">Solicitudes Pendientes</div>
          <div className="stat-subtitle">Nuevos vendedores por aprobar</div>
        </div>
      </div>

      {/* Nuevo vendedor CTA */}
      <div className="form-section">
        <div className="form-header">
          <span>➕</span>
          <h3>Nuevo Vendedor</h3>
        </div>
        <p style={{ color: '#7f8c8d', fontSize: 14, marginBottom: 16 }}>
          Registra un nuevo vendedor con su información de negocio y asígnale un rol desde el formulario.
        </p>
        <button className="btn-create" onClick={() => navigate('/vendedores/nuevo')}>
          ➕ Nuevo Vendedor
        </button>
      </div>

      {/* Users Table */}
      <div className="tables-container">
        <section className="table-section">
          <div className="table-header"><span>👥</span><h2>Usuarios recientes</h2></div>
          <table className="data-table">
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
                      {user.estado === 'Activo' ? '🟢 Activo' : '🔴 Suspendido'}
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
