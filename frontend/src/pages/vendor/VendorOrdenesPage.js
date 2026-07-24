import React, { useState, useEffect, useCallback } from 'react';
import VendorLayout from '../../components/VendorLayout';
import { ordenesService, negociosService, productosService, usuariosService } from '../../config/api';
import ZLoader from '../../components/ZLoader';
import '../../styles/VendorOrdenes.css';
import Icon from '../../components/Icons';

const TABS = [
  { label: 'Todos',      value: 'Todos'     },
  { label: 'En camino',  value: 'En camino' },
  { label: 'Entregadas', value: 'Entregada' },
  { label: 'Canceladas', value: 'Cancelada' },
];

const ESTADO_UI = {
  pendiente:           'Pendiente',
  confirmada:          'Pendiente',
  en_preparacion:      'Pendiente',
  lista_para_retirar:  'Pendiente',
  en_domicilio:        'En camino',
  entregada:           'Entregada',
  cancelada:           'Cancelada',
};

const BORDER = { 'En camino':'#FF7A00', 'Entregada':'#22c55e', 'Cancelada':'#ef4444', 'Pendiente':'#f59e0b' };
const BADGE  = { 'En camino':'vo-badge--camino', 'Entregada':'vo-badge--entregada', 'Cancelada':'vo-badge--cancelada', 'Pendiente':'vo-badge--pendiente' };

const fmtFull  = n => `$${Math.round(n).toLocaleString('es-CO')}`;
const fmtFecha = iso => new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });

const ordenDeApi = (o, negocioNombre, productosMap, clienteNombre, clienteTelefono) => ({
  id: `#${o.id.slice(0, 8)}`,
  idCompleto: o.id,
  fecha: fmtFecha(o.fecha_creacion),
  negocio: negocioNombre,
  cliente: clienteNombre,
  clienteTelefono,
  dir: o.direccion_entrega,
  subtotal: Number(o.subtotal),
  impuesto: Number(o.impuesto),
  total: Number(o.total),
  estado: ESTADO_UI[o.estado] || 'Pendiente',
  estadoReal: o.estado,
  domiciliarioId: o.domiciliario_id,
  minutos: null,
  items: o.items.map(it => ({
    nombre: productosMap[it.producto_id] || 'Producto',
    precio: Number(it.subtotal),
    qty: it.cantidad,
  })),
  domiciliario: null,
});

// Pasos que el vendedor controla antes de que un repartidor pueda tomar el pedido
const VENDEDOR_NEXT = {
  pendiente:      { next: 'confirmada',         label: 'Confirmar pedido' },
  confirmada:     { next: 'en_preparacion',      label: 'Marcar en preparación' },
  en_preparacion: { next: 'lista_para_retirar',  label: 'Marcar listo para recoger' },
};

const ESTADO_REAL_LABEL = {
  pendiente:           'Pendiente',
  confirmada:           'Confirmado',
  en_preparacion:       'Preparando',
  lista_para_retirar:   'Listo para recoger',
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
        <p class="meta">Factura ${orden.id} · ${orden.fecha}${orden.cliente ? ` · Cliente: ${orden.cliente}` : ''}</p>
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

// ── Order Detail Modal ────────────────────────────────────────────────────────
const STEPS = ['Recibido', 'Preparado', 'En camino', 'Entregado'];
const stepIndex = (estado) => {
  if (estado === 'En camino') return 2;
  if (estado === 'Entregada') return 3;
  if (estado === 'Pendiente') return 1;
  return 0;
};

const OrderDetailModal = ({ orden, onClose, onAvanzar }) => {
  if (!orden) return null;
  const current = stepIndex(orden.estado);
  const siguientePaso = VENDEDOR_NEXT[orden.estadoReal];

  return (
    <div className="vo-modal-overlay" onClick={onClose}>
      <div className="vo-modal" onClick={e => e.stopPropagation()}>
        <div className="vo-modal-header">
          <h3>Orden {orden.id}</h3>
          <button className="vo-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Stepper */}
        <div className="vo-stepper">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`vo-step ${i <= current ? 'vo-step--done' : ''} ${i === current ? 'vo-step--current' : ''}`}>
                <div className="vo-step-dot" />
                <span className="vo-step-label">{s}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`vo-step-line ${i < current ? 'vo-step-line--done' : ''}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* Items */}
        <div className="vo-items">
          {orden.items.map((item, i) => (
            <div key={i} className="vo-item-row">
              <div>
                <p className="vo-item-name">{item.nombre}</p>
                <p className="vo-item-meta">{orden.negocio} · Cantidad {item.qty} · ${(item.precio/item.qty).toLocaleString('es-CO')} c/u</p>
              </div>
              <span className="vo-item-price">{fmtFull(item.precio)}</span>
            </div>
          ))}
          <div className="vo-total-row">
            <span>Total</span>
            <span className="vo-total-val">{fmtFull(orden.total)}</span>
          </div>
        </div>

        {/* Estado de despacho */}
        {orden.estadoReal === 'lista_para_retirar' && !orden.domiciliarioId && (
          <div className="vo-delivery">
            <p>🛵 Listo para recoger — esperando que un repartidor lo tome</p>
          </div>
        )}
        {orden.domiciliarioId && orden.estadoReal === 'en_domicilio' && (
          <div className="vo-delivery">
            <p>🛵 Un repartidor ya tomó este pedido y va en camino</p>
          </div>
        )}

        {/* Actions */}
        <div className="vo-modal-actions">
          <button className="vo-btn-map" onClick={() => abrirMapa(orden.dir)}>📍 Ver en mapa</button>
          <button
            className="vo-btn-contact"
            disabled={!orden.clienteTelefono}
            onClick={() => { if (orden.clienteTelefono) window.location.href = `tel:${orden.clienteTelefono}`; }}
          >
            📞 {orden.clienteTelefono || 'Sin teléfono'}
          </button>
          <button className="vo-btn-invoice" onClick={() => descargarFactura(orden)}>⬇ Descargar factura</button>
        </div>
        {siguientePaso && (
          <div className="vo-modal-actions">
            <button className="vo-btn-invoice" style={{ flex: 1, background: '#FF7A00', color: 'white' }} onClick={() => onAvanzar(orden, siguientePaso.next)}>
              {siguientePaso.label} →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const VendorOrdenesPage = () => {
  const [tab, setTab]         = useState('Todos');
  const [detalle, setDetalle] = useState(null);
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    try {
      const { data: negocio } = await negociosService.miNegocio();
      const [{ data: ordenesRaw }, { data: productos }] = await Promise.all([
        ordenesService.listar(),
        productosService.listar(negocio.id, { limit: 100 }),
      ]);

      const productosMap = Object.fromEntries(productos.map(p => [p.id, p.nombre]));

      const clienteIds = [...new Set(ordenesRaw.map(o => o.cliente_id))];
      const clientesPairs = await Promise.all(
        clienteIds.map(id => usuariosService.obtener(id).then(({ data }) => [id, data]).catch(() => [id, null]))
      );
      const clientesMap = Object.fromEntries(clientesPairs);

      const mapeadas = ordenesRaw.map(o => ordenDeApi(
        o, negocio.nombre_negocio, productosMap,
        clientesMap[o.cliente_id]?.nombre,
        clientesMap[o.cliente_id]?.telefono
      ));

      setOrdenes(mapeadas);
    } catch {
      setOrdenes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const avanzarEstado = async (orden, nuevoEstado) => {
    try {
      await ordenesService.actualizar(orden.idCompleto, { estado: nuevoEstado });
      setDetalle(null);
      cargar();
    } catch (err) {
      alert(err.response?.data?.detail || 'No se pudo actualizar el pedido.');
    }
  };

  const filtradas = tab === 'Todos' ? ordenes : ordenes.filter(o => o.estado === tab);
  const count = (val) => val === 'Todos' ? ordenes.length : ordenes.filter(o => o.estado === val).length;

  return (
    <VendorLayout searchPlaceholder="Buscar orden...">
      <h1 className="vo-title">Mis Órdenes</h1>

      {/* Tabs */}
      <div className="vo-tabs">
        {TABS.map(({ label, value }) => (
          <button
            key={value}
            className={`vo-tab ${tab === value ? 'vo-tab--active' : ''}`}
            onClick={() => setTab(value)}
          >
            {label} <span className="vo-tab-count">({count(value)})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <ZLoader size="sm" label="Cargando órdenes..." />
      ) : filtradas.length === 0 ? (
        <div className="vo-empty">
          <div className="vo-empty-icon"><Icon name="paquete" size={26} /></div>
          <p className="vo-empty-title">
            {tab === 'Todos' ? 'Aún no tienes órdenes' : `Ninguna orden en "${tab}"`}
          </p>
          <p className="vo-empty-desc">
            {tab === 'Todos'
              ? 'Cuando un cliente te compre, el pedido aparece aquí.'
              : 'Prueba con otro filtro para ver el resto de tus órdenes.'}
          </p>
        </div>
      ) : (
        <>
          {/* Order cards */}
          <div className="vo-list">
            {filtradas.map(o => (
              <div key={o.id} className="vo-card" style={{ borderLeftColor: BORDER[o.estado] || '#ddd' }}>
                <div className="vo-card-main">
                  <div className="vo-card-info">
                    <div className="vo-card-top">
                      <span className="vo-order-id">{o.id}</span>
                      <span className="vo-order-date">{o.fecha}</span>
                    </div>
                    <p className="vo-negocio">📦 {o.negocio}</p>
                    <p className="vo-dir">📍 {o.dir}</p>
                  </div>
                  <div className="vo-card-right">
                    <p className="vo-card-total">{fmtFull(o.total)}</p>
                    <span className={`vo-badge ${BADGE[o.estado]}`}>
                      {o.estado === 'En camino' ? '🚴 En camino' : o.estado === 'Entregada' ? '✓ Entregada' : o.estado === 'Cancelada' ? '✕ Cancelada' : ESTADO_REAL_LABEL[o.estadoReal] || o.estado}
                    </span>
                    {o.minutos && <p className="vo-eta">⏱ Faltan {o.minutos} minutos</p>}
                    <div className="vo-card-actions">
                      {(o.estado === 'En camino') && (
                        <button className="vo-btn-ver" onClick={() => setDetalle(o)}>Ver</button>
                      )}
                      {(o.estado === 'En camino') && (
                        <button className="vo-btn-contact-sm">📞 Contactar</button>
                      )}
                      {VENDEDOR_NEXT[o.estadoReal] && (
                        <button className="vo-btn-ver" onClick={() => avanzarEstado(o, VENDEDOR_NEXT[o.estadoReal].next)}>
                          {VENDEDOR_NEXT[o.estadoReal].label}
                        </button>
                      )}
                      <button className="vo-btn-detail" onClick={() => setDetalle(o)}>Detalles</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="vo-footer">Mostrando {filtradas.length} de {ordenes.length} órdenes</div>
        </>
      )}

      <OrderDetailModal orden={detalle} onClose={() => setDetalle(null)} onAvanzar={avanzarEstado} />
    </VendorLayout>
  );
};

export default VendorOrdenesPage;