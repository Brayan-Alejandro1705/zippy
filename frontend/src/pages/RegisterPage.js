import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../config/api';
import ZLoader from '../components/ZLoader';
import '../styles/RegisterPage.css';
import Icon from '../components/Icons';
import SelectPro from '../components/SelectPro';

const ROLES = [
  { value: 'cliente',      icon: 'carrito',      label: 'Cliente',      desc: 'Compra en la plataforma' },
  { value: 'vendedor',     icon: 'vendedores',   label: 'Vendedor',     desc: 'Vende tus productos'      },
  { value: 'domiciliario', icon: 'repartidores', label: 'Domiciliario', desc: 'Entrega pedidos'          },
];

// Zippy opera únicamente en Garzón por ahora.
// Para habilitar más municipios, basta con agregarlos a esta lista.
const CIUDADES = ['Garzón'];

// Vehículos con los que puede repartir un domiciliario
const VEHICULOS = [
  { value: 'moto',      label: 'Moto'      },
  { value: 'bicicleta', label: 'Bicicleta' },
  { value: 'carro',     label: 'Carro'     },
];

const CATEGORIAS_NEGOCIO = [
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
    metodo_verificacion: 'email',
    // Campos vendedor
    nombre_negocio: '', categoria_negocio: 'General', ciudad: CIUDADES[0], es_servicio: false,
    vehiculo: 'moto', placa: '',
    aceptaTerminos: false, aceptaPrivacidad: false, aceptaComercios: false,
  });
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [shake, setShake]             = useState(false);
  const [touched, setTouched]         = useState({});
  // Foto/logo del negocio: opcional, se sube despues de crear la cuenta
  // (el endpoint de subida requiere estar logueado, y en el registro
  // todavia no existe el token).
  const [logoFile, setLogoFile]       = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  const isVendedor = form.tipo_usuario === 'vendedor';
  const isDomiciliario = form.tipo_usuario === 'domiciliario';
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
    const repartidorFields = (isDomiciliario && form.vehiculo !== 'bicicleta') ? { placa: true } : {};
    setTouched({ ...baseFields, ...vendorFields });

    if (!form.nombre || !form.apellido || !form.email || !form.telefono || !form.password || !form.confirmPassword) {
      setError('Completa todos los campos obligatorios'); triggerShake(); return;
    }
    if (isDomiciliario && form.vehiculo !== 'bicicleta' && !form.placa.trim()) {
      setError('Escribe la placa de tu vehículo');
      triggerShake();
      return;
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
    if (!form.aceptaTerminos || !form.aceptaPrivacidad) {
      setError('Debes aceptar los Términos y Condiciones y la Política de Privacidad para continuar'); triggerShake(); return;
    }
    if (isVendedor && !form.aceptaComercios) {
      setError('Debes aceptar las Condiciones para Comercios Aliados para continuar'); triggerShake(); return;
    }

    setLoading(true);
    setError('');
    try {
      const { confirmPassword, aceptaTerminos, aceptaPrivacidad, aceptaComercios, ...datos } = form;

      // Enviar solo los campos que aplican al rol elegido
      const payload = { ...datos };
      if (!isVendedor) {
        delete payload.nombre_negocio;
        delete payload.categoria_negocio;
        delete payload.es_servicio;
      }
      if (!isDomiciliario) {
        delete payload.vehiculo;
        delete payload.placa;
      }
      const response = await authService.registro(payload);
      navigate('/verificar', {
        state: {
          email: form.email,
          metodo: response.data.metodo_verificacion,
          tipo_usuario: form.tipo_usuario,
          envioOk: response.data.envio_ok,
          // Se sube despues de verificar, cuando ya hay token de sesion.
          logoFile: isVendedor ? logoFile : null,
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
            <span className="reg-logo-icon">Z</span>
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
              <div className="reg-section-label">Información del negocio</div>
              <div className="reg-field">
                <label>Nombre del negocio <span className="reg-req">*</span></label>
                <div className="reg-input-wrap">
                  <span className="reg-input-icon"><Icon name="vendedores" size={18} /></span>
                  <input
                    name="nombre_negocio" value={form.nombre_negocio}
                    onChange={handleChange} onBlur={handleBlur}
                    placeholder="Ej: Restaurante El Buen Sabor"
                    className={fieldError('nombre_negocio') ? 'reg-input--err' : ''}
                  />
                </div>
                {fieldError('nombre_negocio') && <span className="reg-field-err">{fieldError('nombre_negocio')}</span>}
              </div>

              <div className="reg-field">
                <label>Foto o logo del negocio <span className="reg-optional">(opcional)</span></label>
                <div className="reg-logo-upload">
                  <div className="reg-logo-preview">
                    {logoPreview
                      ? <img src={logoPreview} alt="Logo del negocio" />
                      : <span className="reg-logo-placeholder"><Icon name="vendedores" size={22} /></span>}
                  </div>
                  <div>
                    <label className="reg-logo-btn">
                      Elegir foto
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setLogoFile(file);
                          setLogoPreview(URL.createObjectURL(file));
                        }}
                      />
                    </label>
                    <p className="reg-logo-hint">Puedes agregarla ahora o después desde tu perfil.</p>
                  </div>
                </div>
              </div>

              <div className="reg-grid-2">
                <div className="reg-field">
                  <label>Categoría <span className="reg-req">*</span></label>
                  <SelectPro
                    name="categoria_negocio"
                    value={form.categoria_negocio}
                    onChange={(val) => setForm(prev => ({ ...prev, categoria_negocio: val }))}
                    options={CATEGORIAS_NEGOCIO}
                    placeholder="Selecciona una categoría"
                  />
                </div>
                <div className="reg-field">
                  <label>Ciudad <span className="reg-req">*</span></label>
                  <SelectPro
                    name="ciudad"
                    value={form.ciudad}
                    onChange={(val) => setForm(prev => ({ ...prev, ciudad: val }))}
                    options={CIUDADES}
                    placeholder="Selecciona la ciudad"
                    error={!!fieldError('ciudad')}
                  />
                  {fieldError('ciudad') && <span className="reg-field-err">{fieldError('ciudad')}</span>}
                </div>
              </div>
            </>
          )}

          {isDomiciliario && (
            <>
              <div className="reg-section-label">Tu vehículo</div>
              <div className="reg-grid-2">
                <div className="reg-field">
                  <label>¿Con qué repartes? <span className="reg-req">*</span></label>
                  <SelectPro
                    name="vehiculo"
                    value={form.vehiculo}
                    onChange={(val) => setForm(prev => ({ ...prev, vehiculo: val, placa: val === 'bicicleta' ? '' : prev.placa }))}
                    options={VEHICULOS}
                    placeholder="Selecciona tu vehículo"
                  />
                </div>

                {form.vehiculo !== 'bicicleta' && (
                  <div className="reg-field">
                    <label>Placa <span className="reg-req">*</span></label>
                    <div className="reg-input-wrap">
                      <span className="reg-input-icon"><Icon name={form.vehiculo === 'carro' ? 'carro' : 'moto'} size={18} /></span>
                      <input
                        name="placa"
                        value={form.placa}
                        onChange={e => setForm(prev => ({ ...prev, placa: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7) }))}
                        placeholder={form.vehiculo === 'carro' ? 'ABC123' : 'ABC12D'}
                        autoCapitalize="characters"
                      />
                    </div>
                  </div>
                )}
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
                placeholder="Nombre" autoComplete="given-name"
                className={fieldError('nombre') ? 'reg-input--err' : ''}
              />
              {fieldError('nombre') && <span className="reg-field-err">{fieldError('nombre')}</span>}
            </div>
            <div className="reg-field">
              <label>Apellido <span className="reg-req">*</span></label>
              <input
                name="apellido" value={form.apellido}
                onChange={handleChange} onBlur={handleBlur}
                placeholder="Apellido" autoComplete="family-name"
                className={fieldError('apellido') ? 'reg-input--err' : ''}
              />
              {fieldError('apellido') && <span className="reg-field-err">{fieldError('apellido')}</span>}
            </div>
          </div>

          <div className="reg-field">
            <label>Correo electrónico <span className="reg-req">*</span></label>
            <div className="reg-input-wrap">
              <span className="reg-input-icon"><Icon name="correo" size={18} /></span>
              <input
                name="email" type="email" value={form.email}
                onChange={handleChange} onBlur={handleBlur}
                placeholder="usuario@ejemplo.com" autoComplete="email"
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

          <div className="reg-legal">
            <label className="reg-terms">
              <input
                type="checkbox"
                checked={form.aceptaTerminos}
                onChange={e => { setForm(prev => ({ ...prev, aceptaTerminos: e.target.checked })); setError(''); }}
              />
              <span>Acepto los <a href="https://brayan-alejandro1705.github.io/zippy/terminos.html" target="_blank" rel="noopener noreferrer">Términos y Condiciones Generales</a> de ZIPPYgo SAS.</span>
            </label>

            {isVendedor && (
              <label className="reg-terms">
                <input
                  type="checkbox"
                  checked={form.aceptaComercios}
                  onChange={e => { setForm(prev => ({ ...prev, aceptaComercios: e.target.checked })); setError(''); }}
                />
                <span>Acepto las <a href="https://brayan-alejandro1705.github.io/zippy/comercios-aliados.html" target="_blank" rel="noopener noreferrer">Condiciones para Comercios Aliados</a>.</span>
              </label>
            )}

            <label className="reg-terms">
              <input
                type="checkbox"
                checked={form.aceptaPrivacidad}
                onChange={e => { setForm(prev => ({ ...prev, aceptaPrivacidad: e.target.checked })); setError(''); }}
              />
              <span>Autorizo el tratamiento de mis datos personales conforme a la <a href="https://brayan-alejandro1705.github.io/zippy/privacidad.html" target="_blank" rel="noopener noreferrer">Política de Privacidad</a>.</span>
            </label>
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