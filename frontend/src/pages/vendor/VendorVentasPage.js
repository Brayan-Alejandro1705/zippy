import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import VendorLayout from '../../components/VendorLayout';
import { ordenesService, negociosService, productosService, usuariosService } from '../../config/api';
import '../../styles/VendorVentas.css';
import '../../styles/VendorOrdenes.css';

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

const ESTADO_CLASS = {
  Completada: 'vv-badge--completada',
  'En camino':'vv-badge--camino',
  Pendiente:  'vv-badge--pendiente',
  Cancelada:  'vv-badge--cancelada',
};

const DIA_CORTO  = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const DIA_LARGO  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const fmt = (n) => {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString('es-CO')}`;
};
const fmtFull = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;
const fmtFecha = iso => new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
const capitalizar = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

const STEPS = ['Recibido', 'Preparado', 'En camino', 'Entregado'];
const stepIndex = (estado) => {
  if (estado === 'En camino')  return 2;
  if (estado === 'Completada') return 3;
  if (estado === 'Pendiente')  return 1;
  return 0;
};

const descargarFactura = (orden) => {
  const filas = orden.items.map(item => `
    <tr>
      <td>${item.nombre}</td>
      <td style="text-align:center">${item.qty}</td>
      <td style="text-align:right">$${(item.precio / item.qty).toLocaleString('es-CO')}</td>
      <td style="text-align:right">$${item.precio.toLocaleString('es-CO')}</td>
    </tr>
  `).join('');

  const html = `
    <html>
      <head>
        <title>Factura ${orden.id}</title>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; color: #1e293b; padding: 32px; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th { text-align: left; font-size: 12px; color: #64748b; border-bottom: 1px solid #e2e8f0; padding: 8px 4px; }
          td { padding: 8px 4px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
          .totales td { border: none; }
          .total-final td { font-weight: bold; font-size: 16px; border-top: 2px solid #1e293b; }
        </style>
      </head>
      <body>
        <h1>${orden.negocio}</h1>
        <p class="meta">Factura ${orden.id} · ${orden.fecha} · Cliente: ${orden.cliente}</p>
        <p class="meta">Dirección de entrega: ${orden.dir}</p>
        <table>
          <thead>
            <tr><th>Producto</th><th style="text-align:center">Cant.</th><th style="text-align:right">Precio unit.</th><th style="text-align:right">Subtotal</th></tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
        <table class="totales">
          <tr><td colspan="3" style="text-align:right">Subtotal</td><td style="text-align:right">$${orden.subtotal.toLocaleString('es-CO')}</td></tr>
          <tr><td colspan="3" style="text-align:right">IVA</td><td style="text-align:right">$${orden.impuesto.toLocaleString('es-CO')}</td></tr>
          <tr class="total-final"><td colspan="3" style="text-align:right">Total</td><td style="text-align:right">$${orden.total.toLocaleString('es-CO')}</td></tr>
        </table>
      </body>
    </html>
  `;

  const ventana = window.open('', '_blank');
  if (!ventana) return;
  ventana.document.write(html);
  ventana.document.close();
  ventana.focus();
  ventana.print();
};

const abrirMapa = (direccion) => {
  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`, '_blank');
};

const OrderDetailModal = ({ orden, onClose }) => {
  if (!orden) return null;
  const current = stepIndex(orden.estado);
  return (
    <div className="vo-modal-overlay" onClick={onClose}>
      <div className="vo-modal" onClick={e => e.stopPropagation()}>
        <div className="vo-modal-header">
          <h3>Orden {orden.id} — {orden.cliente}</h3>
          <button className="vo-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="vo-stepper">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`vo-step ${i <= current ? 'vo-step--done' : ''} ${i === current ? 'vo-step--current' : ''}`}>
                <div className="vo-step-dot" />
                <span className="vo-step-label">{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`vo-step-line ${i < current ? 'vo-step-line--done' : ''}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="vo-items">
          {orden.items.map((item, i) => (
            <div key={i} className="vo-item-row">
              <div>
                <p className="vo-item-name">{item.nombre}</p>
                <p className="vo-item-meta">{orden.negocio} · Cantidad {item.qty} · {fmtFull(item.precio / item.qty)} c/u</p>
              </div>
              <span className="vo-item-price">{fmtFull(item.precio)}</span>
            </div>
          ))}
          <div className="vo-total-row">
            <span>Total</span>
            <span className="vo-total-val">{fmtFull(orden.total)}</span>
          </div>
        </div>

        <div className="vo-modal-actions">
          <button className="vo-btn-map" onClick={() => abrirMapa(orden.dir)}>📍 Ver en mapa</button>
          <button
            className="vo-btn-contact"
            disabled={!orden.clienteTelefono}
            onClick={() => { if (orden.clienteTelefono) window.location.href = `tel:${orden.clienteTelefono}`; }}
          >
            📞 {orden.clienteTelefono || 'Sin teléfono'}
          </button>
          <button className="vo-btn-invoice" onClick={() => descargarFactura(orden)}>⬇ Factura</button>
        </div>
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="vv-tooltip">
      <p>{label}</p>
      <p className="vv-tooltip-val">{fmtFull(payload[0].value)}</p>
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
            .filter(o => o.estado === 'Completada' && new Date(o.fechaRaw).toDateString() === d.toDateString())
            .reduce((s, o) => s + o.total, 0);
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

  const filtradas = estadoFiltro === 'Todos'
    ? ordenes
    : ordenes.filter(o => o.estado === estadoFiltro);

  const completadas = ordenes.filter(o => o.estado === 'Completada');

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const completadasEsteMes = completadas.filter(o => new Date(o.fechaRaw) >= inicioMes);
  const ingresosEsteMes = completadasEsteMes.reduce((s, o) => s + o.total, 0);
  const porOrden = completadasEsteMes.length > 0 ? ingresosEsteMes / completadasEsteMes.length : 0;

  const mejorDia = chartData.reduce((mejor, d) => (!mejor || d.ventas > mejor.ventas) ? d : mejor, null);
  const promedioDiario = chartData.length ? chartData.reduce((s, d) => s + d.ventas, 0) / chartData.length : 0;

  return (
    <VendorLayout searchPlaceholder="Buscar orden...">
      <div className="vv-page-header">
        <div>
          <h1 className="vv-title">Mi Tienda</h1>
          <p className="vv-sub">Resumen de tus ventas</p>
        </div>
      </div>

      {/* Stats */}
      <div className="vv-stats">
        <div className="vv-stat">
          <span className="vv-stat-icon">💰</span>
          <div>
            <p className="vv-stat-val">{fmt(ingresosEsteMes)}</p>
            <p className="vv-stat-label">Este mes</p>
          </div>
        </div>
        <div className="vv-stat">
          <span className="vv-stat-icon">✅</span>
          <div>
            <p className="vv-stat-val">{completadas.length}</p>
            <p className="vv-stat-label">Completadas</p>
          </div>
        </div>
        <div className="vv-stat">
          <span className="vv-stat-icon">📦</span>
          <div>
            <p className="vv-stat-val">{fmt(porOrden)}</p>
            <p className="vv-stat-label">Por orden</p>
          </div>
        </div>
        <div className="vv-stat">
          <span className="vv-stat-icon">⭐</span>
          <div>
            <p className="vv-stat-val">{negocio ? Number(negocio.calificacion_promedio).toFixed(1) : '—'}</p>
            <p className="vv-stat-label">Calificación promedio</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="vv-filters">
        {['semana', 'mes', 'año'].map(p => (
          <button
            key={p}
            className={`vv-filter-btn ${periodo === p ? 'vv-filter-btn--active' : ''}`}
            onClick={() => setPeriodo(p)}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)} ▾
          </button>
        ))}
        <select className="vv-estado-sel" value={estadoFiltro} onChange={e => setEstado(e.target.value)}>
          {['Todos','Completada','En camino','Pendiente','Cancelada'].map(e => <option key={e}>{e}</option>)}
        </select>
        <button className="vv-export-btn">+ Exportar</button>
      </div>

      {/* Table */}
      <div className="vv-table-wrap">
        {loading ? (
          <p style={{ padding: 16 }}>Cargando órdenes...</p>
        ) : filtradas.length === 0 ? (
          <p style={{ padding: 16 }}>No tienes órdenes{estadoFiltro !== 'Todos' ? ` en "${estadoFiltro}"` : ''}.</p>
        ) : (
          <>
            <table className="vv-table">
              <thead>
                <tr>
                  <th>Orden ID</th>
                  <th>Cliente</th>
                  <th>Productos</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Entrega</th>
                  <th>Método Pago</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(o => (
                  <tr key={o.id}>
                    <td className="vv-id">{o.id}<br/><span className="vv-dir">{o.dir}</span></td>
                    <td>{o.cliente}</td>
                    <td className="vv-prods">{o.productos}</td>
                    <td className="vv-total">{fmtFull(o.total)}</td>
                    <td><span className={`vv-badge ${ESTADO_CLASS[o.estado]}`}>{o.estado}</span></td>
                    <td>{o.fecha}</td>
                    <td>{o.entrega}</td>
                    <td>{o.pago}</td>
                    <td>
                      <button className="vv-link" onClick={() => setDetalle(o)}>
                        Ver detalles →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="vv-table-footer">
              Mostrando {filtradas.length} de {ordenes.length} órdenes
            </div>
          </>
        )}
      </div>

      {/* Chart */}
      <div className="vv-chart-card">
        <div className="vv-chart-header">
          <h3>Ventas de la semana</h3>
          <div className="vv-chart-meta">
            <span>Promedio diario: <strong>{fmt(promedioDiario)}</strong></span>
            <span>Mejor día: {mejorDia && mejorDia.ventas > 0 ? mejorDia.diaLargo : '—'}</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barSize={36} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <XAxis dataKey="dia" axisLine={false} tickLine={false} tick={{ fill: '#999', fontSize: 13 }} />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
            <Bar dataKey="ventas" radius={[6,6,0,0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={mejorDia && entry.ventas === mejorDia.ventas && entry.ventas > 0 ? '#7c3aed' : '#FF7A00'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <OrderDetailModal orden={detalle} onClose={() => setDetalle(null)} />
    </VendorLayout>
  );
};

export default VendorVentasPage;
