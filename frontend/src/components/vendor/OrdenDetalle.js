import React, { useState } from 'react';
import Icon from '../Icons';
import { cx, btn } from '../../ui/tw';
import { useToast } from '../../context/ToastContext';
import { facturaPDF } from '../../utils/facturaPDF';
import { entregarArchivo, avisoExportacion } from '../../utils/exportarCSV';
import { useCerrarConAtras } from '../../utils/atras';

// ============================================================================
// OrdenDetalle.js - Ventana con el detalle de un pedido para el negocio.
// La usan Mis Órdenes y Mi Tienda (ventas). Antes cada pagina tenia su propia
// copia casi igual; ahora es una sola y se ve bien en celulares pequenos.
//
// La orden que recibe necesita: id, items[{nombre, precio, qty}], total, dir,
// negocio, estadoReal, y opcionales cliente, clienteTelefono, fecha,
// subtotal, domiciliarioId, codigoRecogida.
// ============================================================================

const fmtFull = n => `$${Math.round(n).toLocaleString('es-CO')}`;

// Pasos que el vendedor controla antes de que un repartidor pueda tomar el pedido
export const VENDEDOR_NEXT = {
  pendiente:      { next: 'confirmada',         label: 'Confirmar pedido' },
  confirmada:     { next: 'en_preparacion',      label: 'Marcar en preparación' },
  en_preparacion: { next: 'lista_para_retirar',  label: 'Marcar listo para recoger' },
};


const STEPS = ['Recibido', 'Preparado', 'En camino', 'Entregado'];

// Paso del pedido segun el estado real del backend
const PASO = { pendiente: 0, confirmada: 0, en_preparacion: 0, lista_para_retirar: 1, en_domicilio: 2, entregada: 3, cancelada: 0 };

export const llamar = (tel) => { if (tel) window.location.href = `tel:${tel}`; };

// La factura sale como PDF: en el computador se descarga y en el celular se
// abre el menu de compartir. Antes abria una ventana para imprimir, que en la
// app quedaba en blanco. Devuelve como termino (ver entregarArchivo).
export const descargarFactura = async (orden) => {
  const { blob, nombre } = await facturaPDF(orden);
  return entregarArchivo(blob, nombre);
};

export const abrirMapa = (direccion) => {
  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`, '_blank');
};

const ConfirmarRecogidaBox = ({ orden, onConfirmar }) => {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const entregar = async () => {
    setEnviando(true);
    setError('');
    try {
      await onConfirmar(orden, orden.codigoRecogida || '');
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo confirmar la entrega al repartidor');
      setEnviando(false);
    }
  };

  return (
    <div className="mx-4 mb-4 flex flex-col gap-2 rounded-xl bg-slate-50 p-4 text-[13px] leading-snug text-slate-600 dark:bg-[#162032] dark:text-slate-400 sm:mx-5">
      <p className="m-0 flex items-start gap-2"><Icon name="moto" size={18} /> Un repartidor viene por este pedido. Debe decirte este código:</p>
      <p className="m-0 rounded-xl border-2 border-dashed border-amber-500 bg-amber-100 p-3 text-center text-[26px] font-extrabold tracking-[3px] text-amber-700 xs:text-[30px] dark:bg-amber-500/10 dark:text-amber-300">
        {orden.codigoRecogida || 'Sin código'}
      </p>
      <button className={cx(btn.principal, 'w-full')} disabled={enviando} onClick={entregar}>
        {enviando ? 'Confirmando…' : <><Icon name="check" size={16} /> Coincide, ya se lo entregué</>}
      </button>
      {error && <p className="m-0 font-semibold text-red-600">{error}</p>}
    </div>
  );
};

const AvisoDespacho = ({ children }) => (
  <div className="mx-4 mb-4 flex items-start gap-2 rounded-xl bg-slate-50 p-4 text-[13px] leading-snug text-slate-600 dark:bg-[#162032] dark:text-slate-400 sm:mx-5">
    <Icon name="moto" size={18} /> <span>{children}</span>
  </div>
);

const OrdenDetalleModal = ({ orden, onClose, onAvanzar, onConfirmarRecogida }) => {
  useCerrarConAtras(!!orden, onClose);
  const { addToast } = useToast();
  const [haciendoFactura, setHaciendoFactura] = useState(false);
  const factura = async () => {
    setHaciendoFactura(true);
    try {
      const aviso = avisoExportacion[await descargarFactura(orden)];
      if (aviso) addToast(aviso[0], aviso[1]);
    } catch {
      addToast('No se pudo generar la factura', 'error');
    } finally {
      setHaciendoFactura(false);
    }
  };
  if (!orden) return null;
  const current = PASO[orden.estadoReal] ?? 0;
  const siguientePaso = VENDEDOR_NEXT[orden.estadoReal];

  return (
    // En celular sale desde abajo (como una hoja) y ocupa el ancho completo;
    // en PC queda centrado. max-h + overflow para celulares bajitos.
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/50 sm:items-center sm:p-5" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl dark:bg-noche-card sm:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 bg-[#4c1d95] px-5 py-4">
          <div className="min-w-0">
            <h3 className="m-0 truncate text-[17px] font-bold text-white">Orden {orden.id}</h3>
            {orden.cliente && <p className="m-0 mt-0.5 truncate text-xs text-white/75">{orden.cliente}</p>}
          </div>
          <button
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-white/15 text-white hover:bg-white/25"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <Icon name="equis" size={16} />
          </button>
        </div>

        <div className="overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          {/* Pasos del pedido */}
          <div className="flex items-start px-4 py-5">
            {STEPS.map((s, i) => (
              <React.Fragment key={s}>
                <div className="flex w-14 shrink-0 flex-col items-center gap-1.5 xs:w-16">
                  <div
                    className={cx(
                      'h-3.5 w-3.5 rounded-full',
                      i === current ? 'bg-zippy ring-4 ring-zippy/20' : i < current ? 'bg-green-500' : 'bg-slate-200 dark:bg-noche-borde'
                    )}
                  />
                  <span className={cx('text-center text-[10.5px] font-medium leading-tight xs:text-[11px]', i <= current ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400')}>
                    {s}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cx('mt-1.5 h-0.5 flex-1', i < current ? 'bg-green-500' : 'bg-slate-200 dark:bg-noche-borde')} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Productos */}
          <div className="px-4 pb-4 sm:px-5">
            {orden.items.map((item, i) => (
              <div key={i} className="flex items-start justify-between gap-3 border-0 border-b border-solid border-slate-100 py-3 last:border-b-0 dark:border-noche-borde">
                <div className="min-w-0">
                  <p className="m-0 mb-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">{item.nombre}</p>
                  <p className="m-0 text-xs text-slate-400">Cantidad {item.qty} · ${(item.precio / item.qty).toLocaleString('es-CO')} c/u</p>
                </div>
                <span className="whitespace-nowrap text-sm font-bold text-slate-800 dark:text-slate-100">{fmtFull(item.precio)}</span>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between rounded-lg bg-zippy-50 px-4 py-3 text-sm font-semibold text-slate-600 dark:bg-[#1a2030] dark:text-slate-400">
              <span>Total</span>
              <span className="text-lg font-extrabold text-zippy">{fmtFull(orden.total)}</span>
            </div>
          </div>

          {/* Estado de despacho */}
          {orden.estadoReal === 'lista_para_retirar' && !orden.domiciliarioId && (
            <AvisoDespacho>Listo para recoger: esperando que un repartidor lo tome</AvisoDespacho>
          )}
          {orden.domiciliarioId && orden.estadoReal === 'en_domicilio' && (
            <AvisoDespacho>Un repartidor ya tomó este pedido y va en camino</AvisoDespacho>
          )}
          {orden.domiciliarioId && orden.estadoReal === 'lista_para_retirar' && onConfirmarRecogida && (
            <ConfirmarRecogidaBox orden={orden} onConfirmar={onConfirmarRecogida} />
          )}

          {/* Acciones: 3 columnas en PC, apiladas de a 2 + 1 en celular */}
          <div className="grid grid-cols-2 gap-2.5 border-0 border-t border-solid border-slate-100 px-4 py-4 dark:border-noche-borde sm:grid-cols-3 sm:px-5">
            <button className={btn.azul} onClick={() => abrirMapa(orden.dir)}><Icon name="mapa" size={15} /> Ver en mapa</button>
            <button className={btn.borde} disabled={!orden.clienteTelefono} onClick={() => llamar(orden.clienteTelefono)}>
              <Icon name="telefono" size={15} /> {orden.clienteTelefono ? 'Llamar' : 'Sin teléfono'}
            </button>
            <button className={cx(btn.borde, 'col-span-2 sm:col-span-1')} onClick={factura} disabled={haciendoFactura}>
              <Icon name="descargar" size={15} /> {haciendoFactura ? 'Generando…' : 'Factura'}
            </button>
            {siguientePaso && onAvanzar && (
              <button className={cx(btn.principal, 'col-span-2 sm:col-span-3')} onClick={() => onAvanzar(orden, siguientePaso.next)}>
                {siguientePaso.label} →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


export default OrdenDetalleModal;
