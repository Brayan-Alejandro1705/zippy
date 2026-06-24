import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usuariosService } from '../config/api';
import { useToast } from '../context/ToastContext';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import '../styles/Usuarios.css';
import '../styles/UsuarioDetalle.css';

const MOCK_USERS = {
  'U-2546': { id: 'U-2546', nombre: 'María García',   email: 'maria@tienda.com',  telefono: '311-234-5678', documento: '1075489632', rol: 'Vendedor',   ciudad: 'Garzón',   estado: 'Activo',     productos: 234, negocio: 'Café La Montaña',   fechaRegistro: '2024-03-15' },
  'U-2545': { id: 'U-2545', nombre: 'Carlos López',   email: 'carlos@tienda.com', telefono: '320-987-6543', documento: '1075123456', rol: 'Vendedor',   ciudad: 'Neiva',    estado: 'Suspendido', productos: 156, negocio: 'Panadería Don Juan', fechaRegistro: '2024-01-08' },
  'U-2544': { id: 'U-2544', nombre: 'Ana Martínez',   email: 'ana@correo.com',    telefono: '315-456-7890', documento: '1076234567', rol: 'Cliente',    ciudad: 'Pitalito', estado: 'Activo',     productos: 0,   negocio: null,                fechaRegistro: '2024-06-20' },
  'U-2543': { id: 'U-2543', nombre: 'Luis Rodríguez', email: 'luis@correo.com',   telefono: '318-765-4321', documento: '1077345678', rol: 'Repartidor', ciudad: 'Neiva',    estado: 'Activo',     productos: 0,   negocio: null,                fechaRegistro: '2024-02-11' },
  'U-2542': { id: 'U-2542', nombre: 'Pedro Suárez',   email: 'pedro@tienda.com',  telefono: '312-111-2233', documento: '1078456789', rol: 'Vendedor',   ciudad: 'Garzón',   estado: 'Activo',     productos: 89,  negocio: 'Fruver El Paraíso', fechaRegistro: '2024-05-03' },
};

const UsuarioDetallePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [usuario, setUsuario]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [toggling, setToggling] = useState(false);
  const [confirm, setConfirm]   = useState(false);

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      try {
        const res = await usuariosService.obtener(id);
        setUsuario(res.data);
      } catch {
        setUsuario(MOCK_USERS[id] || null);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [id]);

  const handleToggleEstado = async () => {
    if (!usuario) return;
    const nuevoEstado = usuario.estado === 'Activo' ? 'Suspendido' : 'Activo';
    setConfirm(false);
    setToggling(true);
    try {
      await usuariosService.cambiarEstado(id, nuevoEstado);
    } catch {
      // mock mode
    } finally {
      setUsuario(prev => ({ ...prev, estado: nuevoEstado }));
      setToggling(false);
      addToast(
        `${usuario.nombre} ${nuevoEstado === 'Activo' ? 'activado' : 'suspendido'} correctamente`,
        nuevoEstado === 'Activo' ? 'success' : 'warning'
      );
    }
  };

  return (
    <Layout>
      <div className="ud-page-header">
        <button className="nv-back-btn" onClick={() => navigate(-1)}>← Volver</button>
        <div>
          <h1 className="ud-title">👤 Detalle de Usuario</h1>
          <p className="ud-subtitle">Información completa del usuario</p>
        </div>
      </div>

      {loading ? (
        <div className="ud-loading">
          <div className="us-skeleton-row" style={{ height: 120, borderRadius: 8 }} />
          <div className="us-skeleton-row" style={{ height: 200, borderRadius: 8, marginTop: 16 }} />
        </div>
      ) : !usuario ? (
        <div className="ud-not-found">
          <p>Usuario no encontrado.</p>
          <button className="btn-create" onClick={() => navigate('/usuarios')}>Ver todos los usuarios</button>
        </div>
      ) : (
        <div className="ud-content">
          <div className="ud-profile-card">
            <div className="ud-avatar">{usuario.nombre.charAt(0).toUpperCase()}</div>
            <div className="ud-profile-info">
              <h2 className="ud-nombre">{usuario.nombre}</h2>
              <p className="ud-email">{usuario.email}</p>
              <div className="ud-badges">
                <span className={`us-rol-badge us-rol-${usuario.rol.toLowerCase()}`}>{usuario.rol}</span>
                <span className={`badge ${usuario.estado === 'Activo' ? 'badge-active' : 'badge-suspended'}`}>
                  {usuario.estado === 'Activo' ? '🟢 Activo' : '🔴 Suspendido'}
                </span>
              </div>
            </div>
            <div className="ud-profile-actions">
              <button
                className={`us-toggle-btn ${usuario.estado === 'Activo' ? 'us-toggle-suspend' : 'us-toggle-activate'}`}
                onClick={() => setConfirm(true)}
                disabled={toggling}
                style={{ padding: '10px 20px', fontSize: 14 }}
              >
                {toggling ? 'Actualizando...' : usuario.estado === 'Activo' ? '🚫 Suspender' : '✓ Activar'}
              </button>
            </div>
          </div>

          <div className="ud-details-grid">
            <div className="ud-detail-card">
              <div className="ud-detail-title">Información Personal</div>
              {[
                ['Nombre',    usuario.nombre],
                ['Email',     usuario.email],
                ['Teléfono',  usuario.telefono || '—'],
                ['Documento', usuario.documento || '—'],
                ['Ciudad',    usuario.ciudad || '—'],
                ['Registro',  usuario.fechaRegistro || '—'],
              ].map(([label, value]) => (
                <div className="ud-detail-row" key={label}>
                  <span className="ud-detail-label">{label}</span>
                  <span className="ud-detail-value">{value}</span>
                </div>
              ))}
            </div>

            {usuario.rol === 'Vendedor' && (
              <div className="ud-detail-card">
                <div className="ud-detail-title">Información del Negocio</div>
                {[
                  ['Negocio',   usuario.negocio || '—'],
                  ['Productos', usuario.productos],
                  ['Ciudad',    usuario.ciudad || '—'],
                ].map(([label, value]) => (
                  <div className="ud-detail-row" key={label}>
                    <span className="ud-detail-label">{label}</span>
                    <span className="ud-detail-value">{value}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="ud-detail-card">
              <div className="ud-detail-title">Cuenta</div>
              {[
                ['ID',     usuario.id],
                ['Rol',    usuario.rol],
                ['Estado', usuario.estado],
              ].map(([label, value]) => (
                <div className="ud-detail-row" key={label}>
                  <span className="ud-detail-label">{label}</span>
                  <span className="ud-detail-value" style={label === 'ID' ? { fontFamily: 'monospace' } : {}}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirm}
        danger={usuario?.estado === 'Activo'}
        title={usuario?.estado === 'Activo' ? 'Suspender usuario' : 'Activar usuario'}
        message={
          usuario?.estado === 'Activo'
            ? `¿Suspender a ${usuario?.nombre}? No podrá acceder a la plataforma.`
            : `¿Activar la cuenta de ${usuario?.nombre}?`
        }
        confirmLabel={usuario?.estado === 'Activo' ? 'Sí, suspender' : 'Sí, activar'}
        onConfirm={handleToggleEstado}
        onCancel={() => setConfirm(false)}
      />
    </Layout>
  );
};

export default UsuarioDetallePage;
