import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import Icon from '../components/Icons';
import { ordenesService } from '../config/api';
import { useToast } from '../context/ToastContext';
import { fechaHoraCorta } from '../utils/fechas';

// ============================================================================
// TransferenciasPage — Súper admin: ¿sí llegó la plata? (nov 2026)
//
// Cada pedido pagado con "Transferencia con QR" queda aquí cuando el
// repartidor dice que el cliente le mostró el pago. Un súper admin revisa el
// banco de ZIPPYGO y marca Llegó / No llegó. Si no llegó, el cliente queda
// reportado (con 2 reportes se suspende) y le llega un aviso.
// ============================================================================

const fmt = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;

const TransferenciasPage = () => {
  const { addToast } = useToast();
  const [datos, setDatos] = useState(null);
  const [ocupado, setOcupado] = useState(null);

  const cargar = useCallback(() => {
    ordenesService.transferencias()
      .then(({ data }) => setDatos(data))
      .catch(() => { setDatos(d => d || { por_verificar: [], revisadas: [] }); addToast('No se pudieron cargar las transferencias', 'error'); });
  }, [addToast]);

  useEffect(() => { cargar(); }, [cargar]);

  const revisar = async (t, llego) => {
    if (!llego && !window.confirm(`¿Seguro que no llegó la transferencia de ${fmt(t.total)}? El cliente queda reportado.`)) return;
    setOcupado(t.id);
    try {
      const { data } = await ordenesService.revisarTransferencia(t.id, llego);
      addToast(llego ? 'Marcada como recibida' : (data.cliente_suspendido ? 'Cliente reportado y suspendido' : 'Cliente reportado'), llego ? 'success' : 'error');
      cargar();
    } catch (e) {
      addToast(e?.response?.data?.detail || 'No se pudo guardar', 'error');
      cargar();
    } finally {
      setOcupado(null);
    }
  };

  const tarjeta = 'rounded-2xl bg-white p-3.5 shadow-[0_2px_10px_rgba(0,0,0,0.06)] dark:bg-noche-card';
  const etiqueta = 'm-0 mb-2 mt-4 text-[11px] font-extrabold uppercase tracking-[0.6px] text-slate-400';

  return (
    <Layout>
      <div className="mx-auto max-w-[720px]">
        <h1 className="m-0 flex items-center gap-2 text-[22px] font-extrabold text-slate-800 dark:text-slate-100"><Icon name="qr" size={24} />Transferencias</h1>
        <p className="m-0 mt-0.5 text-[13px] text-slate-500">Revisa en el banco de ZIPPYGO y marca cada una. Si una no llegó, el cliente queda reportado.</p>

        {!datos ? (
          <p className="mt-6 text-center text-[13px] text-slate-500">Cargando…</p>
        ) : (
          <>
            <p className={etiqueta}>Por verificar · {datos.por_verificar.length}</p>
            {datos.por_verificar.length === 0 && (
              <div className={`${tarjeta} text-center text-[13.5px] text-slate-500`}>No hay transferencias pendientes de revisar.</div>
            )}
            <div className="flex flex-col gap-2.5">
              {datos.por_verificar.map(t => (
                <div key={t.id} className={tarjeta}>
                  <div className="flex items-baseline justify-between gap-2">
                    <b className="text-[14.5px] text-slate-800 dark:text-slate-100">#{t.corto} · {t.cliente}</b>
                    <b className="shrink-0 text-[16px] text-zippy">{fmt(t.total)}</b>
                  </div>
                  <p className="m-0 mt-0.5 text-[12.5px] text-slate-500">
                    {t.entregado ? fechaHoraCorta(t.entregado) : ''} · entregó {t.repartidor || '—'} · {t.negocio}
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <button type="button" disabled={ocupado === t.id} onClick={() => revisar(t, true)}
                      className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border-0 bg-emerald-500 py-2.5 font-[inherit] text-[13.5px] font-extrabold text-white disabled:opacity-50">
                      <Icon name="check" size={16} />Llegó
                    </button>
                    <button type="button" disabled={ocupado === t.id} onClick={() => revisar(t, false)}
                      className="flex-1 cursor-pointer rounded-xl border-[1.5px] border-solid border-red-200 bg-transparent py-2.5 font-[inherit] text-[13.5px] font-extrabold text-red-600 disabled:opacity-50">
                      No llegó
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {datos.revisadas.length > 0 && (
              <>
                <p className={etiqueta}>Revisadas (últimos 7 días)</p>
                <div className={`${tarjeta} py-1`}>
                  {datos.revisadas.map((t, i) => (
                    <div key={t.id} className={`flex items-center justify-between gap-2 py-2.5 text-[13.5px] ${i > 0 ? 'border-0 border-t border-solid border-slate-100 dark:border-noche-borde' : ''}`}>
                      <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">#{t.corto} · {t.cliente}</span>
                      <b className={`shrink-0 ${t.estado === 'llego' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {t.estado === 'llego' ? '✓ ' : '✕ '}{fmt(t.total)}
                      </b>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="mt-4 rounded-2xl border-[1.5px] border-solid border-blue-200 bg-blue-50 p-3 text-[12.5px] text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
              Al repartidor no le toca entregar esta plata: en su cierre de turno la transferencia sale aparte y ZIPPYGO le paga su parte.
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default TransferenciasPage;
