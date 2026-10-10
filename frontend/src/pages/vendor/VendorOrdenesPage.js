import React, { useState, useEffect, useCallback } from 'react';
import VendorLayout from '../../components/VendorLayout';
import { ordenesService, negociosService, productosService, usuariosService } from '../../config/api';
import ZLoader from '../../components/ZLoader';
import { fechaCorta, minutosDesde } from '../../utils/fechas';
import Icon from '../../components/Icons';
import { cx, titulo, tarjeta, btn, chip, chipsFila, badge, badgeBase } from '../../ui/tw';
import OrdenDetalleModal, { VENDEDOR_NEXT, llamar } from '../../components/vendor/OrdenDetalle';

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

// Color de la franja izquierda de cada tarjeta y del chip de estado
const BORDER = { 'En camino':'border-l-zippy', 'Entregada':'border-l-green-500', 'Cancelada':'border-l-red-500', 'Pendiente':'border-l-amber-500' };
const BADGE  = { 'En camino':badge.camino, 'Entregada':badge.entregada, 'Cancelada':badge.cancelada, 'Pendiente':badge.pendiente };

const fmtFull  = n => `$${Math.round(n).toLocaleString('es-CO')}`;
const fmtFecha = fechaCorta;

// A partir de aqui el cliente ya se esta preguntando si alguien vio su pedido
const MINUTOS_PARA_ALERTA = 10;

const ordenDeApi = (o, negocioNombre, productosMap, clienteNombre, clienteTelefono) => ({
  id: `#${o.id.slice(0, 8)}`,
  idCompleto: o.id,
  fecha: fmtFecha(o.fecha_creacion),
  fechaRaw: o.fecha_creacion,
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
  codigoRecogida: o.codigo_recogida || null,
  minutos: null,
  items: o.items.map(it => ({
    nombre: productosMap[it.producto_id] || 'Producto',
    precio: Number(it.subtotal),
    qty: it.cantidad,
  })),
  domiciliario: null,
});

const ESTADO_REAL_LABEL = {
  pendiente:           'Pendiente',
  confirmada:           'Confirmado',
  en_preparacion:       'Preparando',
  lista_para_retirar:   'Listo para recoger',
};

const textoEstado = (o) =>
  o.estado === 'En camino' ? 'En camino'
  : o.estado === 'Entregada' ? 'Entregada'
  : o.estado === 'Cancelada' ? 'Cancelada'
  : ESTADO_REAL_LABEL[o.estadoReal] || o.estado;

const iconoEstado = { 'En camino': 'moto', 'Entregada': 'check', 'Cancelada': 'equis' };

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

  const confirmarRecogida = async (orden, codigo) => {
    await ordenesService.confirmarRecogida(orden.idCompleto, codigo);
    setDetalle(null);
    cargar();
  };

  const filtradas = tab === 'Todos' ? ordenes : ordenes.filter(o => o.estado === tab);
  const count = (val) => val === 'Todos' ? ordenes.length : ordenes.filter(o => o.estado === val).length;

  // Pedidos que llevan rato sin confirmar. Un pedido sin confirmar es un
  // cliente mirando una pantalla que no cambia, asi que esto va arriba de
  // todo y en rojo, no escondido en una pestaña.
  const sinConfirmar = ordenes
    .filter(o => o.estadoReal === 'pendiente' && minutosDesde(o.fechaRaw) >= MINUTOS_PARA_ALERTA)
    .sort((a, b) => minutosDesde(b.fechaRaw) - minutosDesde(a.fechaRaw));
  const masViejo = sinConfirmar.length ? minutosDesde(sinConfirmar[0].fechaRaw) : 0;

  return (
    <VendorLayout searchPlaceholder="Buscar orden...">
      <h1 className={cx(titulo, 'mb-4')}>Mis Órdenes</h1>

      {sinConfirmar.length > 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border-[1.5px] border-l-4 border-solid border-red-200 border-l-red-600 bg-red-50 p-3.5 text-red-700 dark:border-red-500/30 dark:border-l-red-500 dark:bg-red-500/10 dark:text-red-300">
          <span className="mt-0.5 shrink-0"><Icon name="alerta" size={20} /></span>
          <div className="min-w-0">
            <p className="m-0 text-[14.5px] font-extrabold leading-snug">
              {sinConfirmar.length === 1
                ? `Tienes 1 pedido sin confirmar desde hace ${masViejo} min`
                : `Tienes ${sinConfirmar.length} pedidos sin confirmar (el más viejo, ${masViejo} min)`}
            </p>
            <p className="m-0 mt-1 text-[12.5px] leading-snug text-rose-800 dark:text-red-300/80">
              El cliente está esperando. Confírmalo para que puedan prepararlo y recogerlo.
            </p>
          </div>
        </div>
      )}

      {/* Pestañas: en celular se desplazan de lado en vez de partirse en dos filas */}
      <div className={cx(chipsFila, 'mb-4')}>
        {TABS.map(({ label, value }) => (
          <button key={value} className={chip(tab === value)} onClick={() => setTab(value)}>
            {label} <span className="text-xs opacity-80">({count(value)})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <ZLoader size="sm" label="Cargando órdenes..." />
      ) : filtradas.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 px-6 pb-14 pt-12 text-center">
          <div className="mb-1.5 inline-flex h-[60px] w-[60px] items-center justify-center rounded-[18px] bg-[#fff3e6] text-orange-700 dark:bg-[#2a3547] dark:text-[#FFA14D]">
            <Icon name="paquete" size={26} />
          </div>
          <p className="m-0 text-base font-bold text-slate-800 dark:text-slate-200">
            {tab === 'Todos' ? 'Aún no tienes órdenes' : `Ninguna orden en "${tab}"`}
          </p>
          <p className="m-0 max-w-[300px] text-[13.5px] leading-snug text-slate-500 dark:text-slate-400">
            {tab === 'Todos'
              ? 'Cuando un cliente te compre, el pedido aparece aquí.'
              : 'Prueba con otro filtro para ver el resto de tus órdenes.'}
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3">
            {filtradas.map(o => (
              <div key={o.id} className={cx(tarjeta, 'border-0 border-l-4 border-solid p-4', BORDER[o.estado] || 'border-l-slate-300')}>
                {/* Fila 1: numero + fecha a la izquierda, total a la derecha.
                    min-w-0 deja que lo largo se recorte en vez de empujar el total fuera. */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="m-0 font-mono text-[15px] font-bold text-slate-800 dark:text-slate-100">{o.id}</p>
                    <p className="m-0 mt-0.5 text-xs text-slate-400">{o.fecha}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <p className="m-0 text-[17px] font-bold text-slate-800 dark:text-slate-100">{fmtFull(o.total)}</p>
                    <span className={cx(badgeBase, BADGE[o.estado])}>
                      {iconoEstado[o.estado] && <Icon name={iconoEstado[o.estado]} size={13} />}
                      {textoEstado(o)}
                    </span>
                  </div>
                </div>

                {/* Fila 2: datos del cliente y la entrega */}
                <div className="mt-2.5 flex flex-col gap-1 text-[13px] text-slate-600 dark:text-slate-400">
                  {o.cliente && (
                    <p className="m-0 flex items-center gap-1.5 font-medium"><span className="shrink-0 text-slate-400"><Icon name="perfil" size={14} /></span><span className="min-w-0 truncate">{o.cliente}</span></p>
                  )}
                  <p className="m-0 flex items-start gap-1.5"><span className="mt-px shrink-0 text-slate-400"><Icon name="ubicacion" size={14} /></span><span className="min-w-0">{o.dir}</span></p>
                  {o.codigoRecogida && o.domiciliarioId && o.estadoReal === 'lista_para_retirar' && (
                    <p className="m-0 flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300">
                      <Icon name="llave" size={14} /> Código de recogida: {o.codigoRecogida}
                    </p>
                  )}
                  {o.minutos && <p className="m-0 text-[11px] text-slate-500">Faltan {o.minutos} minutos</p>}
                </div>

                {/* Fila 3: botones. Bajan de linea si no caben (flex-wrap). */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {VENDEDOR_NEXT[o.estadoReal] && (
                    <button className={cx(btn.azul, 'flex-1')} onClick={() => avanzarEstado(o, VENDEDOR_NEXT[o.estadoReal].next)}>
                      {VENDEDOR_NEXT[o.estadoReal].label}
                    </button>
                  )}
                  {o.estado === 'En camino' && (
                    <button className={cx(btn.azul, 'flex-1')} onClick={() => setDetalle(o)}>Ver</button>
                  )}
                  {o.estado === 'En camino' && (
                    <button className={btn.borde} disabled={!o.clienteTelefono} onClick={() => llamar(o.clienteTelefono)}>
                      <Icon name="telefono" size={14} /> Llamar
                    </button>
                  )}
                  <button className={btn.borde} onClick={() => setDetalle(o)}>Detalles</button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-2 text-center text-xs text-slate-400">Mostrando {filtradas.length} de {ordenes.length} órdenes</div>
        </>
      )}

      <OrdenDetalleModal orden={detalle} onClose={() => setDetalle(null)} onAvanzar={avanzarEstado} onConfirmarRecogida={confirmarRecogida} />
    </VendorLayout>
  );
};

export default VendorOrdenesPage;
