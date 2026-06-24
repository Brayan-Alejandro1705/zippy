import React, { useState } from 'react';
import { useToast } from '../context/ToastContext';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import '../styles/Usuarios.css';

export const MOCK_SOLICITUDES = [];

const SolicitudesPage = () => {
  const { addToast } = useToast();
  const [solicitudes, setSolicitudes] = useState(MOCK_SOLICITUDES);
  const [confirm, setConfirm] = useState(null); // { solicitud, accion }

  const handleConfirm = () => {
    const { solicitud, accion } = confirm;
    setConfirm(null);
    setSolicitudes(prev => prev.filter(s => s.id !== solicitud.id));
    addToast(
      accion === 'aprobar' ? `${solicitud.nombre} aprobado como vendedor` : `Solicitud de ${solicitud.nombre} rechazada`,
      accion === 'aprobar' ? 'success' : 'warning'
    );
  };

  return (
    <Layout>
      <div className="us-page-header">
        <div>
          <h1 className="us-title">📋 Solicitudes</h1>
          <p className="us-subtitle">Nuevos vendedores esperando aprobación</p>
        </div>
      </div>

      <div className="us-stats-strip">
        <div className="us-stat us-stat--orange">
          <span className="us-stat-num">{solicitudes.length}</span>
          <span className="us-stat-label">Pendientes</span>
        </div>
      </div>

      <div className="table-section">
        {solicitudes.length === 0 ? (
          <div className="us-empty"><p>No hay solicitudes pendientes.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th><th>Nombre</th><th>Negocio</th><th>Email</th>
                <th>Teléfono</th><th>Ciudad</th><th>Fecha</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {solicitudes.map(s => (
                <tr key={s.id}>
                  <td className="us-id">{s.id}</td>
                  <td className="us-nombre">{s.nombre}</td>
                  <td>{s.negocio}</td>
                  <td className="us-email">{s.email}</td>
                  <td className="us-email">{s.telefono}</td>
                  <td>{s.ciudad}</td>
                  <td className="us-email">{s.fecha}</td>
                  <td className="us-actions">
                    <div className="us-row-actions">
                      <button className="us-toggle-btn us-toggle-activate" onClick={() => setConfirm({ solicitud: s, accion: 'aprobar' })}>
                        Aprobar
                      </button>
                      <button className="us-toggle-btn us-toggle-delete" onClick={() => setConfirm({ solicitud: s, accion: 'rechazar' })}>
                        Rechazar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        isOpen={!!confirm}
        danger={confirm?.accion === 'rechazar'}
        title={confirm?.accion === 'aprobar' ? 'Aprobar solicitud' : 'Rechazar solicitud'}
        message={
          confirm?.accion === 'aprobar'
            ? `¿Aprobar la solicitud de ${confirm?.solicitud.nombre} (${confirm?.solicitud.negocio})? Se activará como vendedor.`
            : `¿Rechazar la solicitud de ${confirm?.solicitud.nombre}? Esta acción no se puede deshacer.`
        }
        confirmLabel={confirm?.accion === 'aprobar' ? 'Sí, aprobar' : 'Sí, rechazar'}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />
    </Layout>
  );
};

export default SolicitudesPage;
