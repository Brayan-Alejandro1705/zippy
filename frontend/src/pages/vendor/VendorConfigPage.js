import React, { useState } from 'react';
import VendorLayout from '../../components/VendorLayout';
import { useToast } from '../../context/ToastContext';
import { useTheme } from '../../context/ThemeContext';
import '../../styles/VendorConfig.css';

const TABS = [
  { id: 'tienda',         icon: '🏪', label: 'Mi Tienda'      },
  { id: 'cuenta',         icon: '👤', label: 'Cuenta'         },
  { id: 'notificaciones', icon: '🔔', label: 'Notificaciones' },
  { id: 'apariencia',     icon: '🎨', label: 'Apariencia'     },
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
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const [form, setForm] = useState({
    nombre:      usuario.negocio || 'Tienda Demo',
    categoria:   'Restaurante',
    descripcion: 'Productos frescos y artesanales elaborados con ingredientes locales.',
    direccion:   'Cra 5 #12-45, Garzón, Huila',
    telefono:    '310-555-0123',
    whatsapp:    '',
    horario:     '7:00 AM - 8:00 PM',
    ciudad:      'Garzón',
  });
  const [saving, setSaving] = useState(false);
  const set = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    addToast('Información de la tienda actualizada ✓', 'success');
    setSaving(false);
  };

  const initials = (form.nombre || 'T').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

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
          <p className="vc-store-city">📍 {form.ciudad}</p>
        </div>
      </div>

      {/* Datos generales */}
      <div className="vc-card">
        <div className="vc-card-header">
          <div className="vc-card-header-icon" style={{ background: 'linear-gradient(135deg,#fff3e6,#fde8cc)' }}>🏪</div>
          <div className="vc-card-header-text">
            <p className="vc-card-title">Datos del negocio</p>
            <p className="vc-card-desc">Información visible para tus clientes</p>
          </div>
        </div>

        <Field label="Nombre del negocio">
          <div className="vc-input-wrap">
            <span className="vc-input-icon">🏪</span>
            <input name="nombre" value={form.nombre} onChange={set} placeholder="Nombre de tu tienda" />
          </div>
        </Field>

        <div className="vc-field-row">
          <Field label="Categoría">
            <select name="categoria" value={form.categoria} onChange={set}>
              {['Restaurante','Comida rápida','Panadería','Cafetería','Frutas y verduras',
                'Supermercado','Droguería','Ropa','Electrónica','General'].map(c =>
                <option key={c}>{c}</option>
              )}
            </select>
          </Field>
          <Field label="Ciudad">
            <div className="vc-input-wrap">
              <span className="vc-input-icon">📍</span>
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
          <div className="vc-card-header-icon" style={{ background: 'linear-gradient(135deg,#e0f2fe,#bae6fd)' }}>📞</div>
          <div className="vc-card-header-text">
            <p className="vc-card-title">Contacto y ubicación</p>
            <p className="vc-card-desc">Cómo encontrarte</p>
          </div>
        </div>

        <div className="vc-field-row">
          <Field label="Teléfono">
            <div className="vc-input-wrap">
              <span className="vc-input-icon">📱</span>
              <input name="telefono" value={form.telefono} onChange={set} placeholder="310-000-0000" />
            </div>
          </Field>
          <Field label="WhatsApp">
            <div className="vc-input-wrap">
              <span className="vc-input-icon">💬</span>
              <input name="whatsapp" value={form.whatsapp} onChange={set} placeholder="310-000-0000" />
            </div>
          </Field>
        </div>

        <Field label="Dirección">
          <div className="vc-input-wrap">
            <span className="vc-input-icon">📍</span>
            <input name="direccion" value={form.direccion} onChange={set} placeholder="Dirección completa" />
          </div>
        </Field>

        <Field label="Horario de atención">
          <div className="vc-input-wrap">
            <span className="vc-input-icon">🕐</span>
            <input name="horario" value={form.horario} onChange={set} placeholder="Ej: 8:00 AM - 6:00 PM" />
          </div>
        </Field>

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
  const { addToast } = useToast();
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const [form, setForm] = useState({
    nombre:          usuario.nombre || 'Vendedor Demo',
    email:           usuario.email  || 'vendedor@demo.com',
    passwordActual:  '',
    passwordNueva:   '',
    passwordConfirm: '',
  });
  const [saving, setSaving] = useState(false);

  const set = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSavePerfil = async (e) => {
    e.preventDefault();
    setSaving(true);
    await new Promise(r => setTimeout(r, 500));
    localStorage.setItem('usuario', JSON.stringify({ ...usuario, nombre: form.nombre, email: form.email }));
    addToast('Perfil actualizado correctamente', 'success');
    setSaving(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (form.passwordNueva !== form.passwordConfirm) { addToast('Las contraseñas no coinciden', 'error'); return; }
    if (form.passwordNueva.length < 8)               { addToast('Mínimo 8 caracteres', 'warning'); return; }
    setSaving(true);
    await new Promise(r => setTimeout(r, 500));
    setForm(p => ({ ...p, passwordActual: '', passwordNueva: '', passwordConfirm: '' }));
    addToast('Contraseña actualizada correctamente', 'success');
    setSaving(false);
  };

  return (
    <div className="vc-sections">
      <form onSubmit={handleSavePerfil}>
        <CardBlock
          icon="👤" iconBg="linear-gradient(135deg,#e0f2fe,#bae6fd)"
          title="Información personal"
          desc="Tu nombre y correo electrónico"
          footer={
            <button type="submit" className="vc-btn-save" disabled={saving}>
              {saving ? '⏳ Guardando...' : '✓ Guardar perfil'}
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
          icon="🔒" iconBg="linear-gradient(135deg,#f0fdf4,#bbf7d0)"
          title="Cambiar contraseña"
          desc="Actualiza tu clave de acceso"
          footer={
            <button type="submit" className="vc-btn-save" disabled={saving}>
              {saving ? '⏳ Actualizando...' : '🔒 Cambiar contraseña'}
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
    </div>
  );
};

// ── Notificaciones ────────────────────────────────────────────────────────────
const NOTIF_ITEMS = [
  { id: 'nueva_orden',     icon: '📦', label: 'Nueva orden recibida',  desc: 'Notificación cuando recibes un pedido nuevo' },
  { id: 'orden_entregada', icon: '✅', label: 'Orden entregada',       desc: 'Cuando el domiciliario confirma la entrega'  },
  { id: 'stock_bajo',      icon: '⚠️', label: 'Stock bajo',            desc: 'Cuando un producto tiene menos de 10 unidades' },
  { id: 'resumen_diario',  icon: '📊', label: 'Resumen diario',        desc: 'Reporte de ventas al final de cada día'       },
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
        icon="🔔" iconBg="linear-gradient(135deg,#fef9c3,#fde68a)"
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
        icon="🎨" iconBg="linear-gradient(135deg,#f3e8ff,#e9d5ff)"
        title="Apariencia"
        desc="Personaliza el tema de la plataforma"
      >
        <div className="vc-theme-cards">
          <div
            className={`vc-theme-card ${!isDark ? 'vc-theme-card--active' : ''}`}
            onClick={() => { if (isDark) { toggle(); addToast('Modo claro activado', 'info'); } }}
          >
            <div className="vc-theme-preview vc-theme-preview--light">☀️</div>
            <p className="vc-theme-name">Modo claro</p>
            {!isDark && <p className="vc-theme-check">✓ Activo</p>}
          </div>
          <div
            className={`vc-theme-card ${isDark ? 'vc-theme-card--active' : ''}`}
            onClick={() => { if (!isDark) { toggle(); addToast('Modo oscuro activado', 'info'); } }}
          >
            <div className="vc-theme-preview vc-theme-preview--dark">🌙</div>
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
        <div className="vc-page-icon">⚙️</div>
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
              <span className="vc-nav-icon">{icon}</span>
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
