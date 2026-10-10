import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../config/api';
import Icon from './Icons';
import '../styles/ResumenNegocio.css';

/*
 * "Como va el negocio" — lo primero que ve el administrador.
 *
 * Antes el panel de inicio solo contaba usuarios, y no habia donde ver si
 * se estaba vendiendo. Todo sale de /admin/resumen/, calculado con los
 * pedidos reales y en hora de Colombia.
 */

const plata = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const etiquetaDia = (iso) => {
  const [a, m, d] = iso.split('-').map(Number);
  const f = new Date(a, m - 1, d);
  return `${DIAS[f.getDay()]} ${d}`;
};

const RANGOS = [
  { id: 'hoy',    label: 'Hoy' },
  { id: 'semana', label: '7 días' },
  { id: 'mes',    label: '30 días' },
];

const Tarjeta = ({ icono, color, fondo, valor, etiqueta, nota, onClick }) => (
  <div className={`rn-tarjeta flex-col gap-2 xs:flex-row xs:gap-3 ${onClick ? 'rn-tarjeta--link' : ''}`} onClick={onClick}>
    <div className="rn-tarjeta-icono" style={{ background: fondo, color }}><Icon name={icono} size={20} /></div>
    <div className="rn-tarjeta-texto">
      <p className="rn-tarjeta-valor whitespace-nowrap text-lg sm:text-[21px]">{valor}</p>
      <p className="rn-tarjeta-etiqueta">{etiqueta}</p>
      {nota && <p className="rn-tarjeta-nota">{nota}</p>}
    </div>
  </div>
);

const ResumenNegocio = () => {
  const navigate = useNavigate();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(false);
  const [rango, setRango] = useState('semana');

  useEffect(() => {
    let vivo = true;
    adminService.resumen()
      .then(({ data }) => { if (vivo) setDatos(data); })
      .catch(() => { if (vivo) setError(true); });
    return () => { vivo = false; };
  }, []);

  if (error) {
    return <div className="rn-aviso">No se pudo cargar el resumen del negocio. Revisa la conexión y recarga.</div>;
  }
  if (!datos) {
    return <div className="rn-aviso">Cargando cómo va el negocio…</div>;
  }

  const r = datos[rango];
  const grafica = datos.por_dia.map(d => ({ ...d, nombre: etiquetaDia(d.dia) }));
  const hayPedidos = grafica.some(d => d.pedidos > 0);

  return (
    <section className="rn">
      <div className="rn-cabecera">
        <h2 className="rn-titulo">Cómo va el negocio</h2>
        <div className="rn-rangos" role="tablist">
          {RANGOS.map(x => (
            <button
              key={x.id}
              className={`rn-rango ${rango === x.id ? 'rn-rango--activo' : ''}`}
              onClick={() => setRango(x.id)}
            >{x.label}</button>
          ))}
        </div>
      </div>

      {/* Lo que necesita atencion ahora mismo va primero y en rojo */}
      {datos.ahora.sin_aceptar > 0 && (
        <button className="rn-alerta" onClick={() => navigate('/validacion')}>
          <Icon name="alerta" size={18} />
          <span>
            <b>{datos.ahora.sin_aceptar} pedido{datos.ahora.sin_aceptar === 1 ? '' : 's'} sin aceptar</b> por el negocio hace más de 5 minutos
          </span>
          <span className="rn-alerta-ir">Ver →</span>
        </button>
      )}

      <div className="rn-tarjetas">
        <Tarjeta icono="dinero"   color="#15803d" fondo="#dcfce7" valor={plata(r.ventas)} etiqueta="Vendido" nota={`${r.entregados} pedido${r.entregados === 1 ? '' : 's'} entregado${r.entregados === 1 ? '' : 's'}`} />
        <Tarjeta icono="paquete"  color="#c2410c" fondo="#ffedd5" valor={r.pedidos} etiqueta="Pedidos" nota={r.cancelados ? `${r.cancelados} cancelado${r.cancelados === 1 ? '' : 's'}` : 'ninguno cancelado'} />
        <Tarjeta icono="billete"  color="#1d4ed8" fondo="#dbeafe" valor={plata(r.ticket_promedio)} etiqueta="Ticket promedio" nota="por pedido entregado" />
        <Tarjeta icono="reloj"    color="#7c3aed" fondo="#ede9fe" valor={datos.ahora.en_curso} etiqueta="En curso ahora" nota="pedidos sin terminar" />
      </div>

      <div className="rn-fila">
        <div className="rn-card rn-card--grafica">
          <h3 className="rn-card-titulo">Pedidos por día <span>últimos 14 días</span></h3>
          {hayPedidos ? (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={grafica} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.25)" />
                <XAxis dataKey="nombre" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" minTickGap={14} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,122,0,0.08)' }}
                  formatter={(v, k) => (k === 'ventas' ? [plata(v), 'Vendido'] : [v, 'Pedidos'])}
                  labelFormatter={(l) => l}
                />
                <Bar dataKey="pedidos" fill="#FF7A00" radius={[4, 4, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="rn-vacio">Todavía no hay pedidos en estos 14 días.</p>
          )}
        </div>

        <div className="rn-card">
          <h3 className="rn-card-titulo">Lo más vendido <span>30 días</span></h3>
          {datos.top_productos.length === 0 ? (
            <p className="rn-vacio">Aún no hay pedidos entregados.</p>
          ) : (
            <ol className="rn-lista">
              {datos.top_productos.map((p, i) => (
                <li key={i}>
                  <span className="rn-lista-pos">{i + 1}</span>
                  <span className="rn-lista-texto"><b>{p.nombre.trim()}</b><small>{p.negocio.trim()}</small></span>
                  <span className="rn-lista-dato">{p.cantidad} und</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="rn-card">
          <h3 className="rn-card-titulo">Negocios que más venden <span>30 días</span></h3>
          {datos.top_negocios.length === 0 ? (
            <p className="rn-vacio">Aún no hay ventas entregadas.</p>
          ) : (
            <ol className="rn-lista">
              {datos.top_negocios.map((n, i) => (
                <li key={i}>
                  <span className="rn-lista-pos">{i + 1}</span>
                  <span className="rn-lista-texto"><b>{n.nombre.trim()}</b><small>{n.pedidos} pedido{n.pedidos === 1 ? '' : 's'}</small></span>
                  <span className="rn-lista-dato">{plata(n.ventas)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="rn-chips">
        <span className="rn-chip"><Icon name="vendedores" size={15} /> {datos.negocios.activos} negocios activos · {datos.negocios.con_pedidos_semana} con pedidos esta semana</span>
        <span className="rn-chip"><Icon name="moto" size={15} /> {datos.repartidores_activos} repartidores activos</span>
        <span className="rn-chip"><Icon name="solicitudes" size={15} /> {datos.mandados_semana.total} mandados esta semana · {datos.mandados_semana.entregados} entregados</span>
        <span className="rn-chip"><Icon name="usuarios" size={15} /> {datos.clientes_nuevos_semana} clientes nuevos esta semana</span>
      </div>
    </section>
  );
};

export default ResumenNegocio;
