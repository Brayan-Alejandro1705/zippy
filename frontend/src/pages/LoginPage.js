import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { authService } from '../config/api';
import { guardarCuentaActual } from '../utils/cuentas';
import ZLoader from '../components/ZLoader';
import BotonesSociales from '../components/auth/BotonesSociales';
import PantallaAuth, { LogoZippy, TituloAuth, ErrorAuth, CampoAuth, BotonOjo, IconoCorreo, IconoCandado, etiquetaAuth, botonAuth, enlaceAuth } from '../components/auth/PantallaAuth';

const ETIQUETA_ROL = {
  cliente:      'Cliente',
  vendedor:     'Vendedor',
  domiciliario: 'Repartidor',
  admin:        'Administrador',
};

const LoginPage = () => {
  const navigate = useNavigate();
  // Se conserva el ?agregar=1 del selector de cuentas al ir a registro o a
  // recuperar la clave; sin el, la ruta publica manda de vuelta a la tienda.
  const { search } = useLocation();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [shake, setShake]       = useState(false);
  // Cuando el correo tiene varias cuentas con la misma clave, el backend
  // responde 409 con la lista de roles en vez de adivinar. Aqui se guardan
  // para pintar el selector.
  const [cuentas, setCuentas]   = useState(null);

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

  const entrar = async (tipoElegido) => {
    setLoading(true);
    setError('');
    try {
      const response = await authService.login(email, password, tipoElegido);
      guardarCuentaActual(); // conserva la sesión que estaba activa antes de este login
      localStorage.setItem('access_token',  response.data.access_token);
      localStorage.setItem('refresh_token', response.data.refresh_token);
      localStorage.setItem('usuario',       JSON.stringify(response.data.usuario));
      guardarCuentaActual(); // registra la cuenta recién ingresada
      redirectByTipo(response.data.usuario.tipo_usuario);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.code === 'CUENTA_NO_VERIFICADA') {
        navigate('/verificar', { state: { email, metodo: detail.metodo_verificacion } });
        return;
      }
      if (detail && typeof detail === 'object' && detail.code === 'MULTIPLE_CUENTAS') {
        setCuentas(detail.cuentas || []);
        return;
      }
      setError((typeof detail === 'string' && detail) || 'Credenciales incorrectas');
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Completa todos los campos'); triggerShake(); return; }
    setCuentas(null);
    entrar();
  };

  return (
    <PantallaAuth sacudir={shake}>
      <LogoZippy />

      {/* Decia "Admin Panel" y "Accede a tu panel de administración", pero por
          esta pantalla entran sobre todo clientes: se dejo un texto que le
          sirve a cualquiera de los cuatro tipos de cuenta. */}
      <TituloAuth titulo="Bienvenido de nuevo" sub="Entra a tu cuenta de ZIPPYGO" />

      {/* Google / Apple: crean o abren una cuenta de CLIENTE. Los negocios y
          repartidores siguen entrando con su correo, en el formulario de abajo. */}
      <BotonesSociales onError={setError} />

      <form onSubmit={handleLogin} noValidate>
        {error && <ErrorAuth>{error}</ErrorAuth>}

        <div className="mb-[18px]">
          <label htmlFor="lp-email" className={etiquetaAuth}>Correo electrónico</label>
          <CampoAuth
            id="lp-email"
            type="email"
            icono={<IconoCorreo />}
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="tucorreo@ejemplo.com"
            disabled={loading}
            autoComplete="email"
          />
        </div>

        <div className="mb-[18px]">
          {/* En 320 px la etiqueta y "¿Olvidaste...?" bajan de linea si no caben */}
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <label htmlFor="lp-pass" className={etiquetaAuth.replace('mb-2 ', '')}>Contraseña</label>
            <Link to={`/recuperar${search}`} className="text-xs font-medium text-zippy/75 no-underline transition-colors hover:text-zippy">¿Olvidaste tu contraseña?</Link>
          </div>
          <CampoAuth
            id="lp-pass"
            type={showPass ? 'text' : 'password'}
            icono={<IconoCandado />}
            derecha={<BotonOjo visible={showPass} onClick={() => setShowPass(p => !p)} />}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={loading}
            autoComplete="current-password"
          />
        </div>

        {cuentas && (
          <div className="mb-1 flex flex-col gap-2 rounded-xl border-[1.5px] border-solid border-[#FFD9B3] bg-[#FFF7EF] p-3.5">
            <p className="m-0 mb-1 text-[13px] font-semibold leading-snug text-[#7A4A12]">Este correo tiene varias cuentas. ¿Con cuál quieres entrar?</p>
            {cuentas.map(c => (
              <button
                key={c.tipo_usuario}
                type="button"
                className="w-full cursor-pointer rounded-[10px] border-[1.5px] border-solid border-zippy bg-white px-3.5 py-[11px] text-sm font-bold text-zippy transition-colors hover:enabled:bg-zippy hover:enabled:text-white disabled:cursor-default disabled:opacity-60"
                disabled={loading}
                onClick={() => entrar(c.tipo_usuario)}
              >
                {ETIQUETA_ROL[c.tipo_usuario] || c.tipo_usuario}
              </button>
            ))}
          </div>
        )}

        <button type="submit" className={botonAuth} disabled={loading}>
          {loading ? <ZLoader size="sm" inverted /> : <><span>Iniciar sesión</span><span className="text-lg transition-transform group-hover:translate-x-1">→</span></>}
        </button>
      </form>

      <p className="m-0 mt-6 text-center text-[13px] text-white/35">
        ¿No tienes cuenta? <Link to={`/register${search}`} className={enlaceAuth}>Regístrate aquí</Link>
      </p>

      <p className="m-0 mt-5 text-center text-[11px] tracking-[0.5px] text-white/15">Garzón, Huila — Colombia</p>
    </PantallaAuth>
  );
};

export default LoginPage;
