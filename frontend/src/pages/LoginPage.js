import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../config/api';
import '../styles/LoginPage.css';

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [shake, setShake]       = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const redirectByTipo = (tipo) => {
    if (tipo === 'admin')       return navigate('/dashboard');
    if (tipo === 'vendedor')    return navigate('/vendor/productos');
    if (tipo === 'domiciliario') return navigate('/repartidor');
    return navigate('/tienda');
  };

  const handleDemo = (tipo) => {
    const usuarios = {
      admin: {
        id: 'DEMO-001', nombre: 'Admin Demo', email: 'admin@zippy.com',
        tipo_usuario: 'admin', ciudad: 'Garzón',
      },
      vendedor: {
        id: 'DEMO-002', nombre: 'Vendedor Demo', email: 'vendedor@zippy.com',
        tipo_usuario: 'vendedor', ciudad: 'Garzón', negocio: 'Tienda Demo',
      },
      usuario: {
        id: 'DEMO-003', nombre: 'Usuario Demo', email: 'usuario@zippy.com',
        tipo_usuario: 'cliente', ciudad: 'Garzón',
      },
      repartidor: {
        id: 'DEMO-004', nombre: 'Carlos Moto', email: 'repartidor@zippy.com',
        tipo_usuario: 'domiciliario', ciudad: 'Garzón',
      },
    };
    localStorage.setItem('access_token',  'demo-token-' + tipo);
    localStorage.setItem('refresh_token', 'demo-refresh-' + tipo);
    localStorage.setItem('usuario',       JSON.stringify(usuarios[tipo]));
    redirectByTipo(tipo);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Completa todos los campos'); triggerShake(); return; }
    setLoading(true);
    setError('');
    try {
      const response = await authService.login(email, password);
      localStorage.setItem('access_token',  response.data.access_token);
      localStorage.setItem('refresh_token', response.data.refresh_token);
      localStorage.setItem('usuario',       JSON.stringify(response.data.usuario));
      redirectByTipo(response.data.usuario.tipo_usuario);
    } catch (err) {
      setError(err.response?.data?.detail || 'Credenciales incorrectas');
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lp-bg">
      {/* Animated orbs */}
      <div className="lp-orb lp-orb--1" />
      <div className="lp-orb lp-orb--2" />
      <div className="lp-orb lp-orb--3" />

      <div className={`lp-card ${shake ? 'lp-shake' : ''}`}>

        {/* Logo */}
        <div className="lp-header">
          <div className="lp-logo">
            <div className="lp-logo-mark">Z</div>
            <span className="lp-logo-name">ZIPPY</span>
          </div>
          <span className="lp-badge">Admin Panel</span>
        </div>

        <h2 className="lp-title">Bienvenido de nuevo</h2>
        <p className="lp-sub">Accede a tu panel de administración</p>

        <form onSubmit={handleLogin} noValidate>
          {error && (
            <div className="lp-error">
              <span className="lp-error-icon">⚠</span>
              {error}
            </div>
          )}

          {/* Email */}
          <div className="lp-field">
            <label htmlFor="lp-email">Correo electrónico</label>
            <div className="lp-input-wrap">
              <svg className="lp-icon" viewBox="0 0 20 20" fill="none">
                <path d="M2.5 5.5A1.5 1.5 0 014 4h12a1.5 1.5 0 011.5 1.5v9A1.5 1.5 0 0116 16H4a1.5 1.5 0 01-1.5-1.5v-9z" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M2.5 6l7.5 5 7.5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <input
                id="lp-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@zippy.com"
                disabled={loading}
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password */}
          <div className="lp-field">
            <div className="lp-label-row">
              <label htmlFor="lp-pass">Contraseña</label>
              <a href="#" className="lp-forgot">¿Olvidaste tu contraseña?</a>
            </div>
            <div className="lp-input-wrap">
              <svg className="lp-icon" viewBox="0 0 20 20" fill="none">
                <rect x="3.5" y="8.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M7 8.5V6a3 3 0 016 0v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                <circle cx="10" cy="13" r="1.2" fill="currentColor"/>
              </svg>
              <input
                id="lp-pass"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                autoComplete="current-password"
              />
              <button type="button" className="lp-eye" onClick={() => setShowPass(p => !p)} tabIndex={-1}>
                {showPass ? (
                  <svg viewBox="0 0 20 20" fill="none">
                    <path d="M3 3l14 14M8.5 8.6A3 3 0 0013.4 13M6.5 5.6C4.6 6.9 3 9 3 10s3 5 7 5c1.4 0 2.7-.4 3.8-1M10 5c4 0 7 3 7 5a8.5 8.5 0 01-1.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" fill="none">
                    <path d="M10 4C6 4 3 7 3 10s3 6 7 6 7-3 7-6-3-6-7-6z" stroke="currentColor" strokeWidth="1.5"/>
                    <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button type="submit" className="lp-submit" disabled={loading}>
            {loading ? <span className="lp-spinner" /> : <><span>Iniciar sesión</span><span className="lp-arrow">→</span></>}
          </button>
        </form>

        <p className="lp-footer">
          ¿No tienes cuenta? <a href="/register">Regístrate aquí</a>
        </p>

        <div className="lp-demo">
          <span className="lp-demo-label">Acceso rápido (demo)</span>
          <div className="lp-demo-btns">
            <button type="button" className="lp-demo-btn" onClick={() => handleDemo('admin')}>
              <span>🛡</span> Admin
            </button>
            <button type="button" className="lp-demo-btn" onClick={() => handleDemo('vendedor')}>
              <span>🏪</span> Vendedor
            </button>
            <button type="button" className="lp-demo-btn lp-demo-btn--user" onClick={() => handleDemo('usuario')}>
              <span>🛒</span> Usuario
            </button>
            <button type="button" className="lp-demo-btn lp-demo-btn--rep" onClick={() => handleDemo('repartidor')}>
              <span>🛵</span> Repartidor
            </button>
          </div>
        </div>

        <div className="lp-divider">
          <span>Garzón, Huila — Colombia</span>
        </div>

      </div>
    </div>
  );
};

export default LoginPage;
