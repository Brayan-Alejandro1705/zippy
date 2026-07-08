import React, { useState, useEffect } from 'react';
import VendorLayout from '../../components/VendorLayout';
import { useToast } from '../../context/ToastContext';
import { negociosService, ordenesService } from '../../config/api';
import ZLoader from '../../components/ZLoader';
import '../../styles/VendorPagos.css';
import '../../styles/VendorOrdenes.css';
import '../../styles/VendorProductos.css';

const fmt = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;

const VendorPagosPage = () => {
  const { addToast } = useToast();

  const [loading, setLoading]   = useState(true);
  const [negocio, setNegocio]   = useState(null);
  const [comision, setComision] = useState(0);
  const [ordenes, setOrdenes]   = useState([]);

  const [modalCuenta, setModalCuenta] = useState(false);
  const [cuentaForm, setCuentaForm]   = useState({ banco: '', cuenta_tipo: '', cuenta_numero: '' });
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const { data: negocioData } = await negociosService.miNegocio();
        const [{ data: stats }, { data: ordenesRaw }] = await Promise.all([
          negociosService.estadisticas(negocioData.id),
          ordenesService.listar(),
        ]);
        if (!activo) return;
        setNegocio(negocioData);
        setComision(stats.comision_porcentaje);
        setOrdenes(ordenesRaw);
        setCuentaForm({
          banco:         negocioData.banco         || '',
          cuenta_tipo:   negocioData.cuenta_tipo    || '',
          cuenta_numero: negocioData.cuenta_numero  || '',
        });
      } catch {
        if (activo) setOrdenes([]);
      } finally {
        if (activo) setLoading(false);
      }
    })();
    return () => { activo = false; };
  }, []);

  const completadas = ordenes.filter(o => o.estado === 'entregada');

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const completadasEsteMes = completadas.filter(o => new Date(o.fecha_creacion) >= inicioMes);

  const brutoEsteMes    = completadasEsteMes.reduce((s, o) => s + Number(o.total), 0);
  const retenidoEsteMes = brutoEsteMes * (comision / 100);
  const totalHistorico  = completadas.reduce((s, o) => s + Number(o.total), 0);

  const guardarCuenta = async () => {
    setSaving(true);
    try {
      await negociosService.actualizar(negocio.id, cuentaForm);
      setNegocio(n => ({ ...n, ...cuentaForm }));
      addToast('Cuenta para pagos actualizada', 'success');
      setModalCuenta(false);
    } catch (err) {
      addToast(err.response?.data?.detail || 'No se pudo actualizar la cuenta', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <VendorLayout searchPlaceholder="Buscar...">
      <div className="vpg-page-header">
        <h1 className="vpg-title">Pagos y Comisiones</h1>
        <p className="vpg-subtitle">Resumen de tus ganancias y próximos pagos</p>
      </div>

      {loading ? (
        <ZLoader size="sm" />
      ) : (
        <>
          <div className="vpg-stats">
            <div className="vpg-stat vpg-stat--green">
              <span className="vpg-stat-label">Ganado este mes</span>
              <span className="vpg-stat-val">{fmt(brutoEsteMes)}</span>
              <span className="vpg-stat-sub">Bruto antes de comisión</span>
            </div>
            <div className="vpg-stat vpg-stat--orange">
              <span className="vpg-stat-label">Comisión de la plataforma</span>
              <span className="vpg-stat-val">{comision}%</span>
              <span className="vpg-stat-sub">{fmt(retenidoEsteMes)} retenidos este mes</span>
            </div>
            <div className="vpg-stat vpg-stat--blue">
              <span className="vpg-stat-label">Liquidaciones</span>
              <span className="vpg-stat-val">Próximamente</span>
              <span className="vpg-stat-sub">Aún no hay ciclo de pagos configurado</span>
            </div>
            <div className="vpg-stat vpg-stat--purple">
              <span className="vpg-stat-label">Total histórico</span>
              <span className="vpg-stat-val">{fmt(totalHistorico)}</span>
              <span className="vpg-stat-sub">Desde tu registro</span>
            </div>
          </div>

          <div className="vpg-info-card">
            <span className="vpg-info-icon">🏦</span>
            <div className="vpg-info-text-wrap">
              <p className="vpg-info-title">Cuenta para pagos</p>
              <p className="vpg-info-text">
                {negocio?.banco
                  ? `${negocio.banco} · ${negocio.cuenta_tipo} •••• ${negocio.cuenta_numero?.slice(-4)}`
                  : 'No has registrado una cuenta para recibir pagos.'}
              </p>
            </div>
            <button className="vpg-info-btn" onClick={() => setModalCuenta(true)}>
              {negocio?.banco ? 'Cambiar cuenta' : 'Agregar cuenta'}
            </button>
          </div>

          <div className="vpg-table-section">
            <div className="vpg-table-header">Historial de pagos</div>
            <p style={{ padding: '24px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              Las liquidaciones quincenales todavía no están implementadas en la plataforma.
              Por ahora puedes ver tus ganancias acumuladas en las tarjetas de arriba.
            </p>
          </div>
        </>
      )}

      {modalCuenta && (
        <div className="vo-modal-overlay" onClick={() => !saving && setModalCuenta(false)}>
          <div className="vo-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="vo-modal-header">
              <h3>Cuenta para pagos</h3>
              <button className="vo-modal-close" onClick={() => setModalCuenta(false)}>✕</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="vnp-field">
                <label>Banco</label>
                <input
                  value={cuentaForm.banco}
                  onChange={e => setCuentaForm(f => ({ ...f, banco: e.target.value }))}
                  placeholder="Ej. Bancolombia"
                />
              </div>
              <div className="vnp-field">
                <label>Tipo de cuenta</label>
                <select
                  value={cuentaForm.cuenta_tipo}
                  onChange={e => setCuentaForm(f => ({ ...f, cuenta_tipo: e.target.value }))}
                >
                  <option value="">Selecciona</option>
                  <option value="Ahorros">Ahorros</option>
                  <option value="Corriente">Corriente</option>
                </select>
              </div>
              <div className="vnp-field">
                <label>Número de cuenta</label>
                <input
                  value={cuentaForm.cuenta_numero}
                  onChange={e => setCuentaForm(f => ({ ...f, cuenta_numero: e.target.value }))}
                  placeholder="Ej. 1234567890"
                />
              </div>
              <button className="vnp-btn-next" disabled={saving} onClick={guardarCuenta} style={{ marginTop: 8 }}>
                {saving ? 'Guardando...' : 'Guardar cuenta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </VendorLayout>
  );
};

export default VendorPagosPage;
