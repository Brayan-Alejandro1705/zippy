import React, { useState } from 'react';
import Layout from '../components/Layout';
import '../styles/Usuarios.css';

const ACCIONES = ['Todas', 'Suspensión', 'Activación', 'Eliminación', 'Aprobación', 'Configuración', 'Acceso'];

const MOCK_LOGS = [];

const ACCION_BADGE = {
  'Suspensión':    'badge-suspended',
  'Activación':    'badge-active',
  'Eliminación':   'badge-suspended',
  'Aprobación':    'badge-active',
  'Configuración': 'badge-published',
  'Acceso':        'badge-published',
};

const LogsActividadPage = () => {
  const [filtro, setFiltro] = useState('Todas');
  const logs = filtro === 'Todas' ? MOCK_LOGS : MOCK_LOGS.filter(l => l.accion === filtro);

  return (
    <Layout>
      <div className="us-page-header">
        <div>
          <h1 className="us-title">📜 Logs de actividad</h1>
          <p className="us-subtitle">Quién hizo qué y cuándo dentro del panel de administración</p>
        </div>
      </div>

      <div className="us-filters">
        <select className="us-select" value={filtro} onChange={e => setFiltro(e.target.value)}>
          {ACCIONES.map(a => <option key={a}>{a}</option>)}
        </select>
      </div>

      <div className="table-section">
        {logs.length === 0 ? (
          <div className="us-empty"><p>No hay registros para este filtro.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Fecha y hora</th><th>Administrador</th><th>Acción</th><th>Detalle</th></tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}>
                  <td className="us-email">{l.fecha}</td>
                  <td className="us-nombre">{l.admin}</td>
                  <td><span className={`badge ${ACCION_BADGE[l.accion]}`}>{l.accion}</span></td>
                  <td className="us-email">{l.detalle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
};

export default LogsActividadPage;
