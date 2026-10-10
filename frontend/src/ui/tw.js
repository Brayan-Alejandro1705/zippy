// ============================================================================
// ui/tw.js - Piezas de Tailwind que se repiten en varias pantallas.
//
// La idea: en vez de copiar las mismas 15 clases en cada boton o tarjeta,
// se importan de aqui. Si manana cambia el color del boton principal, se
// cambia en un solo sitio.
//
// Reglas para que la app se vea bien en TODOS los celulares:
//   - Nada de anchos fijos en px para bloques de contenido: w-full / flex-1.
//   - Filas con varias cosas: flex-wrap o min-w-0 + truncate, para que en
//     320 px bajen de linea en vez de salirse de la pantalla.
//   - Las tablas en celular se muestran como tarjetas (md:table para PC).
//   - Siempre poner la version dark: de cada color.
// ============================================================================

// Une clases ignorando las vacias: cx('a', cond && 'b')
export const cx = (...c) => c.filter(Boolean).join(' ');

export const titulo = 'm-0 text-[22px] font-bold leading-tight text-slate-800 dark:text-slate-100';
export const subtitulo = 'm-0 mt-1 text-[13px] text-slate-500 dark:text-slate-400';

export const tarjeta =
  'rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.07)] dark:bg-noche-card dark:shadow-none dark:ring-1 dark:ring-noche-borde';

const btnBase =
  'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold cursor-pointer transition-colors ' +
  'disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap';

export const btn = {
  principal: `${btnBase} border-0 bg-zippy px-4 py-2.5 text-sm text-white hover:bg-zippy-600`,
  azul: `${btnBase} border-0 bg-blue-500 px-3 py-2 text-[13px] text-white hover:bg-blue-600`,
  borde:
    `${btnBase} border border-solid border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-600 hover:border-zippy hover:text-zippy ` +
    'dark:border-noche-borde dark:bg-noche-alt dark:text-slate-300',
};

// Pestanas tipo "chip" que se desplazan de lado si no caben (no se parten
// en dos filas raras en celulares pequenos).
export const chipsFila = '-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] xs:-mx-4 xs:px-4 md:mx-0 md:flex-wrap md:px-0';
export const chip = (activo) =>
  cx(
    'shrink-0 cursor-pointer rounded-full border-[1.5px] border-solid px-4 py-2 text-[13px] font-medium transition-colors',
    activo
      ? 'border-zippy bg-zippy font-semibold text-white'
      : 'border-slate-200 bg-white text-slate-600 hover:border-zippy hover:text-zippy dark:border-noche-borde dark:bg-noche-alt dark:text-slate-300'
  );

export const badge = {
  pendiente: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300',
  camino: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  entregada: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  cancelada: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
};
export const badgeBase = 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap';
