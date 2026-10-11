import React from 'react';
import { cx } from '../../ui/tw';

// ============================================================================
// PantallaAuth.js - Fondo oscuro animado + tarjeta de vidrio que comparten
// Login y Recuperar contraseña. Antes cada una cargaba LoginPage.css.
// ============================================================================

export const LogoZippy = () => (
  <div className="mb-8 flex items-center gap-2.5">
    <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-gradient-to-br from-zippy to-[#ff9d3a] text-lg font-black tracking-[-1px] text-white shadow-[0_4px_16px_rgba(255,122,0,0.4)]">
      Z
    </div>
    <span className="text-lg font-extrabold tracking-[2px] text-white">ZIPPY</span>
  </div>
);

const PantallaAuth = ({ children, sacudir = false }) => (
  <div
    className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(-45deg,#0d0d1a,#1a0a2e,#0a1628,#0f0f1f)] bg-[length:400%_400%] px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(24px+env(safe-area-inset-top))] font-sans animate-fondo xs:px-6"
  >
    {/* Luces de colores que flotan detras de la tarjeta */}
    <div className="pointer-events-none fixed -right-[120px] -top-[160px] h-[500px] w-[500px] animate-flotar rounded-full bg-[radial-gradient(circle,rgba(255,122,0,0.22)_0%,transparent_65%)]" />
    <div className="pointer-events-none fixed -bottom-[100px] -left-[80px] h-[380px] w-[380px] animate-flotar rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.18)_0%,transparent_65%)] [animation-delay:-4s] [animation-duration:10s]" />
    <div className="pointer-events-none fixed left-[15%] top-[55%] h-[220px] w-[220px] animate-flotar rounded-full bg-[radial-gradient(circle,rgba(14,165,233,0.12)_0%,transparent_65%)] [animation-delay:-2s] [animation-duration:9s]" />

    <div
      className={cx(
        'relative z-[1] w-full max-w-[420px] rounded-3xl border border-solid border-white/[0.09] bg-white/[0.04] px-6 pb-8 pt-9 backdrop-blur-[24px] xs:px-7 sm:px-11 sm:pb-10 sm:pt-12',
        'shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_32px_72px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)]',
        // textura de puntitos
        'before:pointer-events-none before:absolute before:inset-0 before:rounded-3xl before:bg-[radial-gradient(rgba(255,255,255,0.035)_1px,transparent_1px)] before:bg-[length:22px_22px] before:content-[""]',
        sacudir ? 'animate-sacudir' : 'animate-aparecer'
      )}
    >
      <div className="relative">{children}</div>
    </div>
  </div>
);

export const TituloAuth = ({ titulo, sub }) => (
  <>
    <h2 className="m-0 mb-1.5 text-[22px] font-bold tracking-[-0.3px] text-white sm:text-[26px]">{titulo}</h2>
    {sub && <p className="m-0 mb-7 text-sm leading-snug text-white/40">{sub}</p>}
  </>
);

export const ErrorAuth = ({ children }) => (
  <div className="mb-[18px] flex items-center gap-2 rounded-[10px] border border-l-[3px] border-solid border-red-500/30 border-l-red-500 bg-red-500/10 px-3.5 py-[11px] text-[13px] text-red-300">
    <span className="shrink-0">⚠</span>
    {children}
  </div>
);

export const etiquetaAuth = 'mb-2 block text-xs font-semibold uppercase tracking-[0.8px] text-white/50';

// Campo con icono a la izquierda y, opcionalmente, un boton a la derecha (ojo).
export const CampoAuth = ({ icono, derecha, error, className, ...props }) => (
  <div className="relative flex items-center">
    {icono && <span className="pointer-events-none absolute left-3.5 flex h-4 w-4 text-white/30">{icono}</span>}
    <input
      {...props}
      className={cx(
        'w-full rounded-xl border border-solid py-[13px] text-sm text-white outline-none transition',
        error ? 'border-red-500/70 bg-red-500/[0.08]' : 'border-white/10 bg-white/[0.06]',
        icono ? 'pl-[42px]' : 'pl-3.5',
        derecha ? 'pr-11' : 'pr-3.5',
        'placeholder:text-white/[0.22] focus:border-zippy/60 focus:bg-zippy/[0.07] focus:shadow-[0_0_0_3px_rgba(255,122,0,0.12)] disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
    />
    {derecha}
  </div>
);

export const BotonOjo = ({ visible, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    tabIndex={-1}
    aria-label={visible ? 'Ocultar contraseña' : 'Ver contraseña'}
    className="absolute right-[13px] flex h-[18px] w-[18px] cursor-pointer items-center border-0 bg-transparent p-0 text-white/30 transition-colors hover:text-white/70"
  >
    {visible ? (
      <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]">
        <path d="M3 3l14 14M8.5 8.6A3 3 0 0013.4 13M6.5 5.6C4.6 6.9 3 9 3 10s3 5 7 5c1.4 0 2.7-.4 3.8-1M10 5c4 0 7 3 7 5a8.5 8.5 0 01-1.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ) : (
      <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]">
        <path d="M10 4C6 4 3 7 3 10s3 6 7 6 7-3 7-6-3-6-7-6z" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )}
  </button>
);

export const IconoCorreo = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
    <path d="M2.5 5.5A1.5 1.5 0 014 4h12a1.5 1.5 0 011.5 1.5v9A1.5 1.5 0 0116 16H4a1.5 1.5 0 01-1.5-1.5v-9z" stroke="currentColor" strokeWidth="1.4" />
    <path d="M2.5 6l7.5 5 7.5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

export const IconoCandado = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
    <rect x="3.5" y="8.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M7 8.5V6a3 3 0 016 0v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <circle cx="10" cy="13" r="1.2" fill="currentColor" />
  </svg>
);

// Boton naranja grande con brillo al pasar el mouse
export const botonAuth =
  'group relative mt-2 flex min-h-[50px] w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl border-0 bg-gradient-to-br from-zippy to-[#ff9a38] p-3.5 text-[15px] font-bold text-white ' +
  'shadow-[0_4px_20px_rgba(255,122,0,0.35)] transition hover:enabled:-translate-y-0.5 hover:enabled:shadow-[0_10px_32px_rgba(255,122,0,0.5)] active:enabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60';

export const enlaceAuth = 'font-semibold text-zippy/85 no-underline transition-colors hover:text-zippy';

export default PantallaAuth;
