import React, { useState } from 'react';
import { useToast } from '../context/ToastContext';
import Layout from '../components/Layout';
import { getMatrix, saveMatrix } from '../utils/permissions';
import '../styles/Usuarios.css';
import '../styles/Roles.css';

const ROLES_INFO = [
  { id: 'super_admin', nombre: 'Super Admin', desc: 'Acceso total a la plataforma',  color: '#9b59b6' },
  { id: 'admin',       nombre: 'Admin',       desc: 'Gestión operativa diaria',       color: '#FF7A00' },
  { id: 'soporte',     nombre: 'Soporte',     desc: 'Atención y soporte a usuarios',  color: '#3498db' },
];

const PERMISOS = [
  { id: 'vendedores',   label: 'Gestionar vendedores',     icon: '🏪' },
  { id: 'repartidores', label: 'Gestionar repartidores',   icon: '🛵' },
  { id: 'usuarios',     label: 'Gestionar usuarios',       icon: '👥' },
  { id: 'solicitudes',  label: 'Aprobar solicitudes',      icon: '📋' },
  { id: 'reportes',     label: 'Ver reportes financieros', icon: '📈' },
  { id: 'roles',        label: 'Gestionar roles y permisos', icon: '🔐' },
  { id: 'config',       label: 'Configuración del sistema', icon: '⚙️' },
  { id: 'logs',         label: 'Ver logs de actividad',    icon: '📜' },
];

const RolesPermisosPage = () => {
  const { addToast } = useToast();
  const [matrix, setMatrix] = useState(getMatrix);
  const [dirty, setDirty] = useState(false);

  const toggle = (rolId, permId) => {
    if (rolId === 'super_admin') return;
    setMatrix(prev => ({
      ...prev,
      [rolId]: { ...prev[rolId], [permId]: !prev[rolId][permId] },
    }));
    setDirty(true);
  };

  const guardar = () => {
    saveMatrix(matrix);
    setDirty(false);
    addToast('Permisos guardados. Los cambios aplican en el próximo inicio de sesión.', 'success');
  };

  const resetear = () => {
    localStorage.removeItem('permissions_matrix');
    setMatrix(getMatrix());
    setDirty(false);
    addToast('Permisos restablecidos a valores predeterminados', 'info');
  };

  return (
    <Layout>
      <div className="us-page-header">
        <div>
          <h1 className="us-title">🔐 Roles y permisos</h1>
          <p className="us-subtitle">Define qué puede hacer cada nivel de administrador</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="us-export-btn" onClick={resetear}>↺ Restablecer</button>
          <button className="btn-create" onClick={guardar} disabled={!dirty}>
            💾 {dirty ? 'Guardar cambios*' : 'Sin cambios'}
          </button>
        </div>
      </div>

      {/* Cards de roles */}
      <div className="rpm-roles-grid">
        {ROLES_INFO.map(r => (
          <div key={r.id} className="rpm-role-card" style={{ borderTopColor: r.color }}>
            <div className="rpm-role-dot" style={{ background: r.color }} />
            <h3>{r.nombre}</h3>
            <p>{r.desc}</p>
            <div className="rpm-role-count">
              {r.id === 'super_admin'
                ? `${PERMISOS.length}/${PERMISOS.length} permisos`
                : `${PERMISOS.filter(p => matrix[r.id]?.[p.id]).length}/${PERMISOS.length} permisos`
              }
            </div>
          </div>
        ))}
      </div>

      {/* Tabla de permisos */}
      <div className="table-section">
        <table className="data-table">
          <thead>
            <tr>
              <th>Permiso</th>
              {ROLES_INFO.map(r => (
                <th key={r.id} style={{ textAlign: 'center', color: r.color }}>{r.nombre}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISOS.map(p => (
              <tr key={p.id}>
                <td className="us-nombre">
                  <span style={{ marginRight: 8 }}>{p.icon}</span>{p.label}
                </td>
                {ROLES_INFO.map(r => (
                  <td key={r.id} style={{ textAlign: 'center' }}>
                    <button
                      className={`rpm-check ${matrix[r.id]?.[p.id] ? 'rpm-check--on' : ''} ${r.id === 'super_admin' ? 'rpm-check--locked' : ''}`}
                      onClick={() => toggle(r.id, p.id)}
                      disabled={r.id === 'super_admin'}
                      title={r.id === 'super_admin' ? 'El Super Admin siempre tiene todos los permisos' : (matrix[r.id]?.[p.id] ? 'Quitar permiso' : 'Dar permiso')}
                    >
                      {matrix[r.id]?.[p.id] ? '✓' : ''}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dirty && (
        <div className="rpm-warning">
          ⚠️ Hay cambios sin guardar. Haz clic en <strong>Guardar cambios</strong> para aplicarlos.
        </div>
      )}
    </Layout>
  );
};

export default RolesPermisosPage;
