import React, { useEffect, useState, useCallback } from 'react';
import Icon from '../Icons';
import { reglasService } from '../../config/api';
import { useToast } from '../../context/ToastContext';

// ============================================================================
// EsperandoRepartidor — en el panel del súper admin (nov 2026): pedidos listos
// y mandados que ningún repartidor ha tomado. A los 10 minutos ya le suena al
// súper admin en el celular (vigilante_pedidos.py). Se refresca cada 30 s.
// ============================================================================

const EsperandoRepartidor = () => {
  const { addToast } = useToast();
  const [datos, setDatos] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(() => {
    reglasService.esperando().then(({ data }) => setDatos(data)).catch(() => {});
  }, []);
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 30000);
    return () => clearInterval(t);
  }, [cargar]);

  if (!datos || !datos.esperando.length) return null;

  const avisar = async () => {
    setEnviando(true);
    try {
      const { data } = await reglasService.avisarRepartidores();
      addToast(data.avisados ? `Les sonó a ${data.avisados} repartidores` : 'No hay repartidores con la app para avisar', data.avisados ? 'success' : 'error');
    } catch {
      addToast('No se pudo avisar', 'error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mb-4 rounded-2xl border-[1.5px] border-solid border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
      <b className="flex items-center gap-2 text-[15px] text-red-700 dark:text-red-300">
        <Icon name="alerta" size={18} />{datos.esperando.length} esperando repartidor
      </b>
      <div className="mt-2 flex flex-col gap-2">
        {datos.esperando.map(e => (
          <div key={e.id} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 dark:bg-noche-card">
            <div className="min-w-0 flex-1 text-[13.5px]">
              <b className="font-mono text-slate-800 dark:text-slate-100">{e.corto}</b>
              <span className="text-slate-600 dark:text-slate-300"> · {e.donde}</span>
              <span className="block truncate text-[12px] text-slate-500">{e.tipo === 'pedido' ? 'Listo' : 'Pedido'} hace {e.minutos} min{e.direccion ? ` · ${e.direccion}` : ''}</span>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-extrabold text-white ${e.minutos >= 10 ? 'bg-red-600' : 'bg-amber-500'}`}>{e.minutos} min</span>
          </div>
        ))}
      </div>
      <button type="button" disabled={enviando} onClick={avisar}
        className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-zippy p-3 font-[inherit] text-[14px] font-extrabold text-white disabled:opacity-60">
        <Icon name="notificaciones" size={17} />Volver a avisarles a los repartidores
      </button>
      <p className="m-0 mt-2 text-center text-[12px] text-slate-500">{datos.repartidores_con_app} repartidores con la app</p>
    </div>
  );
};

export default EsperandoRepartidor;
