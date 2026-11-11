import React, { useState, useEffect } from 'react';
import Icon from './Icons';
import { ordenesService } from '../config/api';
import { urlImagen } from '../utils/media';
import { useCerrarConAtras } from '../utils/atras';

// ============================================================================
// CobroQR — el repartidor cobra un pedido de "Transferencia con QR" (nov 2026).
//
// Le muestra al cliente el QR de la cuenta de ZIPPYGO con el valor. Como la
// plata no le llega a él, no la puede revisar en su banco: el cliente le
// enseña el pago hecho en SU app del banco. Después un súper admin confirma
// en el banco de ZIPPYGO que sí llegó (pantalla Transferencias).
// ============================================================================

const fmt = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;

const CobroQR = ({ orden, onCerrar, onCobrado }) => {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(false);
  useCerrarConAtras(!!orden, onCerrar);

  useEffect(() => {
    if (!orden) return;
    let activo = true;
    setError(false);
    ordenesService.pagoQRInfo()
      .then(({ data }) => { if (activo) setInfo(data); })
      .catch(() => { if (activo) setError(true); });
    return () => { activo = false; };
  }, [orden]);

  if (!orden) return null;
  const corto = String(orden.idCompleto || '').slice(0, 8).toUpperCase();

  return (
    <div className="fixed inset-0 z-[700] flex flex-col bg-[#0f172a] text-white" role="dialog" aria-label="Cobrar con QR">
      <div className="flex shrink-0 items-center justify-between px-4 pb-1 pt-[calc(16px+env(safe-area-inset-top))]">
        <b className="text-[16px]">Cobrar pedido #{corto}</b>
        <button type="button" onClick={onCerrar} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-0 bg-white/15 text-white" aria-label="Cerrar">
          <Icon name="equis" size={18} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 text-center">
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-[12px] font-extrabold text-violet-700">
          <Icon name="qr" size={14} />Transferencia con QR
        </span>
        <p className="m-0 mt-3 text-[13px] text-slate-400">El cliente debe pagar</p>
        <p className="m-0 text-[40px] font-black leading-tight text-zippy">{fmt(orden.total)}</p>

        {error ? (
          <p className="mx-auto mt-6 max-w-[300px] text-[14px] text-slate-300">No pudimos cargar el QR. Revisa tu señal, o cóbrale en efectivo.</p>
        ) : !info ? (
          <p className="mt-6 text-[14px] text-slate-400">Cargando QR…</p>
        ) : !info.qr ? (
          <p className="mx-auto mt-6 max-w-[300px] text-[14px] text-slate-300">El pago con QR está apagado en este momento. Cóbrale en efectivo.</p>
        ) : (
          <>
            <div className="mx-auto mt-3 inline-block rounded-2xl bg-white p-3 shadow-[0_4px_18px_rgba(0,0,0,0.3)]">
              <img src={urlImagen(info.qr)} alt="QR de ZIPPYGO" className="block h-[min(64vw,260px)] w-[min(64vw,260px)] object-contain" />
            </div>
            <p className="m-0 mt-3 text-[13px] text-slate-300">
              Muéstrale este QR al cliente. La plata llega a<br />
              <b className="text-white">{[info.titular, info.banco].filter(Boolean).join(' · ') || 'ZIPPYGO'}{info.llave ? ` · llave ${info.llave}` : ''}</b>
            </p>
          </>
        )}

        <div className="mx-auto mt-4 max-w-[420px] rounded-xl border border-solid border-amber-400/40 bg-amber-400/10 p-3 text-left text-[12.5px] leading-snug text-amber-200">
          Pídele que te muestre en <b>su</b> app del banco el pago hecho, con el valor y la hora de ahora. No aceptes un pantallazo enviado por chat.
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2 px-4 pb-[calc(18px+env(safe-area-inset-bottom))] pt-2">
        <button
          type="button"
          disabled={!info?.qr}
          onClick={() => onCobrado('transferencia')}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-0 bg-emerald-500 p-[14px] font-[inherit] text-[15px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon name="check" size={18} />El cliente me mostró el pago
        </button>
        <button
          type="button"
          onClick={() => onCobrado('efectivo')}
          className="w-full cursor-pointer rounded-2xl border-[1.5px] border-solid border-slate-600 bg-transparent p-[13px] font-[inherit] text-[15px] font-extrabold text-slate-200"
        >
          Me pagó en efectivo
        </button>
      </div>
    </div>
  );
};

export default CobroQR;
