import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import VendorLayout from '../../components/VendorLayout';
import BotonesFoto from '../../components/BotonesFoto';
import CampoPesos from '../../components/CampoPesos';
import Icon from '../../components/Icons';
import { useToast } from '../../context/ToastContext';
import { productosService, negociosService } from '../../config/api';
import useCategoriasProducto from '../../hooks/useCategoriasProducto';
import { cx, titulo, subtitulo, tarjeta } from '../../ui/tw';

// ============================================================================
// VendorMenuFotoPage — "Subir mi menú con una foto" (oct 2026).
//
// 1. El negocio le toma foto a su carta (hasta 4 páginas).
// 2. El servidor se la pasa a Gemini (backend/menu_ia.py) y devuelve un
//    BORRADOR: nombre, precio, categoría y si la IA estaba segura.
// 3. El negocio corrige, desmarca lo que no vende y toca "Publicar".
// 4. Cada producto se crea con el POST de siempre (mismas validaciones).
//
// Si la carta trae fotos de los platos, el servidor las recorta y llegan en
// "foto" (data URL): se suben con el producto. Las que falten se ponen en
// "Ponle foto a tus productos" (VendorFotosPage), a donde se va al publicar.
// ============================================================================

const MAX_PAGINAS = 4;

// El recorte llega como data URL; para subirlo por el endpoint de siempre se
// vuelve archivo
const archivoDeDataUrl = async (dataUrl, nombre) => {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], nombre, { type: blob.type || 'image/jpeg' });
};
// Comida que se prepara al momento: la cantidad no se cuenta. Se puede cambiar después.
const STOCK_INICIAL = 100;

const campo = 'box-border w-full min-w-0 rounded-lg border-[1.5px] border-solid border-slate-200 bg-white px-2.5 py-2 font-[inherit] text-[14px] text-slate-800 outline-none focus:border-zippy dark:border-noche-borde dark:bg-noche-alt dark:text-slate-100';
const btnGrande = 'flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-0 bg-zippy px-4 py-[14px] font-[inherit] text-[15px] font-extrabold text-white shadow-[0_6px_18px_rgba(255,122,0,0.3)] disabled:cursor-not-allowed disabled:opacity-50';

// Mientras Gemini lee (unos segundos) se muestra avance para que nadie piense
// que se quedó pegado. La barra avanza sola hasta 92 % y salta a 100 % cuando
// llega la respuesta; los mensajes cambian cada par de segundos.
const MENSAJES_LECTURA = [
  'Mirando tu carta…',
  'Buscando los productos…',
  'Leyendo los precios…',
  'Organizando por categorías…',
  'Revisando que no falte nada…',
  'Casi listo…',
];

const Leyendo = ({ paginas }) => {
  const [avance, setAvance] = useState(4);
  const [paso, setPaso] = useState(0);
  useEffect(() => {
    const t1 = setInterval(() => setAvance(a => (a < 92 ? a + Math.max(0.6, (92 - a) / 14) : a)), 250);
    const t2 = setInterval(() => setPaso(p => Math.min(p + 1, MENSAJES_LECTURA.length - 1)), 2200);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);
  return (
    <div className={cx(tarjeta, 'mt-4 overflow-hidden')}>
      <div className="relative h-44 overflow-hidden bg-slate-900">
        {paginas[0] && <img src={paginas[0].vista} alt="" className="h-full w-full object-cover opacity-60" />}
        {/* Línea que barre la foto de arriba abajo, como un escáner */}
        <span className="zl-escaner absolute inset-x-0 h-1 bg-zippy shadow-[0_0_18px_6px_rgba(255,122,0,0.55)]" />
      </div>
      <div className="p-4 text-center">
        <b className="block text-[16px] text-slate-800 dark:text-slate-100">{MENSAJES_LECTURA[paso]}</b>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-noche-alt">
          <div className="h-full rounded-full bg-zippy transition-[width] duration-300 ease-out" style={{ width: `${Math.round(avance)}%` }} />
        </div>
        <span className="mt-1.5 block text-[12.5px] text-slate-500">{Math.round(avance)}% · No cierres esta pantalla</span>
      </div>
      <style>{'@keyframes zlEscaner{0%{top:0}50%{top:calc(100% - 4px)}100%{top:0}}.zl-escaner{animation:zlEscaner 2.4s ease-in-out infinite}'}</style>
    </div>
  );
};

const VendorMenuFotoPage = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { opciones: categorias } = useCategoriasProducto();

  const [paginas, setPaginas] = useState([]);       // [{ archivo, vista }]
  const [leyendo, setLeyendo] = useState(false);
  const [items, setItems] = useState(null);         // borrador que devolvió la IA
  const [publicando, setPublicando] = useState(null); // { hechos, total }

  const agregarPagina = (archivo) => {
    if (paginas.length >= MAX_PAGINAS) { addToast(`Máximo ${MAX_PAGINAS} fotos por vez`, 'info'); return; }
    setPaginas(p => [...p, { archivo, vista: URL.createObjectURL(archivo) }]);
  };

  const leer = async () => {
    if (!paginas.length) { addToast('Primero tómale foto a tu menú', 'error'); return; }
    setLeyendo(true);
    try {
      const { data } = await productosService.leerMenu(paginas.map(p => p.archivo), categorias);
      if (!data.productos?.length) {
        addToast('No encontramos productos con precio en esa foto. Prueba con una más clara y de frente.', 'error');
        return;
      }
      setItems(data.productos.map((p, i) => ({ ...p, id: i, incluir: true, precio: String(p.precio || '') })));
    } catch (e) {
      addToast(e?.response?.data?.detail || 'No pudimos leer el menú. Intenta de nuevo.', 'error');
    } finally {
      setLeyendo(false);
    }
  };

  const cambiar = (id, campoNombre, valor) =>
    setItems(lista => lista.map(it => (it.id === id ? { ...it, [campoNombre]: valor, ...(['nombre', 'precio', 'categoria'].includes(campoNombre) ? { seguro: true } : {}) } : it)));

  const elegidos = (items || []).filter(it => it.incluir);

  const publicar = async () => {
    const malos = elegidos.filter(it => !it.nombre.trim() || Number(it.precio) < 100);
    if (malos.length) { addToast(`Revisa "${malos[0].nombre || 'sin nombre'}": falta el nombre o el precio`, 'error'); return; }
    let negocio;
    try {
      ({ data: negocio } = await negociosService.miNegocio());
    } catch {
      addToast('No encontramos tu negocio. Intenta de nuevo.', 'error'); return;
    }
    setPublicando({ hechos: 0, total: elegidos.length });
    const fallidos = [];
    let sinFoto = 0;
    for (let i = 0; i < elegidos.length; i++) {
      const it = elegidos[i];
      try {
        // Si la foto no sube, el producto se crea igual y la foto se pone después
        let imagenes = [];
        if (it.foto) {
          try {
            const { data } = await productosService.subirImagen(await archivoDeDataUrl(it.foto, `plato-${i + 1}.jpg`));
            imagenes = [data.url];
          } catch { /* sin foto */ }
        }
        if (!imagenes.length) sinFoto++;
        await productosService.crear(negocio.id, {
          nombre: it.nombre.trim(),
          precio: Number(it.precio),
          categoria: it.categoria,
          descripcion: it.descripcion || '',
          stock: STOCK_INICIAL,
          imagenes,
        });
      } catch (e) {
        fallidos.push({ ...it, error: e?.response?.data?.detail });
      }
      setPublicando({ hechos: i + 1, total: elegidos.length });
    }
    setPublicando(null);
    const ok = elegidos.length - fallidos.length;
    if (fallidos.length) {
      // Se quedan en pantalla solo los que fallaron, para corregirlos
      setItems(fallidos);
      addToast(`${ok} publicados. ${fallidos.length} no se pudieron: revísalos.`, 'error');
      return;
    }
    if (sinFoto) {
      addToast(`${ok} productos publicados. Ahora ponles foto a los que no tienen.`, 'success');
      navigate('/vendor/productos/fotos');
    } else {
      addToast(`${ok} productos publicados con su foto.`, 'success');
      navigate('/vendor/productos');
    }
  };

  return (
    <VendorLayout>
      <button type="button" onClick={() => (items ? setItems(null) : navigate('/vendor/productos'))} className="mb-2 cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-[13px] font-bold text-zippy">← {items ? 'Volver a las fotos' : 'Mis productos'}</button>

      {!items ? (
        <>
          <h1 className={titulo}>Sube tu menú con una foto</h1>
          <p className={subtitulo}>Tómale foto a tu carta o lista de precios. Leemos los productos y tú los revisas antes de publicar.</p>

          {!leyendo && (
            <div className={cx(tarjeta, 'mt-4 p-4')}>
              {paginas.length > 0 ? (
                <div className="mb-1 grid grid-cols-2 gap-2">
                  {paginas.map((p, i) => (
                    <div key={p.vista} className="relative overflow-hidden rounded-xl bg-slate-100 dark:bg-noche-alt">
                      <img src={p.vista} alt={`Página ${i + 1}`} className="block h-44 w-full object-cover" />
                      <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11.5px] font-bold text-white">Página {i + 1}</span>
                      <button type="button" onClick={() => setPaginas(ps => ps.filter((_, j) => j !== i))} className="absolute right-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0 bg-black/60 text-white" aria-label="Quitar"><Icon name="equis" size={15} /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-slate-300 bg-slate-50 px-6 text-center text-[13px] text-slate-500 dark:border-noche-borde dark:bg-noche-alt">
                  <Icon name="camara" size={28} />
                  Con buena luz, de frente y que se lean los precios.
                </div>
              )}
              {paginas.length < MAX_PAGINAS && <BotonesFoto hayFoto={paginas.length > 0} onArchivo={agregarPagina} />}
              {paginas.length > 0 && paginas.length < MAX_PAGINAS && (
                <p className="m-0 mt-2 text-center text-[12px] text-slate-500">¿Tu carta tiene más páginas? Toma otra foto (hasta {MAX_PAGINAS}).</p>
              )}
            </div>
          )}

          {leyendo ? <Leyendo paginas={paginas} /> : (
            <button type="button" className={cx(btnGrande, 'mt-4')} onClick={leer} disabled={!paginas.length}>
              Leer mi menú
            </button>
          )}
        </>
      ) : (
        <>
          <h1 className={titulo}>Revisa tus productos</h1>
          <p className={subtitulo}>
            Encontramos <b>{items.length}</b>{items.some(it => it.foto) ? <>, y <b>{items.filter(it => it.foto).length}</b> traen la foto de tu carta</> : null}. Corrige lo que haga falta y quita la marca a lo que ya no vendes.
          </p>

          <div className="mt-3 flex flex-col gap-2 pb-28">
            {items.map(it => (
              <div
                key={it.id}
                className={cx(tarjeta, 'p-3', !it.incluir && 'opacity-50', it.incluir && !it.seguro && 'outline outline-2 outline-amber-400')}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={it.incluir}
                    onChange={e => cambiar(it.id, 'incluir', e.target.checked)}
                    className="mt-2.5 h-5 w-5 shrink-0 accent-[#FF7A00]"
                    aria-label={`Publicar ${it.nombre}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {it.foto && (
                        <div className="relative h-[42px] w-[42px] shrink-0">
                          <img src={it.foto} alt="" className="block h-full w-full rounded-lg object-cover" />
                          <button type="button" onClick={() => cambiar(it.id, 'foto', null)} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-2 border-solid border-white bg-slate-700 p-0 text-white dark:border-noche-card" aria-label={`Quitar la foto de ${it.nombre}`}><Icon name="equis" size={11} /></button>
                        </div>
                      )}
                      <input className={cx(campo, 'font-bold')} value={it.nombre} onChange={e => cambiar(it.id, 'nombre', e.target.value)} maxLength={255} />
                    </div>
                    <div className="mt-1.5 grid grid-cols-[1fr_8.5rem] gap-1.5">
                      <select className={campo} value={it.categoria} onChange={e => cambiar(it.id, 'categoria', e.target.value)}>
                        {[it.categoria, ...categorias.filter(c => c !== it.categoria)].filter(Boolean).map(c => <option key={c}>{c}</option>)}
                      </select>
                      <CampoPesos name="precio" value={it.precio} onChange={e => cambiar(it.id, 'precio', e.target.value)} className={cx(campo, 'font-bold')} />
                    </div>
                    <textarea
                      className={cx(campo, 'mt-1.5 block resize-none text-[13px] leading-snug')}
                      rows={2}
                      maxLength={300}
                      value={it.descripcion || ''}
                      onChange={e => cambiar(it.id, 'descripcion', e.target.value)}
                      placeholder="Qué trae (opcional). Ej: papa, salchicha y queso"
                      aria-label={`Descripción de ${it.nombre}`}
                    />
                    {it.incluir && !it.seguro && (
                      <span className="mt-1.5 inline-block rounded-md bg-amber-100 px-2 py-0.5 text-[11.5px] font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                        {it.error || 'No se leía bien: revisa el nombre y el precio'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="fixed inset-x-0 bottom-[calc(62px+env(safe-area-inset-bottom))] z-[250] border-0 border-t border-solid border-slate-100 bg-white/95 px-4 py-3 backdrop-blur dark:border-noche-borde dark:bg-noche-card/95 md:bottom-[calc(62px+env(safe-area-inset-bottom))]">
            <div className="mx-auto max-w-[600px]">
              <button type="button" className={btnGrande} onClick={publicar} disabled={!elegidos.length || !!publicando}>
                {publicando
                  ? `Publicando ${publicando.hechos} de ${publicando.total}…`
                  : `Publicar ${elegidos.length} producto${elegidos.length === 1 ? '' : 's'}`}
              </button>
              {!publicando && elegidos.length > 0 && (
                <p className="m-0 mt-1.5 text-center text-[11.5px] text-slate-500">
                  {elegidos.every(it => it.foto)
                    ? 'Todos llevan la foto que venía en tu carta'
                    : 'A los que no tengan foto se la pones en el siguiente paso'}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </VendorLayout>
  );
};

export default VendorMenuFotoPage;
