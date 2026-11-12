import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import Icon from '../components/Icons';
import { avisosService, negociosService } from '../config/api';
import { useToast } from '../context/ToastContext';
import { fechaHoraCorta } from '../utils/fechas';
import { cx } from '../ui/tw';

// ============================================================================
// AvisosPage — Súper admin: avisos de novedades a los clientes (nov 2026).
// Mandar un aviso (máximo uno al día), encender el aviso automático de
// negocios nuevos y ver el historial. Solo les llega a los clientes que
// aceptaron (ver PermisoNovedades y backend/routes_avisos.py).
// ============================================================================

const campo = 'box-border w-full rounded-[10px] border-[1.5px] border-solid border-slate-200 bg-white px-3 py-2.5 font-[inherit] text-[14px] text-slate-800 outline-none focus:border-zippy dark:border-noche-borde dark:bg-noche-alt dark:text-slate-100';
const etiqueta = 'm-0 mb-1.5 mt-3 block text-[11px] font-extrabold uppercase tracking-[0.6px] text-slate-400';
const tarjeta = 'rounded-2xl bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)] dark:bg-noche-card';

const AvisosPage = () => {
  const { addToast } = useToast();
  const [panel, setPanel] = useState(null);
  const [negocios, setNegocios] = useState([]);
  const [form, setForm] = useState({ titulo: '', mensaje: '', negocio_id: '' });
  const [destino, setDestino] = useState('inicio');
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(() => {
    avisosService.panel().then(({ data }) => setPanel(data)).catch(() => addToast('No se pudieron cargar los avisos', 'error'));
  }, [addToast]);

  useEffect(() => {
    cargar();
    negociosService.listar({ limit: 100 }).then(({ data }) => setNegocios((data || []).filter(n => n.estado === 'activo'))).catch(() => {});
  }, [cargar]);

  const bloqueado = !!panel?.proximo_permitido;
  const listo = form.titulo.trim().length >= 3 && form.mensaje.trim().length >= 3 && (destino === 'inicio' || form.negocio_id);

  const enviar = async () => {
    if (!window.confirm(`¿Mandar este aviso a ${panel?.destinatarios || 0} clientes?`)) return;
    setEnviando(true);
    try {
      const { data } = await avisosService.enviar({
        titulo: form.titulo.trim(),
        mensaje: form.mensaje.trim(),
        negocio_id: destino === 'tienda' ? form.negocio_id : null,
      });
      addToast(`Aviso enviado a ${data.enviados} celulares`, 'success');
      setForm({ titulo: '', mensaje: '', negocio_id: '' });
      cargar();
    } catch (e) {
      addToast(e?.response?.data?.detail || 'No se pudo enviar', 'error');
    } finally {
      setEnviando(false);
    }
  };

  const cambiarAuto = async () => {
    try {
      const { data } = await avisosService.cambiarAuto(!panel.auto_activo);
      setPanel(p => ({ ...p, auto_activo: data.auto_activo }));
    } catch {
      addToast('No se pudo cambiar', 'error');
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-[720px]">
        <h1 className="m-0 flex items-center gap-2 text-[22px] font-extrabold text-slate-800 dark:text-slate-100"><Icon name="notificaciones" size={24} />Avisos a clientes</h1>
        <p className="m-0 mt-0.5 text-[13px] text-slate-500">Novedades y promociones al celular de los clientes que aceptaron recibirlas.</p>

        {!panel ? (
          <p className="mt-6 text-center text-[13px] text-slate-500">Cargando…</p>
        ) : (
          <>
            <div className={cx(tarjeta, 'mt-4')}>
              <span className={cx(etiqueta, 'mt-0')}>Título</span>
              <input className={campo} value={form.titulo} maxLength={120} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Llegaron los granizados" />
              <span className={etiqueta}>Mensaje</span>
              <textarea className={cx(campo, 'resize-none')} rows={3} value={form.mensaje} maxLength={300} onChange={e => setForm(f => ({ ...f, mensaje: e.target.value }))} placeholder="Ej: Granizados Ice Colors ya está en ZIPPYGO. Pídelo y te llega a la casa." />
              <span className={etiqueta}>Al tocarlo, abre</span>
              <div className="flex gap-2">
                {[['inicio', 'El inicio'], ['tienda', 'Una tienda']].map(([id, txt]) => (
                  <button key={id} type="button" onClick={() => setDestino(id)}
                    className={cx('flex-1 cursor-pointer rounded-[10px] border-[1.5px] border-solid py-2 font-[inherit] text-[13px] font-bold',
                      destino === id ? 'border-zippy bg-orange-50 text-orange-700 dark:bg-zippy/10 dark:text-orange-300' : 'border-slate-200 bg-white text-slate-600 dark:border-noche-borde dark:bg-noche-alt dark:text-slate-300')}>
                    {txt}
                  </button>
                ))}
              </div>
              {destino === 'tienda' && (
                <select className={cx(campo, 'mt-2')} value={form.negocio_id} onChange={e => setForm(f => ({ ...f, negocio_id: e.target.value }))}>
                  <option value="">Escoge la tienda</option>
                  {negocios.map(n => <option key={n.id} value={n.id}>{n.nombre_negocio}</option>)}
                </select>
              )}

              {(form.titulo || form.mensaje) && (
                <>
                  <span className={etiqueta}>Así le llega</span>
                  <div className="flex gap-2.5 rounded-2xl bg-slate-100 p-3 dark:bg-noche-alt">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-zippy text-[18px] font-black text-white">Z</span>
                    <div className="min-w-0">
                      <b className="block text-[14px] text-slate-800 dark:text-slate-100">{form.titulo || 'Título'}</b>
                      <p className="m-0 line-clamp-2 text-[13px] text-slate-600 dark:text-slate-300">{form.mensaje || 'Mensaje'}</p>
                    </div>
                  </div>
                </>
              )}
              <p className="m-0 mt-3 text-[12.5px] text-slate-500">
                Le llega a <b>{panel.destinatarios}</b> {panel.destinatarios === 1 ? 'cliente que aceptó' : 'clientes que aceptaron'} recibir novedades
                {panel.clientes_con_app > panel.destinatarios ? ` (de ${panel.clientes_con_app} con la app)` : ''}.
              </p>
            </div>

            <button type="button" disabled={!listo || enviando || bloqueado || !panel.destinatarios} onClick={enviar}
              className="mt-3 w-full cursor-pointer rounded-2xl border-0 bg-zippy p-3.5 font-[inherit] text-[15px] font-extrabold text-white shadow-[0_6px_18px_rgba(255,122,0,0.3)] disabled:cursor-not-allowed disabled:opacity-50">
              {enviando ? 'Enviando…' : 'Enviar aviso'}
            </button>
            <p className="m-0 mt-2 text-center text-[12px] text-slate-500">
              {bloqueado
                ? `Ya se mandó un aviso hoy. El próximo se puede desde ${fechaHoraCorta(panel.proximo_permitido)}.`
                : 'Máximo 1 aviso al día, para que nadie se aburra y desinstale.'}
            </p>

            <div className={cx(tarjeta, 'mt-5 flex items-center gap-3')}>
              <div className="min-w-0 flex-1">
                <b className="block text-[14.5px] text-slate-800 dark:text-slate-100">Anunciar negocios nuevos solos</b>
                <p className="m-0 mt-0.5 text-[12.5px] leading-snug text-slate-500">Cuando un negocio nuevo ya tiene 3 productos o más publicados, se les avisa a los clientes una sola vez. Antes no, para que nadie abra una tienda vacía.</p>
              </div>
              <button type="button" role="switch" aria-checked={panel.auto_activo} onClick={cambiarAuto} aria-label="Anunciar negocios nuevos"
                className={cx('relative h-[26px] w-[46px] shrink-0 cursor-pointer rounded-full border-0 transition-colors', panel.auto_activo ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600')}>
                <span className={cx('absolute top-[3px] h-5 w-5 rounded-full bg-white transition-all', panel.auto_activo ? 'left-[23px]' : 'left-[3px]')} />
              </button>
            </div>

            <p className="m-0 mb-2 mt-5 text-[11px] font-extrabold uppercase tracking-[0.6px] text-slate-400">Avisos enviados</p>
            {panel.historial.length === 0 ? (
              <div className={cx(tarjeta, 'text-center text-[13px] text-slate-500')}>Todavía no se ha mandado ningún aviso.</div>
            ) : (
              <div className={cx(tarjeta, 'py-1')}>
                {panel.historial.map((a, i) => (
                  <div key={a.id} className={cx('py-2.5', i > 0 && 'border-0 border-t border-solid border-slate-100 dark:border-noche-borde')}>
                    <b className="block text-[14px] text-slate-800 dark:text-slate-100">{a.titulo}</b>
                    <p className="m-0 mt-0.5 text-[12px] text-slate-500">
                      {a.tipo === 'automatico' ? 'Automático' : (a.autor || 'Admin')} · {fechaHoraCorta(a.fecha)} · {a.enviados} celulares · {a.abiertos} lo abrieron
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default AvisosPage;
