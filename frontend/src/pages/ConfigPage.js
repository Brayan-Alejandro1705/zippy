import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { authService, usuariosService, adminService } from '../config/api';
import Layout from '../components/Layout';
import Icon from '../components/Icons';
import { getPrefs, savePrefs, requestPermission, checkPermission, sendNotification, scheduleReporteSemanal } from '../utils/notifications';
import '../styles/Config.css';

const TABS = [
  { id: 'perfil',          icon: 'perfil',          label: 'Perfil' },
  { id: 'plataforma',      icon: 'vendedores',      label: 'Plataforma' },
  { id: 'notificaciones',  icon: 'notificaciones',  label: 'Notificaciones' },
  { id: 'apariencia',      icon: 'apariencia',      label: 'Apariencia' },
  { id: 'soporte',         icon: 'soporte',         label: 'Soporte', soloSuperAdmin: true },
];

// Solo los super admin pueden configurar el WhatsApp de soporte
const esSuperAdmin = () => {
  try {
    return JSON.parse(localStorage.getItem('usuario') || '{}').es_super_admin === true;
  } catch {
    return false;
  }
};

const CIUDADES_DISPONIBLES = ['Garzón', 'Neiva', 'Pitalito', 'La Plata', 'Campoalegre', 'Algeciras'];

// ── Perfil ────────────────────────────────────────────────────────────────────
const SeccionPerfil = () => {
  const { addToast } = useToast();
  const stored = JSON.parse(localStorage.getItem('usuario') || '{}');
  const [form, setForm] = useState({
    nombre:          stored.nombre  || '',
    email:           stored.email   || '',
    telefono:        stored.telefono || '',
    passwordActual:  '',
    passwordNueva:   '',
    passwordConfirm: '',
  });
  const [saving, setSaving]   = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSavePerfil = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await authService.me();
      localStorage.setItem('usuario', JSON.stringify({ ...stored, nombre: form.nombre, email: form.email, telefono: form.telefono }));
      addToast('Perfil actualizado correctamente', 'success');
    } catch {
      addToast('Error al guardar el perfil', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!form.passwordActual) { addToast('Ingresa tu contraseña actual', 'error'); return; }
    if (form.passwordNueva !== form.passwordConfirm) { addToast('Las contraseñas nuevas no coinciden', 'error'); return; }
    if (form.passwordNueva.length < 8) { addToast('Mínimo 8 caracteres', 'warning'); return; }
    setSavingPw(true);
    try {
      await usuariosService.cambiarPassword(form.passwordActual, form.passwordNueva);
      setForm(prev => ({ ...prev, passwordActual: '', passwordNueva: '', passwordConfirm: '' }));
      sessionStorage.setItem('pw_banner_dismissed', '1');
      addToast('Contraseña actualizada correctamente', 'success');
    } catch (err) {
      addToast(err.response?.data?.detail || 'No se pudo actualizar la contraseña', 'error');
    } finally {
      setSavingPw(false);
    }
  };

  const initials = (form.nombre || 'A').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="cfg-sections">

      {/* Hero card */}
      <div className="cfg-profile-hero">
        <div className="cfg-profile-banner" />
        <div className="cfg-profile-avatar-wrap">
          <div className="cfg-profile-avatar">{initials}</div>
        </div>
        <div className="cfg-profile-hero-info">
          <h2 className="cfg-profile-name">{form.nombre || 'Administrador'}</h2>
          <span className="cfg-profile-badge"><Icon name="rayo" size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />Super Admin</span>
          <p className="cfg-profile-email">{form.email}</p>
        </div>
      </div>

      {/* Datos */}
      <form className="cfg-card" onSubmit={handleSavePerfil}>
        <div className="cfg-card-title">Información personal</div>
        <div className="cfg-field-row">
          <div className="cfg-field">
            <label>Nombre completo</label>
            <div className="cfg-input-wrap">
              <span className="cfg-input-icon"><Icon name="perfil" size={18} /></span>
              <input name="nombre" value={form.nombre} onChange={handleChange} placeholder="Tu nombre completo" />
            </div>
          </div>
          <div className="cfg-field">
            <label>Correo electrónico</label>
            <div className="cfg-input-wrap">
              <span className="cfg-input-icon"><Icon name="correo" size={18} /></span>
              <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="admin@zippy.com" />
            </div>
          </div>
        </div>
        <div className="cfg-field" style={{ marginBottom: 0 }}>
          <label>Teléfono <span style={{ fontWeight: 400, color: '#aaa', fontSize: 12 }}>(opcional)</span></label>
          <div className="cfg-input-wrap">
            <span className="cfg-input-icon"><Icon name="telefono" size={18} /></span>
            <input name="telefono" type="tel" value={form.telefono} onChange={handleChange} placeholder="320-000-0000" />
          </div>
        </div>
        <div className="cfg-card-footer">
          <button type="submit" className="btn-create" disabled={saving}>
            {saving ? 'Guardando...' : '✓ Guardar cambios'}
          </button>
        </div>
      </form>

      {/* Contraseña */}
      <form className="cfg-card" onSubmit={handleChangePassword}>
        <div className="cfg-card-title"><Icon name="candado" size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} />Cambiar contraseña</div>
        <div className="cfg-field" style={{ marginBottom: 16 }}>
          <label>Contraseña actual</label>
          <div className="cfg-input-wrap">
            <span className="cfg-input-icon"><Icon name="llave" size={18} /></span>
            <input name="passwordActual" type="password" value={form.passwordActual} onChange={handleChange} placeholder="Tu contraseña actual" />
          </div>
        </div>
        <div className="cfg-field-row">
          <div className="cfg-field">
            <label>Nueva contraseña</label>
            <div className="cfg-input-wrap">
              <span className="cfg-input-icon"><Icon name="candado" size={18} /></span>
              <input name="passwordNueva" type="password" value={form.passwordNueva} onChange={handleChange} placeholder="Mín. 8 caracteres" />
            </div>
          </div>
          <div className="cfg-field">
            <label>Confirmar contraseña</label>
            <div className="cfg-input-wrap">
              <span className="cfg-input-icon"><Icon name="candado" size={18} /></span>
              <input name="passwordConfirm" type="password" value={form.passwordConfirm} onChange={handleChange} placeholder="Repetir nueva contraseña" />
            </div>
          </div>
        </div>
        {form.passwordNueva && form.passwordNueva === form.passwordConfirm && (
          <p style={{ color: '#22c55e', fontSize: 13, marginTop: 8 }}>✓ Las contraseñas coinciden</p>
        )}
        <div className="cfg-card-footer">
          <button type="submit" className="btn-create" disabled={savingPw}>
            {savingPw ? 'Actualizando...' : 'Actualizar contraseña'}
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
  const [prefs, setPrefs]       = useState(getPrefs);
  const [permiso, setPermiso]   = useState(null); // 'granted' | 'denied' | null
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    checkPermission().then(ok => setPermiso(ok ? 'granted' : 'denied'));
  }, []);

  const handleRequestPermiso = async () => {
    const ok = await requestPermission();
    setPermiso(ok ? 'granted' : 'denied');
    if (ok) addToast('Permiso de notificaciones concedido', 'success');
    else    addToast('Permiso denegado. Actívalo en Ajustes del teléfono', 'error');
  };

  const handleSave = async () => {
    setSaving(true);
    savePrefs(prefs);
    await scheduleReporteSemanal();
    // Notificación de prueba para confirmar que funciona
    await sendNotification('Zippy Admin', 'Preferencias de notificaciones guardadas');
    addToast('Preferencias guardadas. Recibirás una notificación de prueba.', 'success');
    setSaving(false);
  };

  return (
    <div className="cfg-sections">
      {/* Estado del permiso */}
      <div className="cfg-card">
        <div className="cfg-card-title">Permiso de notificaciones</div>
        {permiso === 'granted' ? (
          <div className="cfg-perm-ok"><Icon name="check" size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />Las notificaciones están habilitadas en este dispositivo</div>
        ) : (
          <div className="cfg-perm-warn">
            <p><Icon name="alerta" size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />Las notificaciones no están habilitadas. Actívalas para recibir alertas en el teléfono.</p>
            <button className="btn-create" style={{ marginTop: 12 }} onClick={handleRequestPermiso}>
              <Icon name="notificaciones" size={17} style={{ verticalAlign: '-3px', marginRight: 6 }} />Habilitar notificaciones
            </button>
          </div>
        )}
      </div>

      <div className="cfg-card">
        <div className="cfg-card-title">Notificaciones del teléfono</div>
        <p className="cfg-desc">Elige qué eventos generan una notificación en tu dispositivo.</p>
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
            {saving ? 'Guardando...' : '✓ Guardar y probar notificación'}
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
          <p className="cfg-preview-label">
            <Icon name={isDark ? 'luna' : 'sol'} size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />
            {isDark ? 'Modo oscuro activo' : 'Modo claro activo'}
          </p>
        </div>
      </div>
    </div>
  );
};


// ── Soporte (solo super admin) ────────────────────────────────────────────────
const SeccionSoporte = () => {
  const { addToast } = useToast();
  const [whatsapp, setWhatsapp]   = useState('');
  const [original, setOriginal]   = useState('');
  const [cargando, setCargando]   = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    adminService.obtenerSoporte()
      .then(({ data }) => {
        setWhatsapp(data.whatsapp || '');
        setOriginal(data.whatsapp || '');
      })
      .catch(() => addToast('No se pudo cargar el número de soporte', 'error'))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guardar = async (e) => {
    e.preventDefault();
    if (!whatsapp.trim()) {
      addToast('Escribe un número de WhatsApp', 'error');
      return;
    }
    setGuardando(true);
    try {
      const { data } = await adminService.actualizarSoporte(whatsapp.trim());
      setWhatsapp(data.whatsapp);
      setOriginal(data.whatsapp);
      addToast('Número de soporte actualizado', 'success');
    } catch (err) {
      const detalle = err?.response?.data?.detail;
      addToast(typeof detalle === 'string' ? detalle : 'No se pudo guardar el número', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const probar = () => {
    if (!original) return;
    window.open(`https://wa.me/${original}`, '_blank');
  };

  return (
    <div className="cfg-sections">
      <form className="cfg-card" onSubmit={guardar}>
        <div className="cfg-card-title">WhatsApp de soporte</div>
        <p className="cfg-notif-desc" style={{ marginBottom: 16 }}>
          Este es el número al que se comunican los usuarios desde el botón de soporte
          de la aplicación. Aplica para clientes, vendedores y repartidores.
        </p>

        <div className="cfg-field" style={{ maxWidth: 320 }}>
          <label>Número de WhatsApp</label>
          <input
            type="tel"
            value={whatsapp}
            onChange={e => setWhatsapp(e.target.value)}
            placeholder="300 123 4567"
            disabled={cargando || guardando}
            inputMode="numeric"
          />
          <span className="cfg-notif-desc">
            Si escribes 10 dígitos se le agrega el indicativo de Colombia (57) automáticamente.
          </span>
        </div>

        <div className="cfg-actions" style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <button type="submit" className="cfg-btn-save" disabled={cargando || guardando || whatsapp === original}>
            {guardando ? 'Guardando…' : 'Guardar número'}
          </button>

          {original && (
            <button type="button" className="cfg-btn-secondary" onClick={probar}>
              <Icon name="whatsapp" size={18} style={{ verticalAlign: '-4px', marginRight: 6 }} />
              Probar chat
            </button>
          )}
        </div>

        {!cargando && !original && (
          <p className="cfg-notif-desc" style={{ marginTop: 14 }}>
            Aún no hay un número configurado. Mientras no lo definas, el botón de soporte
            no estará disponible para los usuarios.
          </p>
        )}
      </form>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const SECTION_MAP = {
  perfil:         <SeccionPerfil />,
  plataforma:     <SeccionPlataforma />,
  notificaciones: <SeccionNotificaciones />,
  apariencia:     <SeccionApariencia />,
  soporte:        <SeccionSoporte />,
};

const ConfigPage = () => {
  const [activeTab, setActiveTab] = useState('perfil');
  const superAdmin = esSuperAdmin();
  const tabsVisibles = TABS.filter(t => !t.soloSuperAdmin || superAdmin);

  return (
    <Layout>
      <div className="cfg-page-header">
        <h1 className="cfg-title">
          <Icon name="config" size={26} style={{ verticalAlign: '-5px', marginRight: 8 }} />
          Configuración
        </h1>
        <p className="cfg-subtitle">Administra la plataforma y tu cuenta</p>
      </div>

      <div className="cfg-layout">
        <nav className="cfg-nav">
          {tabsVisibles.map(({ id, icon, label }) => (
            <button
              key={id}
              className={`cfg-nav-item ${activeTab === id ? 'cfg-nav-item--active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <span className="cfg-nav-icon"><Icon name={icon} size={20} /></span>
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