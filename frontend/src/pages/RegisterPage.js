import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { authService } from '../config/api';
import ZLoader from '../components/ZLoader';
import PantallaAuth, { LogoZippy, TituloAuth, ErrorAuth, CampoAuth, BotonOjo, etiquetaAuth, botonAuth, enlaceAuth } from '../components/auth/PantallaAuth';
import { cx } from '../ui/tw';
import BotonesSociales from '../components/auth/BotonesSociales';
import Icon from '../components/Icons';
import SelectPro from '../components/SelectPro';
import { CATEGORIAS_NEGOCIO } from '../constants/categorias';

// El registro público de "domiciliario" quedó deshabilitado: ahora solo un
// súper admin puede crear el acceso de un repartidor (panel admin ->
// Repartidores -> Nuevo repartidor).
const ROLES = [
  { value: 'cliente',      icon: 'carrito',      label: 'Cliente',      desc: 'Compra en la plataforma' },
  { value: 'vendedor',     icon: 'vendedores',   label: 'Vendedor',     desc: 'Vende tus productos'      },
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
  const { search } = useLocation();
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
    setTouched({ ...baseFields, ...vendorFields, ...repartidorFields });

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
      if (err.response?.status === 429) {
        setError('Hay muchos registros desde tu misma red. Espera unos minutos e intenta de nuevo.');
      } else {
        setError(extractErrorMessage(err.response?.data, 'Error al crear la cuenta'));
      }
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  // Piezas que se repiten en el formulario
  const Seccion = ({ children }) => (
    <div className="mb-3 mt-6 text-[11px] font-bold uppercase tracking-[1px] text-zippy first:mt-0">{children}</div>
  );
  const Req = () => <span className="text-red-400">*</span>;
  const ErrorCampo = ({ campo }) => fieldError(campo)
    ? <span className="mt-1.5 block text-xs text-red-300">{fieldError(campo)}</span>
    : null;
  const icono = (nombre) => <Icon name={nombre} size={17} />;
  // Dos columnas solo cuando hay espacio (PC); en celular todo va en una
  const dosColumnas = 'grid grid-cols-1 gap-x-3.5 sm:grid-cols-2';
  const campo = 'mb-4 min-w-0';

  return (
    <PantallaAuth sacudir={shake}>
      <LogoZippy />
      <TituloAuth titulo="Crear cuenta" sub="Únete a la plataforma de Garzón, Huila" />

      {/* "reg-container" se deja solo para que el desplegable (SelectPro)
          tome sus colores oscuros desde selectpro.css */}
      <form onSubmit={handleSubmit} noValidate className="reg-container">

        <Seccion>Tipo de cuenta</Seccion>
        <div className="mb-1 grid grid-cols-2 gap-2.5">
          {ROLES.map(({ value, icon, label, desc }) => {
            const activo = form.tipo_usuario === value;
            return (
              <button
                key={value}
                type="button"
                className={cx(
                  'flex cursor-pointer flex-col items-center gap-1 rounded-[14px] border-2 border-solid px-2 py-3.5 text-center transition-colors',
                  activo ? 'border-zippy bg-zippy/[0.12]' : 'border-white/10 bg-white/[0.03] hover:border-zippy/40 hover:bg-zippy/[0.08]'
                )}
                onClick={() => setForm(prev => ({ ...prev, tipo_usuario: value }))}
              >
                <span className={activo ? 'text-zippy' : 'text-white/80'}><Icon name={icon} size={28} /></span>
                <span className={cx('text-sm font-bold', activo ? 'text-zippy' : 'text-white')}>{label}</span>
                <span className="text-[11px] leading-tight text-white/45">{desc}</span>
              </button>
            );
          })}
        </div>

        {/* Solo para clientes: un negocio necesita los datos de abajo */}
        {form.tipo_usuario === 'cliente' && (
          <div className="mt-5">
            <BotonesSociales texto="Registrarme" onError={(m) => { setError(m); if (m) triggerShake(); }} />
          </div>
        )}

        {isVendedor && (
          <>
            <Seccion>Información del negocio</Seccion>
            <div className={campo}>
              <label className={etiquetaAuth}>Nombre del negocio <Req /></label>
              <CampoAuth
                name="nombre_negocio" value={form.nombre_negocio}
                onChange={handleChange} onBlur={handleBlur}
                placeholder="Ej: Restaurante El Buen Sabor"
                icono={icono('vendedores')}
                error={!!fieldError('nombre_negocio')}
              />
              <ErrorCampo campo="nombre_negocio" />
            </div>

            <div className={campo}>
              <label className={etiquetaAuth}>Foto o logo del negocio <span className="normal-case tracking-normal text-white/30">(opcional)</span></label>
              <div className="flex items-center gap-3.5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-dashed border-white/20 bg-white/[0.04] text-white/40">
                  {logoPreview
                    ? <img src={logoPreview} alt="Logo del negocio" className="h-full w-full object-cover" />
                    : <Icon name="vendedores" size={22} />}
                </div>
                <div className="min-w-0">
                  <label className="inline-block cursor-pointer rounded-lg border border-solid border-zippy/50 bg-zippy/10 px-3.5 py-2 text-[13px] font-semibold text-zippy">
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
                  <p className="m-0 mt-1.5 text-xs leading-snug text-white/40">Puedes agregarla ahora o después desde tu perfil.</p>
                </div>
              </div>
            </div>

            <div className={dosColumnas}>
              <div className={campo}>
                <label className={etiquetaAuth}>Categoría <Req /></label>
                <SelectPro
                  name="categoria_negocio"
                  value={form.categoria_negocio}
                  onChange={(val) => setForm(prev => ({ ...prev, categoria_negocio: val }))}
                  options={CATEGORIAS_NEGOCIO}
                  placeholder="Selecciona una categoría"
                />
              </div>
              <div className={campo}>
                <label className={etiquetaAuth}>Ciudad <Req /></label>
                <SelectPro
                  name="ciudad"
                  value={form.ciudad}
                  onChange={(val) => setForm(prev => ({ ...prev, ciudad: val }))}
                  options={CIUDADES}
                  placeholder="Selecciona la ciudad"
                  error={!!fieldError('ciudad')}
                />
                <ErrorCampo campo="ciudad" />
              </div>
            </div>
          </>
        )}

        {isDomiciliario && (
          <>
            <Seccion>Tu vehículo</Seccion>
            <div className={dosColumnas}>
              <div className={campo}>
                <label className={etiquetaAuth}>¿Con qué repartes? <Req /></label>
                <SelectPro
                  name="vehiculo"
                  value={form.vehiculo}
                  onChange={(val) => setForm(prev => ({ ...prev, vehiculo: val, placa: val === 'bicicleta' ? '' : prev.placa }))}
                  options={VEHICULOS}
                  placeholder="Selecciona tu vehículo"
                />
              </div>
              {form.vehiculo !== 'bicicleta' && (
                <div className={campo}>
                  <label className={etiquetaAuth}>Placa <Req /></label>
                  <CampoAuth
                    name="placa"
                    value={form.placa}
                    onChange={e => setForm(prev => ({ ...prev, placa: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7) }))}
                    placeholder={form.vehiculo === 'carro' ? 'ABC123' : 'ABC12D'}
                    autoCapitalize="characters"
                    icono={icono(form.vehiculo === 'carro' ? 'carro' : 'moto')}
                  />
                </div>
              )}
            </div>
          </>
        )}

        {error && <div className="mt-4"><ErrorAuth>{error}</ErrorAuth></div>}

        <Seccion>Información personal</Seccion>
        <div className={dosColumnas}>
          <div className={campo}>
            <label className={etiquetaAuth}>Nombre <Req /></label>
            <CampoAuth
              name="nombre" value={form.nombre}
              onChange={handleChange} onBlur={handleBlur}
              placeholder="Nombre" autoComplete="given-name"
              error={!!fieldError('nombre')}
            />
            <ErrorCampo campo="nombre" />
          </div>
          <div className={campo}>
            <label className={etiquetaAuth}>Apellido <Req /></label>
            <CampoAuth
              name="apellido" value={form.apellido}
              onChange={handleChange} onBlur={handleBlur}
              placeholder="Apellido" autoComplete="family-name"
              error={!!fieldError('apellido')}
            />
            <ErrorCampo campo="apellido" />
          </div>
        </div>

        <div className={campo}>
          <label className={etiquetaAuth}>Correo electrónico <Req /></label>
          <CampoAuth
            name="email" type="email" value={form.email}
            onChange={handleChange} onBlur={handleBlur}
            placeholder="usuario@ejemplo.com" autoComplete="email"
            icono={icono('correo')}
            error={!!fieldError('email')}
          />
          <ErrorCampo campo="email" />
        </div>

        <div className={campo}>
          <label className={etiquetaAuth}>Teléfono <Req /></label>
          <CampoAuth
            name="telefono" type="tel" value={form.telefono}
            onChange={handleChange} onBlur={handleBlur}
            placeholder="320-123-4567" autoComplete="tel"
            icono={icono('telefono')}
            error={!!fieldError('telefono')}
          />
          <ErrorCampo campo="telefono" />
        </div>

        <Seccion>Seguridad</Seccion>
        <div className={dosColumnas}>
          <div className={campo}>
            <label className={etiquetaAuth}>Contraseña <Req /></label>
            <CampoAuth
              name="password" type={showPass ? 'text' : 'password'} value={form.password}
              onChange={handleChange} onBlur={handleBlur}
              placeholder="Mín. 8 caracteres" autoComplete="new-password"
              icono={icono('candado')}
              derecha={<BotonOjo visible={showPass} onClick={() => setShowPass(p => !p)} />}
              error={!!fieldError('password')}
            />
            <ErrorCampo campo="password" />
            {form.password && (
              <div className="mt-2 flex items-center gap-2.5">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full transition-all" style={{ width: `${strengthPct}%`, background: STRENGTH_COLOR[strength] }} />
                </div>
                <span className="text-[11px] font-semibold" style={{ color: STRENGTH_COLOR[strength] }}>{STRENGTH_LABEL[strength]}</span>
              </div>
            )}
          </div>

          <div className={campo}>
            <label className={etiquetaAuth}>Confirmar contraseña <Req /></label>
            <CampoAuth
              name="confirmPassword" type={showConfirm ? 'text' : 'password'} value={form.confirmPassword}
              onChange={handleChange} onBlur={handleBlur}
              placeholder="Repetir contraseña" autoComplete="new-password"
              icono={icono('candado')}
              derecha={<BotonOjo visible={showConfirm} onClick={() => setShowConfirm(p => !p)} />}
              error={!!fieldError('confirmPassword')}
            />
            <ErrorCampo campo="confirmPassword" />
            {form.confirmPassword && form.confirmPassword === form.password && (
              <span className="mt-1.5 block text-xs font-semibold text-green-400">✓ Las contraseñas coinciden</span>
            )}
          </div>
        </div>

        {/* Casillas legales: la casilla mide 18 px para que se pueda tocar con el dedo */}
        <div className="mb-2 mt-1 flex flex-col gap-3">
          {[
            { key: 'aceptaTerminos', texto: <>Acepto los <a className={enlaceAuth} href="https://brayan-alejandro1705.github.io/zippy/terminos.html" target="_blank" rel="noopener noreferrer">Términos y Condiciones Generales</a> de ZIPPYgo SAS.</> },
            isVendedor && { key: 'aceptaComercios', texto: <>Acepto las <a className={enlaceAuth} href="https://brayan-alejandro1705.github.io/zippy/comercios-aliados.html" target="_blank" rel="noopener noreferrer">Condiciones para Comercios Aliados</a>.</> },
            { key: 'aceptaPrivacidad', texto: <>Autorizo el tratamiento de mis datos personales conforme a la <a className={enlaceAuth} href="https://brayan-alejandro1705.github.io/zippy/privacidad.html" target="_blank" rel="noopener noreferrer">Política de Privacidad</a>.</> },
          ].filter(Boolean).map(({ key, texto }) => (
            <label key={key} className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-white/55">
              <input
                type="checkbox"
                className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-zippy"
                checked={form[key]}
                onChange={e => { setForm(prev => ({ ...prev, [key]: e.target.checked })); setError(''); }}
              />
              <span>{texto}</span>
            </label>
          ))}
        </div>

        <button type="submit" className={cx(botonAuth, 'mt-4')} disabled={loading}>
          {loading
            ? <ZLoader size="sm" inverted />
            : `Crear cuenta como ${ROLES.find(r => r.value === form.tipo_usuario)?.label} →`}
        </button>

        <p className="m-0 mt-5 text-center text-[13px] text-white/35">
          ¿Ya tienes cuenta? <Link to={`/login${search}`} className={enlaceAuth}>Inicia sesión</Link>
        </p>
      </form>
    </PantallaAuth>
  );
};

export default RegisterPage;