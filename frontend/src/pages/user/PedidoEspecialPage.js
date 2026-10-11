import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserLayout from '../../components/UserLayout';
import { useToast } from '../../context/ToastContext';
import { cx, tarjeta } from '../../ui/tw';
import { pedidosEspecialesService, mandadoService } from '../../config/api';
import Icon from '../../components/Icons';

const UNIDADES = ['unidad', 'kg', 'g', 'libra', 'litro', 'ml', 'paquete', 'caja', 'lata', 'botella'];

const itemVacio = () => ({ id: Date.now() + Math.random(), descripcion: '', cantidad: 1, unidad: 'unidad' });

const PedidoEspecialPage = () => {
  const navigate = useNavigate();

  // Los mandados son de la cuenta: sin sesion, al login
  useEffect(() => {
    if (!localStorage.getItem('access_token')) navigate('/login');
  }, [navigate]);
  const { addToast } = useToast();

  const [items, setItems] = useState([itemVacio()]);
  const [origen, setOrigen] = useState('');
  const [direccion, setDireccion] = useState('');
  const [barrio, setBarrio] = useState('');
  const [telefono, setTelefono] = useState('');
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);
  // Lo que cobra ZIPPYGO por el mandado. Se pide al servidor y no se escribe
  // aqui para que cambiarlo sea cosa del panel, no de recompilar la app.
  const [costo, setCosto] = useState(null);

  useEffect(() => {
    let activo = true;
    mandadoService.costo()
      .then(({ data }) => { if (activo) setCosto(Number(data?.costo_mandado) || null); })
      .catch(() => { if (activo) setCosto(null); });
    return () => { activo = false; };
  }, []);

  const agregarItem = () => setItems(prev => [...prev, itemVacio()]);

  const eliminarItem = id => setItems(prev => prev.filter(i => i.id !== id));

  const actualizarItem = (id, campo, valor) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, [campo]: valor } : i));

  const itemsValidos = items.filter(i => i.descripcion.trim() !== '');

  const handleSubmit = async e => {
    e.preventDefault();
    if (itemsValidos.length === 0) {
      addToast('Agrega al menos un producto al pedido', 'warning');
      return;
    }
    if (!direccion.trim()) {
      addToast('Ingresa la dirección de entrega', 'warning');
      return;
    }

    setEnviando(true);

    try {
      await pedidosEspecialesService.crear({
        items: itemsValidos.map(i => ({
          descripcion: i.descripcion.trim(),
          cantidad: i.cantidad,
          unidad: i.unidad,
        })),
        origen: origen.trim(),
        direccion: direccion.trim(),
        barrio: barrio.trim(),
        telefono: telefono.trim(),
        notas: notas.trim(),
      });
      addToast('¡Mandado enviado! Un domiciliario lo tomará pronto.', 'success');
      navigate('/tienda');
    } catch (err) {
      const detalle = err?.response?.data?.detail;
      addToast(typeof detalle === 'string' ? detalle : 'No se pudo enviar el pedido', 'error');
    } finally {
      setEnviando(false);
    }
  };

  // ── Piezas de estilo ─────────────────────────────────────────────────────
  const seccion = cx(tarjeta, 'p-4 xs:p-5');
  const tituloSeccion = 'm-0 text-base font-bold text-slate-800 dark:text-slate-100';
  const etiqueta = 'mb-1.5 block text-xs font-semibold uppercase tracking-[0.4px] text-slate-500';
  const campo = 'box-border w-full rounded-[10px] border-[1.5px] border-solid border-slate-200 bg-white px-3 py-2.5 font-[inherit] text-sm text-slate-800 outline-none transition-colors focus:border-zippy dark:border-noche-borde dark:bg-noche dark:text-slate-100';

  return (
    <UserLayout>
      <div className="mx-auto max-w-[640px] px-3 pb-10 pt-4 xs:px-4 md:px-0">
        <div className="mb-6 flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zippy-50 text-zippy dark:bg-zippy/15"><Icon name="solicitudes" size={24} /></span>
          <div className="min-w-0">
            <h1 className="m-0 mb-1 text-xl font-extrabold text-slate-800 dark:text-slate-100 sm:text-2xl">Mandado</h1>
            <p className="m-0 text-sm text-slate-500 dark:text-slate-400">Describe exactamente lo que necesitas y el domiciliario lo consigue</p>
          </div>
        </div>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>

          {/* Lista de productos */}
          <section className={seccion}>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-1">
              <h2 className={tituloSeccion}>¿Qué necesitas?</h2>
              <span className="text-xs text-slate-400">Sé lo más específico posible</span>
            </div>

            <div className="flex flex-col gap-3.5">
              {items.map((item, idx) => (
                <div key={item.id} className="flex items-start gap-3 rounded-xl border-[1.5px] border-solid border-slate-200 bg-slate-50 p-3 transition-colors focus-within:border-zippy dark:border-noche-borde dark:bg-noche xs:p-3.5">
                  <div className="mt-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zippy text-xs font-bold text-white">{idx + 1}</div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                    <input
                      className={campo}
                      placeholder="Ej: Leche entera, marca Alquería"
                      value={item.descripcion}
                      onChange={e => actualizarItem(item.id, 'descripcion', e.target.value)}
                      aria-label={`Producto ${idx + 1}`}
                    />
                    <div className="flex flex-wrap items-end gap-2.5">
                      <div className="flex flex-col">
                        <label className={etiqueta}>Cantidad</label>
                        <div className="flex items-center overflow-hidden rounded-[10px] border-[1.5px] border-solid border-slate-200 bg-white dark:border-noche-borde dark:bg-noche">
                          <button
                            type="button"
                            className="flex h-[38px] w-[34px] cursor-pointer items-center justify-center border-0 bg-transparent text-lg font-bold text-zippy hover:bg-[#fff3e8] dark:text-orange-400 dark:hover:bg-noche-card"
                            onClick={() => actualizarItem(item.id, 'cantidad', Math.max(1, item.cantidad - 1))}
                            aria-label="Menos"
                          >−</button>
                          <input
                            className="w-11 border-0 bg-white text-center font-[inherit] text-[15px] font-bold text-slate-800 outline-none [appearance:textfield] dark:bg-noche dark:text-slate-100 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            type="number"
                            min="1"
                            value={item.cantidad}
                            onChange={e => actualizarItem(item.id, 'cantidad', Math.max(1, parseInt(e.target.value) || 1))}
                            aria-label="Cantidad"
                          />
                          <button
                            type="button"
                            className="flex h-[38px] w-[34px] cursor-pointer items-center justify-center border-0 bg-transparent text-lg font-bold text-zippy hover:bg-[#fff3e8] dark:text-orange-400 dark:hover:bg-noche-card"
                            onClick={() => actualizarItem(item.id, 'cantidad', item.cantidad + 1)}
                            aria-label="Más"
                          >+</button>
                        </div>
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <label className={etiqueta}>Unidad</label>
                        <select
                          className={cx(campo, 'w-auto cursor-pointer')}
                          value={item.unidad}
                          onChange={e => actualizarItem(item.id, 'unidad', e.target.value)}
                        >
                          {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      {items.length > 1 && (
                        <button
                          type="button"
                          className="mb-0.5 flex h-[34px] w-[34px] shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-red-100 text-[13px] text-red-500 hover:bg-red-200"
                          onClick={() => eliminarItem(item.id)}
                          title="Eliminar"
                          aria-label="Eliminar producto"
                        >✕</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button type="button" className="mt-3.5 w-full cursor-pointer rounded-xl border-2 border-dashed border-zippy bg-[#fff3e8] p-3 text-sm font-bold text-zippy hover:bg-[#ffe8cc] dark:bg-zippy/10" onClick={agregarItem}>
              + Agregar otro producto
            </button>
          </section>

          {/* Entrega */}
          <section className={seccion}>
            <h2 className={cx(tituloSeccion, 'mb-4')}>Datos de entrega</h2>
            <div className="flex flex-col gap-3">
              {/* Antes no se preguntaba de donde, asi que el repartidor aceptaba
                  sin saber si era la tienda de la esquina o la plaza. */}
              <div>
                <label className={etiqueta}>¿De dónde lo traemos?</label>
                <input className={campo} placeholder="Ej: La plaza de mercado, Éxito, la droguería de la 5ta" value={origen} onChange={e => setOrigen(e.target.value)} />
              </div>
              <div>
                <label className={etiqueta}>Dirección *</label>
                <input className={campo} placeholder="Ej: Cra 5 #23-45, Apto 301" value={direccion} onChange={e => setDireccion(e.target.value)} required />
              </div>
              {/* Barrio y telefono uno al lado del otro solo si hay espacio */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <label className={etiqueta}>Barrio</label>
                  <input className={campo} placeholder="Ej: Centro" value={barrio} onChange={e => setBarrio(e.target.value)} />
                </div>
                <div className="min-w-0">
                  <label className={etiqueta}>Teléfono de contacto</label>
                  <input className={campo} placeholder="Ej: 310-000-0000" value={telefono} onChange={e => setTelefono(e.target.value)} inputMode="tel" />
                </div>
              </div>
              <div>
                <label className={etiqueta}>Instrucciones adicionales</label>
                <textarea className={cx(campo, 'resize-y')} placeholder="Ej: Golpear la puerta, no hay timbre. Traer factura." value={notas} onChange={e => setNotas(e.target.value)} rows={3} />
              </div>
            </div>
          </section>

          {/* Resumen */}
          {itemsValidos.length > 0 && (
            <div className="rounded-2xl border-[1.5px] border-solid border-green-300 bg-green-50 px-4 py-4 dark:border-green-800 dark:bg-[#052e16] xs:px-5">
              <p className="m-0 mb-2.5 text-[13px] font-bold uppercase tracking-[0.4px] text-green-700 dark:text-green-400">Resumen del pedido</p>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {itemsValidos.map(i => (
                  <li key={i.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 text-sm text-slate-800 dark:text-slate-200">{i.descripcion}</span>
                    <span className="whitespace-nowrap rounded-full bg-green-100 px-2.5 py-0.5 text-[13px] font-bold text-green-700 dark:bg-green-500/15 dark:text-green-300">{i.cantidad} {i.unidad}</span>
                  </li>
                ))}
              </ul>
              {costo != null && (
                <div className="mt-3.5 border-0 border-t border-dashed border-slate-300 pt-3.5">
                  <div className="flex items-baseline justify-between text-[15px] text-slate-800 dark:text-slate-200">
                    <span>Servicio del mandado</span>
                    <strong className="text-[17px] text-zippy">${costo.toLocaleString('es-CO')}</strong>
                  </div>
                  <p className="m-0 mt-1.5 text-[12.5px] leading-snug text-slate-500 dark:text-slate-400">
                    Aparte pagas lo que valgan las cosas que te traigan. El
                    repartidor te cobra todo junto al entregar, en efectivo.
                  </p>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            className="w-full cursor-pointer rounded-[14px] border-0 bg-zippy p-4 text-base font-extrabold tracking-[0.3px] text-white transition hover:enabled:-translate-y-px hover:enabled:bg-[#e06900] disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={enviando}
          >
            {enviando ? 'Enviando mandado…' : 'Enviar mandado'}
          </button>
        </form>
      </div>
    </UserLayout>
  );
};

export default PedidoEspecialPage;