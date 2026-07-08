import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import VendorLayout from '../../components/VendorLayout';
import { ordenesService, negociosService, productosService } from '../../config/api';
import ZLoader from '../../components/ZLoader';
import '../../styles/VendorReportes.css';

const DIA_ABR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const PALETTE = ['#FF7A00', '#7c3aed', '#10b981', '#3b82f6', '#ec4899', '#f59e0b'];
const DAY_MS = 86400000;

const fmtCompact = (n) => {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString('es-CO')}`;
};
const fmtFull = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;

const pctChange = (curr, prev) => {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return Math.round(((curr - prev) / prev) * 100);
};

const enRango = (fechaIso, desde, hasta) => {
  const t = new Date(fechaIso).getTime();
  return t >= desde && t < hasta;
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="vr-tooltip">
      <p>{label}</p>
      <p className="vr-tooltip-val">{fmtFull(payload[0].value)}</p>
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
    { label: 'Ingresos totales', val: fmtCompact(ingresosActual), change: `${pctChange(ingresosActual, ingresosAnterior) >= 0 ? '+' : ''}${pctChange(ingresosActual, ingresosAnterior)}%`, up: ingresosActual >= ingresosAnterior },
    { label: 'Órdenes',          val: String(ordenesActual.length), change: `${ordenesActual.length - ordenesAnterior.length >= 0 ? '+' : ''}${ordenesActual.length - ordenesAnterior.length}`, up: ordenesActual.length >= ordenesAnterior.length },
    { label: 'Ticket promedio',  val: fmtCompact(ticketActual), change: `${pctChange(ticketActual, ticketAnterior) >= 0 ? '+' : ''}${pctChange(ticketActual, ticketAnterior)}%`, up: ticketActual >= ticketAnterior },
    { label: 'Tasa completadas', val: `${Math.round(tasaActual)}%`, change: `${Math.round(tasaActual - tasaAnterior) >= 0 ? '+' : ''}${Math.round(tasaActual - tasaAnterior)}%`, up: tasaActual >= tasaAnterior },
  ];

  let chartData = [];
  if (periodo === 'semana') {
    const dias = [];
    for (let i = 6; i >= 0; i--) dias.push(new Date(ahora - i * DAY_MS));
    chartData = dias.map(d => ({
      dia: DIA_ABR[d.getDay()],
      ventas: ordenesRaw
        .filter(o => o.estado === 'entregada' && new Date(o.fecha_creacion).toDateString() === d.toDateString())
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

  return (
    <VendorLayout searchPlaceholder="Buscar...">
      <div className="vr-header">
        <div>
          <h1 className="vr-title">Reportes</h1>
          <p className="vr-sub">Análisis de rendimiento de tu tienda</p>
        </div>
        <div className="vr-period-wrap">
          {['semana', 'mes'].map(p => (
            <button
              key={p}
              className={`vr-period-btn ${periodo === p ? 'vr-period-btn--active' : ''}`}
              onClick={() => setPeriodo(p)}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <ZLoader label="Cargando reportes..." />
      ) : (
        <>
          {/* KPIs */}
          <div className="vr-kpis">
            {kpis.map(k => (
              <div key={k.label} className="vr-kpi">
                <p className="vr-kpi-label">{k.label}</p>
                <p className="vr-kpi-val">{k.val}</p>
                <p className={`vr-kpi-change ${k.up ? 'vr-kpi-change--up' : 'vr-kpi-change--down'}`}>
                  {k.change} vs anterior
                </p>
              </div>
            ))}
          </div>

          <div className="vr-row">
            {/* Bar chart */}
            <div className="vr-card vr-card--grow">
              <div className="vr-card-header">
                <h3>Ventas por {periodo}</h3>
              </div>
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={chartData} barSize={34} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <XAxis dataKey="dia" axisLine={false} tickLine={false} tick={{ fill: '#999', fontSize: 13 }} />
                  <YAxis hide />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                  <Bar dataKey="ventas" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.ventas === maxVal && maxVal > 0 ? '#7c3aed' : '#FF7A00'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Categorías */}
            <div className="vr-card vr-card--side">
              <div className="vr-card-header">
                <h3>Por categoría</h3>
              </div>
              {categorias.length === 0 ? (
                <p style={{ padding: '8px 0', color: '#94a3b8', fontSize: 13 }}>Sin ventas todavía</p>
              ) : (
                <div className="vr-cat-list">
                  {categorias.map(c => (
                    <div key={c.nombre} className="vr-cat-row">
                      <div className="vr-cat-info">
                        <span className="vr-cat-dot" style={{ background: c.color }} />
                        <span className="vr-cat-name">{c.nombre}</span>
                      </div>
                      <div className="vr-cat-track">
                        <div className="vr-cat-fill" style={{ width: `${c.pct}%`, background: c.color }} />
                      </div>
                      <span className="vr-cat-pct">{c.pct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Top productos */}
          <div className="vr-card">
            <div className="vr-card-header">
              <h3>Productos más vendidos</h3>
            </div>
            {productosTop.length === 0 ? (
              <p style={{ padding: '8px 0', color: '#94a3b8', fontSize: 13 }}>Todavía no tienes ventas registradas</p>
            ) : (
              <table className="vr-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Unidades</th>
                    <th>Ingreso</th>
                    <th>Participación</th>
                  </tr>
                </thead>
                <tbody>
                  {productosTop.map((p, i) => (
                    <tr key={p.nombre}>
                      <td className="vr-rank">{i + 1}</td>
                      <td className="vr-prod-name">{p.nombre}</td>
                      <td>
                        <span className="vr-chip" style={{ background: '#f1f5f9', color: '#475569' }}>
                          {p.categoria}
                        </span>
                      </td>
                      <td>{p.unidades}</td>
                      <td className="vr-ingreso">{fmtFull(p.ingreso)}</td>
                      <td>
                        <div className="vr-bar-track">
                          <div className="vr-bar-fill" style={{ width: `${(p.unidades / maxUnidades) * 100}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </VendorLayout>
  );
};

export default VendorReportesPage;
