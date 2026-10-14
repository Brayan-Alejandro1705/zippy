import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { authService } from '../config/api';
import ZLoader from '../components/ZLoader';
import PantallaAuth, { LogoZippy, TituloAuth, ErrorAuth, CampoAuth, IconoCorreo, IconoCandado, etiquetaAuth, botonAuth, enlaceAuth } from '../components/auth/PantallaAuth';

const extractErrorMessage = (data, fallback) => {
  const detail = data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(d => d.msg).join('. ');
  return fallback;
};

// Flujo en dos pasos, reutiliza el mismo código de 6 dígitos que ya se usa
// para verificar la cuenta (mismas columnas en el backend, solo que aquí
// termina en un cambio de contraseña en vez de un login).
const TIPOS_CUENTA = [
  ['cliente', 'Cliente'],
  ['vendedor', 'Negocio'],
  ['domiciliario', 'Repartidor'],
  ['admin', 'Administrador'],
];

const RecuperarPasswordPage = () => {
  const { search } = useLocation();
  const [paso, setPaso] = useState('solicitar'); // 'solicitar' | 'confirmar'
  const [email, setEmail] = useState('');
  // Un mismo correo puede tener varias cuentas (cliente, negocio, repartidor).
  // Sin esto, el servidor le cambiaba la clave a la cuenta mas reciente, que
  // podia no ser la que la persona queria recuperar.
  const [tipo, setTipo] = useState('cliente');
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
      const { data } = await authService.olvidePassword(email.trim(), tipo);
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
      const { data } = await authService.restablecerPassword(email.trim(), tipo, codigo.trim(), password);
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
      const { data } = await authService.olvidePassword(email.trim(), tipo);
      setInfo(data.mensaje || 'Código reenviado');
    } catch (err) {
      setError(extractErrorMessage(err.response?.data, 'No se pudo reenviar el código'));
    } finally {
      setLoading(false);
    }
  };

  const flecha = <span className="text-lg transition-transform group-hover:translate-x-1">→</span>;

  return (
    <PantallaAuth sacudir={shake}>
      <LogoZippy />

      {paso === 'solicitar' && (
        <>
          <TituloAuth titulo="Recuperar contraseña" sub="Escribe tu correo y te enviamos un código para restablecerla" />

          <form onSubmit={handleSolicitar} noValidate>
            {error && <ErrorAuth>{error}</ErrorAuth>}

            <div className="mb-[18px]">
              <label htmlFor="rp-email" className={etiquetaAuth}>Correo electrónico</label>
              <CampoAuth
                id="rp-email"
                type="email"
                icono={<IconoCorreo />}
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="usuario@ejemplo.com"
                disabled={loading}
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className="mb-[22px]">
              <span className={etiquetaAuth}>¿Qué cuenta quieres recuperar?</span>
              <div className="grid grid-cols-2 gap-2">
                {TIPOS_CUENTA.map(([valor, nombre]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setTipo(valor)}
                    disabled={loading}
                    className={tipo === valor
                      ? 'cursor-pointer rounded-xl border border-solid border-zippy bg-zippy/15 px-3 py-2.5 text-[13px] font-semibold text-zippy'
                      : 'cursor-pointer rounded-xl border border-solid border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13px] font-medium text-white/60'}
                  >
                    {nombre}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className={botonAuth} disabled={loading}>
              {loading ? <ZLoader size="sm" inverted /> : <><span>Enviar código</span>{flecha}</>}
            </button>
          </form>
        </>
      )}

      {paso === 'confirmar' && (
        <>
          <h2 className="m-0 mb-1.5 text-[22px] font-bold tracking-[-0.3px] text-white sm:text-[26px]">Ingresa el código</h2>
          <p className="m-0 mb-7 break-words text-sm leading-snug text-white/40">
            Enviamos un código de 6 dígitos a<br /><strong className="text-white/70">{email}</strong>
          </p>

          <form onSubmit={handleConfirmar} noValidate>
            {error && <ErrorAuth>{error}</ErrorAuth>}
            {info && !error && (
              <div className="mb-[18px] rounded-[10px] border border-solid border-green-500/30 bg-green-500/10 px-3.5 py-[11px] text-[13px] text-green-300">{info}</div>
            )}

            <div className="mb-[18px]">
              <label htmlFor="rp-codigo" className={etiquetaAuth}>Código</label>
              <CampoAuth
                id="rp-codigo"
                value={codigo}
                onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                maxLength={6}
                disabled={loading}
                autoFocus
                className="text-center text-xl font-bold tracking-[8px]"
              />
            </div>

            <div className="mb-[18px]">
              <label htmlFor="rp-pass" className={etiquetaAuth}>Nueva contraseña</label>
              <CampoAuth
                id="rp-pass"
                type="password"
                icono={<IconoCandado />}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mín. 8 caracteres"
                disabled={loading}
                autoComplete="new-password"
              />
            </div>

            <div className="mb-[18px]">
              <label htmlFor="rp-pass2" className={etiquetaAuth}>Confirmar contraseña</label>
              <CampoAuth
                id="rp-pass2"
                type="password"
                icono={<IconoCandado />}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repetir contraseña"
                disabled={loading}
                autoComplete="new-password"
              />
            </div>

            <button type="submit" className={botonAuth} disabled={loading}>
              {loading ? <ZLoader size="sm" inverted /> : <><span>Restablecer contraseña</span>{flecha}</>}
            </button>
          </form>

          <button
            type="button"
            className="mx-auto mt-3 block cursor-pointer border-0 bg-transparent p-1 text-[13px] font-medium text-zippy/75 hover:text-zippy disabled:opacity-60"
            onClick={handleReenviar}
            disabled={loading}
          >
            Reenviar código
          </button>
        </>
      )}

      {paso === 'listo' && (
        <>
          <TituloAuth titulo="¡Listo!" sub={`${info || 'Tu contraseña fue actualizada.'} Ya puedes iniciar sesión.`} />
          <Link to={`/login${search}`} className={`${botonAuth} no-underline`}>
            <span>Ir al login</span>{flecha}
          </Link>
        </>
      )}

      {paso !== 'listo' && (
        <p className="m-0 mt-6 text-center text-[13px]">
          <Link to={`/login${search}`} className={enlaceAuth}>Volver al login</Link>
        </p>
      )}
    </PantallaAuth>
  );
};

export default RecuperarPasswordPage;
