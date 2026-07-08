import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../config/api';
import ZLoader from '../components/ZLoader';
import '../styles/VerificarCuentaPage.css';

const redirectByTipo = (navigate, tipo) => {
  if (tipo === 'admin')        return navigate('/dashboard');
  if (tipo === 'vendedor')     return navigate('/vendor/productos');
  if (tipo === 'domiciliario') return navigate('/repartidor');
  return navigate('/tienda');
};

const RESEND_COOLDOWN = 30;

const VerificarCuentaPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};

  const [email]  = useState(state.email || '');
  const [metodo] = useState(state.metodo || 'email');
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError]     = useState('');
  const [info, setInfo]       = useState(
    state.envioOk === false ? 'No pudimos enviar el código automáticamente. Usa "Reenviar código".' : ''
  );
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    timerRef.current = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [cooldown]);

  if (!email) {
    return (
      <div className="ver-bg">
        <div className="ver-card">
          <p className="ver-title">Falta información</p>
          <p className="ver-sub">No sabemos qué cuenta verificar. Volvé a intentar el registro o inicia sesión.</p>
          <button className="ver-submit" onClick={() => navigate('/login')}>Ir al login</button>
        </div>
      </div>
    );
  }

  const handleVerificar = async (e) => {
    e.preventDefault();
    if (codigo.trim().length !== 6) { setError('El código tiene 6 dígitos'); return; }
    setLoading(true);
    setError('');
    try {
      const { data } = await authService.verificarCodigo(email, codigo.trim());
      localStorage.setItem('access_token',  data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('usuario',       JSON.stringify(data.usuario));
      redirectByTipo(navigate, data.usuario.tipo_usuario);
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo verificar el código');
    } finally {
      setLoading(false);
    }
  };

  const handleReenviar = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError('');
    setInfo('');
    try {
      const { data } = await authService.reenviarCodigo(email, metodo);
      setInfo(data.mensaje);
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo reenviar el código');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="ver-bg">
      <div className="ver-orb ver-orb--1" />
      <div className="ver-orb ver-orb--2" />

      <div className="ver-card">
        <div className="ver-icon">{metodo === 'sms' ? '📱' : '✉️'}</div>
        <p className="ver-title">Verifica tu cuenta</p>
        <p className="ver-sub">
          Enviamos un código de 6 dígitos por {metodo === 'sms' ? 'SMS' : 'correo'} a<br />
          <strong>{email}</strong>
        </p>

        <form onSubmit={handleVerificar} noValidate>
          {error && <div className="ver-error">⚠ {error}</div>}
          {info && !error && <div className="ver-info">{info}</div>}

          <input
            className="ver-code-input"
            value={codigo}
            onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            maxLength={6}
            autoFocus
          />

          <button type="submit" className="ver-submit" disabled={loading}>
            {loading ? <ZLoader size="sm" inverted /> : 'Verificar cuenta'}
          </button>
        </form>

        <button className="ver-resend" onClick={handleReenviar} disabled={cooldown > 0 || resending}>
          {resending ? 'Reenviando...' : cooldown > 0 ? `Reenviar código (${cooldown}s)` : 'Reenviar código'}
        </button>

        <p className="ver-footer">
          <a href="/login">Volver al login</a>
        </p>
      </div>
    </div>
  );
};

export default VerificarCuentaPage;
