import React, { useState } from 'react';
import { authService } from '../config/api';
import ZLoader from '../components/ZLoader';
import '../styles/LoginPage.css';

const extractErrorMessage = (data, fallback) => {
  const detail = data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(d => d.msg).join('. ');
  return fallback;
};

// Flujo en dos pasos, reutiliza el mismo código de 6 dígitos que ya se usa
// para verificar la cuenta (mismas columnas en el backend, solo que aquí
// termina en un cambio de contraseña en vez de un login).
const RecuperarPasswordPage = () => {
  const [paso, setPaso] = useState('solicitar'); // 'solicitar' | 'confirmar'
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [shake, setShake] = useState(false);

  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 500); };

  const handleSolicitar = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError('Escribe tu correo'); triggerShake(); return; }
    setLoading(true);
    setError('');
    try {
      const { data } = await authService.olvidePassword(email.trim());
      setInfo(data.mensaje || 'Código enviado');
      setPaso('confirmar');
    } catch (err) {
      setError(extractErrorMessage(err.response?.data, 'No pudimos enviar el código'));
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmar = async (e) => {
    e.preventDefault();
    if (codigo.trim().length !== 6) { setError('El código tiene 6 dígitos'); triggerShake(); return; }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); triggerShake(); return; }
    if (!/[A-Z]/.test(password)) { setError('La contraseña debe incluir al menos una mayúscula'); triggerShake(); return; }
    if (!/[0-9]/.test(password)) { setError('La contraseña debe incluir al menos un número'); triggerShake(); return; }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); triggerShake(); return; }

    setLoading(true);
    setError('');
    try {
      const { data } = await authService.restablecerPassword(email.trim(), undefined, codigo.trim(), password);
      setInfo(data.mensaje || 'Contraseña actualizada');
      setPaso('listo');
    } catch (err) {
      setError(extractErrorMessage(err.response?.data, 'No se pudo restablecer la contraseña'));
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleReenviar = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await authService.olvidePassword(email.trim());
      setInfo(data.mensaje || 'Código reenviado');
    } catch (err) {
      setError(extractErrorMessage(err.response?.data, 'No se pudo reenviar el código'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lp-bg">
      <div className="lp-orb lp-orb--1" />
      <div className="lp-orb lp-orb--2" />
      <div className="lp-orb lp-orb--3" />

      <div className={`lp-card ${shake ? 'lp-shake' : ''}`}>
        <div className="lp-header">
          <div className="lp-logo">
            <div className="lp-logo-mark">Z</div>
            <span className="lp-logo-name">ZIPPY</span>
          </div>
        </div>

        {paso === 'solicitar' && (
          <>
            <h2 className="lp-title">Recuperar contraseña</h2>
            <p className="lp-sub">Escribe tu correo y te enviamos un código para restablecerla</p>

            <form onSubmit={handleSolicitar} noValidate>
              {error && <div className="lp-error"><span className="lp-error-icon">⚠</span>{error}</div>}

              <div className="lp-field">
                <label htmlFor="rp-email">Correo electrónico</label>
                <div className="lp-input-wrap">
                  <input
                    id="rp-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="usuario@ejemplo.com"
                    disabled={loading}
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>

              <button type="submit" className="lp-submit" disabled={loading}>
                {loading ? <ZLoader size="sm" inverted /> : <><span>Enviar código</span><span className="lp-arrow">→</span></>}
              </button>
            </form>
          </>
        )}

        {paso === 'confirmar' && (
          <>
            <h2 className="lp-title">Ingresa el código</h2>
            <p className="lp-sub">Enviamos un código de 6 dígitos a<br /><strong>{email}</strong></p>

            <form onSubmit={handleConfirmar} noValidate>
              {error && <div className="lp-error"><span className="lp-error-icon">⚠</span>{error}</div>}
              {info && !error && <div className="lp-error" style={{ background: '#EFFAF3', color: '#1a7f4b', borderColor: '#bfe8cf' }}>{info}</div>}

              <div className="lp-field">
                <label htmlFor="rp-codigo">Código</label>
                <div className="lp-input-wrap">
                  <input
                    id="rp-codigo"
                    value={codigo}
                    onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    inputMode="numeric"
                    maxLength={6}
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </div>

              <div className="lp-field">
                <label htmlFor="rp-pass">Nueva contraseña</label>
                <div className="lp-input-wrap">
                  <input
                    id="rp-pass"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mín. 8 caracteres"
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="lp-field">
                <label htmlFor="rp-pass2">Confirmar contraseña</label>
                <div className="lp-input-wrap">
                  <input
                    id="rp-pass2"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repetir contraseña"
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <button type="submit" className="lp-submit" disabled={loading}>
                {loading ? <ZLoader size="sm" inverted /> : <><span>Restablecer contraseña</span><span className="lp-arrow">→</span></>}
              </button>
            </form>

            <button type="button" className="lp-forgot" style={{ marginTop: 12, background: 'none', border: 'none', cursor: 'pointer' }} onClick={handleReenviar} disabled={loading}>
              Reenviar código
            </button>
          </>
        )}

        {paso === 'listo' && (
          <>
            <h2 className="lp-title">¡Listo!</h2>
            <p className="lp-sub">{info || 'Tu contraseña fue actualizada.'} Ya puedes iniciar sesión.</p>
            <a href="/login" className="lp-submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
              <span>Ir al login</span><span className="lp-arrow">→</span>
            </a>
          </>
        )}

        {paso !== 'listo' && (
          <p className="lp-footer">
            <a href="/login">Volver al login</a>
          </p>
        )}
      </div>
    </div>
  );
};

export default RecuperarPasswordPage;
