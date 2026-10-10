import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import VendorLayout from '../../components/VendorLayout';
import { ordenesService, negociosService, productosService } from '../../config/api';
import ZLoader from '../../components/ZLoader';
import { fechaServidor } from '../../utils/fechas';
import { cx, titulo, subtitulo, tarjeta, chip } from '../../ui/tw';

const DIA_ABR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const PALETTE = ['#FF7A00', '#7c3aed', '#10b981', '#3b82f6', '#ec4899', '#f59e0b'];
const DAY_MS = 86400000;

const fmtFull = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;

const pctChange = (curr, prev) => {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return Math.round(((curr - prev) / prev) * 100);
};

const enRango = (fechaIso, desde, hasta) => {
  // El servidor manda la hora universal sin la Z; fechaServidor la corrige a
  // hora de Colombia. Sin eso los cortes de periodo salian cinco horas antes.
  const t = fechaServidor(fechaIso)?.getTime();
  return t != null && t >= desde && t < hasta;
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-lg">
      <p className="m-0">{label}</p>
      <p className="m-0 font-bold">{fmtFull(payload[0].value)}</p>
    </div>
  );
};

const VendorReportesPage = () => {
  const [periodo, setPeriodo] = useState('semana');
  const [loading, setLoading] = useState(true);
  const [ordenesRaw, setOrdenesRaw] = useState([]);
  const [productosMap, setProductosMap] = useState({});

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const { data: negocio } = await negociosService.miNegocio();
        const [{ data: ordenes }, { data: productos }] = await Promise.all([
          ordenesService.listar(),
          productosService.listar(negocio.id, { limit: 100 }),
        ]);

        if (!activo) return;
        setOrdenesRaw(ordenes);
        setProductosMap(Object.fromEntries(productos.map(p => [p.id, { nombre: p.nombre, categoria: p.categoria || 'Otros' }])));
      } catch {
        if (activo) { setOrdenesRaw([]); setProductosMap({}); }
      } finally {
        if (activo) setLoading(false);
      }
    })();
    return () => { activo = false; };
  }, []);

  // ── KPIs y gráfica: dependen del período seleccionado ──────────────────────
  const ahora = Date.now();
  const rango = periodo === 'semana' ? 7 * DAY_MS : 30 * DAY_MS;
  const inicioActual   = ahora - rango;
  const inicioAnterior = ahora - 2 * rango;

  const ordenesActual   = ordenesRaw.filter(o => enRango(o.fecha_creacion, inicioActual, ahora + 1));
  const ordenesAnterior = ordenesRaw.filter(o => enRango(o.fecha_creacion, inicioAnterior, inicioActual));

  const completadasActual   = ordenesActual.filter(o => o.estado === 'entregada');
  const completadasAnterior = ordenesAnterior.filter(o => o.estado === 'entregada');

  const ingresosActual   = completadasActual.reduce((s, o) => s + Number(o.total), 0);
  const ingresosAnterior = completadasAnterior.reduce((s, o) => s + Number(o.total), 0);

  const ticketActual   = completadasActual.length   ? ingresosActual   / completadasActual.length   : 0;
  const ticketAnterior = completadasAnterior.length ? ingresosAnterior / completadasAnterior.length : 0;

  const tasaActual   = ordenesActual.length   ? (completadasActual.length   / ordenesActual.length)   * 100 : 0;
  const tasaAnterior = ordenesAnterior.length ? (completadasAnterior.length / ordenesAnterior.length) * 100 : 0;

  const kpis = [
    { label: 'Ingresos totales', val: fmtFull(ingresosActual), change: `${pctChange(ingresosActual, ingresosAnterior) >= 0 ? '+' : ''}${pctChange(ingresosActual, ingresosAnterior)}%`, up: ingresosActual >= ingresosAnterior },
    { label: 'Órdenes',          val: String(ordenesActual.length), change: `${ordenesActual.length - ordenesAnterior.length >= 0 ? '+' : ''}${ordenesActual.length - ordenesAnterior.length}`, up: ordenesActual.length >= ordenesAnterior.length },
    { label: 'Ticket promedio',  val: fmtFull(ticketActual), change: `${pctChange(ticketActual, ticketAnterior) >= 0 ? '+' : ''}${pctChange(ticketActual, ticketAnterior)}%`, up: ticketActual >= ticketAnterior },
    { label: 'Tasa completadas', val: `${Math.round(tasaActual)}%`, change: `${Math.round(tasaActual - tasaAnterior) >= 0 ? '+' : ''}${Math.round(tasaActual - tasaAnterior)}%`, up: tasaActual >= tasaAnterior },
  ];

  let chartData = [];
  if (periodo === 'semana') {
    const dias = [];
    for (let i = 6; i >= 0; i--) dias.push(new Date(ahora - i * DAY_MS));
    chartData = dias.map(d => ({
      dia: DIA_ABR[d.getDay()],
      ventas: ordenesRaw
        .filter(o => o.estado === 'entregada' && fechaServidor(o.fecha_creacion)?.toDateString() === d.toDateString())
        .reduce((s, o) => s + Number(o.total), 0),
    }));
  } else {
    chartData = [3, 2, 1, 0].map((semanasAtras, i) => {
      const hasta = ahora - semanasAtras * 7 * DAY_MS;
      const desde = hasta - 7 * DAY_MS;
      return {
        dia: `Sem ${i + 1}`,
        ventas: ordenesRaw
          .filter(o => o.estado === 'entregada' && enRango(o.fecha_creacion, desde, hasta))
          .reduce((s, o) => s + Number(o.total), 0),
      };
    });
  }
  const maxVal = chartData.length ? Math.max(...chartData.map(d => d.ventas)) : 0;

  // ── Top productos y categorías: histórico completo (no depende del período) ─
  const itemAgg = {};
  ordenesRaw.forEach(o => {
    if (o.estado === 'cancelada') return;
    o.items.forEach(it => {
      if (!itemAgg[it.producto_id]) itemAgg[it.producto_id] = { unidades: 0, ingreso: 0 };
      itemAgg[it.producto_id].unidades += it.cantidad;
      itemAgg[it.producto_id].ingreso += Number(it.subtotal);
    });
  });

  const productosTop = Object.entries(itemAgg)
    .map(([id, agg]) => ({
      nombre: productosMap[id]?.nombre || 'Producto',
      categoria: productosMap[id]?.categoria || 'Otros',
      unidades: agg.unidades,
      ingreso: agg.ingreso,
    }))
    .sort((a, b) => b.unidades - a.unidades)
    .slice(0, 5);
  const maxUnidades = productosTop.length ? Math.max(...productosTop.map(p => p.unidades)) : 1;

  const catIngreso = {};
  Object.entries(itemAgg).forEach(([id, agg]) => {
    const cat = productosMap[id]?.categoria || 'Otros';
    catIngreso[cat] = (catIngreso[cat] || 0) + agg.ingreso;
  });
  const totalCatIngreso = Object.values(catIngreso).reduce((s, v) => s + v, 0);
  const categorias = Object.entries(catIngreso)
    .map(([nombre, ingreso], i) => ({
      nombre,
      pct: totalCatIngreso ? Math.round((ingreso / totalCatIngreso) * 100) : 0,
      color: PALETTE[i % PALETTE.length],
    }))
    .sort((a, b) => b.pct - a.pct);

  const cardTitulo = 'm-0 mb-3 text-base font-bold text-slate-800 dark:text-slate-100';

  return (
    <VendorLayout searchPlaceholder="Buscar...">
      {/* Titulo arriba y selector de periodo debajo en celular; lado a lado en PC */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className={titulo}>Reportes</h1>
          <p className={subtitulo}>Análisis de rendimiento de tu tienda</p>
        </div>
        <div className="flex gap-2">
          {[{ v: 'semana', l: 'Semana' }, { v: 'mes', l: 'Mes' }].map(p => (
            <button key={p.v} className={cx(chip(periodo === p.v), 'flex-1 sm:flex-none')} onClick={() => setPeriodo(p.v)}>
              {p.l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <ZLoader label="Cargando reportes..." />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2.5 xs:gap-3 lg:grid-cols-4">
            {kpis.map(k => (
              <div key={k.label} className={cx(tarjeta, 'min-w-0 p-3.5 xs:p-4')}>
                <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{k.label}</p>
                <p className="m-0 mt-1 truncate text-lg font-extrabold text-slate-800 dark:text-slate-100 xs:text-xl">{k.val}</p>
                <p className={cx('m-0 mt-0.5 text-xs font-semibold', k.up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                  {k.change} vs anterior
                </p>
              </div>
            ))}
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
            <div className={cx(tarjeta, 'min-w-0 p-4 xs:p-5')}>
              <h3 className={cardTitulo}>Ventas por {periodo}</h3>
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
                  <XAxis dataKey="dia" axisLine={false} tickLine={false} interval="preserveStartEnd" tick={{ fill: '#999', fontSize: 12 }} />
                  <YAxis hide domain={[0, maxVal > 0 ? 'auto' : 10]} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                  <Bar dataKey="ventas" radius={[6, 6, 0, 0]} minPointSize={4} maxBarSize={34}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.ventas === maxVal && maxVal > 0 ? '#7c3aed' : '#FF7A00'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className={cx(tarjeta, 'min-w-0 p-4 xs:p-5')}>
              <h3 className={cardTitulo}>Por categoría</h3>
              {categorias.length === 0 ? (
                <p className="m-0 py-2 text-[13px] text-slate-400">Sin ventas todavía</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {categorias.map(c => (
                    <div key={c.nombre} className="flex items-center gap-3">
                      <span className="flex w-24 min-w-0 shrink-0 items-center gap-2 xs:w-28">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                        <span className="truncate text-[13px] font-medium text-slate-700 dark:text-slate-200">{c.nombre}</span>
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-noche-borde">
                        <span className="block h-full rounded-full" style={{ width: `${c.pct}%`, background: c.color }} />
                      </span>
                      <span className="w-10 shrink-0 text-right text-[13px] font-semibold text-slate-700 dark:text-slate-200">{c.pct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Productos mas vendidos: lista que cabe en cualquier celular
              (antes era una tabla de 6 columnas que se salia de la pantalla) */}
          <div className={cx(tarjeta, 'p-4 xs:p-5')}>
            <h3 className={cardTitulo}>Productos más vendidos</h3>
            {productosTop.length === 0 ? (
              <p className="m-0 py-2 text-[13px] text-slate-400">Todavía no tienes ventas registradas</p>
            ) : (
              <div className="flex flex-col">
                {productosTop.map((p, i) => (
                  <div key={p.nombre} className="flex items-center gap-3 border-0 border-b border-solid border-slate-100 py-3 last:border-b-0 dark:border-noche-borde">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zippy-50 text-xs font-bold text-zippy dark:bg-zippy/15">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="m-0 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{p.nombre}</p>
                        <p className="m-0 shrink-0 text-sm font-bold text-slate-800 dark:text-slate-100">{fmtFull(p.ingreso)}</p>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{p.unidades} und · {p.categoria}</span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-noche-borde">
                          <span className="block h-full rounded-full bg-zippy" style={{ width: `${(p.unidades / maxUnidades) * 100}%` }} />
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </VendorLayout>
  );
};

export default VendorReportesPage;
