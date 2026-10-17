import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import Icon from '../components/Icons';
import ZLoader from '../components/ZLoader';
import { useToast } from '../context/ToastContext';
import { adminService } from '../config/api';
import { hora, fechaCorta, fechaHoraLarga } from '../utils/fechas';
import { exportarCSV, avisoExportacion } from '../utils/exportarCSV';
import { cx } from '../ui/tw';

// ============================================================================
// RepartidorDomiciliosPage — Súper admin → Repartidores → "Ver domicilios"
// (oct 2026).
//
// Lo que hizo un repartidor hoy, esta semana o este mes: cuántos entregó,
// cuánto cobró de domicilios y cuánto efectivo recibió en la puerta (para
// cuadrar cuentas con él), y cada pedido con sus horas. Marca en amarillo los
// pedidos que se marcaron recogidos y entregados casi al tiempo: en los
// pedidos reales pasaba (3 y 12 segundos) y así el cliente no ve por dónde va.
//
// "Descargar Excel" baja lo mismo que se ve, para guardarlo o mandarlo.
// ============================================================================

const PERIODOS = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
];

const ESTADO = {
  entregada: ['Entregado', 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'],
  en_domicilio: ['En camino', 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'],
  lista_para_retirar: ['Por recoger', 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300'],
  cancelada: ['Cancelado', 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300'],
};

// Menos que esto entre "recogido" y "entregado" no es un viaje real
const SEGUNDOS_SOSPECHOSOS = 60;

const plata = n => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;
const VEHICULO = { moto: 'Moto', bicicleta: 'Bicicleta', carro: 'Carro' };
const PAGO = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', nequi: 'Nequi', transferencia: 'Transferencia' };

const RepartidorDomiciliosPage = () => {
  const { id } = useParams();
  const { addToast } = useToast();
  const [periodo, setPeriodo] = useState('hoy');
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await adminService.domiciliosRepartidor(id, periodo);
      setDatos(data);
    } catch (e) {
      addToast(e?.response?.data?.detail || 'No se pudieron cargar los domicilios', 'error');
      setDatos(null);
    } finally {
      setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, periodo]);

  useEffect(() => { cargar(); }, [cargar]);

  const nombre = datos?.repartidor?.nombre || 'Repartidor';
  const r = datos?.resumen || {};
  const pedidos = datos?.pedidos || [];

  const descargar = async () => {
    if (!pedidos.length) { addToast('No hay domicilios en este periodo', 'info'); return; }
    const filas = pedidos.map(p => [
      fechaCorta(p.creado), `#${p.corto}`, (ESTADO[p.estado] || [p.estado])[0], p.negocio, p.cliente,
      p.direccion, PAGO[p.metodo_pago] || p.metodo_pago, Math.round(p.total), Math.round(p.costo_domicilio),
      p.estado === 'entregada' && p.metodo_pago === 'efectivo' ? Math.round(p.total) : 0,
      hora(p.listo), hora(p.recogido), hora(p.entregado),
      p.segundos_recogido_entregado != null ? p.segundos_recogido_entregado : '',
    ]);
    filas.push([]);
    filas.push(['TOTAL', '', `${r.entregados || 0} entregados`, '', '', '', '', '', Math.round(r.domicilios_cobrados || 0), Math.round(r.efectivo_recibido || 0)]);
    try {
      const resultado = await exportarCSV(
        `domicilios_${nombre.split(' ')[0].toLowerCase()}_${periodo}`,
        ['Fecha', 'Pedido', 'Estado', 'Negocio', 'Cliente', 'Dirección', 'Pago', 'Total', 'Domicilio',
          'Efectivo recibido', 'Listo', 'Recogido', 'Entregado', 'Segundos entre recogido y entregado'],
        filas,
      );
      const aviso = avisoExportacion[resultado];
      if (aviso) addToast(aviso[0], aviso[1]);
    } catch (e) {
      addToast('No se pudo crear el Excel', 'error');
    }
  };

  const tarjeta = 'rounded-[14px] bg-white p-3.5 shadow-[0_1px_6px_rgba(0,0,0,0.06)] dark:bg-noche-card';

  return (
    <Layout>
      <Link to="/repartidores" className="mb-2 inline-flex items-center gap-1 text-[13px] font-bold text-zippy no-underline">← Repartidores</Link>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="m-0 text-[22px] font-extrabold text-slate-800 dark:text-slate-100">Domicilios de {nombre}</h1>
          <p className="m-0 mt-0.5 text-[13px] text-slate-500">
            {[datos?.repartidor?.telefono, VEHICULO[datos?.repartidor?.vehiculo] || datos?.repartidor?.vehiculo].filter(Boolean).join(' · ') || ' '}
          </p>
        </div>
        <button
          type="button"
          onClick={descargar}
          disabled={cargando}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl border-[1.5px] border-solid border-emerald-600 bg-transparent px-3.5 py-2.5 font-[inherit] text-[13.5px] font-extrabold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
        >
          <Icon name="descargar" size={17} /> Descargar Excel
        </button>
      </div>

      <div className="mb-3.5 flex gap-2">
        {PERIODOS.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriodo(p.id)}
            className={cx(
              'cursor-pointer rounded-full border border-solid px-4 py-2 font-[inherit] text-[13px] font-extrabold',
              periodo === p.id
                ? 'border-zippy bg-zippy text-white'
                : 'border-slate-200 bg-white text-slate-600 dark:border-noche-borde dark:bg-noche-card dark:text-slate-300'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {cargando ? (
        <ZLoader size="sm" label="Cargando domicilios..." />
      ) : (
        <>
          <div className="mb-3.5 grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {[
              [r.entregados || 0, 'Entregados'],
              [r.en_curso || 0, 'En curso ahora'],
              [plata(r.domicilios_cobrados), 'Domicilios cobrados'],
              [plata(r.efectivo_recibido), 'Efectivo que recibió'],
            ].map(([valor, etiqueta]) => (
              <div key={etiqueta} className={tarjeta}>
                <b className="block text-xl font-black text-slate-800 dark:text-slate-100">{valor}</b>
                <span className="text-[12px] text-slate-500">{etiqueta}</span>
              </div>
            ))}
          </div>

          {pedidos.length === 0 ? (
            <div className={cx(tarjeta, 'py-8 text-center text-sm text-slate-500')}>No tiene domicilios en este periodo.</div>
          ) : (
            <div className="flex max-w-[720px] flex-col gap-2.5">
              {pedidos.map(p => {
                const [txtEstado, clsEstado] = ESTADO[p.estado] || [p.estado, 'bg-slate-100 text-slate-600'];
                const sospechoso = p.estado === 'entregada' && p.segundos_recogido_entregado != null
                  && p.segundos_recogido_entregado < SEGUNDOS_SOSPECHOSOS;
                return (
                  <div key={p.id} className={tarjeta}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <b className="text-[14px] text-slate-800 dark:text-slate-100">#{p.corto} · {p.negocio}</b>
                        <p className="m-0 mt-0.5 text-[12.5px] text-slate-500">
                          Para {p.cliente || 'cliente'} · {p.direccion} · {PAGO[p.metodo_pago] || p.metodo_pago}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <b className="block text-[14px] text-slate-800 dark:text-slate-100">{plata(p.total)}</b>
                        <span className={cx('mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-extrabold', clsEstado)}>{txtEstado}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px] text-slate-600 dark:text-slate-300">
                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 dark:bg-noche-alt">{fechaCorta(p.creado)}</span>
                      {p.listo && <span className="rounded-lg bg-slate-100 px-2 py-0.5 dark:bg-noche-alt">Listo {hora(p.listo)}</span>}
                      {p.recogido && <span className="rounded-lg bg-slate-100 px-2 py-0.5 dark:bg-noche-alt">Recogió {hora(p.recogido)}</span>}
                      {p.entregado && <span className="rounded-lg bg-slate-100 px-2 py-0.5 dark:bg-noche-alt">Entregó {hora(p.entregado)}</span>}
                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 dark:bg-noche-alt">Domicilio {plata(p.costo_domicilio)}</span>
                    </div>
                    {sospechoso && (
                      <p className="m-0 mt-2 rounded-lg bg-amber-100 px-2.5 py-1.5 text-[12px] font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" title={fechaHoraLarga(p.recogido)}>
                        Recogido y entregado en {p.segundos_recogido_entregado} segundos
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </Layout>
  );
};

export default RepartidorDomiciliosPage;
