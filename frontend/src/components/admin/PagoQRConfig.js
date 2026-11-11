import React, { useState, useEffect } from 'react';
import { adminService } from '../../config/api';
import { useToast } from '../../context/ToastContext';
import { urlImagen } from '../../utils/media';
import BotonesFoto from '../BotonesFoto';

// ============================================================================
// PagoQRConfig — Configuración → Pagos (nov 2026). La cuenta de ZIPPYGO con
// la que los clientes pagan por transferencia: imagen del QR, titular, banco
// y llave, y el interruptor para encender o apagar el cobro con QR.
// ============================================================================

const campo = 'box-border w-full rounded-[10px] border-[1.5px] border-solid border-slate-200 bg-white px-3 py-2.5 font-[inherit] text-[14px] text-slate-800 outline-none focus:border-zippy dark:border-noche-borde dark:bg-noche-alt dark:text-slate-100';
const etiqueta = 'mb-1.5 mt-3.5 block text-[11px] font-extrabold uppercase tracking-[0.6px] text-slate-400';

const PagoQRConfig = () => {
  const { addToast } = useToast();
  const [datos, setDatos] = useState(null);
  const [form, setForm] = useState({ titular: '', banco: '', llave: '' });
  const [ocupado, setOcupado] = useState(false);

  const aplicar = (d) => { setDatos(d); setForm({ titular: d.titular || '', banco: d.banco || '', llave: d.llave || '' }); };

  useEffect(() => {
    adminService.pagoQR().then(({ data }) => aplicar(data)).catch(() => addToast('No se pudo cargar la cuenta de pagos', 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hacer = async (fn, ok) => {
    setOcupado(true);
    try {
      const { data } = await fn();
      aplicar(data);
      if (ok) addToast(ok, 'success');
    } catch (e) {
      addToast(e?.response?.data?.detail || 'No se pudo guardar', 'error');
    } finally {
      setOcupado(false);
    }
  };

  if (!datos) return <div className="cfg-card"><p className="cfg-notif-desc">Cargando…</p></div>;
  const cambios = form.titular !== (datos.titular || '') || form.banco !== (datos.banco || '') || form.llave !== (datos.llave || '');

  return (
    <div className="cfg-sections">
      <div className="cfg-card">
        <div className="flex items-center justify-between gap-3">
          <div className="cfg-card-title" style={{ margin: 0 }}>Transferencia con QR</div>
          <button
            type="button"
            role="switch"
            aria-checked={datos.activo}
            disabled={ocupado || !datos.qr}
            onClick={() => hacer(() => adminService.guardarPagoQR({ activo: !datos.activo }), datos.activo ? 'Pago con QR apagado' : 'Pago con QR encendido')}
            className={`relative h-[26px] w-[46px] shrink-0 cursor-pointer rounded-full border-0 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${datos.activo ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
            aria-label="Encender o apagar el pago con QR"
          >
            <span className={`absolute top-[3px] h-5 w-5 rounded-full bg-white transition-all ${datos.activo ? 'left-[23px]' : 'left-[3px]'}`} />
          </button>
        </div>
        <p className="cfg-notif-desc" style={{ marginTop: 8 }}>
          {datos.activo
            ? 'Encendido: los clientes pueden escoger pagar con transferencia. El repartidor les muestra este QR al entregar.'
            : datos.qr ? 'Apagado: los clientes solo ven efectivo.' : 'Sube el QR de la cuenta de ZIPPYGO para poder encenderlo.'}
        </p>

        <span className={etiqueta}>QR de la cuenta</span>
        {datos.qr && (
          <div className="flex items-center gap-3">
            <img src={urlImagen(datos.qr)} alt="QR de ZIPPYGO" className="block h-28 w-28 rounded-xl border-[1.5px] border-solid border-slate-200 bg-white object-contain dark:border-noche-borde" />
            <button
              type="button"
              disabled={ocupado}
              onClick={() => { if (window.confirm('¿Quitar el QR? El pago con transferencia se apaga.')) hacer(() => adminService.quitarImagenQR(), 'QR quitado'); }}
              className="cursor-pointer rounded-xl border-[1.5px] border-solid border-red-200 bg-transparent px-3.5 py-2 font-[inherit] text-[13px] font-bold text-red-600"
            >
              Quitar
            </button>
          </div>
        )}
        <BotonesFoto hayFoto={!!datos.qr} onArchivo={(archivo) => hacer(() => adminService.subirImagenQR(archivo), 'QR guardado')} />
        <p className="cfg-notif-desc" style={{ marginTop: 6 }}>Lo sacas de la app del banco de la empresa (sale como "Mi QR" o "Cobrar con QR"). Pantallazo y lo subes.</p>

        <span className={etiqueta}>A nombre de</span>
        <input className={campo} value={form.titular} onChange={e => setForm(f => ({ ...f, titular: e.target.value }))} placeholder="ZIPPYgo SAS" maxLength={120} />
        <span className={etiqueta}>Banco</span>
        <input className={campo} value={form.banco} onChange={e => setForm(f => ({ ...f, banco: e.target.value }))} placeholder="Ej: Bancolombia" maxLength={120} />
        <span className={etiqueta}>Llave Bre-B (para el que no pueda escanear)</span>
        <input className={campo} value={form.llave} onChange={e => setForm(f => ({ ...f, llave: e.target.value }))} placeholder="Ej: @zippygo o el NIT" maxLength={120} />

        {cambios && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => hacer(() => adminService.guardarPagoQR(form), 'Datos guardados')}
            className="mt-4 w-full cursor-pointer rounded-xl border-0 bg-zippy px-4 py-3 font-[inherit] text-[14px] font-extrabold text-white disabled:opacity-60"
          >
            Guardar cambios
          </button>
        )}
      </div>
    </div>
  );
};

export default PagoQRConfig;
