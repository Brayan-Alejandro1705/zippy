import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adicionalesService } from '../../config/api';
import { cx } from '../../ui/tw';

// ============================================================================
// ElegirAdicionales — en "Editar producto": qué adicionales de la lista del
// negocio salen en este producto (nov 2026). La lista se maneja en
// Mis productos → Adicionales (VendorAdicionalesPage).
// ============================================================================

const fmt = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;

const ElegirAdicionales = ({ seleccion, onCambio, categoria, aplicarCategoria, onAplicarCategoria }) => {
  const navigate = useNavigate();
  const [lista, setLista] = useState(null);

  useEffect(() => {
    adicionalesService.mios().then(({ data }) => setLista(data || [])).catch(() => setLista([]));
  }, []);

  if (lista === null) return null;

  const alternar = (id) => onCambio(seleccion.includes(id) ? seleccion.filter(x => x !== id) : [...seleccion, id]);

  return (
    <div className="vnp-field">
      <label>Adicionales de este producto <span className="vnp-optional">(opcional)</span></label>
      {lista.length === 0 ? (
        <p className="m-0 text-[13px] text-slate-500">
          Todavía no tienes adicionales (gomas, shot, extra queso…).{' '}
          <button type="button" onClick={() => navigate('/vendor/productos/adicionales')} className="cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-[13px] font-bold text-zippy">Crear mis adicionales</button>
        </p>
      ) : (
        <>
          <div className="rounded-xl border-[1.5px] border-solid border-slate-200 px-3 dark:border-noche-borde">
            {lista.map((a, i) => {
              const on = seleccion.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => alternar(a.id)}
                  className={cx('flex w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent py-2.5 text-left font-[inherit] text-[14px] text-slate-700 dark:text-slate-200',
                    i > 0 && 'border-t border-solid border-slate-100 dark:border-noche-borde')}
                  aria-pressed={on}
                >
                  <span className={cx('flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] border-2 border-solid', on ? 'border-zippy bg-zippy text-white' : 'border-slate-300 dark:border-slate-500')}>
                    {on && <span className="text-[13px] font-black leading-none">✓</span>}
                  </span>
                  <span className={cx('min-w-0 flex-1', !a.disponible && 'text-slate-400 line-through')}>{a.nombre}</span>
                  <span className="shrink-0 text-[13px] font-bold text-slate-500">{fmt(a.precio)}</span>
                </button>
              );
            })}
          </div>
          {categoria && (
            <label className="mt-2.5 flex cursor-pointer items-center gap-2.5 rounded-xl border-[1.5px] border-solid border-orange-200 bg-orange-50 p-2.5 text-[13px] font-bold text-orange-800 dark:border-zippy/30 dark:bg-zippy/10 dark:text-orange-300">
              <input type="checkbox" checked={aplicarCategoria} onChange={e => onAplicarCategoria(e.target.checked)} className="h-[18px] w-[18px] shrink-0 accent-[#FF7A00]" />
              Usar estos mismos adicionales en todos mis productos de "{categoria}"
            </label>
          )}
        </>
      )}
    </div>
  );
};

export default ElegirAdicionales;
