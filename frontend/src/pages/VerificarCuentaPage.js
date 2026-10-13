import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { authService, productosService, negociosService } from '../config/api';
import ZLoader from '../components/ZLoader';
import Icon from '../components/Icons';
import PantallaAuth, { ErrorAuth, botonAuth } from '../components/auth/PantallaAuth';

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
  const [tipoUsuario] = useState(state.tipo_usuario || '');
  const [logoFile]    = useState(state.logoFile || null);
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
      <PantallaAuth>
        <div className="text-center">
          <p className="m-0 mb-2 text-[22px] font-bold text-white">Falta información</p>
          <p className="m-0 mb-6 text-[13.5px] leading-relaxed text-white/50">No sabemos qué cuenta verificar. Vuelve a intentar el registro o inicia sesión.</p>
          <button className={botonAuth} onClick={() => navigate('/login')}>Ir al login</button>
        </div>
      </PantallaAuth>
    );
  }

  const handleVerificar = async (e) => {
    e.preventDefault();
    if (codigo.trim().length !== 6) { setError('El código tiene 6 dígitos'); return; }
    setLoading(true);
    setError('');
    try {
      const { data } = await authService.verificarCodigo(email, codigo.trim(), tipoUsuario);
      localStorage.setItem('access_token',  data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('usuario',       JSON.stringify(data.usuario));

      if (logoFile && data.usuario.tipo_usuario === 'vendedor') {
        try {
          const { data: imagen } = await productosService.subirImagen(logoFile);
          const { data: negocio } = await negociosService.miNegocio();
          await negociosService.actualizar(negocio.id, { logo: imagen.url });
        } catch (e) {
          // No es critico: el vendedor puede agregar la foto despues
          // desde su perfil. No bloqueamos el login por esto.
          console.warn('No se pudo subir la foto del negocio:', e);
        }
      }

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
      const { data } = await authService.reenviarCodigo(email, metodo, tipoUsuario);
      setInfo(data.mensaje);
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo reenviar el código');
    } finally {
      setResending(false);
    }
  };

  return (
    <PantallaAuth>
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-zippy/15 text-zippy">
          <Icon name={metodo === 'sms' ? 'telefono' : 'correo'} size={30} />
        </div>
        <p className="m-0 mb-2 text-[22px] font-bold text-white">Verifica tu cuenta</p>
        <p className="m-0 mb-6 break-words text-[13.5px] leading-relaxed text-white/50">
          Enviamos un código de 6 dígitos por {metodo === 'sms' ? 'SMS' : 'correo'} a<br />
          <strong className="text-white/85">{email}</strong>
        </p>

        <form onSubmit={handleVerificar} noValidate className="text-left">
          {error && <ErrorAuth>{error}</ErrorAuth>}
          {info && !error && (
            <div className="mb-[18px] rounded-[10px] border border-solid border-blue-500/30 bg-blue-500/10 px-3.5 py-[11px] text-[13px] text-blue-300">{info}</div>
          )}

          {/* El codigo se achica en 320 px para que los 6 digitos quepan */}
          <input
            className="mb-4 w-full rounded-xl border border-solid border-white/10 bg-white/[0.06] px-3 py-3.5 text-center text-[22px] font-bold tracking-[6px] text-white outline-none transition placeholder:text-white/15 focus:border-zippy/60 focus:bg-zippy/[0.07] focus:shadow-[0_0_0_3px_rgba(255,122,0,0.12)] xs:text-[26px] xs:tracking-[10px]"
            value={codigo}
            onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            aria-label="Código de verificación"
          />

          <button type="submit" className={botonAuth} disabled={loading}>
            {loading ? <ZLoader size="sm" inverted /> : 'Verificar cuenta'}
          </button>
        </form>

        <button
          className="mt-3 w-full cursor-pointer rounded-xl border border-solid border-white/10 bg-transparent p-3 text-[13px] font-medium text-white/60 transition hover:enabled:border-zippy/40 hover:enabled:text-white disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleReenviar}
          disabled={cooldown > 0 || resending}
        >
          {resending ? 'Reenviando...' : cooldown > 0 ? `Reenviar código (${cooldown}s)` : 'Reenviar código'}
        </button>

        <p className="m-0 mt-5 text-[13px]">
          <Link to="/login" className="text-white/45 no-underline hover:text-white/70">Volver al login</Link>
        </p>
      </div>
    </PantallaAuth>
  );
};

export default VerificarCuentaPage;