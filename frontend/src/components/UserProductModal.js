import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import Icon from './Icons';
import { urlImagen } from '../utils/media';
import { estaAbierto, textoCerrado } from '../utils/horario';
import { cx } from '../ui/tw';
import { useCerrarConAtras } from '../utils/atras';
import { adicionalesService } from '../config/api';
import { tieneOpciones, opcionesIniciales, precioConOpciones } from '../utils/opciones';

const Stars = ({ n, size = 14 }) => (
  <span style={{ fontSize: size, letterSpacing: 1 }}>
    {[1, 2, 3, 4, 5].map(i => (
      <span key={i} style={{ color: i <= n ? '#fbbf24' : '#e2e8f0' }}>★</span>
    ))}
  </span>
);

const fmt = n => `$${n.toLocaleString('es-CO')}`;

// Nov 2026 (Granizados): botones grandes para escoger una opción
const Segmentos = ({ titulo, opciones, valor, onCambio }) => (
  <div className="mb-4">
    <div className="mb-1.5 flex items-center justify-between">
      <b className="text-[15px] text-slate-800 dark:text-slate-100">{titulo}</b>
      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10.5px] font-extrabold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Obligatorio</span>
    </div>
    <div className="flex gap-2">
      {opciones.map(o => {
        const on = o.valor === valor;
        return (
          <button key={String(o.valor)} type="button" onClick={() => onCambio(o.valor)} aria-pressed={on}
            className={cx('flex-1 cursor-pointer rounded-xl border-[1.5px] border-solid px-2 py-2.5 text-center font-[inherit]',
              on ? 'border-zippy bg-orange-50 dark:bg-zippy/10' : 'border-slate-200 bg-white dark:border-noche-borde dark:bg-noche-alt')}>
            <b className={cx('block text-[14.5px]', on ? 'text-orange-700 dark:text-orange-300' : 'text-slate-800 dark:text-slate-100')}>{o.texto}</b>
            {o.sub && <span className="text-[12px] text-slate-500">{o.sub}</span>}
          </button>
        );
      })}
    </div>
  </div>
);

// Adicionales como botoncitos, en grupos (Toppings / Shot extra)
const Chips = ({ titulo, lista, marcados, alternar }) => (
  <div className="mb-4">
    <div className="mb-1.5 flex items-center justify-between">
      <b className="text-[15px] text-slate-800 dark:text-slate-100">{titulo}</b>
      <span className="text-[11.5px] text-slate-400">Opcional · toca los que quieras</span>
    </div>
    <div className="flex flex-wrap gap-2">
      {lista.map(a => {
        const on = marcados.includes(a.id);
        return (
          <button key={a.id} type="button" onClick={() => alternar(a.id)} aria-pressed={on}
            className={cx('flex cursor-pointer items-baseline gap-1 rounded-full border-[1.5px] border-solid px-3 py-1.5 font-[inherit] text-[13px] font-bold',
              on ? 'border-zippy bg-zippy text-white' : 'border-slate-200 bg-white text-slate-700 dark:border-noche-borde dark:bg-noche-alt dark:text-slate-200')}>
            {on && '✓ '}{a.nombre}
            <span className={cx('text-[11px] font-semibold', on ? 'text-orange-100' : 'text-slate-400')}>+{fmt(Number(a.precio))}</span>
          </button>
        );
      })}
    </div>
  </div>
);

const UserProductModal = ({ producto, grad, emoji, iconName, onClose }) => {
  useCerrarConAtras(!!producto, onClose);
  const { addItem } = useCart();
  const { addToast } = useToast();
  const [qty, setQty] = useState(1);
  // Nov 2026: adicionales que el negocio le puso a este producto
  const [adicionales, setAdicionales] = useState([]);
  const [marcados, setMarcados] = useState([]);
  const [elegidas, setElegidas] = useState(null);
  const productoId = producto?.id;
  const conOpciones = tieneOpciones(producto);
  const tieneAdicionales = !!producto?.adicionales?.length;
  useEffect(() => {
    setQty(1);
    setMarcados([]);
    setAdicionales([]);
    setElegidas(opcionesIniciales(producto));
    if (!productoId || !tieneAdicionales) return;
    let activo = true;
    adicionalesService.deProducto(productoId)
      .then(({ data }) => { if (activo) setAdicionales(Array.isArray(data) ? data : []); })
      .catch(() => {});
    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoId, tieneAdicionales]);

  if (!producto) return null;
  const elegidos = adicionales.filter(a => marcados.includes(a.id));
  const precioUnidad = precioConOpciones(producto, elegidas) + elegidos.reduce((s, a) => s + Number(a.precio || 0), 0);
  const ops = producto.opciones || {};
  const shots = conOpciones ? adicionales.filter(a => /shot/i.test(a.nombre)) : [];
  const toppings = conOpciones ? adicionales.filter(a => !/shot/i.test(a.nombre)) : [];
  const alternar = (id) => setMarcados(m => (m.includes(id) ? m.filter(x => x !== id) : [...m, id]));

  const abierto = estaAbierto(producto);

  const handleAdd = () => {
    if (!abierto) {
      addToast(`${producto.tienda} está cerrada ahora · ${textoCerrado(producto)}`, 'error');
      return;
    }
    for (let i = 0; i < qty; i++) addItem(producto, elegidos, elegidas);
    addToast(`${producto.nombre} agregado al carrito`, 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[400] flex animate-desvanecer items-end bg-black/55" onClick={onClose}>
      <div
        className="relative mx-auto max-h-[92vh] w-full max-w-[520px] animate-subir overflow-y-auto rounded-t-3xl bg-white [scrollbar-width:none] dark:bg-noche-card"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label={producto.nombre}
      >
        {/* Asa + cerrar */}
        <div className="relative flex items-center justify-center px-4 pt-3">
          <div className="h-1 w-10 rounded-sm bg-slate-200 dark:bg-noche-borde" />
          <button
            className="absolute right-4 top-2 flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-full border-0 bg-slate-100 text-[13px] text-slate-500 hover:bg-slate-200 dark:bg-noche-alt dark:text-slate-400"
            onClick={onClose}
            aria-label="Cerrar"
          >✕</button>
        </div>

        {/* Foto */}
        <div className="relative mx-4 mt-2.5 flex h-[180px] items-center justify-center overflow-hidden rounded-2xl xs:h-[200px]" style={{ background: producto.foto ? '#f1f5f9' : grad }}>
          {producto.foto
            ? <img className="block h-full w-full object-cover" src={urlImagen(producto.foto)} alt={producto.nombre} />
            : <span className="text-slate-400"><Icon name={iconName || 'paquete'} size={64} strokeWidth={1.3} /></span>}
          {producto.nuevo && <span className="absolute left-3 top-3 rounded-md bg-red-500 px-[9px] py-[3px] text-[10px] font-extrabold tracking-[0.5px] text-white">NUEVO</span>}
        </div>

        {/* Texto (el relleno de abajo deja ver todo por encima del pie fijo) */}
        <div className="px-5 pb-[110px] pt-[18px]">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#fff3e6] px-2.5 py-[3px] text-[10px] font-extrabold uppercase tracking-[0.4px] text-zippy dark:bg-zippy/15">{producto.categoria}</span>
            {producto.rating > 0 ? (
              <>
                <Stars n={Math.round(producto.rating)} />
                <span className="text-xs text-slate-400">{producto.rating.toFixed(1)}</span>
              </>
            ) : (
              <span className="text-xs text-slate-400">Sin calificaciones aún</span>
            )}
          </div>

          <h2 className="m-0 mb-1 text-[22px] font-black leading-tight text-slate-800 dark:text-slate-100">{producto.nombre}</h2>
          <p className="m-0 mb-2.5 flex items-center gap-1.5 text-[13px] text-slate-500"><Icon name="vendedores" size={14} />{producto.tienda}</p>

          {!abierto && (
            <p className="my-2 flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500 dark:bg-noche-alt"><Icon name="reloj" size={14} />{textoCerrado(producto)}</p>
          )}

          {abierto && producto.stock <= 10 && (
            <p className="m-0 mb-3 flex items-center gap-1.5 rounded-lg border-0 border-l-[3px] border-solid border-l-red-500 bg-red-50 px-3 py-2 text-xs font-bold text-red-500 dark:bg-red-500/10"><Icon name="alerta" size={14} />¡Solo quedan {producto.stock} unidades!</p>
          )}

          <p className="m-0 mb-5 text-sm leading-[1.65] text-slate-600 dark:text-slate-400">{producto.descripcion || 'Este producto todavía no tiene descripción.'}</p>

          {conOpciones && elegidas && (
            <>
              <Segmentos titulo="Tamaño" valor={elegidas.tamano} onCambio={v => setElegidas(e => ({ ...e, tamano: v }))}
                opciones={ops.tamanos.map(t => ({ valor: t.nombre, texto: t.nombre, sub: fmt(Number(t.precio)) }))} />
              {ops.con_licor && ops.sin_licor != null && (
                <Segmentos titulo="¿Con licor?" valor={!!elegidas.sin_licor} onCambio={v => setElegidas(e => ({ ...e, sin_licor: v }))}
                  opciones={[{ valor: false, texto: 'Con licor' }, { valor: true, texto: 'Sin licor', sub: Number(ops.sin_licor) ? `−${fmt(Number(ops.sin_licor))}` : '' }]} />
              )}
              {toppings.length > 0 && <Chips titulo="Toppings" lista={toppings} marcados={marcados} alternar={alternar} />}
              {shots.length > 0 && <Chips titulo="Shot extra" lista={shots} marcados={marcados} alternar={alternar} />}
            </>
          )}

          {!conOpciones && adicionales.length > 0 && (
            <div className="mb-2">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.6px] text-slate-400">Adicionales</p>
                <span className="text-[11.5px] text-slate-400">Opcional · escoge los que quieras</span>
              </div>
              {adicionales.map(a => {
                const on = marcados.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => alternar(a.id)}
                    className="flex w-full cursor-pointer items-center gap-2.5 border-0 border-t border-solid border-slate-100 bg-transparent px-0.5 py-[11px] text-left font-[inherit] text-[14px] text-slate-700 first-of-type:border-t-0 dark:border-noche-borde dark:text-slate-200"
                    aria-pressed={on}
                  >
                    <span className={cx('flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] border-2 border-solid', on ? 'border-zippy bg-zippy text-white' : 'border-slate-300 dark:border-slate-500')}>
                      {on && <span className="text-[13px] font-black leading-none">✓</span>}
                    </span>
                    <span className="min-w-0 flex-1">{a.nombre}</span>
                    <span className={cx('shrink-0 text-[13.5px] font-extrabold', on ? 'text-zippy' : 'text-slate-500')}>+{fmt(Number(a.precio))}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Pie fijo. En celular se quita el precio suelto: el boton ya lo dice
            y con precios de cinco cifras el boton se salia por el borde. */}
        <div className="fixed inset-x-0 bottom-0 z-10 mx-auto box-border flex max-w-[520px] items-center gap-2.5 border-0 border-t border-solid border-[#f0f0f0] bg-white px-3.5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3.5 shadow-[0_-6px_24px_rgba(0,0,0,0.1)] dark:border-noche-borde dark:bg-noche-card sm:gap-3 sm:px-5">
          <p className="m-0 hidden whitespace-nowrap text-lg font-black text-zippy sm:block">{fmt(precioUnidad)}</p>
          <div className="flex shrink-0 items-center overflow-hidden rounded-[10px] border-[1.5px] border-solid border-slate-200 bg-slate-50 dark:border-noche-borde dark:bg-noche-alt">
            <button className="flex h-9 w-9 cursor-pointer items-center justify-center border-0 bg-transparent text-xl font-bold text-zippy hover:bg-[#fff3e6]" onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Menos">−</button>
            <span className="min-w-[28px] text-center text-[15px] font-extrabold text-slate-800 dark:text-slate-100">{qty}</span>
            <button className="flex h-9 w-9 cursor-pointer items-center justify-center border-0 bg-transparent text-xl font-bold text-zippy hover:bg-[#fff3e6]" onClick={() => setQty(q => q + 1)} aria-label="Más">+</button>
          </div>
          <button
            className={cx(
              'min-w-0 flex-1 truncate whitespace-nowrap rounded-xl border-0 px-3 py-[13px] font-[inherit] text-sm font-extrabold transition-opacity',
              abierto
                ? 'cursor-pointer bg-gradient-to-br from-zippy to-[#FF9A3C] text-white shadow-[0_4px_14px_rgba(255,122,0,0.35)] hover:opacity-90'
                : 'cursor-not-allowed bg-slate-300 text-slate-500'
            )}
            onClick={handleAdd}
            disabled={!abierto}
          >
            {abierto ? `Agregar · ${fmt(precioUnidad * qty)}` : 'Tienda cerrada'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProductModal;