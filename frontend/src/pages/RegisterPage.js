import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../config/api';
import '../styles/RegisterPage.css';

const ROLES = [
  { value: 'cliente',      icon: '🛒', label: 'Cliente',      desc: 'Compra en la plataforma' },
  { value: 'vendedor',     icon: '🏪', label: 'Vendedor',     desc: 'Vende tus productos'      },
  { value: 'domiciliario', icon: '🛵', label: 'Domiciliario', desc: 'Entrega pedidos'          },
];

const CATEGORIAS = [
  'Restaurante', 'Comida rápida', 'Panadería', 'Cafetería', 'Frutas y verduras',
  'Supermercado', 'Droguería', 'Ropa', 'Electrónica', 'Mascotas', 'General',
];

const getPasswordStrength = (pass) => {
  if (!pass) return 0;
  let score = 0;
  if (pass.length >= 8)          score++;
  if (/[A-Z]/.test(pass))        score++;
  if (/[0-9]/.test(pass))        score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;
  return score;
};

const STRENGTH_LABEL = ['', 'Débil', 'Regular', 'Buena', 'Fuerte'];
const STRENGTH_COLOR = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e'];

const extractErrorMessage = (data, fallback) => {
  const detail = data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(d => d.msg).join('. ');
  return fallback;
};

const RegisterPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombre: '', apellido: '', email: '',
    telefono: '', tipo_usuario: 'cliente',
    password: '', confirmPassword: '',
    // Campos vendedor
    nombre_negocio: '', categoria_negocio: 'General', ciudad: '',
  });
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [shake, setShake]             = useState(false);
  const [touched, setTouched]         = useState({});

  const isVendedor = form.tipo_usuario === 'vendedor';
  const strength   = getPasswordStrength(form.password);
  const strengthPct = (strength / 4) * 100;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleBlur = (e) => setTouched(prev => ({ ...prev, [e.target.name]: true }));

  const fieldError = (name) => {
    if (!touched[name]) return '';
    if (!form[name]?.trim()) return 'Requerido';
    if (name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Email inválido';
    if (name === 'password' && form.password.length < 8) return 'Mínimo 8 caracteres';
    if (name === 'password' && !/[A-Z]/.test(form.password)) return 'Debe incluir una mayúscula';
    if (name === 'password' && !/[0-9]/.test(form.password)) return 'Debe incluir un número';
    if (name === 'confirmPassword' && form.confirmPassword !== form.password) return 'No coinciden';
    return '';
  };

  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 500); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const baseFields = { nombre: true, apellido: true, email: true, password: true, confirmPassword: true };
    const vendorFields = isVendedor ? { nombre_negocio: true, ciudad: true } : {};
    setTouched({ ...baseFields, ...vendorFields });

    if (!form.nombre || !form.apellido || !form.email || !form.password || !form.confirmPassword) {
      setError('Completa todos los campos obligatorios'); triggerShake(); return;
    }
    if (isVendedor && !form.nombre_negocio) {
      setError('El nombre del negocio es obligatorio'); triggerShake(); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('El email no es válido'); triggerShake(); return;
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres'); triggerShake(); return;
    }
    if (!/[A-Z]/.test(form.password)) {
      setError('La contraseña debe incluir al menos una mayúscula'); triggerShake(); return;
    }
    if (!/[0-9]/.test(form.password)) {
      setError('La contraseña debe incluir al menos un número'); triggerShake(); return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden'); triggerShake(); return;
    }

    setLoading(true);
    setError('');
    try {
      const { confirmPassword, ...payload } = form;
      const response = await authService.registro(payload);
      localStorage.setItem('access_token',  response.data.access_token);
      localStorage.setItem('refresh_token', response.data.refresh_token);
      localStorage.setItem('usuario',       JSON.stringify(response.data.usuario));
      const tipo = response.data.usuario.tipo_usuario;
      if (tipo === 'domiciliario') navigate('/repartidor');
      else if (tipo === 'vendedor') navigate('/tienda');
      else navigate('/tienda');
    } catch (err) {
      setError(extractErrorMessage(err.response?.data, 'Error al crear la cuenta'));
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rp-container">
      <div className="rp-blob rp-blob--1" />
      <div className="rp-blob rp-blob--2" />
      <div className="rp-blob rp-blob--3" />

      <div className={`rp-card ${shake ? 'rp-shake' : ''}`}>

        <div className="rp-header">
          <a href="/login" className="rp-back">← Volver al login</a>
          <div className="rp-logo">
            <span className="rp-logo-icon">🛒</span>
            <span className="rp-logo-text">ZIPPY</span>
          </div>
          <h2 className="rp-title">Crear cuenta</h2>
          <p className="rp-sub">Únete a la plataforma de Garzón, Huila</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>

          {/* Tipo de cuenta */}
          <div className="rp-section-label">Tipo de cuenta</div>
          <div className="rp-roles">
            {ROLES.map(({ value, icon, label, desc }) => (
              <button
                key={value}
                type="button"
                className={`rp-role-card ${form.tipo_usuario === value ? 'rp-role-card--active' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, tipo_usuario: value }))}
              >
                <span className="rp-role-icon">{icon}</span>
                <span className="rp-role-label">{label}</span>
                <span className="rp-role-desc">{desc}</span>
              </button>
            ))}
          </div>

          {/* Campos extra para vendedor */}
          {isVendedor && (
            <>
              <div className="rp-section-label">Información del negocio</div>
              <div className="rp-field">
                <label>Nombre del negocio <span className="rp-req">*</span></label>
                <div className="rp-input-wrap">
                  <span className="rp-input-icon">🏪</span>
                  <input
                    name="nombre_negocio" value={form.nombre_negocio}
                    onChange={handleChange} onBlur={handleBlur}
                    placeholder="Ej: Restaurante El Buen Sabor"
                    className={fieldError('nombre_negocio') ? 'rp-input--err' : ''}
                  />
                </div>
                {fieldError('nombre_negocio') && <span className="rp-field-err">{fieldError('nombre_negocio')}</span>}
              </div>

              <div className="rp-grid-2">
                <div className="rp-field">
                  <label>Categoría <span className="rp-req">*</span></label>
                  <select
                    name="categoria_negocio" value={form.categoria_negocio}
                    onChange={handleChange}
                    className="rp-select"
                  >
                    {CATEGORIAS.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="rp-field">
                  <label>Ciudad <span className="rp-optional">(opcional)</span></label>
                  <div className="rp-input-wrap">
                    <span className="rp-input-icon">📍</span>
                    <input
                      name="ciudad" value={form.ciudad}
                      onChange={handleChange}
                      placeholder="Garzón, Huila"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {error && <div className="rp-error"><span>⚠</span> {error}</div>}

          {/* Información personal */}
          <div className="rp-section-label">Información personal</div>
          <div className="rp-grid-2">
            <div className="rp-field">
              <label>Nombre <span className="rp-req">*</span></label>
              <input
                name="nombre" value={form.nombre}
                onChange={handleChange} onBlur={handleBlur}
                placeholder="María" autoComplete="given-name"
                className={fieldError('nombre') ? 'rp-input--err' : ''}
              />
              {fieldError('nombre') && <span className="rp-field-err">{fieldError('nombre')}</span>}
            </div>
            <div className="rp-field">
              <label>Apellido <span className="rp-req">*</span></label>
              <input
                name="apellido" value={form.apellido}
                onChange={handleChange} onBlur={handleBlur}
                placeholder="García" autoComplete="family-name"
                className={fieldError('apellido') ? 'rp-input--err' : ''}
              />
              {fieldError('apellido') && <span className="rp-field-err">{fieldError('apellido')}</span>}
            </div>
          </div>

          <div className="rp-field">
            <label>Correo electrónico <span className="rp-req">*</span></label>
            <div className="rp-input-wrap">
              <span className="rp-input-icon">✉</span>
              <input
                name="email" type="email" value={form.email}
                onChange={handleChange} onBlur={handleBlur}
                placeholder="maria@ejemplo.com" autoComplete="email"
                className={fieldError('email') ? 'rp-input--err' : ''}
              />
            </div>
            {fieldError('email') && <span className="rp-field-err">{fieldError('email')}</span>}
          </div>

          <div className="rp-field">
            <label>Teléfono <span className="rp-optional">(opcional)</span></label>
            <div className="rp-input-wrap">
              <span className="rp-input-icon">📱</span>
              <input
                name="telefono" type="tel" value={form.telefono}
                onChange={handleChange}
                placeholder="320-123-4567" autoComplete="tel"
              />
            </div>
          </div>

          {/* Contraseña */}
          <div className="rp-section-label">Seguridad</div>
          <div className="rp-grid-2">
            <div className="rp-field">
              <label>Contraseña <span className="rp-req">*</span></label>
              <div className="rp-input-wrap">
                <span className="rp-input-icon">🔒</span>
                <input
                  name="password" type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={handleChange} onBlur={handleBlur}
                  placeholder="Mín. 8 caracteres" autoComplete="new-password"
                  className={fieldError('password') ? 'rp-input--err' : ''}
                />
                <button type="button" className="rp-toggle-pass" onClick={() => setShowPass(p => !p)} tabIndex={-1}>
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
              {fieldError('password') && <span className="rp-field-err">{fieldError('password')}</span>}
              {form.password && (
                <div className="rp-strength">
                  <div className="rp-strength-bar">
                    <div className="rp-strength-fill" style={{ width: `${strengthPct}%`, background: STRENGTH_COLOR[strength] }} />
                  </div>
                  <span className="rp-strength-label" style={{ color: STRENGTH_COLOR[strength] }}>
                    {STRENGTH_LABEL[strength]}
                  </span>
                </div>
              )}
            </div>

            <div className="rp-field">
              <label>Confirmar contraseña <span className="rp-req">*</span></label>
              <div className="rp-input-wrap">
                <span className="rp-input-icon">🔒</span>
                <input
                  name="confirmPassword" type={showConfirm ? 'text' : 'password'} value={form.confirmPassword}
                  onChange={handleChange} onBlur={handleBlur}
                  placeholder="Repetir contraseña" autoComplete="new-password"
                  className={fieldError('confirmPassword') ? 'rp-input--err' : ''}
                />
                <button type="button" className="rp-toggle-pass" onClick={() => setShowConfirm(p => !p)} tabIndex={-1}>
                  {showConfirm ? '🙈' : '👁'}
                </button>
              </div>
              {fieldError('confirmPassword') && <span className="rp-field-err">{fieldError('confirmPassword')}</span>}
              {form.confirmPassword && form.confirmPassword === form.password && (
                <span className="rp-match">✓ Las contraseñas coinciden</span>
              )}
            </div>
          </div>

          <button type="submit" className="rp-submit" disabled={loading}>
            {loading
              ? <span className="rp-spinner" />
              : `Crear cuenta como ${ROLES.find(r => r.value === form.tipo_usuario)?.label} →`
            }
          </button>

          <p className="rp-footer">
            ¿Ya tienes cuenta? <a href="/login">Inicia sesión</a>
          </p>

        </form>
      </div>
    </div>
  );
};

export default RegisterPage;
