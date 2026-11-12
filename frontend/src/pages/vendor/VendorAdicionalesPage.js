import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import VendorLayout from '../../components/VendorLayout';
import CampoPesos from '../../components/CampoPesos';
import Icon from '../../components/Icons';
import { useToast } from '../../context/ToastContext';
import { adicionalesService } from '../../config/api';
import { cx, titulo, subtitulo, tarjeta } from '../../ui/tw';

// ============================================================================
// VendorAdicionalesPage — Mis productos → Adicionales (nov 2026).
//
// La lista de lo que el negocio cobra aparte encima de un producto (gomas,
// shot, extra queso). Se crean una vez; en cada producto se escoge cuáles
// salen (Editar producto). El interruptor apaga uno cuando se acaba.
// ============================================================================

const fmt = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;
const campo = 'box-border w-full min-w-0 rounded-[10px] border-[1.5px] border-solid border-slate-200 bg-white px-3 py-2.5 font-[inherit] text-[14px] text-slate-800 outline-none focus:border-zippy dark:border-noche-borde dark:bg-noche-alt dark:text-slate-100';

const Interruptor = ({ on, onClick, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    disabled={disabled}
    onClick={onClick}
    className={cx('relative h-6 w-10 shrink-0 cursor-pointer rounded-full border-0 transition-colors disabled:opacity-50', on ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600')}
  >
    <span className={cx('absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-all', on ? 'left-[19px]' : 'left-[3px]')} />
  </button>
);

const VendorAdicionalesPage = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [lista, setLista] = useState(null);
  const [nuevo, setNuevo] = useState({ nombre: '', precio: '' });
  const [editando, setEditando] = useState(null);   // { id, nombre, precio }
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    adicionalesService.mios().then(({ data }) => setLista(data || [])).catch(() => { setLista([]); addToast('No se pudieron cargar tus adicionales', 'error'); });
  }, [addToast]);

  const hacer = async (fn) => {
    setOcupado(true);
    try { await fn(); return true; } catch (e) {
      addToast(e?.response?.data?.detail || 'No se pudo guardar', 'error');
      return false;
    } finally { setOcupado(false); }
  };

  const crear = () => hacer(async () => {
    if (!nuevo.nombre.trim() || !Number(nuevo.precio)) { addToast('Escribe el nombre y el precio', 'error'); return; }
    const { data } = await adicionalesService.crear({ nombre: nuevo.nombre.trim(), precio: Number(nuevo.precio) });
    setLista(l => [...l, data]);
    setNuevo({ nombre: '', precio: '' });
  });

  const guardarEdicion = () => hacer(async () => {
    const { data } = await adicionalesService.cambiar(editando.id, { nombre: editando.nombre.trim(), precio: Number(editando.precio) });
    setLista(l => l.map(a => (a.id === data.id ? data : a)));
    setEditando(null);
  });

  const alternar = (a) => hacer(async () => {
    const { data } = await adicionalesService.cambiar(a.id, { disponible: !a.disponible });
    setLista(l => l.map(x => (x.id === data.id ? data : x)));
  });

  const borrar = (a) => {
    if (!window.confirm(`¿Borrar "${a.nombre}"? Se quita de todos tus productos.`)) return;
    hacer(async () => {
      await adicionalesService.borrar(a.id);
      setLista(l => l.filter(x => x.id !== a.id));
      setEditando(null);
    });
  };

  return (
    <VendorLayout>
      <button type="button" onClick={() => navigate('/vendor/productos')} className="mb-2 cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-[13px] font-bold text-zippy">← Mis productos</button>
      <h1 className={titulo}>Adicionales</h1>
      <p className={subtitulo}>Lo que cobras aparte encima de un producto: gomas, shot, extra queso… Los creas una vez y en cada producto escoges cuáles salen.</p>

      {lista === null ? (
        <p className="mt-6 text-center text-[13px] text-slate-500">Cargando…</p>
      ) : (
        <>
          {lista.length > 0 && (
            <div className={cx(tarjeta, 'mt-4 px-3.5 py-1')}>
              {lista.map((a, i) => (
                <div key={a.id} className={cx('py-2.5', i > 0 && 'border-0 border-t border-solid border-slate-100 dark:border-noche-borde')}>
                  {editando?.id === a.id ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <input className={campo} value={editando.nombre} onChange={e => setEditando(x => ({ ...x, nombre: e.target.value }))} maxLength={120} aria-label="Nombre" />
                        <CampoPesos className={cx(campo, 'w-[110px] shrink-0')} value={editando.precio} onChange={e => setEditando(x => ({ ...x, precio: e.target.value }))} aria-label="Precio" />
                      </div>
                      <div className="flex gap-2">
                        <button type="button" disabled={ocupado} onClick={guardarEdicion} className="flex-1 cursor-pointer rounded-xl border-0 bg-zippy py-2 font-[inherit] text-[13px] font-extrabold text-white">Guardar</button>
                        <button type="button" disabled={ocupado} onClick={() => setEditando(null)} className="flex-1 cursor-pointer rounded-xl border-[1.5px] border-solid border-slate-200 bg-transparent py-2 font-[inherit] text-[13px] font-bold text-slate-600 dark:border-noche-borde dark:text-slate-300">Cancelar</button>
                        <button type="button" disabled={ocupado} onClick={() => borrar(a)} className="cursor-pointer rounded-xl border-[1.5px] border-solid border-red-200 bg-transparent px-3 py-2 font-[inherit] text-[13px] font-bold text-red-600" aria-label={`Borrar ${a.nombre}`}><Icon name="equis" size={14} /></button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setEditando({ id: a.id, nombre: a.nombre, precio: String(Math.round(a.precio)) })} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left font-[inherit]">
                        <span className={cx('min-w-0 flex-1 truncate text-[14.5px] text-slate-800 dark:text-slate-100', !a.disponible && 'text-slate-400 line-through')}>{a.nombre}</span>
                        <b className="shrink-0 text-[14px] text-slate-700 dark:text-slate-200">{fmt(a.precio)}</b>
                      </button>
                      <Interruptor on={a.disponible} disabled={ocupado} onClick={() => alternar(a)} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {lista.length > 0 && (
            <p className="m-0 mt-2 px-1 text-[12px] text-slate-500">Toca uno para cambiarle el nombre o el precio. El interruptor lo apaga cuando se te acaba.</p>
          )}

          <div className={cx(tarjeta, 'mt-4 p-3.5')}>
            <p className="m-0 mb-2 text-[11px] font-extrabold uppercase tracking-[0.6px] text-slate-400">Nuevo adicional</p>
            <div className="flex gap-2">
              <input className={campo} value={nuevo.nombre} onChange={e => setNuevo(x => ({ ...x, nombre: e.target.value }))} placeholder="Ej: Leche condensada" maxLength={120} aria-label="Nombre del adicional" />
              <CampoPesos className={cx(campo, 'w-[110px] shrink-0')} value={nuevo.precio} onChange={e => setNuevo(x => ({ ...x, precio: e.target.value }))} placeholder="1.000" aria-label="Precio del adicional" />
            </div>
            <button type="button" disabled={ocupado} onClick={crear} className="mt-2.5 w-full cursor-pointer rounded-xl border-0 bg-zippy py-3 font-[inherit] text-[14px] font-extrabold text-white disabled:opacity-60">
              + Agregar adicional
            </button>
          </div>

          <p className="m-0 mt-3 px-1 text-[12.5px] text-slate-500">
            Para escoger en qué productos salen, entra a <b>Editar</b> en cada producto. Ahí puedes ponérselos de una vez a todos los de la misma categoría.
          </p>
        </>
      )}
    </VendorLayout>
  );
};

export default VendorAdicionalesPage;
