import React, { useState } from 'react';
import { useToast } from '../context/ToastContext';
import Layout from '../components/Layout';
import '../styles/Usuarios.css';
import '../styles/Roles.css';

const ROLES_INFO = [
  { id: 'super_admin', nombre: 'Super Admin', desc: 'Acceso total a la plataforma',    color: '#9b59b6' },
  { id: 'admin',       nombre: 'Admin',       desc: 'Gestión operativa diaria',        color: '#FF7A00' },
  { id: 'soporte',     nombre: 'Soporte',     desc: 'Atención y soporte a usuarios',   color: '#3498db' },
];

const PERMISOS = [
  { id: 'vendedores',   label: 'Gestionar vendedores' },
  { id: 'repartidores', label: 'Gestionar repartidores' },
  { id: 'usuarios',     label: 'Gestionar usuarios' },
  { id: 'solicitudes',  label: 'Aprobar solicitudes' },
  { id: 'reportes',     label: 'Ver reportes financieros' },
  { id: 'roles',        label: 'Gestionar roles y permisos' },
  { id: 'config',       label: 'Configuración del sistema' },
  { id: 'logs',         label: 'Ver logs de actividad' },
];

const INITIAL_MATRIX = {
  super_admin: { vendedores: true,  repartidores: true,  usuarios: true,  solicitudes: true,  reportes: true,  roles: true,  config: true,  logs: true },
  admin:       { vendedores: true,  repartidores: true,  usuarios: true,  solicitudes: true,  reportes: true,  roles: false, config: false, logs: true },
  soporte:     { vendedores: false, repartidores: false, usuarios: true,  solicitudes: false, reportes: false, roles: false, config: false, logs: true },
};

const RolesPermisosPage = () => {
  const { addToast } = useToast();
  const [matrix, setMatrix] = useState(INITIAL_MATRIX);

  const toggle = (rolId, permId) => {
    if (rolId === 'super_admin') return;
    setMatrix(prev => ({
      ...prev,
      [rolId]: { ...prev[rolId], [permId]: !prev[rolId][permId] },
    }));
  };

  const guardar = () => addToast('Permisos actualizados correctamente', 'success');

  return (
    <Layout>
      <div className="us-page-header">
        <div>
          <h1 className="us-title">🔐 Roles y permisos</h1>
          <p className="us-subtitle">Define qué puede hacer cada nivel de administrador</p>
        </div>
        <button className="btn-create" onClick={guardar}>💾 Guardar cambios</button>
      </div>

      <div className="rpm-roles-grid">
        {ROLES_INFO.map(r => (
          <div key={r.id} className="rpm-role-card" style={{ borderTopColor: r.color }}>
            <h3>{r.nombre}</h3>
            <p>{r.desc}</p>
          </div>
        ))}
      </div>

      <div className="table-section">
        <table className="data-table">
          <thead>
            <tr>
              <th>Permiso</th>
              {ROLES_INFO.map(r => <th key={r.id} style={{ textAlign: 'center' }}>{r.nombre}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERMISOS.map(p => (
              <tr key={p.id}>
                <td className="us-nombre">{p.label}</td>
                {ROLES_INFO.map(r => (
                  <td key={r.id} style={{ textAlign: 'center' }}>
                    <button
                      className={`rpm-check ${matrix[r.id][p.id] ? 'rpm-check--on' : ''} ${r.id === 'super_admin' ? 'rpm-check--locked' : ''}`}
                      onClick={() => toggle(r.id, p.id)}
                      disabled={r.id === 'super_admin'}
                    >
                      {matrix[r.id][p.id] ? '✓' : ''}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
};

export default RolesPermisosPage;
