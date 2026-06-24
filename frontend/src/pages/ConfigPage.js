import React, { useState } from 'react';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { authService } from '../config/api';
import Layout from '../components/Layout';
import '../styles/Config.css';

const TABS = [
  { id: 'perfil',          icon: '👤', label: 'Perfil' },
  { id: 'plataforma',      icon: '🏪', label: 'Plataforma' },
  { id: 'notificaciones',  icon: '🔔', label: 'Notificaciones' },
  { id: 'apariencia',      icon: '🎨', label: 'Apariencia' },
];

const CIUDADES_DISPONIBLES = ['Garzón', 'Neiva', 'Pitalito', 'La Plata', 'Campoalegre', 'Algeciras'];

// ── Perfil ────────────────────────────────────────────────────────────────────
const SeccionPerfil = () => {
  const { addToast } = useToast();
  const stored = JSON.parse(localStorage.getItem('usuario') || '{}');
  const [form, setForm] = useState({
    nombre:          stored.nombre  || '',
    email:           stored.email   || '',
    passwordActual:  '',
    passwordNueva:   '',
    passwordConfirm: '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSavePerfil = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // PATCH /auth/me with name/email
      await authService.me(); // placeholder — replace with PATCH when endpoint exists
      localStorage.setItem('usuario', JSON.stringify({ ...stored, nombre: form.nombre, email: form.email }));
      addToast('Perfil actualizado correctamente', 'success');
    } catch {
      addToast('Error al guardar el perfil', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (form.passwordNueva !== form.passwordConfirm) {
      addToast('Las contraseñas nuevas no coinciden', 'error');
      return;
    }
    if (form.passwordNueva.length < 8) {
      addToast('La contraseña debe tener al menos 8 caracteres', 'warning');
      return;
    }
    setSaving(true);
    try {
      await authService.me(); // placeholder
      setForm(prev => ({ ...prev, passwordActual: '', passwordNueva: '', passwordConfirm: '' }));
      addToast('Contraseña actualizada correctamente', 'success');
    } catch {
      addToast('Contraseña actual incorrecta', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cfg-sections">
      <form className="cfg-card" onSubmit={handleSavePerfil}>
        <div className="cfg-card-title">Información del administrador</div>
        <div className="cfg-avatar-row">
          <div className="cfg-avatar">
            {(form.nombre || 'A').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="cfg-avatar-name">{form.nombre || 'Administrador'}</p>
            <p className="cfg-avatar-role">Super Admin</p>
          </div>
        </div>
        <div className="cfg-field-row">
          <div className="cfg-field">
            <label>Nombre completo</label>
            <input name="nombre" value={form.nombre} onChange={handleChange} placeholder="Tu nombre" />
          </div>
          <div className="cfg-field">
            <label>Email</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="admin@ejemplo.com" />
          </div>
        </div>
        <div className="cfg-card-footer">
          <button type="submit" className="btn-create" disabled={saving}>
            {saving ? 'Guardando...' : '✓ Guardar perfil'}
          </button>
        </div>
      </form>

      <form className="cfg-card" onSubmit={handleChangePassword}>
        <div className="cfg-card-title">Cambiar contraseña</div>
        <div className="cfg-field-col">
          <div className="cfg-field">
            <label>Contraseña actual</label>
            <input name="passwordActual" type="password" value={form.passwordActual} onChange={handleChange} placeholder="••••••••" />
          </div>
          <div className="cfg-field-row">
            <div className="cfg-field">
              <label>Nueva contraseña</label>
              <input name="passwordNueva" type="password" value={form.passwordNueva} onChange={handleChange} placeholder="Mín. 8 caracteres" />
            </div>
            <div className="cfg-field">
              <label>Confirmar contraseña</label>
              <input name="passwordConfirm" type="password" value={form.passwordConfirm} onChange={handleChange} placeholder="Repetir nueva contraseña" />
            </div>
          </div>
        </div>
        <div className="cfg-card-footer">
          <button type="submit" className="btn-create" disabled={saving}>
            {saving ? 'Actualizando...' : '🔒 Cambiar contraseña'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ── Plataforma ────────────────────────────────────────────────────────────────
const SeccionPlataforma = () => {
  const { addToast } = useToast();
  const [form, setForm] = useState({
    nombrePlataforma: 'Zippy Admin',
    moneda:           'COP',
    comision:         '5',
    ciudadBase:       'Garzón',
  });
  const [ciudades, setCiudades] = useState(['Garzón', 'Neiva', 'Pitalito']);
  const [saving, setSaving] = useState(false);

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const toggleCiudad = (ciudad) => {
    setCiudades(prev =>
      prev.includes(ciudad) ? prev.filter(c => c !== ciudad) : [...prev, ciudad]
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    await new Promise(r => setTimeout(r, 600)); // simulate API
    addToast('Configuración de plataforma guardada', 'success');
    setSaving(false);
  };

  return (
    <form className="cfg-sections" onSubmit={handleSave}>
      <div className="cfg-card">
        <div className="cfg-card-title">Información general</div>
        <div className="cfg-field-row">
          <div className="cfg-field">
            <label>Nombre de la plataforma</label>
            <input name="nombrePlataforma" value={form.nombrePlataforma} onChange={handleChange} />
          </div>
          <div className="cfg-field">
            <label>Ciudad base</label>
            <select name="ciudadBase" value={form.ciudadBase} onChange={handleChange}>
              {CIUDADES_DISPONIBLES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="cfg-field-row">
          <div className="cfg-field">
            <label>Moneda</label>
            <select name="moneda" value={form.moneda} onChange={handleChange}>
              <option value="COP">COP — Peso colombiano</option>
              <option value="USD">USD — Dólar americano</option>
            </select>
          </div>
          <div className="cfg-field">
            <label>Comisión por venta (%)</label>
            <input name="comision" type="number" min="0" max="50" step="0.5" value={form.comision} onChange={handleChange} />
            <span className="cfg-hint">Porcentaje que retiene la plataforma</span>
          </div>
        </div>
      </div>

      <div className="cfg-card">
        <div className="cfg-card-title">Ciudades habilitadas</div>
        <p className="cfg-desc">Solo los vendedores de estas ciudades podrán registrarse.</p>
        <div className="cfg-cities-grid">
          {CIUDADES_DISPONIBLES.map(ciudad => (
            <label key={ciudad} className={`cfg-city-chip ${ciudades.includes(ciudad) ? 'cfg-city-chip--active' : ''}`}>
              <input type="checkbox" checked={ciudades.includes(ciudad)} onChange={() => toggleCiudad(ciudad)} />
              <span>{ciudad}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="cfg-card-footer cfg-card-footer--standalone">
        <button type="submit" className="btn-create" disabled={saving}>
          {saving ? 'Guardando...' : '✓ Guardar configuración'}
        </button>
      </div>
    </form>
  );
};

// ── Notificaciones ────────────────────────────────────────────────────────────
const NOTIF_ITEMS = [
  { id: 'nuevo_vendedor',  label: 'Nuevo vendedor registrado',      desc: 'Cuando un vendedor crea su cuenta en la plataforma' },
  { id: 'prod_pendiente',  label: 'Productos pendientes de revisión', desc: 'Productos que esperan aprobación para publicarse' },
  { id: 'orden_nueva',     label: 'Nueva orden recibida',            desc: 'Cada vez que se genera una orden en la plataforma' },
  { id: 'vendedor_suspend',label: 'Vendedor suspendido',             desc: 'Cuando un vendedor es suspendido por el sistema' },
  { id: 'reporte_semanal', label: 'Reporte semanal',                 desc: 'Resumen de actividad cada lunes a las 8:00 AM' },
];

const SeccionNotificaciones = () => {
  const { addToast } = useToast();
  const [prefs, setPrefs] = useState({ nuevo_vendedor: true, prod_pendiente: true, orden_nueva: false, vendedor_suspend: true, reporte_semanal: true });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 500));
    addToast('Preferencias de notificaciones guardadas', 'success');
    setSaving(false);
  };

  return (
    <div className="cfg-sections">
      <div className="cfg-card">
        <div className="cfg-card-title">Notificaciones por email</div>
        <p className="cfg-desc">Elige qué eventos generan un email al administrador.</p>
        <div className="cfg-notif-list">
          {NOTIF_ITEMS.map(({ id, label, desc }) => (
            <div key={id} className="cfg-notif-row">
              <div className="cfg-notif-info">
                <span className="cfg-notif-label">{label}</span>
                <span className="cfg-notif-desc">{desc}</span>
              </div>
              <button
                type="button"
                className={`cfg-toggle ${prefs[id] ? 'cfg-toggle--on' : ''}`}
                onClick={() => setPrefs(prev => ({ ...prev, [id]: !prev[id] }))}
                aria-label={prefs[id] ? 'Desactivar' : 'Activar'}
              >
                <span className="cfg-toggle-thumb" />
              </button>
            </div>
          ))}
        </div>
        <div className="cfg-card-footer">
          <button className="btn-create" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : '✓ Guardar preferencias'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Apariencia ────────────────────────────────────────────────────────────────
const SeccionApariencia = () => {
  const { isDark, toggle } = useTheme();
  const { addToast } = useToast();
  const [idioma, setIdioma] = useState('es');

  return (
    <div className="cfg-sections">
      <div className="cfg-card">
        <div className="cfg-card-title">Tema</div>
        <div className="cfg-appearance-row">
          <div className="cfg-appearance-info">
            <span className="cfg-notif-label">Modo oscuro</span>
            <span className="cfg-notif-desc">Cambia la apariencia de toda la plataforma admin</span>
          </div>
          <button
            type="button"
            className={`cfg-toggle ${isDark ? 'cfg-toggle--on' : ''}`}
            onClick={() => { toggle(); addToast(isDark ? 'Modo claro activado' : 'Modo oscuro activado', 'info'); }}
          >
            <span className="cfg-toggle-thumb" />
          </button>
        </div>

        <div className="cfg-theme-preview">
          <div className={`cfg-preview-card ${isDark ? 'cfg-preview-card--dark' : ''}`}>
            <div className="cfg-preview-bar" />
            <div className="cfg-preview-line" />
            <div className="cfg-preview-line cfg-preview-line--short" />
          </div>
          <p className="cfg-preview-label">{isDark ? '🌙 Modo oscuro activo' : '☀️ Modo claro activo'}</p>
        </div>
      </div>

      <div className="cfg-card">
        <div className="cfg-card-title">Idioma</div>
        <div className="cfg-field" style={{ maxWidth: 280 }}>
          <label>Idioma de la interfaz</label>
          <select value={idioma} onChange={e => { setIdioma(e.target.value); addToast('Idioma actualizado', 'success'); }}>
            <option value="es">🇨🇴 Español</option>
            <option value="en">🇺🇸 English</option>
          </select>
        </div>
      </div>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const SECTION_MAP = {
  perfil:         <SeccionPerfil />,
  plataforma:     <SeccionPlataforma />,
  notificaciones: <SeccionNotificaciones />,
  apariencia:     <SeccionApariencia />,
};

const ConfigPage = () => {
  const [activeTab, setActiveTab] = useState('perfil');

  return (
    <Layout>
      <div className="cfg-page-header">
        <h1 className="cfg-title">⚙️ Configuración</h1>
        <p className="cfg-subtitle">Administra la plataforma y tu cuenta</p>
      </div>

      <div className="cfg-layout">
        <nav className="cfg-nav">
          {TABS.map(({ id, icon, label }) => (
            <button
              key={id}
              className={`cfg-nav-item ${activeTab === id ? 'cfg-nav-item--active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <span className="cfg-nav-icon">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="cfg-content">
          {SECTION_MAP[activeTab]}
        </div>
      </div>
    </Layout>
  );
};

export default ConfigPage;
