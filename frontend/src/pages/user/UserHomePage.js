import React, { useState, useEffect } from 'react';
import UserLayout from '../../components/UserLayout';
import UserProductModal from '../../components/UserProductModal';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { productosService, negociosService, clienteService } from '../../config/api';
import PantallaCarga from '../../components/PantallaCarga';
import { cx } from '../../ui/tw';
import { urlImagen } from '../../utils/media';
import Icon from '../../components/Icons';
import { estaAbierto, textoCerrado } from '../../utils/horario';
import { coincide } from '../../utils/buscar';

/* ── Countdown ──────────────────────────────────────────── */
const useCountdown = () => {
  const [time, setTime] = useState({ h: 0, m: 0, s: 0 });
  useEffect(() => {
    const calc = () => {
      const now = new Date(), midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const d = midnight - now;
      setTime({ h: Math.floor(d / 3600000), m: Math.floor((d % 3600000) / 60000), s: Math.floor((d % 60000) / 1000) });
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
};
const pad = n => String(n).padStart(2, '0');
// En el celular cada tienda ocupa todo el ancho (ver .uh-stores-row), asi que
// con tres ya se llena buena parte de la pantalla; el resto sale con "Ver todas".
const TIENDAS_VISIBLES = 3;
// Se puede mirar la tienda sin cuenta; guardar y pedir si piden sesion
const hayCuenta = () => !!localStorage.getItem('access_token');

/* ── Helpers de presentación (no son datos, son solo decoración) ─────────── */
const CAT_ICON = {
  bebidas: 'taza', panadería: 'pan', pastelería: 'pastel',
  'frutas y verduras': 'verduras', lácteos: 'lacteos', carnes: 'carnes', otros: 'paquete',
};
const CAT_GRADIENT_BASE = [
  'linear-gradient(135deg,#fff3e6,#fed7aa)',
  'linear-gradient(135deg,#ecfdf5,#a7f3d0)',
  'linear-gradient(135deg,#f5f3ff,#ddd6fe)',
  'linear-gradient(135deg,#eff6ff,#bfdbfe)',
  'linear-gradient(135deg,#fdf2f8,#fbcfe8)',
];
const STORE_COLORS = [
  { bg: '#fff3e6', text: '#FF7A00' },
  { bg: '#f0fdf4', text: '#16a34a' },
  { bg: '#f5f3ff', text: '#7c3aed' },
  { bg: '#eff6ff', text: '#2563eb' },
  { bg: '#fdf2f8', text: '#db2777' },
];

const getIcon = (categoria) => CAT_ICON[(categoria || '').toLowerCase()] || 'paquete';
const getGradient = (categoria, idx) => CAT_GRADIENT_BASE[idx % CAT_GRADIENT_BASE.length];

const fmt = n => `$${Math.round(n).toLocaleString('es-CO')}`;
const esNuevo = (fechaIso) => (Date.now() - new Date(fechaIso).getTime()) < 7 * 86400000;

/* ── Componente ─────────────────────────────────────────── */
const UserHomePage = () => {
  const { addItem, items } = useCart();
  const { addToast }       = useToast();
  const countdown          = useCountdown();

  const [tab,          setTab]          = useState('destacados');
  const [query,        setQuery]        = useState('');
  const [tiendaFiltro, setTiendaFiltro] = useState('');
  const [orden,        setOrden]        = useState('relevancia');
  const [saved,        setSaved]        = useState(new Set());
  const [modalProd,    setModalProd]    = useState(null);
  const [precioMin,    setPrecioMin]    = useState('');
  const [precioMax,    setPrecioMax]    = useState('');
  const [showFilters,  setShowFilters]  = useState(false);

  const [loading,   setLoading]   = useState(true);
  const [productos, setProductos] = useState([]);
  const [tiendas,   setTiendas]   = useState([]);
  const [verTodasTiendas, setVerTodasTiendas] = useState(false);
  const [categorias, setCategorias] = useState([]);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const [{ data: productosRaw }, { data: negociosRaw }] = await Promise.all([
          productosService.listar(undefined, { limit: 100 }),
          negociosService.listar({ limit: 100 }),
        ]);

        if (!activo) return;

        const negociosMap = Object.fromEntries(negociosRaw.map(n => [n.id, n]));

        const conteoPorNegocio = {};
        productosRaw.forEach(p => { conteoPorNegocio[p.negocio_id] = (conteoPorNegocio[p.negocio_id] || 0) + 1; });

        const tiendasReales = negociosRaw
          .filter(n => conteoPorNegocio[n.id])
          .map((n, i) => ({
            id: n.id,
            nombre: n.nombre_negocio,
            // El negocio sube su logo desde su perfil y estaba guardado sin
            // que nadie lo mostrara: el cliente veia una cajita gris igual
            // para todos.
            logo: n.logo || null,
            icon: getIcon(n.categoria),
            color: STORE_COLORS[i % STORE_COLORS.length].bg,
            text: STORE_COLORS[i % STORE_COLORS.length].text,
            count: conteoPorNegocio[n.id] || 0,
            rating: Number(n.calificacion_promedio) || 0,
            hora_apertura: n.hora_apertura,
            hora_cierre: n.hora_cierre,
            dias_operacion: n.dias_operacion,
          }));

        const categoriasReales = [...new Set(productosRaw.map(p => p.categoria).filter(Boolean))]
          .map(cat => ({ id: cat, icon: getIcon(cat), label: cat }));

        const productosMapeados = productosRaw.map((p, i) => ({
          id: p.id,
          nombre: p.nombre,
          descripcion: p.descripcion,
          tienda: negociosMap[p.negocio_id]?.nombre_negocio || 'Tienda',
          negocioId: p.negocio_id,
          precio: Number(p.precio),
          precioOriginal: p.precio_original ? Number(p.precio_original) : null,
          descuento: Number(p.descuento_porcentaje) || 0,
          enOferta: !!p.en_oferta,
          categoria: p.categoria || 'Otros',
          nuevo: esNuevo(p.fecha_creacion),
          rating: Number(p.calificacion_promedio) || 0,
          stock: p.stock,
          foto: p.imagenes?.[0] || null,
          totalVendidos: p.total_vendidos || 0,
          gradIdx: i,
          hora_apertura: negociosMap[p.negocio_id]?.hora_apertura,
          hora_cierre: negociosMap[p.negocio_id]?.hora_cierre,
          dias_operacion: negociosMap[p.negocio_id]?.dias_operacion,
        }));

        setProductos(productosMapeados);
        setTiendas(tiendasReales);
        setCategorias(categoriasReales);
      } catch {
        if (activo) { setProductos([]); setTiendas([]); setCategorias([]); }
      } finally {
        if (activo) setLoading(false);
      }
    })();
    return () => { activo = false; };
  }, []);

  useEffect(() => {
    // Los guardados son de la cuenta: sin sesion no se piden
    if (!hayCuenta()) return;
    let activo = true;
    clienteService.favoritos()
      .then(({ data }) => {
        if (!activo) return;
        const lista = Array.isArray(data) ? data : (data?.items || []);
        setSaved(new Set(lista.map(p => p.producto_id || p.id)));
      })
      .catch(() => { if (activo) setSaved(new Set()); });
    return () => { activo = false; };
  }, []);

  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const hora    = new Date().getHours();
  const saludo  = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';

  const populares = [...productos].sort((a, b) => b.totalVendidos - a.totalVendidos).slice(0, 5);
  const oferta = [...productos].filter(p => p.descuento > 0).sort((a, b) => b.descuento - a.descuento)[0] || null;

  const ratingPromedioTiendas = tiendas.length
    ? (tiendas.reduce((s, t) => s + (Number(t.rating) || 0), 0) / tiendas.length)
    : 0;

  const filtrados = productos
    .filter(p => {
      // Busca sin importar tildes, mayusculas ni errores de escritura, y
      // mira tambien la descripcion y la categoria: quien escribe "platano"
      // o "arros" tiene que encontrar su producto igual.
      const matchQ      = coincide([p.nombre, p.tienda, p.descripcion, p.categoria], query);
      const matchTab    = tab === 'destacados' || p.categoria === tab;
      const matchTienda = !tiendaFiltro || p.tienda === tiendaFiltro;
      const matchMin    = !precioMin || p.precio >= Number(precioMin);
      const matchMax    = !precioMax || p.precio <= Number(precioMax);
      return matchQ && matchTab && matchTienda && matchMin && matchMax;
    })
    .sort((a, b) => {
      if (orden === 'precio-asc')  return a.precio - b.precio;
      if (orden === 'precio-desc') return b.precio - a.precio;
      if (orden === 'rating')      return b.rating - a.rating;
      return 0;
    });

  const handleAdd = p => {
    if (!estaAbierto(p)) {
      addToast(`${p.tienda} está cerrada ahora · ${textoCerrado(p)}`, 'error');
      return;
    }
    addItem(p);
    addToast(`${p.nombre} agregado al carrito`, 'success');
  };
  const toggleSave = (id) => {
    if (!hayCuenta()) {
      addToast('Inicia sesión para guardar productos', 'error');
      window.location.href = '/login';
      return;
    }
    const yaGuardado = saved.has(id);
    // Actualizacion optimista: refleja el cambio ya mismo en la UI...
    setSaved(prev => { const s = new Set(prev); yaGuardado ? s.delete(id) : s.add(id); return s; });
    // ...y lo confirma contra el backend. Antes esto NUNCA se guardaba de
    // verdad: solo cambiaba un estado local de React que se perdia al
    // recargar, por eso "Guardados" en el perfil siempre aparecia vacio.
    const peticion = yaGuardado ? clienteService.quitarFavorito(id) : clienteService.agregarFavorito(id);
    peticion.catch(() => {
      // Si falla, revierte el cambio optimista.
      setSaved(prev => { const s = new Set(prev); yaGuardado ? s.add(id) : s.delete(id); return s; });
      addToast('No se pudo actualizar guardados', 'error');
    });
  };
  const inCart  = id => items.some(i => i.id === id);
  const cartQty = id => items.find(i => i.id === id)?.qty || 0;

  if (loading) {
    return (
      <UserLayout onSearch={setQuery}>
        <PantallaCarga texto="Cargando los negocios de Garzón…" />
      </UserLayout>
    );
  }

  // ── Piezas de estilo que se repiten ──────────────────────────────────────
  const seccion = 'mb-6 px-4 md:mb-8 md:px-0';
  const seccionHdr = 'mb-4 flex items-center justify-between gap-3';
  const seccionTitulo = 'm-0 flex items-center gap-1.5 text-lg font-extrabold text-slate-800 dark:text-slate-100';
  const enlace = 'cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-[13px] font-bold text-zippy hover:underline';
  const etiquetaFoto = 'absolute rounded-[5px] px-2 py-[3px] text-[9px] font-extrabold tracking-[0.3px]';
  const notaPeque = 'self-start rounded-md px-2 py-[3px] text-[11px] font-bold mt-1';
  const irAProductos = () => document.getElementById('uh-productos')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <UserLayout onSearch={setQuery}>

      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="relative mb-5 flex items-center justify-between gap-6 overflow-hidden bg-[linear-gradient(135deg,#FF7A00_0%,#ff9a3c_55%,#ffb84d_100%)] px-5 pb-6 pt-[22px] md:mb-8 md:min-h-[220px] md:rounded-[22px] md:px-10 md:py-9">
        <span className="pointer-events-none absolute -right-[60px] -top-20 h-[280px] w-[280px] rounded-full bg-white/10" />
        <span className="pointer-events-none absolute -bottom-[60px] left-[30%] h-[200px] w-[200px] rounded-full bg-white/[0.06]" />

        <div className="relative z-[1] min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.22] px-3.5 py-1.5 text-[13px] font-semibold text-white backdrop-blur-[6px]">
              <Icon name="ubicacion" size={14} />Garzón, Huila
            </span>
            {usuario.nombre && (
              <span className="text-[13px] font-semibold text-white/90">{saludo}, {usuario.nombre.split(' ')[0]}</span>
            )}
          </div>
          <h1 className="m-0 mb-2 text-[24px] font-black leading-[1.12] tracking-[-0.5px] text-white xs:text-[26px] md:text-[36px]">¿Qué quieres<br />pedir hoy?</h1>
          <p className="m-0 mb-[22px] hidden max-w-[340px] text-sm leading-normal text-white/80 md:block">Productos frescos de tiendas locales directo a tu puerta</p>
          <div className="flex flex-wrap gap-2 md:gap-2.5">
            {[{ id: 'destacados', icon: 'destacado', label: 'Destacados' }, ...categorias].map(c => {
              const activo = tab === c.id;
              return (
                <button
                  key={c.id}
                  className={cx(
                    'flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] border-solid px-3.5 py-[7px] font-[inherit] text-xs font-bold transition-colors md:px-[18px] md:py-[9px] md:text-[13px]',
                    activo ? 'border-white bg-white text-zippy' : 'border-white/35 bg-white/20 text-white hover:bg-white/30'
                  )}
                  onClick={() => { setTab(c.id); irAProductos(); }}
                >
                  <Icon name={c.icon} size={16} /><span>{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lado derecho del hero, solo en PC */}
        <div className="relative z-[1] hidden shrink-0 flex-col items-center gap-5 md:flex">
          <div className="flex h-[100px] w-[100px] items-center justify-center rounded-full bg-white/[0.18] text-white shadow-[0_8px_32px_rgba(0,0,0,0.15)]">
            <Icon name="repartidores" size={54} strokeWidth={1.3} />
          </div>
          <div className="flex items-center gap-4 rounded-2xl bg-white/15 px-5 py-3 backdrop-blur-[6px]">
            {[
              [tiendas.length, 'Tiendas'],
              [productos.length, 'Productos'],
              [ratingPromedioTiendas > 0 ? ratingPromedioTiendas.toFixed(1) : '—', 'Rating'],
            ].map(([num, label], i) => (
              <React.Fragment key={label}>
                {i > 0 && <span className="h-[30px] w-px bg-white/30" />}
                <span className="flex flex-col items-center gap-0.5">
                  <span className="text-lg font-black leading-none text-white">{num}</span>
                  <span className="text-[10px] font-semibold uppercase text-white/80">{label}</span>
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* ── Más pedidos hoy ─────────────────────────────── */}
      {populares.length > 0 && (
        <div className={seccion}>
          <div className={seccionHdr}>
            <h2 className={seccionTitulo}><Icon name="destacado" size={19} />Más pedidos</h2>
            <button className={enlace} onClick={() => setTab('destacados')}>Ver todos →</button>
          </div>
          {/* Fila que se desliza de lado: la tarjeta cortada a la derecha avisa que hay mas */}
          <div className="flex gap-3.5 overflow-x-auto pb-2 [scrollbar-color:#FF7A00_#f0f0f0] [scrollbar-width:thin]">
            {populares.map(p => (
              <button
                key={p.id}
                className="w-[148px] shrink-0 cursor-pointer overflow-hidden rounded-[18px] border-[1.5px] border-solid border-transparent bg-white p-0 text-left font-[inherit] shadow-[0_2px_12px_rgba(0,0,0,0.08)] transition hover:-translate-y-1 hover:border-zippy hover:shadow-[0_8px_28px_rgba(0,0,0,0.13)] dark:border-noche-borde dark:bg-noche-card dark:hover:border-zippy md:w-[170px]"
                onClick={() => setModalProd(p)}
              >
                <div className="relative flex h-24 items-center justify-center overflow-hidden md:h-[110px]" style={{ background: getGradient(p.categoria, p.gradIdx) }}>
                  {p.foto
                    ? <img src={urlImagen(p.foto, true)} alt={p.nombre} loading="lazy" className="h-full w-full object-cover" />
                    : <Icon name={getIcon(p.categoria)} size={30} strokeWidth={1.4} />}
                  {p.rating > 0 && (
                    <span className="absolute right-2 top-2 inline-flex items-center gap-0.5 rounded-[10px] bg-white/95 px-2 py-[3px] text-[11px] font-bold text-[#333] shadow-[0_2px_6px_rgba(0,0,0,0.1)] dark:bg-noche-card/85 dark:text-slate-200">
                      <Icon name="estrella" size={13} />{p.rating.toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="px-3.5 pb-3.5 pt-3">
                  <p className="m-0 mb-[3px] text-[13px] font-bold leading-[1.3] text-slate-800 dark:text-slate-100">{p.nombre}</p>
                  <p className="m-0 mb-2.5 text-[11px] text-slate-400">{p.tienda}</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-black text-zippy md:text-base">{fmt(p.precio)}</span>
                    <span
                      className={cx(
                        'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-xl font-bold leading-none text-white transition-transform hover:scale-110',
                        inCart(p.id) ? 'bg-emerald-500 shadow-[0_4px_12px_rgba(16,185,129,0.35)]' : 'bg-zippy shadow-[0_4px_12px_rgba(255,122,0,0.35)]'
                      )}
                      onClick={e => { e.stopPropagation(); handleAdd(p); }}
                    >
                      {inCart(p.id) ? '✓' : '+'}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Oferta del día ──────────────────────────────── */}
      {oferta && (
        <div className="mb-6 grid grid-cols-1 gap-4 px-4 md:mb-8 md:grid-cols-2 md:px-0">
          <div className="relative flex flex-col items-start justify-between gap-4 overflow-hidden rounded-[20px] bg-[linear-gradient(135deg,#1e293b_0%,#0f172a_100%)] px-5 py-6 md:flex-row md:px-[26px]">
            <span className="pointer-events-none absolute -top-[50px] right-[60px] h-[180px] w-[180px] rounded-full bg-zippy/10" />
            <div className="relative z-[1] w-full min-w-0 flex-1">
              <span className="mb-2.5 inline-flex items-center gap-1 rounded-full bg-zippy px-3 py-1 text-[10px] font-extrabold tracking-[0.5px] text-white">
                <Icon name="rayo" size={13} />OFERTA DEL DÍA
              </span>
              <p className="m-0 mb-[3px] text-[22px] font-black text-white">{oferta.nombre}</p>
              <p className="m-0 mb-3 text-xs text-slate-500">{oferta.tienda}</p>
              <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
                <span className="text-[13px] text-slate-500 line-through">{fmt(oferta.precioOriginal || oferta.precio)}</span>
                <span className="text-[26px] font-black text-zippy">{fmt(oferta.precio)}</span>
                <span className="rounded-md bg-red-500 px-[9px] py-[3px] text-xs font-extrabold text-white">-{oferta.descuento}%</span>
              </div>
              <div className="mb-4 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] font-semibold uppercase text-slate-500">Termina en</span>
                {[[countdown.h, 'H'], [countdown.m, 'M'], [countdown.s, 'S']].map(([v, l], i) => (
                  <React.Fragment key={l}>
                    {i > 0 && <span className="mb-2.5 text-lg font-black text-zippy">:</span>}
                    <span className="flex min-w-[42px] flex-col items-center rounded-lg bg-white/[0.08] px-2.5 py-[7px]">
                      <span className="text-xl font-black leading-none text-white">{pad(v)}</span>
                      <small className="text-[8px] font-bold uppercase text-slate-500">{l}</small>
                    </span>
                  </React.Fragment>
                ))}
              </div>
              <button
                className="w-full cursor-pointer whitespace-nowrap rounded-xl border-0 bg-zippy px-5 py-[11px] text-center font-[inherit] text-sm font-extrabold text-white transition hover:-translate-y-px hover:bg-zippy-600 md:w-auto"
                onClick={() => handleAdd(oferta)}
              >
                {inCart(oferta.id) ? `✓ En carrito (${cartQty(oferta.id)})` : 'Aprovechar oferta →'}
              </button>
            </div>
            <div className="absolute right-4 top-4 z-[1] text-white opacity-40 md:relative md:right-auto md:top-auto md:self-center md:opacity-100">
              <Icon name="regalo" size={46} strokeWidth={1.3} />
            </div>
          </div>
        </div>
      )}

      {/* ── Tiendas ──────────────────────────────────────── */}
      {tiendas.length > 0 && (
        <div className={seccion}>
          <div className={seccionHdr}>
            <h2 className={seccionTitulo}><Icon name="vendedores" size={19} />Tiendas</h2>
            {tiendaFiltro ? (
              <button className="cursor-pointer border-0 bg-transparent font-[inherit] text-xs font-semibold text-red-500" onClick={() => setTiendaFiltro('')}>Quitar filtro ✕</button>
            ) : tiendas.length > TIENDAS_VISIBLES && (
              <button className={cx(enlace, 'py-1')} onClick={() => setVerTodasTiendas(v => !v)}>
                {verTodasTiendas ? 'Ver menos ▴' : `Ver todas (${tiendas.length}) ▾`}
              </button>
            )}
          </div>
          {/* Una tienda por fila en el celular (antes iban dos y el nombre se
              partia en dos o tres renglones); cuadricula en PC. */}
          <div className="grid grid-cols-1 gap-2.5 pb-1.5 sm:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] sm:gap-3">
            {(verTodasTiendas ? tiendas : tiendas.slice(0, TIENDAS_VISIBLES)).map(t => {
              const activa = tiendaFiltro === t.nombre;
              return (
                <button
                  key={t.id}
                  className={cx(
                    'flex min-w-0 cursor-pointer items-center gap-3.5 rounded-2xl border-2 border-solid px-4 py-3.5 font-[inherit] shadow-[0_2px_8px_rgba(0,0,0,0.07)] transition hover:-translate-y-0.5 hover:border-zippy hover:shadow-[0_6px_20px_rgba(255,122,0,0.12)] sm:gap-3 sm:px-[18px]',
                    activa ? 'border-zippy bg-zippy-50 dark:bg-[#1a2030]' : 'border-transparent bg-white dark:bg-noche-card'
                  )}
                  onClick={() => {
                    setTiendaFiltro(activa ? '' : t.nombre);
                    if (!activa) setTimeout(() => document.getElementById('uh-productos')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                  }}
                >
                  <div
                    className="flex h-[54px] w-[54px] shrink-0 items-center justify-center overflow-hidden rounded-[15px] sm:h-[46px] sm:w-[46px] sm:rounded-[14px]"
                    style={{ background: t.color, color: t.text }}
                  >
                    {/* Sin logo, la inicial del nombre: con el cubo de antes todas
                        las tiendas sin logo se veian iguales. */}
                    {t.logo
                      ? <img src={urlImagen(t.logo, true)} alt={t.nombre} loading="lazy" className="block h-full w-full object-cover" />
                      : <span className="text-2xl font-black leading-none sm:text-[22px]">{(t.nombre || '?').trim().charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="m-0 mb-0.5 truncate text-base font-bold leading-[1.3] text-slate-800 dark:text-slate-100 sm:line-clamp-2 sm:whitespace-normal sm:text-[13px]">{t.nombre}</p>
                    {estaAbierto(t)
                      ? <p className="m-0 text-[13px] text-slate-400 sm:text-[11px]"><span className="font-bold text-emerald-600 dark:text-emerald-400">Abierto</span> · {t.count} producto{t.count !== 1 ? 's' : ''}</p>
                      : <p className="m-0 text-[13px] font-bold text-slate-500 sm:text-[11px]">{textoCerrado(t)}</p>}
                  </div>
                  {activa
                    ? <span className="text-base font-black text-zippy">✓</span>
                    : <span className="shrink-0 text-[22px] font-light leading-none text-slate-400 dark:text-slate-500" aria-hidden="true">›</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Productos ────────────────────────────────────── */}
      <div id="uh-productos" className={seccion}>
        <div className="flex flex-col items-start gap-0 md:flex-row md:gap-6">

          {/* Menu lateral de categorias (solo PC) */}
          <aside className="sticky top-[76px] hidden w-[180px] shrink-0 rounded-[18px] bg-white py-4 shadow-[0_2px_10px_rgba(0,0,0,0.07)] dark:bg-noche-card md:block">
            {(() => {
              const item = (activo) => cx(
                'flex w-full cursor-pointer items-center gap-2.5 border-0 border-l-[3px] border-solid px-4 py-[11px] text-left font-[inherit] text-sm transition-colors',
                activo
                  ? 'border-l-zippy bg-[#fff3e6] font-bold text-zippy dark:bg-zippy/[0.12] dark:text-orange-400'
                  : 'border-l-transparent bg-transparent font-medium text-slate-600 hover:bg-zippy-50 hover:text-zippy dark:text-slate-400 dark:hover:bg-noche-alt'
              );
              const tituloLado = 'm-0 px-4 pb-2.5 text-[10px] font-extrabold uppercase tracking-[0.8px] text-slate-400 dark:text-slate-500';
              const divisor = <div className="my-2 h-px bg-slate-100 dark:bg-noche-borde" />;
              return (
                <>
                  <p className={tituloLado}>Categorías</p>
                  <button className={item(tab === 'destacados')} onClick={() => setTab('destacados')}>
                    <span className="w-[22px] shrink-0 text-center"><Icon name="destacado" size={17} /></span><span>Destacados</span>
                  </button>
                  {categorias.map(c => (
                    <button key={c.id} className={item(tab === c.id)} onClick={() => setTab(c.id)}>
                      <span className="w-[22px] shrink-0 text-center"><Icon name={c.icon} size={17} /></span><span>{c.label}</span>
                    </button>
                  ))}
                  {divisor}
                  <button className={cx(item(false), 'font-semibold text-zippy')} onClick={() => { setTab('destacados'); setTiendaFiltro(''); }}>
                    <span className="w-[22px] shrink-0 text-center"><Icon name="filtro" size={17} /></span><span>Ver todo</span>
                  </button>
                  {tiendas.length > 0 && (
                    <>
                      {divisor}
                      <p className={cx(tituloLado, 'mt-1')}>Tiendas</p>
                      {tiendas.map(t => (
                        <button key={t.id} className={item(tiendaFiltro === t.nombre)} onClick={() => setTiendaFiltro(prev => prev === t.nombre ? '' : t.nombre)}>
                          <span className="flex w-[22px] shrink-0 justify-center">
                            {t.logo
                              ? <img src={urlImagen(t.logo, true)} alt="" className="block h-[17px] w-[17px] rounded-[5px] object-cover" loading="lazy" />
                              : <Icon name={t.icon} size={17} />}
                          </span>
                          <span className="text-xs">{t.nombre}</span>
                        </button>
                      ))}
                    </>
                  )}
                </>
              );
            })()}
          </aside>

          <div className="w-full min-w-0 flex-1">
            <div className="mb-3 flex max-w-full flex-wrap items-start justify-between gap-3 md:mb-4">
              <div className="min-w-0">
                <h2 className="m-0 mb-0.5 flex flex-wrap items-center gap-1.5 text-[17px] font-extrabold text-slate-800 dark:text-slate-100 md:text-xl">
                  <Icon name={tab === 'destacados' ? 'destacado' : getIcon(tab)} size={15} />
                  {tab === 'destacados' ? 'Destacados' : tab}
                  {tiendaFiltro && <span className="text-zippy">· {tiendaFiltro}</span>}
                </h2>
                <p className="m-0 text-[13px] text-slate-500">{filtrados.length} producto{filtrados.length !== 1 ? 's' : ''}</p>
              </div>
              {/* En celular ocupa todo el ancho: Filtros a la izquierda y el orden estirado */}
              <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
                <button
                  className={cx(
                    'flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] border-[1.5px] border-solid px-3.5 py-2 font-[inherit] text-[13px] font-semibold transition-colors',
                    showFilters
                      ? 'border-zippy bg-zippy-50 text-zippy dark:bg-[#1a2030]'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-zippy hover:text-zippy dark:border-noche-borde dark:bg-noche-alt dark:text-slate-400'
                  )}
                  onClick={() => setShowFilters(v => !v)}
                >
                  <Icon name="config" size={15} />Filtros
                </button>
                <select
                  className="min-w-0 flex-1 cursor-pointer rounded-[10px] border-[1.5px] border-solid border-slate-200 bg-white px-3 py-2 font-[inherit] text-[13px] text-slate-600 outline-none focus:border-zippy dark:border-noche-borde dark:bg-noche-alt dark:text-slate-200 sm:flex-none"
                  value={orden}
                  onChange={e => setOrden(e.target.value)}
                  aria-label="Ordenar"
                >
                  <option value="relevancia">Relevancia</option>
                  <option value="precio-asc">Precio ↑</option>
                  <option value="precio-desc">Precio ↓</option>
                  <option value="rating">Mejor valorados</option>
                </select>
              </div>
            </div>

            {showFilters && (
              <div className="mb-4 box-border max-w-full rounded-[14px] border-[1.5px] border-solid border-[#f0f0f0] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)] dark:border-noche-borde dark:bg-noche-card">
                <p className="m-0 mb-2.5 text-[11px] font-bold uppercase tracking-[0.5px] text-slate-400">Rango de precio</p>
                <div className="flex min-w-0 items-center gap-2.5">
                  {[['Mín', precioMin, setPrecioMin], ['Máx', precioMax, setPrecioMax]].map(([ph, v, set], i) => (
                    <React.Fragment key={ph}>
                      {i > 0 && <span className="text-slate-400">—</span>}
                      <input
                        className="min-w-0 flex-1 rounded-[10px] border-[1.5px] border-solid border-slate-200 bg-white px-3.5 py-2.5 font-[inherit] text-sm outline-none focus:border-zippy dark:border-noche-borde dark:bg-noche-alt dark:text-slate-200"
                        type="number" placeholder={ph} value={v} onChange={e => set(e.target.value)}
                      />
                    </React.Fragment>
                  ))}
                  {(precioMin || precioMax) && (
                    <button className="cursor-pointer whitespace-nowrap rounded-[10px] border-[1.5px] border-solid border-red-200 bg-transparent px-3 py-2 font-[inherit] text-[13px] font-bold text-red-500" onClick={() => { setPrecioMin(''); setPrecioMax(''); }}>
                      Limpiar
                    </button>
                  )}
                </div>
              </div>
            )}

            {filtrados.length === 0 ? (
              <div className="flex flex-col items-center gap-2.5 px-5 py-16 text-center text-slate-400">
                <span className="opacity-40"><Icon name={productos.length === 0 ? 'paquete' : 'buscar'} size={38} strokeWidth={1.2} /></span>
                <p className="m-0 text-[15px]">{productos.length === 0
                  ? 'Todavía no hay productos publicados. Los negocios de Garzón están llegando: vuelve pronto.'
                  : 'No encontramos nada con esos filtros. Prueba quitando alguno o busca otra cosa.'}</p>
              </div>
            ) : (
              // 2 columnas en celular, 3 en PC
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
                {filtrados.map(p => (
                  <div
                    key={p.id}
                    className="flex cursor-pointer flex-col overflow-hidden rounded-[18px] border-[1.5px] border-solid border-transparent bg-white shadow-[0_2px_10px_rgba(0,0,0,0.07)] transition hover:-translate-y-1 hover:border-zippy hover:shadow-[0_10px_30px_rgba(0,0,0,0.12)] dark:border-noche-borde dark:bg-noche-card dark:hover:border-zippy"
                    onClick={() => setModalProd(p)}
                  >
                    <div className="relative flex h-[108px] shrink-0 items-center justify-center md:h-[130px]" style={{ background: getGradient(p.categoria, p.gradIdx) }}>
                      {p.foto
                        ? <img src={urlImagen(p.foto, true)} alt={p.nombre} loading="lazy" className="h-full w-full object-cover" />
                        : <Icon name={getIcon(p.categoria)} size={40} strokeWidth={1.3} />}
                      {p.enOferta && <span className={cx(etiquetaFoto, 'left-2.5 top-2.5 inline-flex items-center gap-0.5 bg-[linear-gradient(135deg,#ff7a00,#ff4d4d)] text-white')}><Icon name="destacado" size={12} />Oferta</span>}
                      {p.nuevo && !p.enOferta && <span className={cx(etiquetaFoto, 'left-2.5 top-2.5 bg-red-500 tracking-[0.5px] text-white')}>NUEVO</span>}
                      {p.rating >= 4.7 && <span className={cx(etiquetaFoto, 'bottom-2.5 left-2.5 inline-flex items-center gap-0.5 bg-amber-400 text-amber-900')}><Icon name="estrella" size={12} />Top</span>}
                      {p.rating > 0 && (
                        <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-0.5 rounded-[10px] bg-white/95 px-2 py-[3px] text-[11px] font-bold text-[#333] shadow-[0_2px_6px_rgba(0,0,0,0.1)] dark:bg-noche-card/85 dark:text-slate-200">
                          <Icon name="estrella" size={12} />{p.rating.toFixed(1)}
                        </span>
                      )}
                      {inCart(p.id) && (
                        <span className="absolute bottom-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-zippy text-[11px] font-extrabold text-white shadow-[0_2px_8px_rgba(255,122,0,0.4)]">{cartQty(p.id)}</span>
                      )}
                      {!estaAbierto(p) && <span className={cx(etiquetaFoto, 'left-2.5 top-2.5 bg-slate-900/85 text-white')}>Cerrado</span>}
                    </div>
                    <div className="flex flex-1 flex-col gap-[3px] px-3 py-2.5 md:px-4 md:py-3.5">
                      <p className="m-0 text-[13px] font-bold leading-[1.3] text-slate-800 dark:text-slate-100 md:text-sm">{p.nombre}</p>
                      <p className="m-0 text-xs text-slate-400">{p.tienda}</p>
                      {/* En celular el precio va arriba y los botones abajo a todo el ancho:
                          en una tarjeta de ~150 px no caben precio + corazon + "Agregar" en una fila */}
                      <div className="mt-2 flex flex-col items-stretch justify-between gap-2 md:flex-row md:items-center">
                        <div className="min-w-0">
                          <p className="m-0 text-[15px] font-black text-zippy md:text-lg">{fmt(p.precio)}</p>
                          {p.enOferta && p.precioOriginal && (
                            <p className="-mt-0.5 mb-0 text-xs text-slate-400 line-through">{fmt(p.precioOriginal)}</p>
                          )}
                        </div>
                        <div className="flex w-full items-center gap-1.5 md:w-auto" onClick={e => e.stopPropagation()}>
                          <button
                            className={cx(
                              'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-[1.5px] border-solid transition-colors hover:border-red-500 hover:text-red-500',
                              saved.has(p.id) ? 'border-red-500 bg-red-50 text-red-500' : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-noche-borde dark:bg-noche-alt'
                            )}
                            onClick={() => toggleSave(p.id)}
                            aria-label="Guardar"
                          ><Icon name="corazon" size={18} filled={saved.has(p.id)} /></button>
                          <button
                            className={cx(
                              'flex min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-lg border-0 px-[9px] py-[7px] font-[inherit] text-[11px] font-bold transition-colors md:flex-none md:px-3 md:py-2 md:text-xs',
                              !estaAbierto(p) ? 'cursor-not-allowed bg-slate-300 text-slate-500'
                                : inCart(p.id) ? 'cursor-pointer bg-emerald-500 text-white hover:bg-emerald-600'
                                : 'cursor-pointer bg-zippy text-white hover:bg-zippy-600'
                            )}
                            onClick={() => handleAdd(p)}
                            disabled={!estaAbierto(p)}
                          >
                            {!estaAbierto(p) ? 'Cerrado' : (inCart(p.id) ? `✓ ${cartQty(p.id)}` : '+ Agregar')}
                          </button>
                        </div>
                      </div>
                      {!estaAbierto(p)
                        ? <p className={cx(notaPeque, 'bg-slate-100 text-slate-500 dark:bg-noche-alt')}>{textoCerrado(p)}</p>
                        : (p.stock <= 10 && <span className={cx(notaPeque, 'bg-red-50 text-red-500 dark:bg-[#3a1a1a]')}>¡Solo {p.stock} disponibles!</span>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <UserProductModal
        producto={modalProd}
        grad={modalProd ? getGradient(modalProd.categoria, modalProd.gradIdx) : ''}
        emoji={modalProd ? getIcon(modalProd.categoria) : ''}
        iconName={modalProd ? getIcon(modalProd.categoria) : 'paquete'}
        onClose={() => setModalProd(null)}
      />
    </UserLayout>
  );
};

export default UserHomePage;