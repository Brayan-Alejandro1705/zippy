import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { vendedoresService } from '../config/api';
import { useToast } from '../context/ToastContext';
import Layout from '../components/Layout';
import '../styles/NuevoVendedor.css';

const CIUDADES = ['Garzón', 'Neiva', 'Pitalito', 'La Plata', 'Campoalegre'];
const ROLES = ['Vendedor', 'Repartidor', 'Admin', 'Soporte'];

const initialForm = { nombre: '', email: '', telefono: '', documento: '', negocio: '', ciudad: '', direccion: '', rol: 'Vendedor', descripcion: '', password: '' };

const NuevoVendedorPage = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [form, setForm]     = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.nombre.trim())    e.nombre    = 'Campo requerido';
    if (!form.email.trim())     e.email     = 'Campo requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email inválido';
    if (!form.telefono.trim())  e.telefono  = 'Campo requerido';
    if (!form.documento.trim()) e.documento = 'Campo requerido';
    if (!form.negocio.trim())   e.negocio   = 'Campo requerido';
    if (!form.ciudad)           e.ciudad    = 'Selecciona una ciudad';
    if (!form.direccion.trim()) e.direccion = 'Campo requerido';
    if (!form.password.trim())  e.password  = 'Campo requerido';
    else if (form.password.length < 8) e.password = 'Mínimo 8 caracteres';
    return e;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) { setErrors(validationErrors); return; }

    setLoading(true);
    try {
      await vendedoresService.crear(form);
      setSuccess(true);
      addToast(`Vendedor ${form.nombre} creado exitosamente`, 'success');
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.email?.[0] || 'Error al crear el vendedor.';
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

  return (
    <Layout>
      <div className="nv-page-header">
        <button className="nv-back-btn" onClick={() => navigate('/dashboard')}>← Volver</button>
        <div>
          <h1 className="nv-title">➕ Nuevo Vendedor</h1>
          <p className="nv-subtitle">Crea una cuenta de vendedor en la plataforma</p>
        </div>
      </div>

      {success ? (
        <div className="nv-success-card">
          <div className="nv-success-icon">✓</div>
          <h2>¡Vendedor creado exitosamente!</h2>
          <p>Se envió un email de bienvenida a <strong>{form.email}</strong> con las credenciales de acceso.</p>
          <div className="nv-success-actions">
            <button className="btn-create" onClick={handleCrearOtro}>➕ Crear otro vendedor</button>
            <button className="btn-cancel" onClick={() => navigate('/dashboard')}>Ir al Dashboard</button>
          </div>
        </div>
      ) : (
        <form className="nv-form-card" onSubmit={handleSubmit} noValidate>
          <div className="nv-section-title">Información Personal</div>
          <div className="form-row">
            <div className="form-group">
              <label>Nombre completo</label>
              <input type="text" name="nombre" placeholder="Ej. María García" value={form.nombre} onChange={handleChange} className={errors.nombre ? 'input-error' : ''} />
              {errors.nombre && <span className="nv-field-error">{errors.nombre}</span>}
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" name="email" placeholder="maria@tienda.com" value={form.email} onChange={handleChange} className={errors.email ? 'input-error' : ''} />
              {errors.email && <span className="nv-field-error">{errors.email}</span>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Teléfono</label>
              <input type="text" name="telefono" placeholder="320-123-4567" value={form.telefono} onChange={handleChange} className={errors.telefono ? 'input-error' : ''} />
              {errors.telefono && <span className="nv-field-error">{errors.telefono}</span>}
            </div>
            <div className="form-group">
              <label>Documento de identidad</label>
              <input type="text" name="documento" placeholder="1234567890" value={form.documento} onChange={handleChange} className={errors.documento ? 'input-error' : ''} />
              {errors.documento && <span className="nv-field-error">{errors.documento}</span>}
            </div>
          </div>

          <div className="nv-section-title">Información del Negocio</div>
          <div className="form-row">
            <div className="form-group">
              <label>Nombre del negocio</label>
              <input type="text" name="negocio" placeholder="Ej. Café Premium - La Montaña" value={form.negocio} onChange={handleChange} className={errors.negocio ? 'input-error' : ''} />
              {errors.negocio && <span className="nv-field-error">{errors.negocio}</span>}
            </div>
            <div className="form-group">
              <label>Ciudad</label>
              <select name="ciudad" value={form.ciudad} onChange={handleChange} className={errors.ciudad ? 'input-error' : ''}>
                <option value="">Seleccionar ciudad</option>
                {CIUDADES.map(c => <option key={c}>{c}</option>)}
              </select>
              {errors.ciudad && <span className="nv-field-error">{errors.ciudad}</span>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Dirección</label>
              <input type="text" name="direccion" placeholder="Ej. Cra 5 #12-45, Garzón" value={form.direccion} onChange={handleChange} className={errors.direccion ? 'input-error' : ''} />
              {errors.direccion && <span className="nv-field-error">{errors.direccion}</span>}
            </div>
            <div className="form-group">
              <label>Rol asignado</label>
              <select name="rol" value={form.rol} onChange={handleChange}>
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row nv-full-row">
            <div className="form-group">
              <label>Descripción del negocio <span className="nv-optional">(opcional)</span></label>
              <textarea name="descripcion" placeholder="Breve descripción del negocio..." value={form.descripcion} onChange={handleChange} rows={3} />
            </div>
          </div>

          <div className="nv-section-title">Acceso a la plataforma</div>
          <div className="form-row">
            <div className="form-group">
              <label>Contraseña temporal</label>
              <input type="password" name="password" placeholder="Mínimo 8 caracteres" value={form.password} onChange={handleChange} className={errors.password ? 'input-error' : ''} />
              {errors.password && <span className="nv-field-error">{errors.password}</span>}
            </div>
            <div className="form-group nv-hint-group">
              <div className="nv-hint">💡 El vendedor podrá cambiar su contraseña al iniciar sesión por primera vez.</div>
            </div>
          </div>

          <div className="nv-form-footer">
            <p className="form-note">✓ Se enviará un email de bienvenida con las credenciales</p>
            <div className="form-actions">
              <button type="button" className="btn-cancel" onClick={() => navigate('/dashboard')} disabled={loading}>Cancelar</button>
              <button type="submit" className="btn-create" disabled={loading}>{loading ? 'Creando...' : '✓ Crear Vendedor'}</button>
            </div>
          </div>
        </form>
      )}
    </Layout>
  );
};

export default NuevoVendedorPage;
