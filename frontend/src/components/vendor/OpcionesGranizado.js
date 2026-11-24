import React from 'react';
import CampoPesos from '../CampoPesos';
import { cx } from '../../ui/tw';

// ============================================================================
// OpcionesGranizado — en "Editar/Nuevo producto", solo para negocios de la
// categoría Granizados (nov 2026). Tamaños con su precio y "con o sin licor".
// Valor: null o { tamanos: [{nombre, precio}], con_licor, sin_licor }
// ============================================================================

const campo = 'box-border w-full rounded-[10px] border-[1.5px] border-solid border-slate-200 bg-white px-3 py-2.5 font-[inherit] text-[14px] text-slate-800 outline-none focus:border-zippy dark:border-noche-borde dark:bg-noche-alt dark:text-slate-100';

const Interruptor = ({ on, onClick, etiqueta }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={etiqueta} onClick={onClick}
    className={cx('relative h-[26px] w-[46px] shrink-0 cursor-pointer rounded-full border-0 transition-colors', on ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600')}>
    <span className={cx('absolute top-[3px] h-5 w-5 rounded-full bg-white transition-all', on ? 'left-[23px]' : 'left-[3px]')} />
  </button>
);

// Los tamaños los escribe el negocio (10 oz, 12 oz, 16 oz, litro…): no se llenan solos
const VACIO = { tamanos: [{ nombre: '', precio: '' }, { nombre: '', precio: '' }], con_licor: false, sin_licor: null };

const OpcionesGranizado = ({ valor, onCambio, precioBase }) => {
  const activo = !!valor;
  const v = valor || VACIO;
  const set = (cambios) => onCambio({ ...v, ...cambios });
  const setTamano = (i, cambios) => set({ tamanos: v.tamanos.map((t, k) => (k === i ? { ...t, ...cambios } : t)) });

  return (
    <div className="mb-4 rounded-2xl border-[1.5px] border-solid border-orange-200 bg-orange-50/60 p-3.5 dark:border-zippy/30 dark:bg-zippy/5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <b className="block text-[15px] text-slate-800 dark:text-slate-100">Tamaños y licor</b>
          <span className="text-[12.5px] leading-snug text-slate-500">Un solo producto con tamaños (10 oz, 20 oz…) en vez de repetirlo.</span>
        </div>
        <Interruptor on={activo} etiqueta="Tamaños y licor"
          onClick={() => onCambio(activo ? null : { ...VACIO, tamanos: [{ nombre: '', precio: precioBase || '' }, { nombre: '', precio: '' }] })} />
      </div>

      {activo && (
        <>
          <span className="mb-1.5 mt-3 block text-[11px] font-extrabold uppercase tracking-[0.5px] text-slate-400">Tamaños</span>
          <p className="m-0 mb-2 text-[12px] text-slate-500">Escribe cada tamaño como lo vendes (onzas, vaso, litro…) y su precio.</p>
          {v.tamanos.map((t, i) => (
            <div key={i} className="mb-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_28px] items-center gap-2">
              <input className={campo} value={t.nombre} maxLength={20} placeholder={i === 0 ? 'Ej: 12 oz' : 'Ej: 16 oz'} onChange={e => setTamano(i, { nombre: e.target.value })} />
              <div className="min-w-0"><CampoPesos name={`precio${i}`} value={t.precio} placeholder="Precio" className={campo} onChange={e => setTamano(i, { precio: e.target.value })} /></div>
              {v.tamanos.length > 1 ? (
                <button type="button" aria-label="Quitar tamaño" onClick={() => set({ tamanos: v.tamanos.filter((_, k) => k !== i) })}
                  className="cursor-pointer border-0 bg-transparent px-1 text-[20px] text-slate-400">×</button>
              ) : <span />}
            </div>
          ))}
          {v.tamanos.length < 4 && (
            <button type="button" onClick={() => set({ tamanos: [...v.tamanos, { nombre: '', precio: '' }] })}
              className="cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-[14px] font-extrabold text-orange-600">+ Agregar tamaño</button>
          )}

          <div className="mt-3 flex items-center gap-3 border-0 border-t border-solid border-orange-200 pt-3 dark:border-zippy/20">
            <div className="min-w-0 flex-1">
              <b className="block text-[14px] text-slate-800 dark:text-slate-100">Lleva licor</b>
              <span className="text-[12px] text-slate-500">Al cliente se le pide que confirme que es mayor de edad</span>
            </div>
            <Interruptor on={!!v.con_licor} etiqueta="Lleva licor" onClick={() => set({ con_licor: !v.con_licor, sin_licor: v.con_licor ? null : v.sin_licor })} />
          </div>
          {v.con_licor && (
            <div className="mt-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <b className="block text-[14px] text-slate-800 dark:text-slate-100">También sin licor</b>
                <span className="text-[12px] text-slate-500">El cliente escoge con o sin licor</span>
              </div>
              <Interruptor on={v.sin_licor != null} etiqueta="También sin licor" onClick={() => set({ sin_licor: v.sin_licor != null ? null : 1000 })} />
            </div>
          )}
          {v.con_licor && v.sin_licor != null && (
            <div className="mt-2 flex items-center gap-2">
              <span className="flex-1 text-[13px] text-slate-600 dark:text-slate-300">Sin licor cuesta menos</span>
              <div className="w-[140px]"><CampoPesos name="sin_licor" value={v.sin_licor} placeholder="0" className={campo} onChange={e => set({ sin_licor: e.target.value === '' ? 0 : Number(e.target.value) })} /></div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Qué le falta para guardar (null si está bien)
export const faltaEnOpciones = (v) => {
  if (!v) return null;
  const llenos = v.tamanos.filter(t => String(t.nombre).trim() || t.precio);
  if (!llenos.length) return 'Escribe al menos un tamaño con su precio, o apaga "Tamaños y licor"';
  const malo = llenos.find(t => !String(t.nombre).trim() || !(Number(t.precio) > 0));
  if (malo) return !String(malo.nombre).trim() ? 'Escribe el nombre de cada tamaño (por ejemplo 12 oz)' : `Escribe el precio del tamaño ${String(malo.nombre).trim()}`;
  return null;
};

// Lo que se manda al servidor (precios como número, sin tamaños vacíos)
export const opcionesParaGuardar = (v) => {
  if (!v) return null;
  const tamanos = v.tamanos.filter(t => String(t.nombre).trim()).map(t => ({ nombre: String(t.nombre).trim(), precio: Number(t.precio) || 0 }));
  if (!tamanos.length) return null;
  return { tamanos, con_licor: !!v.con_licor, sin_licor: v.con_licor && v.sin_licor != null ? Number(v.sin_licor) || 0 : null };
};

export default OpcionesGranizado;
