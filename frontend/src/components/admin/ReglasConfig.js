import React, { useEffect, useState } from 'react';
import { reglasService } from '../../config/api';
import { useToast } from '../../context/ToastContext';
import { cx } from '../../ui/tw';

// ============================================================================
// ReglasConfig — Súper admin → Configuración → Reglas (nov 2026).
// "Invita a un amigo" y exigir ubicación y horario a los negocios.
// ============================================================================

const Interruptor = ({ on, onClick, etiqueta }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={etiqueta} onClick={onClick}
    className={cx('relative h-8 w-14 shrink-0 cursor-pointer rounded-full border-0 transition-colors', on ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600')}>
    <span className={cx('absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all', on ? 'left-7' : 'left-1')} />
  </button>
);

const NOMBRE_FALTA = { ubicacion: 'ubicación', horario: 'horario o días' };

const ReglasConfig = () => {
  const { addToast } = useToast();
  const [datos, setDatos] = useState(null);

  const cargar = () => reglasService.ver().then(({ data }) => setDatos(data)).catch(() => addToast('No se pudieron cargar las reglas', 'error'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, []);

  const cambiar = async (clave, texto) => {
    const nuevo = !datos[clave];
    if (!window.confirm(texto(nuevo))) return;
    try {
      await reglasService.cambiar({ [clave]: nuevo });
      addToast(nuevo ? 'Encendido' : 'Apagado', 'success');
      cargar();
    } catch {
      addToast('No se pudo cambiar', 'error');
    }
  };

  if (!datos) return <p className="text-sm text-slate-500">Cargando…</p>;
  const tarjeta = 'rounded-2xl border border-solid border-slate-100 bg-white p-4 dark:border-noche-borde dark:bg-noche-card';

  return (
    <div className="flex flex-col gap-3.5">
      {/* "Invita a un amigo" quedó para después (nov 2026): el código está listo
          en routes_invitaciones.py y se enciende con la regla "invitaciones". */}
      <div className={tarjeta}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <b className="block text-[15px] text-slate-800 dark:text-slate-100">Exigir ubicación y horario a los negocios</b>
            <span className="text-[12.5px] leading-snug text-slate-500">Si está encendido, el negocio sin ubicación, horario o días sale cerrado para los clientes hasta que los complete. El negocio ve qué le falta.</span>
          </div>
          <Interruptor on={datos.exigir_datos_negocio} etiqueta="Exigir ubicación y horario"
            onClick={() => cambiar('exigir_datos_negocio', n => n
              ? `¿Exigir ubicación y horario? Hoy ${datos.negocios_incompletos.length} negocios quedarían cerrados hasta completarlos.`
              : '¿Dejar de exigir ubicación y horario?')} />
        </div>
        {datos.negocios_incompletos.length > 0 && (
          <div className="mt-2.5 border-0 border-t border-solid border-slate-100 pt-2 dark:border-noche-borde">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.5px] text-slate-400">Negocios incompletos ({datos.negocios_incompletos.length})</span>
            {datos.negocios_incompletos.map(n => (
              <div key={n.nombre} className="flex justify-between gap-2 py-1 text-[13px]">
                <span className="truncate text-slate-700 dark:text-slate-200">{n.nombre}</span>
                <span className="shrink-0 text-amber-700 dark:text-amber-300">Falta {n.faltan.map(f => NOMBRE_FALTA[f] || f).join(' y ')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReglasConfig;
