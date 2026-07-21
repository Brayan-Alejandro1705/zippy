import React, { useState, useEffect } from 'react';
import VendorLayout from '../../components/VendorLayout';
import { useToast } from '../../context/ToastContext';
import { useTheme } from '../../context/ThemeContext';
import { negociosService, usuariosService, authService } from '../../config/api';
import '../../styles/VendorConfig.css';
import Icon from '../../components/Icons';
import { useNavigate } from 'react-router-dom';

const TABS = [
  { id: 'tienda',         icon: 'vendedores',     label: 'Mi Tienda'      },
  { id: 'cuenta',         icon: 'perfil',         label: 'Cuenta'         },
  { id: 'notificaciones', icon: 'notificaciones', label: 'Notificaciones' },
  { id: 'apariencia',     icon: 'apariencia',     label: 'Apariencia'     },
];

// ── Field helper ──────────────────────────────────────────────────────────────
const Field = ({ label, children }) => (
  <div className="vc-field">
    <label>{label}</label>
    {children}
  </div>
);

// ── CardBlock ─────────────────────────────────────────────────────────────────
const CardBlock = ({ icon, iconBg, title, desc, children, footer }) => (
  <div className="vc-card">
    <div className="vc-card-header">
      <div className="vc-card-header-icon" style={{ background: iconBg }}>
        {icon}
      </div>
      <div className="vc-card-header-text">
        <p className="vc-card-title">{title}</p>
        {desc && <p className="vc-card-desc">{desc}</p>}
      </div>
    </div>
    {children}
    {footer && <div className="vc-card-footer">{footer}</div>}
  </div>
);

// ── Tienda ────────────────────────────────────────────────────────────────────
const SeccionTienda = () => {
  const { addToast } = useToast();
  const [negocioId, setNegocioId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: '', categoria: 'General', descripcion: '', direccion: '',
    telefono: '', whatsapp: '', horaApertura: '', horaCierre: '', ciudad: 'Garzón',
  });

  useEffect(() => {
    let activo = true;
    negociosService.miNegocio()
      .then(({ data }) => {
        if (!activo) return;
        setNegocioId(data.id);
        setForm({
          nombre:       data.nombre_negocio || '',
          categoria:    data.categoria || 'General',
          descripcion:  data.descripcion || '',
          direccion:    data.direccion || '',
          telefono:     data.telefono || '',
          whatsapp:     data.whatsapp || '',
          horaApertura: data.hora_apertura || '',
          horaCierre:   data.hora_cierre || '',
          ciudad:       data.ciudad || 'Garzón',
        });
      })
      .catch(() => addToast('No se pudo cargar la información de tu tienda', 'error'))
      .finally(() => activo && setLoading(false));
    return () => { activo = false; };
  }, [addToast]);

  const set = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!negocioId) return;
    setSaving(true);
    try {
      await negociosService.actualizar(negocioId, {
        nombre_negocio: form.nombre,
        categoria:      form.categoria,
        descripcion:    form.descripcion,
        direccion:      form.direccion,
        telefono:       form.telefono,
        whatsapp:       form.whatsapp,
        hora_apertura:  form.horaApertura,
        hora_cierre:    form.horaCierre,
        ciudad:         form.ciudad,
      });
      addToast('Información de la tienda actualizada ✓', 'success');
    } catch (err) {
      addToast(err.response?.data?.detail || 'No se pudo guardar la información', 'error');
    } finally {
      setSaving(false);
    }
  };

  const initials = (form.nombre || 'T').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  if (loading) {
    return <div className="vc-sections"><p>Cargando información de tu tienda...</p></div>;
  }

  return (
    <form className="vc-sections" onSubmit={handleSave}>

      {/* Hero de tienda */}
      <div className="vc-store-hero">
        <div className="vc-store-banner" />
        <div className="vc-store-avatar-wrap">
          <div className="vc-store-avatar">{initials}</div>
        </div>
        <div className="vc-store-hero-info">
          <h2 className="vc-store-name">{form.nombre}</h2>
          <span className="vc-store-cat-badge">{form.categoria}</span>
          <p className="vc-store-city"><Icon name="ubicacion" size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />{form.ciudad}</p>
        </div>
      </div>

      {/* Datos generales */}
      <div className="vc-card">
        <div className="vc-card-header">
          <div className="vc-card-header-icon" style={{ background: 'linear-gradient(135deg,#fff3e6,#fde8cc)' }}><Icon name="vendedores" size={20} /></div>
          <div className="vc-card-header-text">
            <p className="vc-card-title">Datos del negocio</p>
            <p className="vc-card-desc">Información visible para tus clientes</p>
          </div>
        </div>

        <Field label="Nombre del negocio">
          <div className="vc-input-wrap">
            <span className="vc-input-icon"><Icon name="vendedores" size={17} /></span>
            <input name="nombre" value={form.nombre} onChange={set} placeholder="Nombre de tu tienda" />
          </div>
        </Field>

        <div className="vc-field-row">
          <Field label="Categoría">
            <select name="categoria" value={form.categoria} onChange={set}>
              {['Restaurante','Comida rápida','Panadería','Cafetería','Frutas y verduras',
                'Supermercado','Droguería','Ropa','Electrónica','Mascotas',
                'Transporte','Aseo y limpieza','Belleza','Plomería y electricidad',
                'Reparaciones','Tutorías y clases','General'].map(c =>
                <option key={c}>{c}</option>
              )}
            </select>
          </Field>
          <Field label="Ciudad">
            <div className="vc-input-wrap">
              <span className="vc-input-icon"><Icon name="ubicacion" size={17} /></span>
              <select name="ciudad" value={form.ciudad} onChange={set} style={{ paddingLeft: 36 }}>
                {['Garzón','Neiva','Pitalito','La Plata','Campoalegre'].map(c =>
                  <option key={c}>{c}</option>
                )}
              </select>
            </div>
          </Field>
        </div>

        <Field label="Descripción">
          <textarea name="descripcion" rows={3} value={form.descripcion} onChange={set}
            placeholder="Cuéntales a tus clientes qué ofreces..." />
        </Field>

        <div className="vc-card-footer">
          <button type="submit" className="vc-btn-save" disabled={saving}>
            {saving ? '⏳ Guardando...' : '✓ Guardar'}
          </button>
        </div>
      </div>

      {/* Contacto y ubicación */}
      <div className="vc-card">
        <div className="vc-card-header">
          <div className="vc-card-header-icon" style={{ background: 'linear-gradient(135deg,#e0f2fe,#bae6fd)' }}><Icon name="telefono" size={20} /></div>
          <div className="vc-card-header-text">
            <p className="vc-card-title">Contacto y ubicación</p>
            <p className="vc-card-desc">Cómo encontrarte</p>
          </div>
        </div>

        <div className="vc-field-row">
          <Field label="Teléfono">
            <div className="vc-input-wrap">
              <span className="vc-input-icon"><Icon name="telefono" size={17} /></span>
              <input name="telefono" value={form.telefono} onChange={set} placeholder="310-000-0000" />
            </div>
          </Field>
          <Field label="WhatsApp">
            <div className="vc-input-wrap">
              <span className="vc-input-icon"><Icon name="whatsapp" size={17} /></span>
              <input name="whatsapp" value={form.whatsapp} onChange={set} placeholder="310-000-0000" />
            </div>
          </Field>
        </div>

        <Field label="Dirección">
          <div className="vc-input-wrap">
            <span className="vc-input-icon"><Icon name="ubicacion" size={17} /></span>
            <input name="direccion" value={form.direccion} onChange={set} placeholder="Dirección completa" />
          </div>
        </Field>

        <div className="vc-field-row">
          <Field label="Hora de apertura">
            <div className="vc-input-wrap">
              <span className="vc-input-icon"><Icon name="reloj" size={17} /></span>
              <input name="horaApertura" value={form.horaApertura} onChange={set} placeholder="Ej: 8:00 AM" />
            </div>
          </Field>
          <Field label="Hora de cierre">
            <div className="vc-input-wrap">
              <span className="vc-input-icon"><Icon name="reloj" size={17} /></span>
              <input name="horaCierre" value={form.horaCierre} onChange={set} placeholder="Ej: 6:00 PM" />
            </div>
          </Field>
        </div>

        <div className="vc-card-footer">
          <button type="submit" className="vc-btn-save" disabled={saving}>
            {saving ? '⏳ Guardando...' : '✓ Guardar'}
          </button>
        </div>
      </div>

    </form>
  );
};

// ── Cuenta ────────────────────────────────────────────────────────────────────
const SeccionCuenta = () => {
  const navigate = useNavigate();

  const cerrarSesion = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('usuario');
    navigate('/login');
  };

  const { addToast } = useToast();
  const usuarioGuardado = JSON.parse(localStorage.getItem('usuario') || '{}');
  const [form, setForm] = useState({
    nombre:          usuarioGuardado.nombre || '',
    email:           usuarioGuardado.email  || '',
    passwordActual:  '',
    passwordNueva:   '',
    passwordConfirm: '',
  });
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    let activo = true;
    authService.me()
      .then(({ data }) => {
        if (!activo) return;
        setForm(p => ({ ...p, nombre: data.nombre || '', email: data.email || '' }));
        localStorage.setItem('usuario', JSON.stringify({ ...usuarioGuardado, ...data }));
      })
      .catch(() => {});
    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSavePerfil = async (e) => {
    e.preventDefault();
    setSavingPerfil(true);
    try {
      const { data } = await usuariosService.actualizarPerfil({ nombre: form.nombre, email: form.email });
      localStorage.setItem('usuario', JSON.stringify({ ...usuarioGuardado, nombre: data.nombre, email: data.email }));
      addToast('Perfil actualizado correctamente', 'success');
    } catch (err) {
      addToast(err.response?.data?.detail || 'No se pudo actualizar el perfil', 'error');
    } finally {
      setSavingPerfil(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (form.passwordNueva !== form.passwordConfirm) { addToast('Las contraseñas no coinciden', 'error'); return; }
    if (form.passwordNueva.length < 8)               { addToast('Mínimo 8 caracteres', 'warning'); return; }
    setSavingPassword(true);
    try {
      await usuariosService.cambiarPassword(form.passwordActual, form.passwordNueva);
      setForm(p => ({ ...p, passwordActual: '', passwordNueva: '', passwordConfirm: '' }));
      addToast('Contraseña actualizada correctamente', 'success');
    } catch (err) {
      addToast(err.response?.data?.detail || 'No se pudo cambiar la contraseña', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="vc-sections">
      <form onSubmit={handleSavePerfil}>
        <CardBlock
          icon={<Icon name="perfil" size={20} />} iconBg="linear-gradient(135deg,#e0f2fe,#bae6fd)"
          title="Información personal"
          desc="Tu nombre y correo electrónico"
          footer={
            <button type="submit" className="vc-btn-save" disabled={savingPerfil}>
              {savingPerfil ? 'Guardando...' : 'Guardar perfil'}
            </button>
          }
        >
          <div className="vc-avatar-row">
            <div className="vc-avatar">{(form.nombre || 'V').charAt(0).toUpperCase()}</div>
            <div>
              <p className="vc-avatar-name">{form.nombre || 'Vendedor'}</p>
              <p className="vc-avatar-role">Vendedor</p>
            </div>
          </div>
          <div className="vc-field-row">
            <Field label="Nombre completo">
              <input name="nombre" value={form.nombre} onChange={set} placeholder="Tu nombre" />
            </Field>
            <Field label="Correo electrónico">
              <input name="email" type="email" value={form.email} onChange={set} placeholder="correo@ejemplo.com" />
            </Field>
          </div>
        </CardBlock>
      </form>

      <form onSubmit={handleChangePassword}>
        <CardBlock
          icon={<Icon name="candado" size={20} />} iconBg="linear-gradient(135deg,#f0fdf4,#bbf7d0)"
          title="Cambiar contraseña"
          desc="Actualiza tu clave de acceso"
          footer={
            <button type="submit" className="vc-btn-save" disabled={savingPassword}>
              {savingPassword ? 'Actualizando...' : 'Cambiar contraseña'}
            </button>
          }
        >
          <Field label="Contraseña actual">
            <input name="passwordActual" type="password" value={form.passwordActual} onChange={set} placeholder="••••••••" />
          </Field>
          <div className="vc-field-row" style={{ marginTop: 4 }}>
            <Field label="Nueva contraseña">
              <input name="passwordNueva" type="password" value={form.passwordNueva} onChange={set} placeholder="Mín. 8 caracteres" />
            </Field>
            <Field label="Confirmar contraseña">
              <input name="passwordConfirm" type="password" value={form.passwordConfirm} onChange={set} placeholder="Repetir" />
            </Field>
          </div>
        </CardBlock>
      </form>

      <CardBlock
        icon={<Icon name="salir" size={20} />} iconBg="linear-gradient(135deg,#fee2e2,#fecaca)"
        title="Cerrar sesión"
        desc="Saldrás de tu cuenta en este dispositivo"
      >
        <button type="button" className="vc-btn-logout" onClick={cerrarSesion}>
          <Icon name="salir" size={18} style={{ verticalAlign: '-4px', marginRight: 8 }} />
          Cerrar sesión
        </button>
      </CardBlock>
    </div>
  );
};

// ── Notificaciones ────────────────────────────────────────────────────────────
const NOTIF_ITEMS = [
  { id: 'nueva_orden',     icon: 'paquete',   label: 'Nueva orden recibida',  desc: 'Notificación cuando recibes un pedido nuevo' },
  { id: 'orden_entregada', icon: 'check',     label: 'Orden entregada',       desc: 'Cuando el domiciliario confirma la entrega'  },
  { id: 'stock_bajo',      icon: 'alerta',    label: 'Stock bajo',            desc: 'Cuando un producto tiene menos de 10 unidades' },
  { id: 'resumen_diario',  icon: 'dashboard', label: 'Resumen diario',        desc: 'Reporte de ventas al final de cada día'       },
];

const SeccionNotificaciones = () => {
  const { addToast } = useToast();
  const [prefs, setPrefs] = useState({
    nueva_orden: true, orden_entregada: true, stock_bajo: true, resumen_diario: false,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 500));
    addToast('Preferencias de notificación guardadas', 'success');
    setSaving(false);
  };

  return (
    <div className="vc-sections">
      <CardBlock
        icon={<Icon name="notificaciones" size={20} />} iconBg="linear-gradient(135deg,#fef9c3,#fde68a)"
        title="Notificaciones"
        desc="Elige qué eventos te generan alertas"
        footer={
          <button className="vc-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? '⏳ Guardando...' : '✓ Guardar preferencias'}
          </button>
        }
      >
        <div className="vc-notif-list">
          {NOTIF_ITEMS.map(({ id, icon, label, desc }) => (
            <div key={id} className="vc-notif-row">
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                <div>
                  <p className="vc-notif-label">{label}</p>
                  <p className="vc-notif-desc">{desc}</p>
                </div>
              </div>
              <button
                type="button"
                className={`vc-toggle ${prefs[id] ? 'vc-toggle--on' : ''}`}
                onClick={() => setPrefs(p => ({ ...p, [id]: !p[id] }))}
              >
                <span className="vc-toggle-thumb" />
              </button>
            </div>
          ))}
        </div>
      </CardBlock>
    </div>
  );
};

// ── Apariencia ────────────────────────────────────────────────────────────────
const SeccionApariencia = () => {
  const { isDark, toggle } = useTheme();
  const { addToast } = useToast();

  return (
    <div className="vc-sections">
      <CardBlock
        icon={<Icon name="apariencia" size={20} />} iconBg="linear-gradient(135deg,#f3e8ff,#e9d5ff)"
        title="Apariencia"
        desc="Personaliza el tema de la plataforma"
      >
        <div className="vc-theme-cards">
          <div
            className={`vc-theme-card ${!isDark ? 'vc-theme-card--active' : ''}`}
            onClick={() => { if (isDark) { toggle(); addToast('Modo claro activado', 'info'); } }}
          >
            <div className="vc-theme-preview vc-theme-preview--light"><Icon name="sol" size={20} /></div>
            <p className="vc-theme-name">Modo claro</p>
            {!isDark && <p className="vc-theme-check">✓ Activo</p>}
          </div>
          <div
            className={`vc-theme-card ${isDark ? 'vc-theme-card--active' : ''}`}
            onClick={() => { if (!isDark) { toggle(); addToast('Modo oscuro activado', 'info'); } }}
          >
            <div className="vc-theme-preview vc-theme-preview--dark"><Icon name="luna" size={20} /></div>
            <p className="vc-theme-name">Modo oscuro</p>
            {isDark && <p className="vc-theme-check">✓ Activo</p>}
          </div>
        </div>

        <div className="vc-notif-row" style={{ paddingTop: 0, borderBottom: 'none', paddingBottom: 0 }}>
          <div>
            <p className="vc-notif-label">Cambiar tema rápidamente</p>
            <p className="vc-notif-desc">Activa o desactiva el modo oscuro con este interruptor</p>
          </div>
          <button
            type="button"
            className={`vc-toggle ${isDark ? 'vc-toggle--on' : ''}`}
            onClick={() => { toggle(); addToast(isDark ? 'Modo claro activado' : 'Modo oscuro activado', 'info'); }}
          >
            <span className="vc-toggle-thumb" />
          </button>
        </div>
      </CardBlock>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const SECTION_MAP = {
  tienda:         <SeccionTienda />,
  cuenta:         <SeccionCuenta />,
  notificaciones: <SeccionNotificaciones />,
  apariencia:     <SeccionApariencia />,
};

const VendorConfigPage = () => {
  const [activeTab, setActiveTab] = useState('tienda');

  return (
    <VendorLayout searchPlaceholder="Buscar...">
      <div className="vc-page-header">
        <div className="vc-page-icon"><Icon name="config" size={24} /></div>
        <div>
          <h1 className="vc-title">Configuración</h1>
          <p className="vc-subtitle">Gestiona tu tienda y cuenta</p>
        </div>
      </div>

      <div className="vc-layout">
        <nav className="vc-nav">
          {TABS.map(({ id, icon, label }) => (
            <button
              key={id}
              className={`vc-nav-item ${activeTab === id ? 'vc-nav-item--active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <span className="vc-nav-icon"><Icon name={icon} size={19} /></span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="vc-content">
          {SECTION_MAP[activeTab]}
        </div>
      </div>
    </VendorLayout>
  );
};

export default VendorConfigPage;