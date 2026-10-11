import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { googleDisponible, appleDisponible, entrarConProveedor } from '../../utils/loginSocial';
import { cx } from '../../ui/tw';

// ============================================================================
// BotonesSociales.js - "Continuar con Google" / "Continuar con Apple".
// Solo para clientes: el login y el registro los muestran unicamente cuando
// la cuenta es de cliente. Si el celular no trae el plugin, no se dibuja nada.
// ============================================================================

const LogoGoogle = () => (
  <svg viewBox="0 0 48 48" className="h-[18px] w-[18px]" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

const LogoApple = () => (
  <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="currentColor" aria-hidden="true">
    <path d="M16.37 1.43c0 1.14-.42 2.2-1.24 3.06-.98 1.02-2.16 1.61-3.44 1.51-.02-.13-.03-.27-.03-.41 0-1.1.48-2.27 1.33-3.14.42-.44.96-.8 1.6-1.09.64-.28 1.25-.44 1.82-.47.02.18.03.36.03.54h-.07zM20.6 17.2c-.38.88-.83 1.7-1.36 2.45-.72 1.03-1.31 1.74-1.77 2.14-.71.65-1.47.99-2.28 1.01-.58 0-1.28-.17-2.1-.5-.82-.33-1.57-.5-2.25-.5-.72 0-1.49.17-2.31.5-.83.34-1.49.51-2 .53-.78.03-1.55-.31-2.32-1.04-.49-.43-1.11-1.16-1.85-2.2-.79-1.12-1.44-2.41-1.95-3.88C1.86 14.13 1.6 12.6 1.6 11.12c0-1.69.37-3.15 1.1-4.37.57-.98 1.34-1.75 2.29-2.32.96-.56 1.99-.85 3.11-.87.61 0 1.41.19 2.4.56.99.37 1.62.56 1.9.56.21 0 .92-.22 2.13-.66 1.14-.41 2.1-.58 2.89-.51 2.14.17 3.74 1.01 4.81 2.53-1.91 1.16-2.85 2.78-2.83 4.86.02 1.62.6 2.97 1.76 4.04.53.5 1.11.88 1.76 1.15-.14.41-.29.8-.45 1.18z" />
  </svg>
);

const boton =
  'flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl px-4 py-3 font-[inherit] text-[15px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60';

const BotonesSociales = ({ onError, texto = 'Continuar' }) => {
  const navigate = useNavigate();
  const [cargando, setCargando] = useState(null);

  const google = googleDisponible();
  const apple = appleDisponible();
  if (!google && !apple) return null;

  const entrar = async (proveedor) => {
    if (cargando) return;
    setCargando(proveedor);
    onError?.('');
    try {
      const res = await entrarConProveedor(proveedor);
      if (!res) { setCargando(null); return; } // cerro la ventana
      // Google y Apple no dan el celular, y el repartidor lo necesita
      navigate(res.usuario?.telefono ? '/tienda' : '/completar-telefono', { replace: true });
    } catch (err) {
      onError?.(err.message);
      setCargando(null);
    }
  };

  return (
    <div className="mb-5">
      <div className="flex flex-col gap-2.5">
        {/* En iPhone Apple va primero, como piden sus guias */}
        {apple && (
          <button type="button" className={cx(boton, 'border-0 bg-white text-black hover:bg-white/90')} onClick={() => entrar('apple')} disabled={!!cargando}>
            <LogoApple />{cargando === 'apple' ? 'Conectando…' : `${texto} con Apple`}
          </button>
        )}
        {google && (
          <button type="button" className={cx(boton, 'border border-solid border-white/15 bg-white/[0.08] text-white hover:bg-white/[0.12]')} onClick={() => entrar('google')} disabled={!!cargando}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white"><LogoGoogle /></span>
            {cargando === 'google' ? 'Conectando…' : `${texto} con Google`}
          </button>
        )}
      </div>
      <p className="m-0 mt-2.5 text-center text-[11.5px] leading-snug text-white/35">
        Al continuar aceptas los{' '}
        <a className="text-white/55 underline" href="https://brayan-alejandro1705.github.io/zippy/terminos.html" target="_blank" rel="noopener noreferrer">Términos</a>{' '}
        y la{' '}
        <a className="text-white/55 underline" href="https://brayan-alejandro1705.github.io/zippy/privacidad.html" target="_blank" rel="noopener noreferrer">Política de Privacidad</a>.
      </p>
      <div className="mt-5 flex items-center gap-3 text-xs text-white/35">
        <span className="h-px flex-1 bg-white/10" />o con tu correo<span className="h-px flex-1 bg-white/10" />
      </div>
    </div>
  );
};

export default BotonesSociales;
