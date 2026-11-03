import React, { useState, useEffect } from 'react';
import Icon from './Icons';
import { cx } from '../ui/tw';
import { urlImagen } from '../utils/media';
import { estaAbierto, textoCerrado, horaBonita } from '../utils/horario';

// ============================================================================
// CartaTienda — la carta de un negocio (nov 2026).
//
// Cuando el cliente toca una tienda en el inicio, en vez de la cuadrícula de
// tarjetas sueltas se le muestra la carta: los productos agrupados por
// categoría, con su descripción y precio, como en el menú del local. Tocar un
// producto abre el mismo detalle de siempre; el "+" lo agrega al carrito.
// ============================================================================

const fmt = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;
const idSeccion = (cat) => `carta-${String(cat).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

// Visor de las fotos de la carta: a pantalla completa, una página al lado de
// la otra (se pasa deslizando) y con un toque se acerca para leer los precios.
const VisorCarta = ({ fotos, nombre, onCerrar }) => {
  const [pagina, setPagina] = useState(0);
  const [cerca, setCerca] = useState(false);
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const tecla = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', tecla);
    return () => { document.body.style.overflow = antes; window.removeEventListener('keydown', tecla); };
  }, [onCerrar]);
  const pasar = (e) => {
    const el = e.currentTarget;
    setPagina(Math.round(el.scrollLeft / el.clientWidth));
  };
  return (
    <div className="fixed inset-0 z-[600] flex flex-col bg-black" role="dialog" aria-label={`Carta de ${nombre}`}>
      <div className="flex shrink-0 items-center gap-3 px-4 pb-2 pt-[calc(12px+env(safe-area-inset-top))] text-white">
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[15px]">Carta de {nombre}</b>
          <span className="text-[12px] text-white/60">{fotos.length > 1 ? `Página ${pagina + 1} de ${fotos.length} · ` : ''}{cerca ? 'Toca para alejar' : 'Toca para acercar'}</span>
        </span>
        <button type="button" onClick={onCerrar} className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-white/15 text-white" aria-label="Cerrar la carta">
          <Icon name="equis" size={20} />
        </button>
      </div>
      <div className={cx('flex min-h-0 flex-1 snap-x snap-mandatory [scrollbar-width:none]', cerca ? 'overflow-hidden' : 'overflow-x-auto')} onScroll={pasar}>
        {fotos.map((url, i) => (
          <div key={url} className={cx('h-full w-full shrink-0 snap-center', cerca ? 'overflow-auto' : 'flex items-center justify-center overflow-hidden')}>
            <img
              src={urlImagen(url)}
              alt={`Carta de ${nombre}, página ${i + 1}`}
              onClick={() => setCerca(c => !c)}
              className={cx('block cursor-zoom-in select-none', cerca ? 'w-[220%] max-w-none cursor-zoom-out' : 'max-h-full max-w-full object-contain')}
            />
          </div>
        ))}
      </div>
      {fotos.length > 1 && (
        <div className="flex shrink-0 justify-center gap-1.5 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3">
          {fotos.map((u, i) => <span key={u} className={cx('h-2 rounded-full transition-all', i === pagina ? 'w-5 bg-zippy' : 'w-2 bg-white/40')} />)}
        </div>
      )}
    </div>
  );
};

const CartaTienda = ({ tienda, productos, onCerrar, onAbrir, onAgregar, inCart, cartQty }) => {
  const abierta = estaAbierto(tienda);
  const [verFotos, setVerFotos] = useState(false);
  const fotosCarta = tienda.fotosCarta || [];
  // Las categorías en el orden en que el negocio las fue creando
  const categorias = [...new Set(productos.map(p => p.categoria || 'Otros'))];

  const irA = (cat) => {
    const el = document.getElementById(idSeccion(cat));
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 130, behavior: 'smooth' });
  };

  return (
    <div className="mx-auto w-full max-w-[760px]">
      {/* Cabecera del negocio */}
      <div className="mb-3 flex items-center gap-3.5 rounded-2xl bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.07)] dark:bg-noche-card">
        <div
          className="flex h-[58px] w-[58px] shrink-0 items-center justify-center overflow-hidden rounded-2xl"
          style={{ background: tienda.color, color: tienda.text }}
        >
          {tienda.logo
            ? <img src={urlImagen(tienda.logo, true)} alt={tienda.nombre} className="block h-full w-full object-cover" />
            : <span className="text-[26px] font-black leading-none">{(tienda.nombre || '?').trim().charAt(0).toUpperCase()}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 truncate text-[18px] font-black text-slate-800 dark:text-slate-100">{tienda.nombre}</h2>
          <p className="m-0 mt-0.5 text-[12.5px] text-slate-500">
            {abierta
              ? <><span className="font-bold text-emerald-600 dark:text-emerald-400">Abierto</span>{tienda.hora_cierre ? ` · Cierra a las ${horaBonita(tienda.hora_cierre)}` : ''}</>
              : <span className="font-bold">{textoCerrado(tienda)}</span>}
            {tienda.rating > 0 && <> · <Icon name="estrella" size={11} /> {tienda.rating.toFixed(1)}</>}
          </p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          className="shrink-0 cursor-pointer rounded-full border-[1.5px] border-solid border-slate-200 bg-transparent px-3 py-1.5 font-[inherit] text-[12px] font-bold text-slate-500 dark:border-noche-borde dark:text-slate-400"
        >
          Ver todo
        </button>
      </div>

      {fotosCarta.length > 0 && (
        <button
          type="button"
          onClick={() => setVerFotos(true)}
          className="mb-3 flex w-full cursor-pointer items-center gap-3 rounded-2xl border-0 bg-white p-2.5 pr-4 text-left font-[inherit] shadow-[0_2px_10px_rgba(0,0,0,0.07)] dark:bg-noche-card"
        >
          <img src={urlImagen(fotosCarta[0])} alt="" className="h-14 w-12 shrink-0 rounded-lg object-cover" />
          <span className="min-w-0 flex-1">
            <b className="block text-[14.5px] text-slate-800 dark:text-slate-100">Ver la carta</b>
            <span className="text-[12.5px] text-slate-500">La foto del menú del local{fotosCarta.length > 1 ? ` · ${fotosCarta.length} páginas` : ''}</span>
          </span>
          <span className="text-lg text-zippy">→</span>
        </button>
      )}
      {verFotos && <VisorCarta fotos={fotosCarta} nombre={tienda.nombre} onCerrar={() => setVerFotos(false)} />}

      {/* Saltar a una categoría: se queda pegada arriba al bajar */}
      {categorias.length > 1 && (
        <div className="sticky top-[56px] z-10 -mx-4 mb-2 flex gap-2 overflow-x-auto bg-[#f5f6fa]/95 px-4 py-2 backdrop-blur [scrollbar-width:none] dark:bg-noche/95 md:top-[76px] md:mx-0 md:px-0">
          {categorias.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => irA(c)}
              className="shrink-0 cursor-pointer rounded-full border-[1.5px] border-solid border-slate-200 bg-white px-3.5 py-1.5 font-[inherit] text-[13px] font-bold text-slate-600 dark:border-noche-borde dark:bg-noche-card dark:text-slate-300"
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {productos.length === 0 && (
        <p className="py-10 text-center text-[14px] text-slate-400">No encontramos nada con esa búsqueda en este negocio.</p>
      )}

      {categorias.map(cat => (
        <section key={cat} id={idSeccion(cat)} className="mb-4">
          <h3 className="m-0 mb-2 mt-3 text-[15px] font-black uppercase tracking-[0.4px] text-slate-700 dark:text-slate-200">{cat}</h3>
          <div className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_10px_rgba(0,0,0,0.07)] dark:bg-noche-card">
            {productos.filter(p => (p.categoria || 'Otros') === cat).map((p, i) => (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => onAbrir(p)}
                onKeyDown={e => { if (e.key === 'Enter') onAbrir(p); }}
                className={cx(
                  'flex cursor-pointer items-center gap-3 p-3.5 transition-colors hover:bg-zippy-50/60 dark:hover:bg-noche-alt',
                  i > 0 && 'border-0 border-t border-solid border-slate-100 dark:border-noche-borde'
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[14.5px] font-bold leading-snug text-slate-800 dark:text-slate-100">{p.nombre}</p>
                  {p.descripcion && <p className="m-0 mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-slate-500">{p.descripcion}</p>}
                  <p className="m-0 mt-1 flex items-baseline gap-2">
                    <span className="text-[15px] font-black text-zippy">{fmt(p.precio)}</span>
                    {p.enOferta && p.precioOriginal && <span className="text-[12px] text-slate-400 line-through">{fmt(p.precioOriginal)}</span>}
                  </p>
                </div>
                <div className="relative shrink-0">
                  {p.foto && <img src={urlImagen(p.foto, true)} alt={p.nombre} loading="lazy" className="block h-[76px] w-[76px] rounded-xl object-cover" />}
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onAgregar(p); }}
                    disabled={!abierta}
                    aria-label={`Agregar ${p.nombre}`}
                    className={cx(
                      p.foto ? 'absolute -bottom-1.5 -right-1.5' : 'relative',
                      'flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-full border-[3px] border-solid border-white px-1.5 font-[inherit] text-[15px] font-black text-white shadow-[0_3px_10px_rgba(255,122,0,0.35)] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none dark:border-noche-card',
                      inCart(p.id) ? 'bg-emerald-500' : 'bg-zippy'
                    )}
                  >
                    {inCart(p.id) ? cartQty(p.id) : '+'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default CartaTienda;
