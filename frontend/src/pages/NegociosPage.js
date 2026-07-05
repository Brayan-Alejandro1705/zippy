import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { negociosService } from '../config/api';
import Layout from '../components/Layout';
import '../styles/Negocios.css';

const COLORS = ['#FF7A00', '#3b82f6', '#22c55e', '#9b59b6', '#ef4444', '#f59e0b', '#14b8a6'];

const MOCK_NEGOCIOS = [];

const StatCard = ({ label, value, sub, color }) => (
  <div className="ng-stat" style={{ borderLeftColor: color }}>
    <div className="ng-stat-value" style={{ color }}>{value}</div>
    <div className="ng-stat-label">{label}</div>
    {sub && <div className="ng-stat-sub">{sub}</div>}
  </div>
);

const NegociosPage = () => {
  const [negocios, setNegocios]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [busqueda, setBusqueda]   = useState('');
  const [filtroEstado, setFiltro] = useState('Todos');

  useEffect(() => {
    negociosService.listar()
      .then(res => setNegocios(res.data.results ?? res.data))
      .catch(() => setNegocios(MOCK_NEGOCIOS))
      .finally(() => setLoading(false));
  }, []);

  const filtrados = negocios.filter(n => {
    const q = busqueda.toLowerCase();
    const coincide = !q
      || n.nombre_negocio?.toLowerCase().includes(q)
      || n.categoria?.toLowerCase().includes(q)
      || n.ciudad?.toLowerCase().includes(q);
    return coincide && (filtroEstado === 'Todos' || n.estado === filtroEstado.toLowerCase());
  });

  // Stats generales
  const totalActivos    = negocios.filter(n => n.estado === 'activo').length;
  const totalVentas     = negocios.reduce((s, n) => s + (n.total_ventas || 0), 0);
  const totalProductos  = negocios.reduce((s, n) => s + (n.total_productos || 0), 0);

  // Datos para gráfica de barras (top 8 por ventas)
  const dataBarras = [...filtrados]
    .sort((a, b) => (b.total_ventas || 0) - (a.total_ventas || 0))
    .slice(0, 8)
    .map(n => ({
      nombre: n.nombre_negocio?.length > 12 ? n.nombre_negocio.slice(0, 12) + '…' : n.nombre_negocio,
      ventas: n.total_ventas || 0,
      ordenes: n.total_ordenes || 0,
    }));

  // Datos para gráfica de torta por categoría
  const porCategoria = negocios.reduce((acc, n) => {
    const cat = n.categoria || 'General';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});
  const dataTorta = Object.entries(porCategoria).map(([name, value]) => ({ name, value }));

  return (
    <Layout>
      <div className="ng-page-header">
        <div>
          <h1 className="ng-title">🏬 Negocios</h1>
          <p className="ng-subtitle">Todos los negocios registrados en la plataforma</p>
        </div>
      </div>

      {/* Stats */}
      <div className="ng-stats-row">
        <StatCard label="Total negocios"  value={negocios.length}        color="#FF7A00" />
        <StatCard label="Activos"         value={totalActivos}           color="#22c55e" />
        <StatCard label="Suspendidos"     value={negocios.length - totalActivos} color="#ef4444" />
        <StatCard label="Ventas totales"  value={`$${totalVentas.toLocaleString()}`} color="#3b82f6" sub="COP" />
        <StatCard label="Productos"       value={totalProductos}         color="#9b59b6" />
      </div>

      {/* Gráficas */}
      {negocios.length > 0 && (
        <div className="ng-charts-row">
          {/* Barras — ventas por negocio */}
          <div className="ng-chart-card">
            <h3 className="ng-chart-title">📊 Ventas por negocio (top 8)</h3>
            {dataBarras.length === 0 ? (
              <div className="ng-chart-empty">Sin datos de ventas aún</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dataBarras} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="nombre" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`$${v.toLocaleString()}`, 'Ventas']} />
                  <Bar dataKey="ventas" fill="#FF7A00" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Torta — por categoría */}
          <div className="ng-chart-card">
            <h3 className="ng-chart-title">🍕 Negocios por categoría</h3>
            {dataTorta.length === 0 ? (
              <div className="ng-chart-empty">Sin datos aún</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={dataTorta} cx="50%" cy="45%" outerRadius={75} dataKey="value" label={({ name, percent }) => `${(percent*100).toFixed(0)}%`} labelLine={false}>
                    {dataTorta.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="ng-filters">
        <input
          className="ng-search"
          placeholder="🔍  Buscar negocio, categoría o ciudad..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <select className="ng-select" value={filtroEstado} onChange={e => setFiltro(e.target.value)}>
          <option>Todos</option>
          <option>Activo</option>
          <option>Suspendido</option>
        </select>
      </div>

      {/* Cards de negocios */}
      {loading ? (
        <div className="ng-grid">
          {[1,2,3,4,5,6].map(i => <div key={i} className="ng-skeleton" />)}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="ng-empty">
          <div className="ng-empty-icon">🏬</div>
          <p>No hay negocios registrados aún.</p>
        </div>
      ) : (
        <div className="ng-grid">
          {filtrados.map((n, i) => (
            <div key={n.id} className="ng-card">
              {/* Avatar del negocio */}
              <div className="ng-card-avatar" style={{ background: COLORS[i % COLORS.length] }}>
                {n.logo
                  ? <img src={n.logo} alt={n.nombre_negocio} />
                  : <span>{n.nombre_negocio?.charAt(0) ?? '?'}</span>
                }
              </div>

              <div className="ng-card-info">
                <div className="ng-card-nombre">{n.nombre_negocio}</div>
                <div className="ng-card-categoria">{n.categoria}</div>
                {n.ciudad && <div className="ng-card-ciudad">📍 {n.ciudad}</div>}
              </div>

              <span className={`ng-badge ${n.estado === 'activo' ? 'ng-badge--activo' : 'ng-badge--suspendido'}`}>
                {n.estado === 'activo' ? '🟢 Activo' : '🔴 Suspendido'}
              </span>

              <div className="ng-card-stats">
                <div className="ng-mini-stat">
                  <span className="ng-mini-val">${(n.total_ventas || 0).toLocaleString()}</span>
                  <span className="ng-mini-label">Ventas</span>
                </div>
                <div className="ng-mini-stat">
                  <span className="ng-mini-val">{n.total_ordenes || 0}</span>
                  <span className="ng-mini-label">Órdenes</span>
                </div>
                <div className="ng-mini-stat">
                  <span className="ng-mini-val">{n.calificacion_promedio || '–'}</span>
                  <span className="ng-mini-label">⭐ Rating</span>
                </div>
              </div>

              {/* Barra de ventas relativa */}
              {totalVentas > 0 && (
                <div className="ng-card-bar-wrap">
                  <div
                    className="ng-card-bar"
                    style={{
                      width: `${Math.min(((n.total_ventas || 0) / totalVentas) * 100, 100)}%`,
                      background: COLORS[i % COLORS.length],
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
};

export default NegociosPage;
