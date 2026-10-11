import React from 'react';
import Icon from '../Icons';
import { cx } from '../../ui/tw';

// ============================================================================
// layout/piezas.js - Encabezado naranja y barra de abajo que comparten la app
// del cliente (UserLayout) y el panel del negocio (VendorLayout).
// Antes vivian en UserLayout.css y VendorLayout.css.
// ============================================================================

// Fondo de toda la pantalla
export const contenedor = 'flex min-h-screen flex-col bg-[#f5f6f8] font-sans dark:bg-noche';

// En iPhone el encabezado se dibuja detras de la hora y la Dynamic Island:
// el naranja llega hasta el borde pero el contenido baja lo necesario.
export const Encabezado = ({ children }) => (
  <header className="sticky top-0 z-[100] box-border flex h-[calc(58px+env(safe-area-inset-top))] items-center gap-2.5 bg-zippy px-3 pt-[env(safe-area-inset-top)] shadow-[0_2px_10px_rgba(255,122,0,0.25)] xs:gap-3 xs:px-4 md:h-[62px] md:px-8">
    {children}
  </header>
);

export const Logo = ({ onClick }) => (
  <button className="flex shrink-0 cursor-pointer items-center border-0 bg-transparent p-0" onClick={onClick} aria-label="Inicio">
    <img src="/logo-zippy.jpeg" alt="Zippy Go" className="h-9 w-auto rounded-md object-contain" />
  </button>
);

// Boton cuadrado translucido del encabezado (carrito, perfil, configuracion)
export const botonEncabezado =
  'relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border-0 bg-white/20 text-white transition-colors hover:bg-white/30';

export const Buscador = ({ value, onChange, placeholder }) => (
  <div className="relative min-w-0 flex-1">
    <svg className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#aaa] dark:text-slate-500" viewBox="0 0 20 20" fill="none">
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
    <input
      className="box-border w-full text-ellipsis rounded-[22px] border-0 bg-white/95 py-[9px] pl-8 pr-3 text-[13px] text-[#333] outline-none placeholder:text-[#aaa] dark:bg-white/[0.08] dark:text-slate-200 dark:placeholder:text-slate-500"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
    />
  </div>
);

// Contenido. El relleno de abajo deja libre la barra inferior.
export const contenido = 'box-border w-full max-w-[600px] flex-1 self-center md:max-w-[1160px]';

// Barra de abajo. En iPhone deja libre la rayita de inicio.
export const BarraInferior = ({ children, enPC = false }) => (
  <nav
    className={cx(
      'fixed inset-x-0 bottom-0 z-[300] box-border flex h-[calc(62px+env(safe-area-inset-bottom))] items-stretch border-0 border-t border-solid border-[#f0f0f0] bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.08)] dark:border-noche-borde dark:bg-noche-card',
      // El cliente tiene el encabezado completo en PC y esconde la barra;
      // el negocio no tiene otra navegacion, asi que la conserva.
      enPC ? 'md:mx-auto md:max-w-[1160px] md:rounded-t-2xl' : 'md:hidden'
    )}
  >
    {children}
  </nav>
);

export const ItemBarra = ({ activo, icono, etiqueta, onClick, aviso }) => (
  <button
    className="relative flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-[3px] border-0 bg-transparent px-0.5 pb-2.5 pt-2 font-[inherit] transition-colors hover:bg-slate-50 dark:hover:bg-noche"
    onClick={onClick}
  >
    {activo && <span className="absolute inset-x-[20%] top-0 h-[3px] rounded-b-[3px] bg-zippy" />}
    <span className={cx('relative inline-flex leading-none transition-transform', activo ? 'scale-[1.15] text-zippy' : 'text-slate-700 dark:text-slate-300')}>
      <Icon name={icono} size={22} />
      {aviso > 0 && (
        <span className="absolute -right-[11px] -top-1.5 h-[17px] min-w-[17px] rounded-full bg-red-500 px-1 text-center text-[10px] font-extrabold leading-[17px] text-white shadow-[0_0_0_2px_#fff] dark:shadow-[0_0_0_2px_#1e293b]">
          {aviso > 9 ? '9+' : aviso}
        </span>
      )}
    </span>
    {/* 10 px y sin espacio entre letras: con 5 botones en 320 px tiene que caber "Productos" */}
    <span className={cx('max-w-full truncate text-[10px] font-semibold', activo ? 'text-zippy' : 'text-slate-400')}>{etiqueta}</span>
  </button>
);
