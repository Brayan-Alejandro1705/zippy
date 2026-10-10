import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import VendorLayout from '../../components/VendorLayout';
import { ordenesService, negociosService, productosService, usuariosService } from '../../config/api';
import ZLoader from '../../components/ZLoader';
import Icon from '../../components/Icons';
import OrdenDetalleModal from '../../components/vendor/OrdenDetalle';
import { fechaCorta, fechaServidor } from '../../utils/fechas';
import { cx, titulo, subtitulo, tarjeta, chip, chipsFila, badge, badgeBase } from '../../ui/tw';

const ESTADO_UI = {
  pendiente:           'Pendiente',
  confirmada:           'Pendiente',
  en_preparacion:       'Pendiente',
  lista_para_retirar:   'Pendiente',
  en_domicilio:         'En camino',
  entregada:            'Completada',
  cancelada:            'Cancelada',
};

const ENTREGA_UI = {
  pendiente:           'Pendiente',
  confirmada:           'Pendiente',
  en_preparacion:       'Pendiente',
  lista_para_retirar:   'Pendiente',
  en_domicilio:         'En camino',
  entregada:            'Entregado',
  cancelada:            'No entregado',
};

const ESTADO_BADGE = {
  Completada:  badge.entregada,
  'En camino': badge.camino,
  Pendiente:   badge.pendiente,
  Cancelada:   badge.cancelada,
};

const PERIODOS = [
  { value: 'semana', label: 'Últimos 7 días' },
  { value: 'mes',    label: 'Este mes' },
  { value: 'año',    label: 'Este año' },
];

const DIA_CORTO  = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const DIA_LARGO  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// En pesos colombianos abreviar a K/M pierde toda la precision: $1.428 se
// volvia "$1K". Se muestra la cifra completa con separador de miles.
const fmt = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;
const fmtFull = fmt;
const fmtFecha = fechaCorta;
const capitalizar = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

const Dato = ({ icono, color, valor, etiqueta }) => (
  // En 320 px el icono va arriba y la cifra usa todo el ancho de la tarjeta
  <div className={cx(tarjeta, 'flex min-w-0 flex-col items-start gap-2 p-3.5 xs:flex-row xs:items-center xs:gap-3')}>
    <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl xs:h-10 xs:w-10', color)}>
      <Icon name={icono} size={20} />
    </span>
    <div className="min-w-0">
      {/* text-base en 320 px y mas grande desde 360: "$1.250.000" cabe sin partirse */}
      <p className="m-0 truncate text-base font-bold text-slate-800 dark:text-slate-100 xs:text-lg">{valor}</p>
      <p className="m-0 text-xs leading-tight text-slate-500 dark:text-slate-400">{etiqueta}</p>
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-lg">
      <p className="m-0">{label}</p>
      <p className="m-0 font-bold">{fmtFull(payload[0].value)}</p>
    </div>
  );
};

const VendorVentasPage = () => {
  const [periodo, setPeriodo]     = useState('semana');
  const [estadoFiltro, setEstado] = useState('Todos');
  const [detalle, setDetalle]     = useState(null);

  const [loading, setLoading]   = useState(true);
  const [ordenes, setOrdenes]   = useState([]);
  const [negocio, setNegocio]   = useState(null);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const { data: negocioData } = await negociosService.miNegocio();
        const [{ data: ordenesRaw }, { data: productos }] = await Promise.all([
          ordenesService.listar(),
          productosService.listar(negocioData.id, { limit: 100 }),
        ]);

        const productosMap = Object.fromEntries(productos.map(p => [p.id, p.nombre]));

        const clienteIds = [...new Set(ordenesRaw.map(o => o.cliente_id))];
        const clientesPairs = await Promise.all(
          clienteIds.map(id => usuariosService.obtener(id).then(({ data }) => [id, data]).catch(() => [id, null]))
        );
        const clientesMap = Object.fromEntries(clientesPairs);

        const mapeadas = ordenesRaw.map(o => ({
          id: `#${o.id.slice(0, 8)}`,
          cliente: clientesMap[o.cliente_id]?.nombre || 'Cliente',
          clienteTelefono: clientesMap[o.cliente_id]?.telefono,
          negocio: negocioData.nombre_negocio,
          dir: o.direccion_entrega,
          productos: o.items.map(it => `${productosMap[it.producto_id] || 'Producto'} (x${it.cantidad})`).join(', '),
          subtotal: Number(o.subtotal),
          impuesto: Number(o.impuesto),
          total: Number(o.total),
          estado: ESTADO_UI[o.estado] || 'Pendiente',
          estadoReal: o.estado,
          domiciliarioId: o.domiciliario_id,
          codigoRecogida: o.codigo_recogida || null,
          entrega: ENTREGA_UI[o.estado] || 'Pendiente',
          pago: capitalizar(o.metodo_pago),
          fecha: fmtFecha(o.fecha_creacion),
          fechaRaw: o.fecha_creacion,
          minutos: null,
          items: o.items.map(it => ({
            nombre: productosMap[it.producto_id] || 'Producto',
            precio: Number(it.subtotal),
            qty: it.cantidad,
          })),
        }));

        // Últimos 7 días, sumando ventas completadas por día
        const hoy = new Date();
        const dias = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(hoy);
          d.setDate(hoy.getDate() - i);
          dias.push(d);
        }
        const chart = dias.map(d => {
          const ventasDia = mapeadas
            .filter(o => o.estado === 'Completada' && fechaServidor(o.fechaRaw)?.toDateString() === d.toDateString())
            .reduce((s, o) => s + o.subtotal, 0);
          return { dia: DIA_CORTO[d.getDay()], diaLargo: DIA_LARGO[d.getDay()], ventas: ventasDia };
        });

        if (activo) {
          setOrdenes(mapeadas);
          setNegocio(negocioData);
          setChartData(chart);
        }
      } catch {
        if (activo) { setOrdenes([]); setChartData([]); }
      } finally {
        if (activo) setLoading(false);
      }
    })();
    return () => { activo = false; };
  }, []);

  // El periodo filtra la lista (antes los botones Semana/Mes/Año no hacian nada)
  const desde = new Date();
  if (periodo === 'semana') { desde.setDate(desde.getDate() - 6); }
  else if (periodo === 'mes') { desde.setDate(1); }
  else { desde.setMonth(0, 1); }
  desde.setHours(0, 0, 0, 0);
  const enPeriodo = ordenes.filter(o => (fechaServidor(o.fechaRaw)?.getTime() || 0) >= desde.getTime());
  const filtradas = estadoFiltro === 'Todos'
    ? enPeriodo
    : enPeriodo.filter(o => o.estado === estadoFiltro);

  const completadas = ordenes.filter(o => o.estado === 'Completada');

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const completadasEsteMes = completadas.filter(o => (fechaServidor(o.fechaRaw)?.getTime() || 0) >= inicioMes.getTime());
  const ingresosEsteMes = completadasEsteMes.reduce((s, o) => s + o.subtotal, 0);
  const porOrden = completadasEsteMes.length > 0 ? ingresosEsteMes / completadasEsteMes.length : 0;

  const mejorDia = chartData.reduce((mejor, d) => (!mejor || d.ventas > mejor.ventas) ? d : mejor, null);
  const promedioDiario = chartData.length ? chartData.reduce((s, d) => s + d.ventas, 0) / chartData.length : 0;

  return (
    <VendorLayout searchPlaceholder="Buscar orden...">
      <h1 className={titulo}>Mi Tienda</h1>
      <p className={cx(subtitulo, 'mb-4')}>Resumen de tus ventas</p>

      {/* 2 columnas en celular, 4 en PC */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 xs:gap-3 md:grid-cols-4">
        <Dato icono="dinero"  color="bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300" valor={fmt(ingresosEsteMes)} etiqueta="Vendido este mes" />
        <Dato icono="check"   color="bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" valor={completadas.length} etiqueta="Completadas" />
        <Dato icono="paquete" color="bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" valor={fmt(porOrden)} etiqueta="Promedio por pedido" />
        <Dato icono="estrella" color="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" valor={negocio ? Number(negocio.calificacion_promedio || 0).toFixed(1) : '—'} etiqueta="Calificación" />
      </div>

      {/* Periodo + estado */}
      <div className={cx(chipsFila, 'mb-2.5')}>
        {PERIODOS.map(p => (
          <button key={p.value} className={chip(periodo === p.value)} onClick={() => setPeriodo(p.value)}>{p.label}</button>
        ))}
      </div>
      <select
        className="mb-4 w-full rounded-lg border-[1.5px] border-solid border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 dark:border-noche-borde dark:bg-noche-alt dark:text-slate-200 sm:w-56"
        value={estadoFiltro}
        onChange={e => setEstado(e.target.value)}
        aria-label="Filtrar por estado"
      >
        {['Todos', 'Completada', 'En camino', 'Pendiente', 'Cancelada'].map(e => (
          <option key={e} value={e}>{e === 'Todos' ? 'Todos los estados' : e}</option>
        ))}
      </select>

      {loading ? (
        <div className="p-4"><ZLoader size="sm" label="Cargando órdenes..." /></div>
      ) : filtradas.length === 0 ? (
        <p className={cx(tarjeta, 'm-0 mb-5 p-5 text-center text-sm text-slate-500 dark:text-slate-400')}>
          No tienes órdenes{estadoFiltro !== 'Todos' ? ` en "${estadoFiltro}"` : ''} en este periodo.
        </p>
      ) : (
        <>
          {/* Celular: tarjetas. Una tabla de 9 columnas no cabe en 320-430 px. */}
          <div className="mb-3 flex flex-col gap-2.5 md:hidden">
            {filtradas.map(o => (
              <button
                key={o.id}
                className={cx(tarjeta, 'block w-full cursor-pointer border-0 p-3.5 text-left')}
                onClick={() => setDetalle(o)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="m-0 font-mono text-sm font-bold text-slate-800 dark:text-slate-100">{o.id}</p>
                    <p className="m-0 mt-0.5 truncate text-[13px] text-slate-600 dark:text-slate-300">{o.cliente}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-base font-bold text-slate-800 dark:text-slate-100">{fmtFull(o.total)}</span>
                    <span className={cx(badgeBase, ESTADO_BADGE[o.estado])}>{o.estado}</span>
                  </div>
                </div>
                <p className="m-0 mt-2 line-clamp-2 text-[13px] text-slate-500 dark:text-slate-400">{o.productos}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                  <span>{o.fecha} · {o.pago}</span>
                  <span className="font-semibold text-zippy">Ver detalles →</span>
                </div>
              </button>
            ))}
          </div>

          {/* PC: tabla completa */}
          <div className={cx(tarjeta, 'mb-3 hidden overflow-x-auto md:block')}>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#4c1d95] text-left text-xs uppercase tracking-wide text-white">
                  {['Orden', 'Cliente', 'Productos', 'Total', 'Estado', 'Fecha', 'Entrega', 'Pago', ''].map(h => (
                    <th key={h} className="whitespace-nowrap px-3 py-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map(o => (
                  <tr key={o.id} className="border-0 border-b border-solid border-slate-100 align-top text-slate-600 dark:border-noche-borde dark:text-slate-300">
                    <td className="px-3 py-3">
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{o.id}</span>
                      <span className="mt-0.5 block max-w-[180px] text-[11px] text-slate-400">{o.dir}</span>
                    </td>
                    <td className="px-3 py-3">{o.cliente}</td>
                    <td className="max-w-[240px] px-3 py-3">{o.productos}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-800 dark:text-slate-100">{fmtFull(o.total)}</td>
                    <td className="px-3 py-3"><span className={cx(badgeBase, ESTADO_BADGE[o.estado])}>{o.estado}</span></td>
                    <td className="whitespace-nowrap px-3 py-3">{o.fecha}</td>
                    <td className="px-3 py-3">{o.entrega}</td>
                    <td className="px-3 py-3">{o.pago}</td>
                    <td className="px-3 py-3">
                      <button className="cursor-pointer whitespace-nowrap border-0 bg-transparent p-0 text-[13px] font-semibold text-zippy" onClick={() => setDetalle(o)}>
                        Ver detalles →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="m-0 mb-5 text-center text-xs text-slate-400">Mostrando {filtradas.length} de {ordenes.length} órdenes</p>
        </>
      )}

      <div className={cx(tarjeta, 'p-4 xs:p-5')}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="m-0 text-base font-bold text-slate-800 dark:text-slate-100">Ventas de los últimos 7 días</h3>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
            <span>Promedio diario: <strong className="text-slate-700 dark:text-slate-200">{fmt(promedioDiario)}</strong></span>
            <span>Mejor día: <strong className="text-slate-700 dark:text-slate-200">{mejorDia && mejorDia.ventas > 0 ? mejorDia.diaLargo : '—'}</strong></span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
            <XAxis dataKey="dia" axisLine={false} tickLine={false} tick={{ fill: '#999', fontSize: 13 }} />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
            <Bar dataKey="ventas" radius={[6, 6, 0, 0]} maxBarSize={36}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={mejorDia && entry.ventas === mejorDia.ventas && entry.ventas > 0 ? '#7c3aed' : '#FF7A00'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <OrdenDetalleModal orden={detalle} onClose={() => setDetalle(null)} />
    </VendorLayout>
  );
};

export default VendorVentasPage;
