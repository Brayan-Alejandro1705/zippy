import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { ordenesService, clienteService, domicilioService } from '../../config/api';
import { cx } from '../../ui/tw';
import { ENVIO_POR_TIENDA } from '../../constants/envio';
import { estaAbierto, textoCerrado } from '../../utils/horario';
import { urlImagen } from '../../utils/media';
import Icon from '../../components/Icons';
import SelectorUbicacion from '../../components/SelectorUbicacion';

const fmt = n => `$${Number(n || 0).toLocaleString('es-CO')}`;

const CAT_ALCOHOL = ['cerveza', 'aguardiente y ron', 'whisky y otros licores', 'vinos', 'licores'];
const sinTildes = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const esAlcohol = i => CAT_ALCOHOL.includes(sinTildes(i.categoria)) || sinTildes(i.categoriaNegocio || i.negocio_categoria) === 'licorera';

const UserCheckoutPage = () => {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCart();
  const { addToast } = useToast();

  // Mismo criterio que el carrito: manda el servidor, el archivo es respaldo.
  const [envioUnitario, setEnvioUnitario] = useState(ENVIO_POR_TIENDA);

  useEffect(() => {
    domicilioService.obtener()
      .then(({ data }) => {
        if (typeof data?.costo_domicilio === 'number') {
          setEnvioUnitario(data.costo_domicilio);
        }
      })
      .catch(() => {});
  }, []);

  const [pago]                = useState('efectivo');
  const [nota, setNota]       = useState('');
  const [loading, setLoading] = useState(false);
  const [mayorEdad, setMayorEdad] = useState(false);
  const [pideEdad, setPideEdad]   = useState(false);

  // La direccion venia escrita a mano en el codigo ('Cra 5 #23-45, Apto 402'),
  // asi que TODAS las ordenes salian con la misma direccion falsa. Ahora se
  // cargan las que el cliente guardo y no se deja confirmar sin una.
  const [direcciones, setDirecciones]     = useState([]);
  const [dirId, setDirId]                 = useState(null);
  const [cargandoDirs, setCargandoDirs]   = useState(true);

  // Pedir si necesita cuenta; ver la tienda no (Apple 5.1.1)
  useEffect(() => {
    if (!localStorage.getItem('access_token')) navigate('/login');
  }, [navigate]);

  useEffect(() => {
    let activo = true;
    clienteService.direcciones()
      .then(({ data }) => {
        if (!activo) return;
        const lista = Array.isArray(data) ? data : (data?.items || []);
        setDirecciones(lista);
        const principal = lista.find(d => d.principal) || lista[0];
        if (principal) setDirId(principal.id);
      })
      .catch(() => { if (activo) setDirecciones([]); })
      .finally(() => { if (activo) setCargandoDirs(false); });
    return () => { activo = false; };
  }, []);

  const dirElegida = direcciones.find(d => d.id === dirId) || null;

  /*
   * Domicilio por zonas (oct 2026): el precio depende de que tan lejos del
   * centro queda el punto que marco el cliente. Se pregunta al servidor cada
   * vez que cambia la direccion; al crear la orden el servidor lo vuelve a
   * calcular, asi que esto solo sirve para mostrarlo antes de confirmar.
   */
  const [cot, setCot] = useState(null);
  const latDir = dirElegida?.lat ?? null;
  const lngDir = dirElegida?.lng ?? null;
  useEffect(() => {
    if (!dirElegida) { setCot(null); return undefined; }
    let vivo = true;
    domicilioService.cotizar(latDir, lngDir)
      .then(({ data }) => { if (vivo) setCot(data || null); })
      .catch(() => { if (vivo) setCot(null); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirElegida?.id, latDir, lngDir]);

  const porZonas  = Boolean(cot?.por_zonas);
  const fueraZona = porZonas && cot?.fuera;
  const sinPunto  = porZonas && cot?.sin_punto;
  const bloqueoZona = fueraZona || sinPunto;
  const kmTexto = (km) => String(km ?? '').replace('.', ',');

  /*
   * Elegir o agregar la direccion SIN salir del pedido.
   *
   * Antes, para agregar una direccion habia que irse al Perfil: el enlace
   * sacaba al cliente de la compra, caia en la pestaña equivocada y despues
   * tenia que encontrar el camino de vuelta al carrito. Ahora sube una hoja
   * desde abajo, se elige o se agrega ahi mismo, y la compra sigue donde iba.
   *
   * hojaDir: null (cerrada) | 'elegir' | 'nueva'
   */
  const [hojaDir, setHojaDir]       = useState(null);
  const [dirMarcada, setDirMarcada] = useState(null);
  const [formDir, setFormDir]       = useState({ etiqueta: '', direccion: '', referencia: '' });
  const [ubicDir, setUbicDir]       = useState(null);
  const [guardandoDir, setGuardandoDir] = useState(false);

  const abrirHojaDir = () => {
    setDirMarcada(dirId);
    setHojaDir(direcciones.length === 0 ? 'nueva' : 'elegir');
  };

  const guardarDireccionNueva = async (e) => {
    e.preventDefault();
    if (guardandoDir) return;
    if (!formDir.etiqueta.trim() || !formDir.direccion.trim()) return;
    if (!ubicDir) { addToast('Marca en el mapa dónde queda, para que el repartidor llegue exacto', 'error'); return; }
    setGuardandoDir(true);
    try {
      const { data } = await clienteService.agregarDireccion({
        etiqueta: formDir.etiqueta.trim(),
        direccion: formDir.direccion.trim(),
        referencia: formDir.referencia.trim(),
        lat: ubicDir.lat,
        lng: ubicDir.lng,
      });
      setDirecciones(prev => [...prev, data]);
      setDirId(data.id);
      setFormDir({ etiqueta: '', direccion: '', referencia: '' });
      setUbicDir(null);
      setHojaDir(null);
      addToast('Dirección guardada', 'success');
    } catch {
      addToast('No se pudo guardar la dirección. Intenta de nuevo.', 'error');
    } finally {
      setGuardandoDir(false);
    }
  };

  const tiendas    = [...new Set(items.map(i => i.tienda))];
  const envioPorTienda = typeof cot?.costo_domicilio === 'number' ? cot.costo_domicilio : envioUnitario;
  const envioTotal = tiendas.length * envioPorTienda;
  const total      = subtotal + envioTotal;
  const itemsCerrados = items.filter(i => !estaAbierto(i));
  // Bebidas alcoholicas: el backend es quien decide (tambien mira la categoria
  // del negocio). Si responde que falta la confirmacion, se muestra la casilla.
  const tieneAlcohol = pideEdad || items.some(esAlcohol);

  // Si el carrito queda vacio (p.ej. tras confirmar), volver a la tienda.
  // OJO: navigate() no puede llamarse durante el render -> pantalla en blanco.
  // Por eso va dentro de useEffect y aqui solo cortamos el render con null.
  useEffect(() => {
    if (items.length === 0) navigate('/tienda');
  }, [items.length, navigate]);

  if (items.length === 0) return null;

  const handleConfirmar = async () => {
    if (!dirElegida) {
      addToast('Agrega una direccion de entrega antes de confirmar.', 'error');
      return;
    }
    if (itemsCerrados.length > 0) {
      addToast(`Producto no disponible: ${itemsCerrados[0].tienda} está cerrada · ${textoCerrado(itemsCerrados[0])}`, 'error');
      return;
    }
    if (tieneAlcohol && !mayorEdad) {
      addToast('Confirma que eres mayor de 18 años para pedir bebidas alcohólicas.', 'error');
      return;
    }
    if (bloqueoZona) {
      addToast(fueraZona ? 'Por ahora no llegamos a esa dirección. Elige otra.' : 'Marca tu dirección en el mapa para calcular el domicilio.', 'error');
      return;
    }
    setLoading(true);

    // El backend crea una orden por negocio: agrupamos el carrito por negocio.
    // Segun la pantalla desde donde se agrego, el producto trae 'negocioId'
    // (mapeado) o 'negocio_id' (crudo del backend). Aceptamos ambos: si solo
    // miramos uno, los productos agregados desde la otra pantalla quedaban con
    // clave undefined y el backend rechazaba la orden con 422.
    const porNegocio = {};
    const sinNegocio = [];
    items.forEach(item => {
      const nid = item.negocioId || item.negocio_id;
      if (!nid) { sinNegocio.push(item); return; }
      if (!porNegocio[nid]) porNegocio[nid] = [];
      porNegocio[nid].push(item);
    });

    if (sinNegocio.length > 0 || Object.keys(porNegocio).length === 0) {
      setLoading(false);
      addToast('Un producto del carrito no tiene tienda asociada. Quitalo y vuelve a agregarlo.', 'error');
      return;
    }

    try {
      const respuestas = await Promise.all(
        Object.entries(porNegocio).map(([negocio_id, itemsNegocio]) =>
          ordenesService.crear({
            negocio_id,
            items: itemsNegocio.map(i => ({ producto_id: i.id, cantidad: i.qty })),
            metodo_pago: pago,
            direccion_entrega: dirElegida.referencia ? `${dirElegida.dir} · ${dirElegida.referencia}` : dirElegida.dir,
            latitud_entrega: dirElegida.lat ?? undefined,
            longitud_entrega: dirElegida.lng ?? undefined,
            notas_cliente: nota || undefined,
            confirma_mayor_edad: mayorEdad,
          })
        )
      );
      clearCart();
      if (respuestas.some(r => r?.data?.requiere_validacion)) {
        addToast('Recibimos tu pedido. Como es tu primer pedido, soporte te va a contactar para confirmarlo.', 'success');
      } else {
        addToast('¡Orden confirmada! Recibirás un correo de confirmación.', 'success');
      }
      navigate('/tienda/pedidos');
    } catch (err) {
      const detail = err.response?.data?.detail;
      let msg = 'No se pudo confirmar la orden. Intenta de nuevo.';
      if (typeof detail === 'string') {
        msg = detail;
        if (detail.includes('mayor de 18')) setPideEdad(true);
      } else if (Array.isArray(detail) && detail.length > 0) {
        // Error 422 de validación de FastAPI/Pydantic: detail es una lista de
        // objetos {type, loc, msg, input, url}, no un string. Antes esto se
        // pasaba directo a addToast() y React tumbaba toda la app al intentar
        // renderizar un objeto como hijo (por eso la pantalla se ponia en blanco).
        msg = detail.map(d => d.msg || JSON.stringify(d)).join(' · ');
        // eslint-disable-next-line no-console
        console.error('Detalle completo del error 422 al confirmar orden:', detail);
      }
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Piezas de estilo ─────────────────────────────────────────────────────
  const seccion = 'border-0 border-b border-solid border-[#f0f0f0] px-4 py-3.5 last-of-type:border-b-0 dark:border-noche-borde sm:px-5 sm:py-4';
  const etiqueta = 'm-0 mb-2.5 text-[11px] font-bold uppercase tracking-[0.5px] text-slate-400';
  const botonGrande = 'block w-full cursor-pointer rounded-[10px] border-0 bg-zippy p-[15px] font-[inherit] text-[15px] font-extrabold text-white transition-colors hover:enabled:bg-zippy-600 disabled:cursor-not-allowed disabled:opacity-70 sm:rounded-xl sm:p-4 sm:text-base';
  const campoHoja = 'box-border w-full rounded-[10px] border-[1.5px] border-solid border-slate-200 bg-white p-3 font-[inherit] text-[15px] text-slate-800 focus:border-zippy focus:outline-none dark:border-noche-borde dark:bg-noche dark:text-slate-200';

  return (
    <div className="flex min-h-screen flex-col items-center bg-white font-sans dark:bg-noche sm:bg-[#f5f5f5]">
      {/* Encabezado naranja, debajo de la hora del iPhone */}
      <div className="flex w-full items-center gap-3 bg-zippy px-4 pb-3 pt-[calc(12px+env(safe-area-inset-top))] shadow-[0_2px_8px_rgba(0,0,0,0.15)] sm:px-5 sm:pb-3.5 sm:pt-[calc(14px+env(safe-area-inset-top))]">
        <button className="cursor-pointer whitespace-nowrap border-0 bg-transparent p-0 text-[13px] font-semibold text-white hover:underline" onClick={() => navigate('/tienda/carrito')}>← Volver</button>
        <div className="flex-1 text-center">
          <p className="m-0 text-[15px] font-extrabold text-white sm:text-[17px]">Confirmar Orden</p>
          <p className="m-0 text-xs text-white/75">Resumen de compra</p>
        </div>
        {/* Mismo ancho que "Volver" para que el titulo quede centrado */}
        <span className="invisible text-[13px] font-semibold" aria-hidden="true">← Volver</span>
      </div>

      <div className="box-border min-h-[calc(100vh-52px)] w-full max-w-[460px] overflow-hidden bg-white pb-2 dark:bg-noche-card sm:m-5 sm:min-h-0 sm:rounded-2xl sm:shadow-[0_4px_24px_rgba(0,0,0,0.1)]">
        {/* Productos */}
        <div className={seccion}>
          {items.map(item => {
            const cerrado = !estaAbierto(item);
            return (
              <div key={item.id} className="mb-2 flex items-start justify-between gap-3 rounded-lg bg-[#f5f3ff] p-3 last:mb-0 dark:bg-[#1a2030] sm:rounded-[10px] sm:px-3.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-slate-100 text-slate-400 dark:bg-noche-alt">
                    {item.foto
                      ? <img src={urlImagen(item.foto)} alt={item.nombre} loading="lazy" className="block h-full w-full object-cover" />
                      : <Icon name="paquete" size={20} strokeWidth={1.3} />}
                  </div>
                  <div className="min-w-0">
                    <p className="m-0 mb-1 text-[13px] font-bold text-slate-800 dark:text-slate-100 sm:text-sm">{item.nombre}</p>
                    <p className="m-0 text-xs text-slate-400">Cantidad: {item.qty} · Precio: {fmt(item.precio)} c/u</p>
                    {cerrado && (
                      <p className="m-0 mt-1 flex items-center gap-1 text-[11px] font-bold text-red-700 dark:text-red-300"><Icon name="reloj" size={13} />Producto no disponible · tienda cerrada · {textoCerrado(item)}</p>
                    )}
                  </div>
                </div>
                <span className="whitespace-nowrap text-[13px] font-extrabold text-zippy sm:text-sm">{fmt(item.precio * item.qty)}</span>
              </div>
            );
          })}
        </div>

        {/* Direccion de entrega */}
        <div className={cx(seccion, 'bg-slate-50 dark:bg-[#162032]')}>
          <p className={etiqueta}>Dirección de entrega</p>
          {cargandoDirs ? (
            <p className="m-0 text-[13px] font-semibold text-slate-800 dark:text-slate-200">Cargando direcciones...</p>
          ) : (
            <div className="flex items-center gap-2.5 rounded-[10px] border-[1.5px] border-solid border-slate-200 bg-white px-3 py-2.5 dark:border-noche-borde dark:bg-noche-card sm:px-3.5 sm:py-3">
              <span className="shrink-0 text-slate-700 dark:text-slate-300"><Icon name="ubicacion" size={18} /></span>
              <div className="min-w-0 flex-1">
                <p className="m-0 mb-0.5 text-[13px] font-semibold text-slate-800 dark:text-slate-100 sm:text-sm">{dirElegida ? (dirElegida.etiqueta || 'Dirección') : 'Sin dirección'}</p>
                <p className="m-0 break-words text-[12.5px] leading-snug text-slate-500 dark:text-slate-400">
                  {dirElegida ? <>{dirElegida.dir}{dirElegida.referencia ? ` · ${dirElegida.referencia}` : ''}</> : 'Dinos a dónde llevarlo'}
                </p>
                {porZonas && cot?.zona && (
                  <span className="mt-1.5 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[11.5px] font-extrabold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                    {cot.zona} · {kmTexto(cot.km)} km del centro
                  </span>
                )}
                {fueraZona && (
                  <span className="mt-1.5 inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-[11.5px] font-extrabold text-red-700 dark:bg-red-500/15 dark:text-red-300">
                    A {kmTexto(cot.km)} km · fuera de cobertura
                  </span>
                )}
              </div>
              <button
                type="button"
                className={cx(
                  'shrink-0 cursor-pointer whitespace-nowrap rounded-full border-[1.5px] border-solid border-zippy px-[15px] py-[9px] font-[inherit] text-[13px] font-extrabold active:translate-y-px',
                  dirElegida ? 'bg-transparent text-zippy' : 'bg-zippy text-white'
                )}
                onClick={abrirHojaDir}
              >
                {dirElegida ? 'Cambiar' : '+ Agregar'}
              </button>
            </div>
          )}
          {fueraZona && (
            <div className="mt-2.5 rounded-[10px] border border-solid border-red-200 bg-red-50 px-3 py-2.5 text-[13px] leading-snug text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              <strong className="mb-0.5 block text-red-700 dark:text-red-300">Por ahora no llegamos hasta allá</strong>
              Esa dirección está a {kmTexto(cot.km)} km del centro y entregamos hasta {kmTexto(cot.max_km)} km. Elige otra dirección o escríbenos desde Ayuda.
            </div>
          )}
          {sinPunto && (
            <div className="mt-2.5 rounded-[10px] bg-amber-500/[0.12] px-3 py-2.5 text-[13px] leading-snug text-amber-800 dark:text-amber-300">
              <strong className="mb-0.5 block">Falta marcar tu casa en el mapa</strong>
              Sin el punto no sabemos cuánto cuesta el domicilio. Agrega la dirección de nuevo y marca dónde queda.
              <button type="button" className="mt-2 block cursor-pointer rounded-full border-[1.5px] border-solid border-amber-600 bg-transparent px-3.5 py-1.5 font-[inherit] text-[12.5px] font-extrabold text-amber-700 dark:border-amber-400 dark:text-amber-300" onClick={() => { setDirMarcada(dirId); setHojaDir('nueva'); }}>
                Agregar con el mapa
              </button>
            </div>
          )}
        </div>

        {/* Metodo de pago (por ahora solo efectivo) */}
        <div className={seccion}>
          <p className={etiqueta}>Método de pago</p>
          <div className="flex items-center gap-2 rounded-[10px] border-2 border-solid border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-semibold text-slate-700 dark:border-noche-borde dark:bg-noche-alt dark:text-slate-300">
            <span className="text-green-600"><Icon name="billete" size={18} /></span>
            Efectivo contra entrega
          </div>
        </div>

        {/* Notas para el negocio */}
        <div className={seccion}>
          <textarea
            className="box-border w-full resize-none rounded-[10px] border-[1.5px] border-solid border-slate-200 bg-[#fafafa] px-3.5 py-3 font-[inherit] text-[13px] text-slate-600 outline-none transition-colors focus:border-zippy focus:bg-white dark:border-noche-borde dark:bg-noche-alt dark:text-slate-300 dark:focus:bg-noche-card"
            rows={3}
            placeholder="Ej: Entrega sin sal, llamar al llegar..."
            value={nota}
            onChange={e => setNota(e.target.value)}
            aria-label="Notas para el pedido"
          />
        </div>

        {dirElegida && dirElegida.lat == null && !porZonas && (
          <p className="m-0 mx-4 mb-3 rounded-[10px] bg-amber-500/[0.12] px-3 py-2.5 text-[13px] leading-snug text-amber-700 dark:text-amber-300 sm:mx-5">
            Esta dirección no está marcada en el mapa. Para que el repartidor llegue exacto, agrégala de nuevo en Perfil → Direcciones y marca tu casa.
          </p>
        )}

        {tieneAlcohol && (
          <label className="mx-4 mb-3.5 mt-1 flex cursor-pointer items-start gap-2.5 text-sm leading-snug text-slate-700 dark:text-slate-300 sm:mx-5">
            <input
              type="checkbox"
              checked={mayorEdad}
              onChange={e => setMayorEdad(e.target.checked)}
              className="mt-px h-5 w-5 shrink-0 accent-zippy"
            />
            <span>Confirmo que soy mayor de 18 años. El repartidor puede pedir mi documento al entregar. La venta de alcohol a menores está prohibida.</span>
          </label>
        )}

        {/* Desglose: productos y domicilio por separado */}
        {!bloqueoZona && (
          <div className="px-4 pb-2.5 pt-1 sm:px-5">
            <div className="flex justify-between py-1 text-[13.5px] text-slate-500 dark:text-slate-400">
              <span>Productos</span><strong className="text-slate-800 dark:text-slate-100">{fmt(subtotal)}</strong>
            </div>
            <div className="flex justify-between py-1 text-[13.5px] text-slate-500 dark:text-slate-400">
              <span>
                Domicilio{porZonas && cot?.zona ? ` · ${cot.zona}` : ''}
                {tiendas.length > 1 ? ` (${tiendas.length} tiendas × ${fmt(envioPorTienda)})` : ''}
              </span>
              <strong className="text-slate-800 dark:text-slate-100">{fmt(envioTotal)}</strong>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between bg-zippy-50 px-4 py-3.5 dark:bg-[#1a2030] sm:px-5 sm:py-4">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Total</span>
          <span className={cx('text-2xl font-black sm:text-[26px]', bloqueoZona ? 'text-slate-400' : 'text-zippy')}>{bloqueoZona ? '—' : fmt(total)}</span>
        </div>

        <div className="px-4 pt-3.5 sm:px-5 sm:pt-4">
          <button
            className={botonGrande}
            onClick={handleConfirmar}
            disabled={loading || !dirElegida || itemsCerrados.length > 0 || (tieneAlcohol && !mayorEdad) || bloqueoZona}
          >
            {loading
              ? 'Procesando...'
              : itemsCerrados.length > 0
                ? 'Hay productos no disponibles'
                : !dirElegida
                  ? 'Agrega una dirección'
                  : fueraZona
                    ? 'Elige otra dirección'
                    : sinPunto
                      ? 'Marca tu dirección en el mapa'
                      : 'Confirmar Orden'}
          </button>
        </div>
        <p className="m-0 px-4 pb-5 pt-1.5 text-center text-xs text-slate-400 sm:px-5 sm:pb-4">Recibirás confirmación en tu correo</p>
      </div>

      {/* Hoja que sube desde abajo para elegir o agregar la direccion */}
      {hojaDir && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-950/55" onClick={() => setHojaDir(null)}>
          <div
            className="box-border max-h-[88vh] w-full max-w-[560px] animate-aparecer overflow-y-auto rounded-t-[22px] bg-white px-4 pb-[calc(18px+env(safe-area-inset-bottom))] pt-2.5 dark:bg-noche-card"
            role="dialog"
            aria-label="Dirección de entrega"
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-sm bg-slate-300 dark:bg-slate-600" />

            {hojaDir === 'elegir' ? (
              <>
                <p className="m-0 mb-3 text-[17px] font-extrabold text-slate-800 dark:text-slate-100">¿A dónde lo llevamos?</p>
                <div className="flex flex-col gap-2">
                  {direcciones.map(d => {
                    const sel = dirMarcada === d.id;
                    return (
                      <label
                        key={d.id}
                        className={cx(
                          'flex cursor-pointer items-start gap-2.5 rounded-xl border-[1.5px] border-solid p-3 transition-colors',
                          sel ? 'border-zippy bg-[#fff6ee] dark:bg-[#2a2016]' : 'border-slate-200 dark:border-noche-borde'
                        )}
                      >
                        <input type="radio" name="direccion" checked={sel} onChange={() => setDirMarcada(d.id)} className="mt-[3px] shrink-0 accent-zippy" />
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <strong className="text-sm text-slate-800 dark:text-slate-100">{d.etiqueta || 'Dirección'}</strong>
                          <span className="text-[13px] text-slate-600 dark:text-slate-300">{d.dir}</span>
                          {d.referencia && <small className="text-xs text-slate-500">{d.referencia}</small>}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <button type="button" className="mt-2.5 w-full cursor-pointer rounded-xl border-[1.5px] border-dashed border-zippy bg-transparent p-[13px] font-[inherit] text-sm font-extrabold text-zippy" onClick={() => setHojaDir('nueva')}>
                  + Agregar nueva dirección
                </button>
                <button
                  type="button"
                  className={cx(botonGrande, 'mt-3')}
                  disabled={!dirMarcada}
                  onClick={() => { setDirId(dirMarcada); setHojaDir(null); }}
                >
                  Usar esta dirección
                </button>
              </>
            ) : (
              <form onSubmit={guardarDireccionNueva} className="flex flex-col gap-2.5">
                <p className="m-0 mb-0.5 text-[17px] font-extrabold text-slate-800 dark:text-slate-100">Nueva dirección</p>
                <input className={campoHoja} placeholder="Nombre (Casa, Trabajo...)" value={formDir.etiqueta} onChange={e => setFormDir(p => ({ ...p, etiqueta: e.target.value }))} required />
                <input className={campoHoja} placeholder="Dirección completa" value={formDir.direccion} onChange={e => setFormDir(p => ({ ...p, direccion: e.target.value }))} required />
                <input className={campoHoja} placeholder="Referencia (casa azul, frente al parque...)" value={formDir.referencia} onChange={e => setFormDir(p => ({ ...p, referencia: e.target.value }))} />
                <SelectorUbicacion direccion={formDir.direccion} valor={ubicDir} onChange={setUbicDir} />
                <button type="submit" className={cx(botonGrande, 'mt-0.5')} disabled={guardandoDir}>
                  {guardandoDir ? 'Guardando…' : 'Guardar y usar esta dirección'}
                </button>
                <button
                  type="button"
                  className="mt-1.5 w-full cursor-pointer border-0 bg-transparent p-2.5 font-[inherit] text-[13.5px] font-bold text-slate-500 dark:text-slate-400"
                  onClick={() => setHojaDir(direcciones.length > 0 ? 'elegir' : null)}
                >
                  {direcciones.length > 0 ? 'Volver a mis direcciones' : 'Cancelar'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserCheckoutPage;