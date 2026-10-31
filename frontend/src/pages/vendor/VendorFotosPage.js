import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import VendorLayout from '../../components/VendorLayout';
import BotonesFoto from '../../components/BotonesFoto';
import Icon from '../../components/Icons';
import { useToast } from '../../context/ToastContext';
import { productosService } from '../../config/api';
import { urlImagen } from '../../utils/media';
import { cx, titulo, subtitulo, tarjeta } from '../../ui/tw';

// ============================================================================
// VendorFotosPage — "Ponle foto a tus productos" (oct 2026).
//
// Lista solo los productos que no tienen foto. El negocio toca "Tomar foto",
// la toma y el producto queda listo; la tarjeta siguiente se resalta para
// seguir en fila, sin entrar a editar producto por producto.
//
// Se llega aquí al publicar el menú desde una foto (VendorMenuFotoPage) y
// desde el aviso de "productos sin foto" en Mis productos.
// ============================================================================

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-CO')}`;

const VendorFotosPage = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [productos, setProductos] = useState(null);
  // id -> url de la foto puesta en esta visita (para mostrarla como "Listo")
  const [listos, setListos] = useState({});
  const [subiendo, setSubiendo] = useState(null);
  const tarjetas = useRef({});

  useEffect(() => {
    productosService.misProductos()
      .then(({ data }) => setProductos((data || []).filter(p => !p.imagenes?.length)))
      .catch(() => { setProductos([]); addToast('No se pudieron cargar tus productos', 'error'); });
  }, [addToast]);

  const pendientes = (productos || []).filter(p => !listos[p.id]);
  const total = (productos || []).length;
  const hechos = total - pendientes.length;
  const siguiente = pendientes[0];

  const ponerFoto = async (producto, archivo) => {
    setSubiendo(producto.id);
    try {
      const { data } = await productosService.subirImagen(archivo);
      await productosService.actualizar(producto.id, { imagenes: [data.url] });
      setListos(l => ({ ...l, [producto.id]: data.url }));
      // Se baja a la que sigue para no tener que buscarla
      const prox = pendientes.find(p => p.id !== producto.id);
      if (prox) setTimeout(() => tarjetas.current[prox.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
    } catch (e) {
      addToast(e?.response?.data?.detail || 'No se pudo subir la foto. Intenta de nuevo.', 'error');
    } finally {
      setSubiendo(null);
    }
  };

  return (
    <VendorLayout>
      <button type="button" onClick={() => navigate('/vendor/productos')} className="mb-2 cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-[13px] font-bold text-zippy">← Mis productos</button>
      <h1 className={titulo}>Ponle foto a tus productos</h1>
      <p className={subtitulo}>Los productos con foto se venden más. Tómale foto a cada uno; con buena luz y de cerca.</p>

      {productos === null ? (
        <p className="mt-6 text-center text-[13px] text-slate-500">Cargando…</p>
      ) : total === 0 ? (
        <div className={cx(tarjeta, 'mt-4 p-6 text-center')}>
          <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15"><Icon name="check" size={26} /></span>
          <b className="block text-[15px] text-slate-800 dark:text-slate-100">Todos tus productos tienen foto</b>
        </div>
      ) : (
        <>
          <div className={cx(tarjeta, 'mt-4 p-3.5')}>
            <div className="mb-2 flex items-baseline justify-between text-[13px]">
              <span className="font-bold text-slate-700 dark:text-slate-200">{hechos} de {total} con foto</span>
              {pendientes.length > 0 && <span className="text-slate-500">Faltan {pendientes.length}</span>}
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-noche-alt">
              <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${total ? (hechos / total) * 100 : 0}%` }} />
            </div>
          </div>

          {pendientes.length === 0 && (
            <div className={cx(tarjeta, 'mt-3 p-5 text-center')}>
              <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15"><Icon name="check" size={26} /></span>
              <b className="block text-[15px] text-slate-800 dark:text-slate-100">¡Listo! Todos tienen foto</b>
              <button type="button" onClick={() => navigate('/vendor/productos')} className="mt-3 cursor-pointer rounded-xl border-0 bg-zippy px-5 py-2.5 font-[inherit] text-[14px] font-extrabold text-white">Ver mis productos</button>
            </div>
          )}

          <div className="mt-3 flex flex-col gap-2.5 pb-6">
            {productos.map(p => {
              const lista = listos[p.id];
              const activa = siguiente && siguiente.id === p.id;
              return (
                <div
                  key={p.id}
                  ref={el => { tarjetas.current[p.id] = el; }}
                  className={cx(tarjeta, 'p-3', activa && 'outline outline-2 outline-zippy')}
                >
                  <div className="flex items-center gap-3">
                    {lista ? (
                      <img src={urlImagen(lista, true)} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-noche-alt"><Icon name="camara" size={20} /></span>
                    )}
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-[14.5px] text-slate-800 dark:text-slate-100">{p.nombre}</b>
                      <span className="text-[12.5px] text-slate-500">{p.categoria} · {fmt(p.precio)}</span>
                    </div>
                    {lista && <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[12px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><Icon name="check" size={13} /> Listo</span>}
                  </div>
                  {!lista && (
                    subiendo === p.id ? (
                      <p className="m-0 mt-2.5 rounded-xl bg-slate-50 py-3 text-center text-[13.5px] font-bold text-slate-500 dark:bg-noche-alt">Subiendo foto…</p>
                    ) : (
                      <BotonesFoto onArchivo={archivo => ponerFoto(p, archivo)} />
                    )
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </VendorLayout>
  );
};

export default VendorFotosPage;
