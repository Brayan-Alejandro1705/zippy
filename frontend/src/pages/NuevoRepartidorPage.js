import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { repartidoresService } from '../config/api';
import { useToast } from '../context/ToastContext';
import Layout from '../components/Layout';
import '../styles/NuevoVendedor.css';

const VEHICULOS = [
  { value: 'moto',      label: 'Moto'      },
  { value: 'bicicleta', label: 'Bicicleta' },
  { value: 'carro',     label: 'Carro'     },
];

const initialForm = { nombre: '', apellido: '', email: '', telefono: '', documento: '', vehiculo: 'moto', placa: '', password: '' };

const NuevoRepartidorPage = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [form, setForm]     = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Ruta protegida solo en el front: la seguridad real está en el backend
  // (_requiere_super_admin en /api/v1/usuarios/repartidor/), esto solo
  // evita que un admin normal vea el formulario por error.
  let esSuperAdmin = false;
  try { esSuperAdmin = !!JSON.parse(localStorage.getItem('usuario') || '{}').es_super_admin; } catch { /* noop */ }

  const validate = () => {
    const e = {};
    if (!form.nombre.trim())   e.nombre   = 'Campo requerido';
    if (!form.email.trim())    e.email    = 'Campo requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email inválido';
    if (!form.telefono.trim()) e.telefono = 'Campo requerido';
    if (form.vehiculo !== 'bicicleta' && !form.placa.trim()) e.placa = 'Requerida para moto o carro';
    if (!form.password.trim()) e.password = 'Campo requerido';
    else if (form.password.length < 8) e.password = 'Mínimo 8 caracteres';
    return e;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: name === 'placa' ? value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7) : value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) { setErrors(validationErrors); return; }

    setLoading(true);
    try {
      const payload = { ...form };
      if (payload.vehiculo === 'bicicleta') payload.placa = '';
      await repartidoresService.crear(payload);
      setSuccess(true);
      addToast(`Repartidor ${form.nombre} creado exitosamente`, 'success');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al crear el repartidor.';
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCrearOtro = () => {
    setForm(initialForm);
    setErrors({});
    setSuccess(false);
  };

  if (!esSuperAdmin) {
    return (
      <Layout>
        <div className="nv-page-header">
          <button className="nv-back-btn" onClick={() => navigate('/repartidores')}>← Volver</button>
          <div>
            <h1 className="nv-title">🚫 Acceso restringido</h1>
            <p className="nv-subtitle">Solo un súper administrador puede crear cuentas de repartidor.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="nv-page-header">
        <button className="nv-back-btn" onClick={() => navigate('/repartidores')}>← Volver</button>
        <div>
          <h1 className="nv-title">➕ Nuevo Repartidor</h1>
          <p className="nv-subtitle">Crea una cuenta de repartidor en la plataforma</p>
        </div>
      </div>

      {success ? (
        <div className="nv-success-card">
          <div className="nv-success-icon">✓</div>
          <h2>¡Repartidor creado exitosamente!</h2>
          <p>Comparte el correo <strong>{form.email}</strong> y la contraseña temporal con el repartidor para que inicie sesión.</p>
          <div className="nv-success-actions">
            <button className="btn-create" onClick={handleCrearOtro}>➕ Crear otro repartidor</button>
            <button className="btn-cancel" onClick={() => navigate('/repartidores')}>Ir a Repartidores</button>
          </div>
        </div>
      ) : (
        <form className="nv-form-card" onSubmit={handleSubmit} noValidate>
          <div className="nv-section-title">Información Personal</div>
          <div className="form-row">
            <div className="form-group">
              <label>Nombre</label>
              <input type="text" name="nombre" placeholder="Ej. Juan Pérez" value={form.nombre} onChange={handleChange} className={errors.nombre ? 'input-error' : ''} />
              {errors.nombre && <span className="nv-field-error">{errors.nombre}</span>}
            </div>
            <div className="form-group">
              <label>Apellido <span className="nv-optional">(opcional)</span></label>
              <input type="text" name="apellido" placeholder="Ej. Pérez" value={form.apellido} onChange={handleChange} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Email</label>
              <input type="email" name="email" placeholder="repartidor@correo.com" value={form.email} onChange={handleChange} className={errors.email ? 'input-error' : ''} />
              {errors.email && <span className="nv-field-error">{errors.email}</span>}
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input type="text" name="telefono" placeholder="320-123-4567" value={form.telefono} onChange={handleChange} className={errors.telefono ? 'input-error' : ''} />
              {errors.telefono && <span className="nv-field-error">{errors.telefono}</span>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Documento de identidad <span className="nv-optional">(opcional)</span></label>
              <input type="text" name="documento" placeholder="1234567890" value={form.documento} onChange={handleChange} />
            </div>
          </div>

          <div className="nv-section-title">Vehículo</div>
          <div className="form-row">
            <div className="form-group">
              <label>¿Con qué reparte?</label>
              <select name="vehiculo" value={form.vehiculo} onChange={handleChange}>
                {VEHICULOS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </div>
            {form.vehiculo !== 'bicicleta' && (
              <div className="form-group">
                <label>Placa</label>
                <input type="text" name="placa" placeholder="ABC123" value={form.placa} onChange={handleChange} className={errors.placa ? 'input-error' : ''} />
                {errors.placa && <span className="nv-field-error">{errors.placa}</span>}
              </div>
            )}
          </div>

          <div className="nv-section-title">Acceso a la plataforma</div>
          <div className="form-row">
            <div className="form-group">
              <label>Contraseña temporal</label>
              <input type="password" name="password" placeholder="Mínimo 8 caracteres" value={form.password} onChange={handleChange} className={errors.password ? 'input-error' : ''} />
              {errors.password && <span className="nv-field-error">{errors.password}</span>}
            </div>
            <div className="form-group nv-hint-group">
              <div className="nv-hint">💡 El repartidor podrá cambiar su contraseña desde su perfil o con "¿Olvidaste tu contraseña?" en el login.</div>
            </div>
          </div>

          <div className="nv-form-footer">
            <p className="form-note">✓ Comparte las credenciales directamente con el repartidor (no se envía correo automático)</p>
            <div className="form-actions">
              <button type="button" className="btn-cancel" onClick={() => navigate('/repartidores')} disabled={loading}>Cancelar</button>
              <button type="submit" className="btn-create" disabled={loading}>{loading ? 'Creando...' : '✓ Crear Repartidor'}</button>
            </div>
          </div>
        </form>
      )}
    </Layout>
  );
};

export default NuevoRepartidorPage;
