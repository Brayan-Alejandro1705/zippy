import React, { useState } from 'react';
import Icon from '../Icons';
import { negociosService } from '../../config/api';
import { useToast } from '../../context/ToastContext';
import { cx } from '../../ui/tw';

// ============================================================================
// CerrarHoy — "Hoy no abro" sin tocar el horario (nov 2026). La tienda sale
// cerrada hasta la medianoche (hora Colombia) y mañana abre sola.
// ============================================================================

const hoyColombia = () => {
  const ahora = new Date();
  return new Date(ahora.getTime() + ahora.getTimezoneOffset() * 60000 - 5 * 3600000).toISOString().slice(0, 10);
};

const CerrarHoy = ({ negocio, onCambio }) => {
  const { addToast } = useToast();
  const [enviando, setEnviando] = useState(false);
  if (!negocio) return null;
  const cerrado = !!negocio.cerrado_hasta && String(negocio.cerrado_hasta).slice(0, 10) >= hoyColombia();

  const cambiar = async () => {
    if (!cerrado && !window.confirm('¿Cerrar la tienda por hoy? Los clientes la ven cerrada y mañana abre sola con tu horario.')) return;
    setEnviando(true);
    try {
      const { data } = await negociosService.cerrarHoy(!cerrado);
      onCambio?.(data);
      addToast(cerrado ? 'Tu tienda está abierta otra vez' : 'Tienda cerrada por hoy. Mañana abre sola.', 'success');
    } catch (e) {
      addToast(e?.response?.data?.detail || 'No se pudo cambiar', 'error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className={cx('mb-4 rounded-2xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)]', cerrado ? 'bg-red-50 dark:bg-red-500/10' : 'bg-white dark:bg-noche-card')}>
      <div className="flex items-center gap-3">
        <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', cerrado ? 'bg-red-100 text-red-600 dark:bg-red-500/20' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15')}>
          <Icon name={cerrado ? 'candado' : 'check'} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <b className="block text-[15px] text-slate-800 dark:text-slate-100">{cerrado ? 'Cerrado por hoy' : 'Tu tienda está recibiendo pedidos'}</b>
          <span className="block text-[12.5px] leading-snug text-slate-500">
            {cerrado ? 'Los clientes la ven cerrada. Mañana abre sola con tu horario normal.' : '¿Hoy no abres? Ciérrala solo por hoy.'}
          </span>
        </div>
      </div>
      <button type="button" disabled={enviando} onClick={cambiar}
        className={cx('mt-3 w-full cursor-pointer rounded-xl border-0 p-3 font-[inherit] text-[14.5px] font-extrabold text-white disabled:opacity-60', cerrado ? 'bg-emerald-500' : 'bg-red-500')}>
        {cerrado ? 'Abrir de nuevo' : 'Cerrar por hoy'}
      </button>
    </div>
  );
};

export default CerrarHoy;
