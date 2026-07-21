import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../config/api';
import ZLoader from '../components/ZLoader';
import '../styles/RegisterPage.css';
import Icon from '../components/Icons';

const ROLES = [
  { value: 'cliente',      icon: 'carrito',      label: 'Cliente',      desc: 'Compra en la plataforma' },
  { value: 'vendedor',     icon: 'vendedores',   label: 'Vendedor',     desc: 'Vende tus productos'      },
  { value: 'domiciliario', icon: 'repartidores', label: 'Domiciliario', desc: 'Entrega pedidos'          },
];

const CATEGORIAS_NEGOCIO = [
  'Restaurante', 'Comida rápida', 'Panadería', 'Cafetería', 'Frutas y verduras',
  'Supermercado', 'Droguería', 'Ropa', 'Electrónica', 'Mascotas', 'General',
];

const CATEGORIAS_SERVICIO = [
  'Aseo del hogar', 'Lavado y planchado', 'Jardinería y poda', 'Pintura',
  'Albañilería', 'Carpintería', 'Cerrajería', 'Fumigación', 'Niñera',
  'Cuidado de adultos mayores', 'Entrenador personal', 'Peluquería / barbería',
  'Manicure y pedicure', 'Maquillaje', 'Repostería por pedido',
  'Comida casera / catering', 'Fotografía y video', 'DJ / sonido', 'Decoración',
  'Meseros', 'Lavado de motos y carros', 'Mecánica a domicilio',
  'Modistería / arreglos de ropa', 'Mensajería y mandados', 'Soporte técnico',
  'Clases particulares',
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
    metodo_verificacion: 'email',
    // Campos vendedor
    nombre_negocio: '', categoria_negocio: 'General', ciudad: '', es_servicio: false,
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
    const baseFields = { nombre: true, apellido: true, email: true, telefono: true, password: true, confirmPassword: true };
    const vendorFields = isVendedor ? { nombre_negocio: true, ciudad: true } : {};
    setTouched({ ...baseFields, ...vendorFields });

    if (!form.nombre || !form.apellido || !form.email || !form.telefono || !form.password || !form.confirmPassword) {
      setError('Completa todos los campos obligatorios'); triggerShake(); return;
    }
    if (isVendedor && !form.nombre_negocio) {
      setError('El nombre del negocio es obligatorio'); triggerShake(); return;
    }
    if (isVendedor && !form.ciudad) {
      setError('La ciudad es obligatoria'); triggerShake(); return;
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
      navigate('/verificar', {
        state: {
          email: form.email,
          metodo: response.data.metodo_verificacion,
          tipo_usuario: form.tipo_usuario,
          envioOk: response.data.envio_ok,
        },
      });
    } catch (err) {
      setError(extractErrorMessage(err.response?.data, 'Error al crear la cuenta'));
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reg-container">
      <div className="reg-blob reg-blob--1" />
      <div className="reg-blob reg-blob--2" />
      <div className="reg-blob reg-blob--3" />

      <div className={`reg-card ${shake ? 'reg-shake' : ''}`}>

        <div className="reg-header">
          <div className="reg-logo">
            <span className="reg-logo-icon"><Icon name="carrito" size={30} /></span>
            <span className="reg-logo-text">ZIPPY</span>
          </div>
          <h2 className="reg-title">Crear cuenta</h2>
          <p className="reg-sub">Únete a la plataforma de Garzón, Huila</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>

          {/* Tipo de cuenta */}
          <div className="reg-section-label">Tipo de cuenta</div>
          <div className="reg-roles">
            {ROLES.map(({ value, icon, label, desc }) => (
              <button
                key={value}
                type="button"
                className={`reg-role-card ${form.tipo_usuario === value ? 'reg-role-card--active' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, tipo_usuario: value }))}
              >
                <span className="reg-role-icon"><Icon name={icon} size={30} /></span>
                <span className="reg-role-label">{label}</span>
                <span className="reg-role-desc">{desc}</span>
              </button>
            ))}
          </div>

          {/* Campos extra para vendedor */}
          {isVendedor && (
            <>
              <div className="reg-section-label">¿Qué vas a ofrecer?</div>
              <div className="reg-modalidad-toggle">
                <button
                  type="button"
                  className={`reg-modalidad-btn ${!form.es_servicio ? 'reg-modalidad-btn--active' : ''}`}
                  onClick={() => setForm(prev => ({ ...prev, es_servicio: false, categoria_negocio: CATEGORIAS_NEGOCIO[0] }))}
                >
                  <span className="reg-modalidad-icon"><Icon name="vendedores" size={22} /></span>
                  <span>
                    <span className="reg-modalidad-title">Negocio</span>
                    <span className="reg-modalidad-desc">Tengo un local o tienda</span>
                  </span>
                </button>
                <button
                  type="button"
                  className={`reg-modalidad-btn ${form.es_servicio ? 'reg-modalidad-btn--active' : ''}`}
                  onClick={() => setForm(prev => ({ ...prev, es_servicio: true, categoria_negocio: CATEGORIAS_SERVICIO[0] }))}
                >
                  <span className="reg-modalidad-icon"><Icon name="herramientas" size={22} /></span>
                  <span>
                    <span className="reg-modalidad-title">Servicio</span>
                    <span className="reg-modalidad-desc">Sin local fijo</span>
                  </span>
                </button>
              </div>

              <div className="reg-section-label">
                {form.es_servicio ? 'Información del servicio' : 'Información del negocio'}
              </div>
              <div className="reg-field">
                <label>{form.es_servicio ? 'Nombre del servicio' : 'Nombre del negocio'} <span className="reg-req">*</span></label>
                <div className="reg-input-wrap">
                  <span className="reg-input-icon"><Icon name={form.es_servicio ? 'herramientas' : 'vendedores'} size={18} /></span>
                  <input
                    name="nombre_negocio" value={form.nombre_negocio}
                    onChange={handleChange} onBlur={handleBlur}
                    placeholder={form.es_servicio ? 'Ej: Plomería Juan Pérez' : 'Ej: Restaurante El Buen Sabor'}
                    className={fieldError('nombre_negocio') ? 'reg-input--err' : ''}
                  />
                </div>
                {fieldError('nombre_negocio') && <span className="reg-field-err">{fieldError('nombre_negocio')}</span>}
              </div>

              <div className="reg-grid-2">
                <div className="reg-field">
                  <label>Categoría <span className="reg-req">*</span></label>
                  <select
                    name="categoria_negocio" value={form.categoria_negocio}
                    onChange={handleChange}
                    className="reg-select"
                  >
                    {(form.es_servicio ? CATEGORIAS_SERVICIO : CATEGORIAS_NEGOCIO).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="reg-field">
                  <label>Ciudad <span className="reg-req">*</span></label>
                  <div className="reg-input-wrap">
                    <span className="reg-input-icon"><Icon name="ubicacion" size={18} /></span>
                    <input
                      name="ciudad" value={form.ciudad}
                      onChange={handleChange} onBlur={handleBlur}
                      placeholder="Garzón, Huila"
                      className={fieldError('ciudad') ? 'reg-input--err' : ''}
                    />
                  </div>
                  {fieldError('ciudad') && <span className="reg-field-err">{fieldError('ciudad')}</span>}
                </div>
              </div>
            </>
          )}

          {error && <div className="reg-error"><span><Icon name="alerta" size={17} /></span> {error}</div>}

          {/* Información personal */}
          <div className="reg-section-label">Información personal</div>
          <div className="reg-grid-2">
            <div className="reg-field">
              <label>Nombre <span className="reg-req">*</span></label>
              <input
                name="nombre" value={form.nombre}
                onChange={handleChange} onBlur={handleBlur}
                placeholder="María" autoComplete="given-name"
                className={fieldError('nombre') ? 'reg-input--err' : ''}
              />
              {fieldError('nombre') && <span className="reg-field-err">{fieldError('nombre')}</span>}
            </div>
            <div className="reg-field">
              <label>Apellido <span className="reg-req">*</span></label>
              <input
                name="apellido" value={form.apellido}
                onChange={handleChange} onBlur={handleBlur}
                placeholder="García" autoComplete="family-name"
                className={fieldError('apellido') ? 'reg-input--err' : ''}
              />
              {fieldError('apellido') && <span className="reg-field-err">{fieldError('apellido')}</span>}
            </div>
          </div>

          <div className="reg-field">
            <label>Correo electrónico <span className="reg-req">*</span></label>
            <div className="reg-input-wrap">
              <span className="reg-input-icon">✉</span>
              <input
                name="email" type="email" value={form.email}
                onChange={handleChange} onBlur={handleBlur}
                placeholder="maria@ejemplo.com" autoComplete="email"
                className={fieldError('email') ? 'reg-input--err' : ''}
              />
            </div>
            {fieldError('email') && <span className="reg-field-err">{fieldError('email')}</span>}
          </div>

          <div className="reg-field">
            <label>Teléfono <span className="reg-req">*</span></label>
            <div className="reg-input-wrap">
              <span className="reg-input-icon"><Icon name="telefono" size={18} /></span>
              <input
                name="telefono" type="tel" value={form.telefono}
                onChange={handleChange} onBlur={handleBlur}
                placeholder="320-123-4567" autoComplete="tel"
                className={fieldError('telefono') ? 'reg-input--err' : ''}
              />
            </div>
            {fieldError('telefono') && <span className="reg-field-err">{fieldError('telefono')}</span>}
          </div>

          {/* Contraseña */}
          <div className="reg-section-label">Seguridad</div>
          <div className="reg-grid-2">
            <div className="reg-field">
              <label>Contraseña <span className="reg-req">*</span></label>
              <div className="reg-input-wrap">
                <span className="reg-input-icon"><Icon name="candado" size={18} /></span>
                <input
                  name="password" type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={handleChange} onBlur={handleBlur}
                  placeholder="Mín. 8 caracteres" autoComplete="new-password"
                  className={fieldError('password') ? 'reg-input--err' : ''}
                />
                <button type="button" className="reg-toggle-pass" onClick={() => setShowPass(p => !p)} tabIndex={-1}>
                  {showPass ? (
                    <svg viewBox="0 0 20 20" fill="none" width="20" height="20">
                    <path d="M3 3l14 14M8.5 8.6A3 3 0 0013.4 13M6.5 5.6C4.6 6.9 3 9 3 10s3 5 7 5c1.4 0 2.7-.4 3.8-1M10 5c4 0 7 3 7 5a8.5 8.5 0 01-1.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" fill="none" width="20" height="20">
                    <path d="M10 4C6 4 3 7 3 10s3 6 7 6 7-3 7-6-3-6-7-6z" stroke="currentColor" strokeWidth="1.5"/>
                    <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  )}
                </button>
              </div>
              {fieldError('password') && <span className="reg-field-err">{fieldError('password')}</span>}
              {form.password && (
                <div className="reg-strength">
                  <div className="reg-strength-bar">
                    <div className="reg-strength-fill" style={{ width: `${strengthPct}%`, background: STRENGTH_COLOR[strength] }} />
                  </div>
                  <span className="reg-strength-label" style={{ color: STRENGTH_COLOR[strength] }}>
                    {STRENGTH_LABEL[strength]}
                  </span>
                </div>
              )}
            </div>

            <div className="reg-field">
              <label>Confirmar contraseña <span className="reg-req">*</span></label>
              <div className="reg-input-wrap">
                <span className="reg-input-icon"><Icon name="candado" size={18} /></span>
                <input
                  name="confirmPassword" type={showConfirm ? 'text' : 'password'} value={form.confirmPassword}
                  onChange={handleChange} onBlur={handleBlur}
                  placeholder="Repetir contraseña" autoComplete="new-password"
                  className={fieldError('confirmPassword') ? 'reg-input--err' : ''}
                />
                <button type="button" className="reg-toggle-pass" onClick={() => setShowConfirm(p => !p)} tabIndex={-1}>
                  {showConfirm ? (
                    <svg viewBox="0 0 20 20" fill="none" width="20" height="20">
                    <path d="M3 3l14 14M8.5 8.6A3 3 0 0013.4 13M6.5 5.6C4.6 6.9 3 9 3 10s3 5 7 5c1.4 0 2.7-.4 3.8-1M10 5c4 0 7 3 7 5a8.5 8.5 0 01-1.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" fill="none" width="20" height="20">
                    <path d="M10 4C6 4 3 7 3 10s3 6 7 6 7-3 7-6-3-6-7-6z" stroke="currentColor" strokeWidth="1.5"/>
                    <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  )}
                </button>
              </div>
              {fieldError('confirmPassword') && <span className="reg-field-err">{fieldError('confirmPassword')}</span>}
              {form.confirmPassword && form.confirmPassword === form.password && (
                <span className="reg-match">✓ Las contraseñas coinciden</span>
              )}
            </div>
          </div>

          <button type="submit" className="reg-submit" disabled={loading}>
            {loading
              ? <ZLoader size="sm" inverted />
              : `Crear cuenta como ${ROLES.find(r => r.value === form.tipo_usuario)?.label} →`
            }
          </button>

          <p className="reg-footer">
            ¿Ya tienes cuenta? <a href="/login">Inicia sesión</a>
          </p>

        </form>
      </div>
    </div>
  );
};

export default RegisterPage;