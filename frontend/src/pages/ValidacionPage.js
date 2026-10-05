import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import Icon from '../components/Icons';
import { useToast } from '../context/ToastContext';
import { ordenesService } from '../config/api';
import { fechaHoraCorta, minutosDesde } from '../utils/fechas';
import '../styles/Usuarios.css';

// ============================================================================
// ValidacionPage — seguridad de pedidos (sep 2026)
//
// 1. Pedidos por validar: el PRIMER pedido de cada cliente no le llega al
//    negocio hasta que soporte lo confirma con el cliente (WhatsApp/llamada).
// 2. Clientes reportados: los que un repartidor reportó (no salió, dirección
//    falsa...). Con 2 reportes la cuenta queda suspendida; aquí se reactiva.
// 3. Pedidos quietos (oct 2026): los que llevan demasiado tiempo parados sin
//    que nadie se entere. El servidor no vigila solo —no hay tareas
//    programadas— sino que los calcula cuando esta pantalla pregunta, cada 30
//    segundos mientras esté abierta. Si nadie la tiene abierta, nadie se
//    entera: por eso vale la pena dejarla abierta en el turno.
// ============================================================================

const fmt = n => `$${Number(n || 0).toLocaleString('es-CO')}`;
const hace = iso => {
  if (!iso) return '';
  const min = minutosDesde(iso);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
};
const fecha = fechaHoraCorta;
// wa.me necesita el número con indicativo; los de Colombia se guardan con 10 dígitos
const numeroWa = tel => {
  const d = String(tel || '').replace(/\D/g, '');
  if (!d) return null;
  return d.length === 10 ? `57${d}` : d;
};

const card = { background: 'var(--card-bg, #fff)', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 14 };
const btn = (bg, color, border) => ({
  flex: 1, padding: '11px 10px', borderRadius: 12, border: border || 0, background: bg, color,
  fontWeight: 800, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'center', textDecoration: 'none',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
});
const muted = { color: '#64748b', fontSize: 13, margin: '3px 0 0' };

// Por qué está quieto y a quién hay que llamar
const MOTIVO_QUIETO = {
  sin_confirmar:  { titulo: 'El negocio no lo ha confirmado', a: 'Llama al negocio', color: '#dc2626' },
  sin_validar:    { titulo: 'Soporte no ha confirmado el primer pedido', a: 'Llama al cliente', color: '#b45309' },
  sin_repartidor: { titulo: 'Listo para recoger y sin repartidor', a: 'Busca un repartidor', color: '#7c3aed' },
};

const ValidacionPage = () => {
  const { addToast } = useToast();
  const [tab, setTab] = useState('validar');
  const [pendientes, setPendientes] = useState([]);
  const [reportados, setReportados] = useState([]);
  const [quietos, setQuietos] = useState({ total: 0, pedidos: [], umbrales: {} });
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const [p, r, q] = await Promise.all([
        ordenesService.porValidar().then(x => x.data).catch(() => []),
        ordenesService.clientesReportados().then(x => x.data).catch(() => []),
        ordenesService.atascados().then(x => x.data).catch(() => ({ total: 0, pedidos: [], umbrales: {} })),
      ]);
      setPendientes(p || []);
      setReportados(r || []);
      setQuietos(q || { total: 0, pedidos: [], umbrales: {} });
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 30000);
    return () => clearInterval(t);
  }, [cargar]);

  const validar = async (o, aprobar) => {
    if (!aprobar && !window.confirm(`¿Rechazar el pedido #${o.id.slice(0, 8)} de ${o.cliente.nombre}? Al cliente le llega un aviso.`)) return;
    setOcupado(o.id);
    try {
      await ordenesService.validar(o.id, aprobar, aprobar ? null : 'No se pudo confirmar con el cliente');
      addToast(aprobar ? 'Pedido aprobado: ya le llegó al negocio' : 'Pedido rechazado', aprobar ? 'success' : 'warning');
      setPendientes(prev => prev.filter(x => x.id !== o.id));
    } catch (err) {
      addToast(err.response?.data?.detail || 'No se pudo actualizar el pedido', 'error');
      cargar();
    } finally {
      setOcupado(null);
    }
  };

  const reactivar = async (c) => {
    if (!window.confirm(`¿Reactivar la cuenta de ${c.nombre}? Sus reportes vuelven a 0.`)) return;
    try {
      await ordenesService.reactivarCliente(c.id);
      addToast('Cuenta reactivada', 'success');
      cargar();
    } catch (err) {
      addToast(err.response?.data?.detail || 'No se pudo reactivar', 'error');
    }
  };

  const suspendidos = reportados.filter(c => c.estado === 'suspendido').length;

  return (
    <Layout>
      <div className="us-page-header">
        <div>
          <h1 className="us-title">Validación y seguridad</h1>
          <p className="us-subtitle">Primer pedido de clientes nuevos, pedidos que se quedaron quietos y clientes reportados</p>
        </div>
      </div>

      <div className="us-stats-strip">
        <button type="button" onClick={() => setTab('validar')} className="us-stat us-stat--orange" style={{ cursor: 'pointer', border: tab === 'validar' ? '2px solid #FF7A00' : undefined, fontFamily: 'inherit' }}>
          <span className="us-stat-num">{pendientes.length}</span>
          <span className="us-stat-label">Por validar</span>
        </button>
        <button type="button" onClick={() => setTab('quietos')} className={`us-stat ${quietos.total > 0 ? 'us-stat--red' : ''}`} style={{ cursor: 'pointer', border: tab === 'quietos' ? '2px solid #FF7A00' : undefined, fontFamily: 'inherit' }}>
          <span className="us-stat-num">{quietos.total}</span>
          <span className="us-stat-label">Quietos</span>
        </button>
        <button type="button" onClick={() => setTab('reportados')} className="us-stat" style={{ cursor: 'pointer', border: tab === 'reportados' ? '2px solid #FF7A00' : undefined, fontFamily: 'inherit' }}>
          <span className="us-stat-num">{suspendidos}</span>
          <span className="us-stat-label">Suspendidos</span>
        </button>
      </div>

      {cargando ? (
        <div className="us-empty"><p>Cargando…</p></div>
      ) : tab === 'validar' ? (
        pendientes.length === 0 ? (
          <div className="us-empty"><p>No hay pedidos por validar. Cuando un cliente haga su primer pedido aparece aquí.</p></div>
        ) : (
          <div style={{ maxWidth: 640 }}>
            {pendientes.map(o => {
              const wa = numeroWa(o.cliente.telefono);
              const texto = `Hola ${o.cliente.nombre}, te escribimos de ZIPPYGO para confirmar tu pedido en ${o.negocio} por ${fmt(o.total)} para entregar en ${o.direccion_entrega}. ¿Nos confirmas que es correcto?`;
              return (
                <div key={o.id} style={{ ...card, border: '2px solid #f59e0b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong>#{o.id.slice(0, 8)}</strong>
                    <span style={muted}>{hace(o.fecha_creacion)}</span>
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: 14 }}><strong>{o.cliente.nombre}</strong>{o.cliente.telefono ? ` · ${o.cliente.telefono}` : ''}</p>
                  <p style={muted}>Cuenta creada {fecha(o.cliente.fecha_creacion)} · {o.cliente.email}</p>
                  <p style={{ ...muted, marginTop: 8 }}>
                    <Icon name="ubicacion" size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />{o.direccion_entrega}
                    {o.lat != null
                      ? <> · <a href={`https://maps.google.com/?q=${o.lat},${o.lng}`} target="_blank" rel="noopener noreferrer" style={{ color: '#16a34a', fontWeight: 700 }}>ver en el mapa</a></>
                      : <span style={{ color: '#b45309' }}> · sin punto en el mapa</span>}
                  </p>
                  <p style={muted}>{o.negocio} · <strong style={{ color: '#FF7A00' }}>{fmt(o.total)}</strong> · {o.metodo_pago}</p>
                  <p style={muted}>{o.items.map(i => `${i.nombre} x${i.cantidad}`).join(', ')}</p>
                  {o.notas_cliente && <p style={muted}>Nota: {o.notas_cliente}</p>}

                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    {wa && (
                      <a href={`https://wa.me/${wa}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer" style={btn('transparent', '#15803d', '1.5px solid #bbf7d0')}>
                        <Icon name="whatsapp" size={16} />WhatsApp
                      </a>
                    )}
                    {o.cliente.telefono && (
                      <a href={`tel:${o.cliente.telefono}`} style={btn('transparent', '#1e293b', '1.5px solid #e2e8f0')}>
                        <Icon name="telefono" size={16} />Llamar
                      </a>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button type="button" disabled={ocupado === o.id} onClick={() => validar(o, false)} style={btn('#fee2e2', '#dc2626')}>Rechazar</button>
                    <button type="button" disabled={ocupado === o.id} onClick={() => validar(o, true)} style={btn('#16a34a', '#fff')}>Aprobar</button>
                  </div>
                </div>
              );
            })}
            <p style={{ ...muted, textAlign: 'center' }}>Cuando soporte aprueba el primer pedido de un cliente, los siguientes ya no pasan por aquí.</p>
          </div>
        )
      ) : tab === 'quietos' ? (
        quietos.pedidos.length === 0 ? (
          <div className="us-empty">
            <p>Ningún pedido está quieto. Aquí aparecen los que el negocio no confirma en {quietos.umbrales?.sin_confirmar || 10} min,
            los primeros pedidos sin validar después de {quietos.umbrales?.sin_validar || 20} min,
            y los que llevan {quietos.umbrales?.sin_repartidor || 15} min listos sin repartidor.</p>
          </div>
        ) : (
          <div style={{ maxWidth: 640 }}>
            {quietos.pedidos.map(o => {
              const m = MOTIVO_QUIETO[o.motivo] || { titulo: o.motivo, a: '', color: '#dc2626' };
              const waNegocio = numeroWa(o.negocio.telefono || o.negocio.vendedor_telefono);
              const waCliente = numeroWa(o.cliente.telefono);
              const textoNegocio = `Hola, te escribimos de ZIPPYGO. El pedido #${o.corto} de ${o.cliente.nombre} lleva ${o.minutos} minutos esperando. ¿Lo puedes atender o lo cancelamos?`;
              const textoCliente = `Hola ${o.cliente.nombre}, te escribimos de ZIPPYGO por tu pedido #${o.corto}. Estamos sobre él para que te llegue lo antes posible.`;
              return (
                <div key={o.id + o.motivo} style={{ ...card, border: `2px solid ${m.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <strong>#{o.corto}</strong>
                    <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: '#fee2e2', color: m.color }}>
                      quieto {o.minutos} min
                    </span>
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: 14, fontWeight: 700, color: m.color }}>{m.titulo}</p>
                  <p style={muted}>{m.a}</p>
                  <p style={{ ...muted, marginTop: 8 }}>{o.negocio.nombre} · <strong style={{ color: '#FF7A00' }}>{fmt(o.total)}</strong></p>
                  <p style={muted}>{o.cliente.nombre}{o.cliente.telefono ? ` · ${o.cliente.telefono}` : ''}</p>
                  <p style={muted}><Icon name="ubicacion" size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />{o.direccion_entrega}</p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    {waNegocio && (
                      <a href={`https://wa.me/${waNegocio}?text=${encodeURIComponent(textoNegocio)}`} target="_blank" rel="noopener noreferrer" style={btn('transparent', '#15803d', '1.5px solid #bbf7d0')}>
                        <Icon name="whatsapp" size={16} />Negocio
                      </a>
                    )}
                    {waCliente && (
                      <a href={`https://wa.me/${waCliente}?text=${encodeURIComponent(textoCliente)}`} target="_blank" rel="noopener noreferrer" style={btn('transparent', '#15803d', '1.5px solid #bbf7d0')}>
                        <Icon name="whatsapp" size={16} />Cliente
                      </a>
                    )}
                    {o.negocio.telefono && (
                      <a href={`tel:${o.negocio.telefono}`} style={btn('transparent', '#1e293b', '1.5px solid #e2e8f0')}>
                        <Icon name="telefono" size={16} />Llamar al negocio
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
            <p style={{ ...muted, textAlign: 'center' }}>Esta lista se calcula cada 30 segundos mientras tengas esta pantalla abierta.</p>
          </div>
        )
      ) : (
        reportados.length === 0 ? (
          <div className="us-empty"><p>Ningún repartidor ha reportado clientes.</p></div>
        ) : (
          <div style={{ maxWidth: 640 }}>
            {reportados.map(c => (
              <div key={c.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <strong>{c.nombre}</strong>
                  <span style={{
                    fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 999,
                    background: c.estado === 'suspendido' ? '#fee2e2' : '#fef3c7',
                    color: c.estado === 'suspendido' ? '#991b1b' : '#92400e',
                  }}>{c.estado === 'suspendido' ? 'Suspendido' : 'Activo'} · {c.reportes} reporte{c.reportes === 1 ? '' : 's'}</span>
                </div>
                <p style={muted}>{c.telefono || 'sin teléfono'} · {c.email}</p>
                {c.ultimo_motivo && (
                  <p style={{ margin: '8px 0 0', fontSize: 13 }}>Último reporte: "{c.ultimo_motivo}" · pedido #{c.ultimo_pedido} · {fecha(c.ultima_fecha)}</p>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button type="button" onClick={() => reactivar(c)} style={btn('transparent', '#1e293b', '1.5px solid #e2e8f0')}>
                    {c.estado === 'suspendido' ? 'Reactivar cuenta' : 'Borrar reportes'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </Layout>
  );
};

export default ValidacionPage;
