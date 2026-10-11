import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLoadScript, GoogleMap, Marker } from '@react-google-maps/api';
import UserLayout from '../../components/UserLayout';
import OrdenChat from '../../components/OrdenChat';
import ZLoader from '../../components/ZLoader';
import ConfirmModal from '../../components/ConfirmModal';
import EliminarCuenta from '../../components/EliminarCuenta';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { useTheme } from '../../context/ThemeContext';
import { ordenesService, negociosService, productosService, resenasService, usuariosService, pedidosEspecialesService } from '../../config/api';
import { MAPS_KEY, MAPS_LIBRARIES, GARZON } from '../../config/googleMaps';
import SelectorUbicacion from '../../components/SelectorUbicacion';
import { cx } from '../../ui/tw';
import { urlImagen } from '../../utils/media';
import { fechaCorta, fechaHoraLarga, fechaServidor, minutosDesde } from '../../utils/fechas';
import Icon from '../../components/Icons';
import { clienteService, soporteService } from '../../config/api';

// Clases de Tailwind de esta pantalla (antes en UserPanel.css)
const C = {
  trackBtn: 'mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-solid p-2.5 font-[inherit] text-[13px] font-bold transition-colors disabled:cursor-default disabled:opacity-60',
  trackBtnNaranja: 'border-[#ffd9ad] bg-zippy-50 text-zippy hover:enabled:border-zippy hover:enabled:bg-zippy hover:enabled:text-white dark:border-zippy/30 dark:bg-zippy/10',
  trackBtnGris: 'border-slate-200 bg-slate-50 text-slate-600 hover:enabled:border-slate-600 hover:enabled:bg-slate-600 hover:enabled:text-white dark:border-noche-borde dark:bg-noche-alt dark:text-slate-300',
  trackBtnRojo: 'border-red-200 bg-[#fff5f5] text-red-700 hover:enabled:border-red-700 hover:enabled:bg-red-700 hover:enabled:text-white dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
  addrBtn: 'cursor-pointer rounded-[7px] border-[1.5px] border-solid bg-white px-3 py-[5px] font-[inherit] text-xs font-semibold transition-colors dark:bg-noche-alt',
  empty: 'flex flex-col items-center gap-2.5 px-5 py-[60px] text-center text-slate-400 [&>p]:m-0 [&>p]:text-[15px] [&>p]:font-medium [&>span]:opacity-30',
  list: 'flex flex-col gap-3',
  orderCard: 'rounded-[14px] bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.07)] dark:bg-noche-card dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]',
  orderTop: 'mb-2 flex items-center justify-between gap-2',
  orderId: 'font-mono text-sm font-extrabold text-slate-800 dark:text-slate-100',
  orderBadge: 'whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-bold',
  orderTienda: 'm-0 mb-1 flex items-center gap-1 text-xs text-slate-500',
  orderItems: 'm-0 mb-2.5 text-[13px] leading-snug text-slate-700 dark:text-slate-300',
  orderBottom: 'flex items-center justify-between gap-2',
  orderFecha: 'text-xs text-slate-400',
  orderTotal: 'text-base font-black text-zippy',
  avisoEspera: 'm-0 mb-0.5 mt-2.5 rounded-xl border border-solid border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] leading-[1.45] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  avisoLink: 'mt-2 flex items-center gap-1.5 font-extrabold text-green-700 no-underline dark:text-green-400',
  stars: 'flex gap-1',
  modalOverlay: 'fixed inset-0 z-[1000] flex items-end justify-center bg-black/50 sm:items-center sm:p-5',
  modal: 'max-h-[92vh] w-full max-w-[460px] overflow-y-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_20px_60px_rgba(0,0,0,0.2)] dark:bg-noche-card sm:max-h-[90vh] sm:rounded-2xl',
  modalHeader: 'sticky top-0 z-[1] flex items-center justify-between gap-3 bg-zippy px-5 py-4 [&>h3]:m-0 [&>h3]:truncate [&>h3]:text-base [&>h3]:font-bold [&>h3]:text-white',
  modalClose: 'flex h-[26px] w-[26px] shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-white/20 text-[13px] text-white hover:bg-white/30',
  trackStatus: 'mx-4 my-3.5 rounded-[10px] bg-zippy-50 px-3.5 py-3 text-[13px] leading-normal text-slate-600 dark:bg-[#1a2030] dark:text-slate-300 [&_p]:m-0',
  field: 'mb-3.5 flex flex-col gap-[5px] [&>label]:flex [&>label]:items-center [&>label]:gap-1 [&>label]:text-[11px] [&>label]:font-bold [&>label]:uppercase [&>label]:tracking-[0.4px] [&>label]:text-slate-500 [&_input]:rounded-[10px] [&_input]:border-[1.5px] [&_input]:border-solid [&_input]:border-slate-200 [&_input]:bg-[#fafafa] [&_input]:px-3.5 [&_input]:py-[11px] [&_input]:font-[inherit] [&_input]:text-sm [&_input]:outline-none [&_input:focus]:border-zippy [&_input:focus]:bg-white [&_textarea]:resize-y [&_textarea]:rounded-[10px] [&_textarea]:border-[1.5px] [&_textarea]:border-solid [&_textarea]:border-slate-200 [&_textarea]:bg-[#fafafa] [&_textarea]:px-3.5 [&_textarea]:py-[11px] [&_textarea]:font-[inherit] [&_textarea]:text-sm [&_textarea]:outline-none [&_textarea:focus]:border-zippy dark:[&_input]:border-noche-borde dark:[&_input]:bg-noche-alt dark:[&_input]:text-slate-200 dark:[&_textarea]:border-noche-borde dark:[&_textarea]:bg-noche-alt dark:[&_textarea]:text-slate-200',
  fieldAyuda: 'm-0 mt-1 text-[11.5px] text-slate-500',
  btnPrimary: 'mt-1 w-full cursor-pointer rounded-[10px] border-0 bg-zippy px-5 py-3 font-[inherit] text-[13px] font-bold text-white transition-colors hover:enabled:bg-zippy-600 disabled:cursor-not-allowed disabled:opacity-60',
  btnSecondary: 'mt-1 flex-1 cursor-pointer rounded-[10px] border-[1.5px] border-solid border-slate-200 bg-white p-3 font-[inherit] text-[13px] font-semibold text-slate-600 transition-colors hover:border-zippy hover:text-zippy dark:border-noche-borde dark:bg-noche-alt dark:text-slate-400',
  eta: 'mx-4 mt-3.5 flex items-start gap-2.5 rounded-xl border-[1.5px] border-solid border-[#ffd9ad] bg-zippy-50 px-3.5 py-3 text-[#9a4a00] dark:border-zippy/30 dark:bg-zippy/10 dark:text-orange-300',
  etaMin: 'm-0 text-[15px] font-extrabold text-orange-700 dark:text-orange-300',
  etaSub: 'm-0 mt-0.5 text-xs leading-snug',
  trackMap: 'px-4 pt-4',
  trackMapMsg: 'flex h-[220px] items-center justify-center rounded-xl bg-slate-50 text-[13px] text-slate-400 dark:bg-noche',
  trackCallBtn: 'mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-[13px] font-bold text-white no-underline',
  trackSteps: 'px-4 pb-[18px]',
  trackStep: 'flex gap-3 py-2',
  trackStepDot: 'mt-[5px] h-[9px] w-[9px] shrink-0 rounded-full bg-zippy',
  trackStepLabel: 'm-0 text-[13px] font-semibold text-slate-800 dark:text-slate-100',
  trackStepFecha: 'm-0 text-[11px] text-slate-400',
  savedGrid: 'grid grid-cols-2 gap-3 md:grid-cols-3',
  savedCard: 'overflow-hidden rounded-[14px] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.07)] dark:bg-noche-card',
  savedPhoto: 'relative flex h-[100px] items-center justify-center overflow-hidden bg-slate-100 text-slate-400 dark:bg-noche-alt [&>img]:block [&>img]:h-full [&>img]:w-full [&>img]:object-cover',
  savedRemove: 'absolute right-[7px] top-[7px] flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-0 bg-white/90 text-[11px] text-red-500 hover:bg-red-50',
  savedInfo: 'px-3 pb-3 pt-2.5',
  savedName: 'm-0 mb-0.5 text-xs font-bold leading-[1.3] text-slate-800 dark:text-slate-100',
  savedTienda: 'm-0 mb-1 text-[10px] text-slate-400',
  savedPrice: 'm-0 mb-2 text-[15px] font-black text-zippy',
  savedAdd: 'w-full cursor-pointer rounded-lg border-0 bg-zippy p-2 font-[inherit] text-[11px] font-bold text-white hover:bg-zippy-600',
  addrTop: 'mb-2 flex items-center justify-between gap-2',
  addrLabel: 'text-sm font-bold text-slate-800 dark:text-slate-100',
  addrChip: 'ml-2 rounded-[10px] bg-[#fff3e6] px-2 py-0.5 text-[10px] font-bold text-zippy dark:bg-zippy/15',
  addrActions: 'flex shrink-0 gap-1.5',
  addrDir: 'm-0 mb-[3px] flex items-start gap-1 text-[13px] text-slate-700 dark:text-slate-300',
  addrCiudad: 'm-0 flex items-center gap-1 text-xs text-slate-400',
  addrForm: 'flex flex-col gap-2.5 [&>input]:rounded-[10px] [&>input]:border-[1.5px] [&>input]:border-solid [&>input]:border-slate-200 [&>input]:px-3.5 [&>input]:py-[11px] [&>input]:font-[inherit] [&>input]:text-sm [&>input]:outline-none [&>input:focus]:border-zippy dark:[&>input]:border-noche-borde dark:[&>input]:bg-noche-alt dark:[&>input]:text-slate-200',
  addrFormRow: 'flex gap-2.5',
  addDirBtn: 'cursor-pointer rounded-[14px] border-2 border-dashed border-slate-200 bg-white p-3.5 font-[inherit] text-sm font-semibold text-zippy transition-colors hover:border-zippy hover:bg-zippy-50 dark:border-noche-borde dark:bg-noche-alt dark:hover:bg-[#1a2030]',
  cuentaCard: 'rounded-[14px] bg-white px-4 py-[18px] shadow-[0_1px_4px_rgba(0,0,0,0.07)] dark:bg-noche-card',
  cuentaSection: 'm-0 mb-3.5 border-0 border-b border-solid border-[#f0f0f0] pb-2.5 text-xs font-bold uppercase tracking-[0.5px] text-slate-400 dark:border-noche-borde',
  notifRow: 'flex items-center justify-between gap-3 border-0 border-b border-solid border-[#f5f5f5] py-3 last:border-b-0 dark:border-noche-borde',
  notifLabel: 'm-0 mb-0.5 text-[13px] font-semibold text-slate-800 dark:text-slate-100',
  notifDesc: 'm-0 text-[11px] text-slate-400',
  logoutBtn: 'flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-[14px] border-[1.5px] border-solid border-red-200 bg-red-50 p-3.5 font-[inherit] text-sm font-bold text-red-500 transition-colors hover:border-red-500 hover:bg-red-100 dark:border-[#5a2020] dark:bg-[#3a1a1a] dark:text-red-400 dark:hover:border-red-400 dark:hover:bg-[#5a2020]',
  sinSesion: 'flex flex-col items-center gap-3 px-7 pb-10 pt-14 text-center',
  sinSesionIcono: 'mb-1 flex h-[84px] w-[84px] items-center justify-center rounded-full bg-orange-100 text-zippy dark:bg-noche-card',
  sinSesionTitulo: 'm-0 text-[21px] font-extrabold text-slate-800 dark:text-slate-100',
  sinSesionTexto: 'm-0 max-w-[300px] text-sm leading-[1.55] text-gray-500 dark:text-slate-400',
  sinSesionBtn: 'mt-2 cursor-pointer rounded-full border-0 bg-zippy px-[38px] py-3.5 font-[inherit] text-base font-extrabold text-white shadow-[0_6px_16px_rgba(255,122,0,0.3)] active:translate-y-px',
  sinSesionLink: 'cursor-pointer border-0 bg-transparent p-1.5 font-[inherit] text-sm font-bold text-zippy underline',
  pedidosCabecera: 'px-4 pb-1 pt-5 md:px-0',
  pedidosTitulo: 'm-0 text-[22px] font-extrabold text-slate-800 dark:text-slate-100',
  pedidosResumen: 'm-0 mt-1 text-[13px] text-slate-500 dark:text-slate-400',
  content: 'px-3 pb-2 pt-3 xs:px-4 md:px-0',
  profile: 'relative mx-3 mb-4 mt-3 overflow-hidden rounded-[18px] bg-[linear-gradient(135deg,#FF7A00_0%,#FF9A3C_100%)] px-5 pb-5 pt-[22px] xs:mx-4 md:mx-0',
  profileAvatar: 'relative mb-2.5 flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full border-[3px] border-solid border-white/40 bg-white/25 text-[26px] font-extrabold text-white',
  profileInfo: 'relative mb-1',
  profileName: 'm-0 mb-0.5 break-words text-lg font-extrabold text-white',
  profileEmail: 'm-0 break-all text-xs text-white/75',
  profileActions: 'absolute right-3.5 top-3.5 flex gap-2',
  profileEdit: 'flex cursor-pointer items-center rounded-lg border-0 bg-white/20 px-2.5 py-[7px] text-white transition-colors hover:bg-white/35',
  profileLogout: 'flex cursor-pointer items-center rounded-lg border border-solid border-red-500/40 bg-red-500/25 px-2.5 py-[7px] text-white transition-colors hover:border-red-500/70 hover:bg-red-500/45',
  tabs: 'mx-3 mb-4 flex gap-1 overflow-x-auto rounded-[14px] bg-white p-1.5 shadow-[0_1px_4px_rgba(0,0,0,0.07)] [scrollbar-width:none] dark:bg-noche-card xs:mx-4 md:mx-0',
};

const MAP_STYLE = { width: '100%', height: '220px', borderRadius: '12px' };

const PASO_LABEL = {
  pendiente:          'Recibido',
  confirmada:          'Confirmado',
  en_preparacion:      'En preparación',
  lista_para_retirar:  'Listo para recoger',
  en_domicilio:        'En camino',
  entregada:           'Entregado',
  cancelada:           'Cancelado',
};

const ESTADO_UI = {
  pendiente:          'Pendiente',
  confirmada:         'Confirmado',
  en_preparacion:     'En preparación',
  lista_para_retirar: 'Listo para recoger',
  en_domicilio:       'En camino',
  entregada:          'Entregado',
  cancelada:          'Cancelado',
  rechazada:          'Rechazado',
};

// Pasos que ve el cliente, en orden
const PASOS_PEDIDO = [
  { estado: 'Pendiente',          icon: 'reloj',        titulo: 'Pedido recibido',    detalle: 'Esperando que el negocio lo confirme' },
  { estado: 'Confirmado',         icon: 'check',        titulo: 'Confirmado',         detalle: 'El negocio aceptó tu pedido' },
  { estado: 'En preparación',     icon: 'vendedores',   titulo: 'En preparación',     detalle: 'Están alistando tu pedido' },
  { estado: 'Listo para recoger', icon: 'paquete',      titulo: 'Listo',              detalle: 'Esperando al repartidor' },
  { estado: 'En camino',          icon: 'repartidores', titulo: 'En camino',          detalle: 'Tu pedido va hacia ti' },
  { estado: 'Entregado',          icon: 'check',        titulo: 'Entregado',          detalle: 'Pedido completado' },
];

const indicePaso = (estado) => PASOS_PEDIDO.findIndex(p => p.estado === estado);

// Pasado este rato sin que el negocio conteste, mejor darle al cliente una
// salida que dejarlo mirando una pantalla que no cambia.
const MINUTOS_PARA_SOPORTE = 10;
const fmtFecha = fechaCorta;

/* ── Mock data (todavía no hay backend para esto) ─────────── */

const ESTADO_STYLE = {
  Entregado:            { bg: '#dcfce7', color: '#15803d' },
  'En camino':          { bg: '#fef3c7', color: '#b45309' },
  'Listo para recoger': { bg: '#ffedd5', color: '#c2410c' },
  'En preparación':     { bg: '#e0f2fe', color: '#0369a1' },
  Confirmado:           { bg: '#ede9fe', color: '#6d28d9' },
  Cancelado:            { bg: '#fee2e2', color: '#b91c1c' },
  Rechazado:            { bg: '#fee2e2', color: '#b91c1c' },
  Pendiente:            { bg: '#e0e7ff', color: '#3730a3' },
  'En validación':      { bg: '#fef3c7', color: '#92400e' },
};

const fmt = n => `$${n.toLocaleString('es-CO')}`;

/* ── Tabs ────────────────────────────────────────────────── */
// Pedidos y Ayuda salieron de aqui: ahora tienen boton propio en la barra de
// abajo (ver NAV_ITEMS en UserLayout).
const TABS = [
  { id: 'guardados',   icon: 'corazon',   label: 'Guardados'  },
  { id: 'direcciones', icon: 'ubicacion', label: 'Direcciones'},
  { id: 'cuenta',      icon: 'config',    label: 'Cuenta'     },
];

// "359 minutos" no le dice nada a nadie; "casi 6 horas" si.
const esperaLegible = (min) => {
  if (min < 60) return `${min} minuto${min === 1 ? '' : 's'}`;
  const horas = Math.round(min / 60);
  if (horas < 24) return `${horas} hora${horas === 1 ? '' : 's'}`;
  const dias = Math.round(horas / 24);
  return `${dias} día${dias === 1 ? '' : 's'}`;
};

/* ── Pedidos ─────────────────────────────────────────────── */
// Estados en los que el cliente todavia puede cancelar. Una vez el negocio
// empieza a preparar el pedido ya gasto en el, asi que cancelar ahi le hace
// perder plata: de ese punto en adelante toca por soporte.
const ESTADOS_CANCELABLES = ['Pendiente', 'En validación', 'Confirmado'];

const SeccionPedidos = ({ pedidos, loading, onTrack, onCalificar, onRepetir, repitiendo, onCancelar, cancelando }) => {
  // WhatsApp de soporte, para el primer pedido que esta en validacion
  const [wa, setWa] = useState('');
  useEffect(() => {
    soporteService.obtener().then(({ data }) => setWa(data?.whatsapp || '')).catch(() => {});
  }, []);

  if (loading) return <ZLoader size="sm" label="Cargando pedidos..." />;
  if (pedidos.length === 0) return (
    <div className={C.empty}>
      <span><Icon name="paquete" size={40} strokeWidth={1.2} /></span>
      <p>Todavía no has hecho ningún pedido</p>
    </div>
  );

  return (
    <div className={C.list}>
      {pedidos.map(p => {
        const st = ESTADO_STYLE[p.estado] || ESTADO_STYLE.Pendiente;
        return (
          <div key={p.id} className={C.orderCard}>
            <div className={C.orderTop}>
              <span className={C.orderId}>{p.id}</span>
              <span className={C.orderBadge} style={{ background: st.bg, color: st.color }}>
                {p.estado}
              </span>
            </div>
            <p className={C.orderTienda}><Icon name={p.esEspecial ? 'rayo' : 'vendedores'} size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />{p.tienda}</p>
            <p className={C.orderItems}>{p.items}</p>
            <div className={C.orderBottom}>
              <span className={C.orderFecha}>{p.fecha}</span>
              {p.total != null && <span className={C.orderTotal}>{fmt(p.total)}</span>}
            </div>
            {p.estado === 'En validación' && (
              <div className={C.avisoEspera}>
                <b>Estamos validando tu pedido.</b> Es tu primer pedido en ZIPPYGO: soporte te va a escribir por WhatsApp o llamar en unos minutos para confirmarlo. Apenas lo confirmemos, el negocio empieza a prepararlo.
                {wa && (
                  <a
                    href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hola, hice mi primer pedido ${p.id} en ZIPPYGO y quiero confirmarlo.`)}`}
                    target="_blank" rel="noopener noreferrer"
                    className={C.avisoLink}
                  ><Icon name="whatsapp" size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />Escribir a soporte</a>
                )}
              </div>
            )}
            {p.estado === 'Pendiente' && minutosDesde(p.fechaRaw) >= MINUTOS_PARA_SOPORTE && (
              <div className={C.avisoEspera}>
                <b>El negocio todavía no ha confirmado tu pedido.</b> Lleva {esperaLegible(minutosDesde(p.fechaRaw))} esperando. Puedes cancelarlo aquí mismo o escribirnos y lo movemos nosotros.
                {wa && (
                  <a
                    href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hola, mi pedido ${p.id} en ZIPPYGO lleva ${esperaLegible(minutosDesde(p.fechaRaw))} sin confirmar.`)}`}
                    target="_blank" rel="noopener noreferrer"
                    className={C.avisoLink}
                  ><Icon name="whatsapp" size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />Escribir a soporte</a>
                )}
              </div>
            )}
            {/* El seguimiento con mapa es de los pedidos a negocios. Un mandado
                no tiene tienda de donde salir, y abrir ese modal con el id de un
                mandado no traia nada: salia un mapa vacio. */}
            {!p.esEspecial && !['Entregado', 'Cancelado', 'Rechazado'].includes(p.estado) && (
              <button className={cx(C.trackBtn, C.trackBtnNaranja)} onClick={() => onTrack(p)}>
                <Icon name="repartidores" size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />Ver seguimiento
              </button>
            )}
            {/* El chat del mandado vive en la burbuja flotante, que sale en
                toda la app del cliente (ver UserLayout). Poner otro boton aqui
                abriria una segunda burbuja encima de la misma conversacion. */}
            {p.esEspecial && p.tieneRepartidor && !['Entregado', 'Cancelado', 'Rechazado'].includes(p.estado) && (
              <p className={C.avisoEspera} style={{ marginTop: 10 }}>
                <Icon name="chat" size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />
                Usa la burbuja naranja de la esquina para escribirle al repartidor.
              </p>
            )}
            {/* Cancelar: el Centro de Ayuda lo prometia desde el principio,
                pero no habia boton que lo hiciera. */}
            {ESTADOS_CANCELABLES.includes(p.estado) && (
              <button
                className={cx(C.trackBtn, C.trackBtnRojo)}
                onClick={() => onCancelar(p)}
                disabled={cancelando === p.idCompleto}
              >
                <Icon name="equis" size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />
                {cancelando === p.idCompleto ? 'Cancelando…' : 'Cancelar pedido'}
              </button>
            )}
            {p.estado === 'Entregado' && !p.esEspecial && (
              <button className={cx(C.trackBtn, C.trackBtnNaranja)} onClick={() => onCalificar(p)}>
                <Icon name="estrella" size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />Calificar pedido
              </button>
            )}
            {/* Repetir: la mayoria de la gente pide casi siempre lo mismo.
                Volver a buscar producto por producto era el camino largo. */}
            {['Entregado', 'Cancelado', 'Rechazado'].includes(p.estado) && !p.esEspecial && (
              <button
                className={cx(C.trackBtn, C.trackBtnGris)}
                onClick={() => onRepetir(p)}
                disabled={repitiendo === p.idCompleto}
              >
                <Icon name="repetir" size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />
                {repitiendo === p.idCompleto ? 'Agregando al carrito…' : 'Repetir pedido'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ── Calificar pedido (reseña real, recalcula la calificación de la tienda) ─ */
const StarPicker = ({ value, onChange }) => (
  <div className={C.stars}>
    {[1, 2, 3, 4, 5].map(n => (
      <button
        key={n}
        type="button"
        className={cx('cursor-pointer border-0 bg-transparent p-0 leading-none transition hover:scale-110', n <= value ? 'text-zippy' : 'text-slate-200 dark:text-slate-600')}
        aria-label={`${n} estrella${n > 1 ? 's' : ''}`}
        onClick={() => onChange(n)}
      ><Icon name="estrella" size={20} /></button>
    ))}
  </div>
);

const CalificarModal = ({ pedido, onClose }) => {
  const { addToast } = useToast();
  const [loading, setLoading]     = useState(true);
  const [existente, setExistente] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [form, setForm] = useState({ calificacion_general: 0, calificacion_producto: 0, calificacion_entrega: 0, calificacion_domiciliario: 0, comentario: '' });
  // Nombre del repartidor, para poder calificarlo por su nombre y no como
  // "el domiciliario". Si nadie llevo el pedido, esa parte no aparece.
  const [repartidor, setRepartidor] = useState(null);

  useEffect(() => {
    if (!pedido) return;
    let activo = true;
    setLoading(true);
    setForm({ calificacion_general: 0, calificacion_producto: 0, calificacion_entrega: 0, calificacion_domiciliario: 0, comentario: '' });
    resenasService.obtenerPorOrden(pedido.idCompleto)
      .then(({ data }) => { if (activo) setExistente(data); })
      .catch(() => { if (activo) setExistente(null); })
      .finally(() => { if (activo) setLoading(false); });
    return () => { activo = false; };
  }, [pedido]);

  useEffect(() => {
    if (!pedido) { setRepartidor(null); return; }
    let activo = true;
    setRepartidor(null);
    ordenesService.ubicacionDomiciliario(pedido.idCompleto)
      .then(({ data }) => {
        if (activo && data?.asignado) setRepartidor(data.domiciliario_nombre || 'tu repartidor');
      })
      .catch(() => { if (activo) setRepartidor(null); });
    return () => { activo = false; };
  }, [pedido]);

  if (!pedido) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.calificacion_general) { addToast('Selecciona una calificación general', 'error'); return; }
    setSaving(true);
    try {
      const { data } = await resenasService.crear({
        orden_id: pedido.idCompleto,
        calificacion_general: form.calificacion_general,
        calificacion_producto: form.calificacion_producto || undefined,
        calificacion_entrega: form.calificacion_entrega || undefined,
        calificacion_domiciliario: form.calificacion_domiciliario || undefined,
        comentario: form.comentario || undefined,
      });
      setExistente(data);
      addToast('¡Gracias por tu calificación!', 'success');
    } catch (err) {
      addToast(err.response?.data?.detail || 'No se pudo enviar la calificación', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={C.modalOverlay} onClick={onClose}>
      <div className={C.modal} onClick={e => e.stopPropagation()}>
        <div className={C.modalHeader}>
          <h3>Calificar {pedido.id}</h3>
          <button className={C.modalClose} onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div style={{ padding: 20 }}><ZLoader size="sm" /></div>
        ) : existente ? (
          <div className={C.trackStatus} style={{ margin: 16 }}>
            <p>Ya calificaste este pedido con {existente.calificacion_general} <Icon name="estrella" size={14} style={{ verticalAlign: '-2px' }} /></p>
            {existente.comentario && <p style={{ marginTop: 8 }}>"{existente.comentario}"</p>}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: '4px 20px 20px' }}>
            <div className={C.field}>
              <label>Calificación general *</label>
              <StarPicker value={form.calificacion_general} onChange={v => setForm(p => ({ ...p, calificacion_general: v }))} />
            </div>
            <div className={C.field}>
              <label>Productos</label>
              <StarPicker value={form.calificacion_producto} onChange={v => setForm(p => ({ ...p, calificacion_producto: v }))} />
            </div>
            <div className={C.field}>
              <label>Tiempo de entrega</label>
              <StarPicker value={form.calificacion_entrega} onChange={v => setForm(p => ({ ...p, calificacion_entrega: v }))} />
            </div>
            {repartidor && (
              <div className={C.field}>
                <label>
                  <Icon name="repartidores" size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} />
                  {repartidor}
                </label>
                <StarPicker value={form.calificacion_domiciliario} onChange={v => setForm(p => ({ ...p, calificacion_domiciliario: v }))} />
                <p className={C.fieldAyuda}>Cómo te trató quien te llevó el pedido</p>
              </div>
            )}
            <div className={C.field}>
              <label>Comentario (opcional)</label>
              <textarea
                rows={3}
                value={form.comentario}
                onChange={e => setForm(p => ({ ...p, comentario: e.target.value }))}
                placeholder="¿Cómo fue tu experiencia?"
              />
            </div>
            <button type="submit" className={C.btnPrimary} disabled={saving}>
              {saving ? 'Enviando...' : 'Enviar calificación'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};


/* ── Línea de estado del pedido ──────────────────────────── */
const LineaEstado = ({ estado, tieneRepartidor, nombreRepartidor }) => {
  const actual = estado === 'En validación' ? 0 : indicePaso(estado);
  const cancelado = estado === 'Cancelado' || estado === 'Rechazado';

  const caja = 'mx-4 mb-3.5 rounded-[14px] border-[1.5px] border-solid px-[18px] py-4';

  if (cancelado) {
    return (
      <div className={cx(caja, 'flex items-center gap-3 border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300')}>
        <Icon name="bloqueado" size={20} />
        <div>
          <p className="m-0 text-sm font-bold">Pedido {estado.toLowerCase()}</p>
          <p className="m-0 mt-0.5 text-[12.5px] opacity-85">Este pedido ya no está en curso</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cx(caja, 'border-[#f0f0f0] bg-white dark:border-noche-borde dark:bg-noche-card')}>
      <p className="m-0 mb-3.5 text-[11px] font-extrabold uppercase tracking-[.6px] text-slate-400">Estado de mi pedido</p>

      <ol className="m-0 list-none p-0">
        {PASOS_PEDIDO.map((paso, i) => {
          const hecho  = i < actual;
          const activo = i === actual;
          const ultimo = i === PASOS_PEDIDO.length - 1;

          return (
            <li key={paso.estado} className={cx('relative flex items-start gap-3', !ultimo && 'pb-4')}>
              {/* linea vertical que une un paso con el siguiente */}
              {!ultimo && <span className={cx('absolute bottom-0.5 left-[15px] top-[30px] w-0.5', hecho ? 'bg-green-500' : 'bg-slate-200 dark:bg-noche-borde')} />}
              <span
                className={cx(
                  'z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-solid',
                  hecho ? 'border-green-500 bg-green-100 text-green-700'
                    : activo ? 'animate-pulso border-zippy bg-[#fff3e6] text-zippy dark:bg-zippy/15'
                    : 'border-slate-200 bg-slate-100 text-slate-400 dark:border-noche-borde dark:bg-noche-alt'
                )}
              >
                <Icon name={hecho ? 'check' : paso.icon} size={16} />
              </span>
              <div className="pt-[5px]">
                <p className={cx('m-0 text-sm', hecho ? 'font-semibold text-green-700 dark:text-green-400' : activo ? 'font-extrabold text-slate-900 dark:text-slate-100' : 'font-semibold text-slate-500')}>{paso.titulo}</p>
                {activo && <p className="m-0 mt-[3px] text-[12.5px] font-semibold text-zippy">{paso.detalle}</p>}
              </div>
            </li>
          );
        })}
      </ol>

      <div
        className={cx(
          'mt-3.5 flex items-center gap-2 rounded-[10px] border border-solid px-[13px] py-[11px] text-[13px]',
          tieneRepartidor
            ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300'
            : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-noche-borde dark:bg-noche-alt dark:text-slate-400'
        )}
      >
        <Icon name={tieneRepartidor ? 'repartidores' : 'reloj'} size={16} />
        <span>
          {tieneRepartidor
            ? <><strong>{nombreRepartidor || 'Un repartidor'}</strong> ya tiene tu pedido</>
            : 'Todavía ningún repartidor ha tomado tu pedido'}
        </span>
      </div>
    </div>
  );
};

/* ── Tiempo estimado de entrega ───────────────────────────
 *
 * No hay un servicio de rutas detras: esto es una cuenta honesta, no una
 * promesa. Cuando ya se sabe donde va el repartidor se calcula con la
 * distancia en linea recta y una velocidad de moto por las calles de Garzon;
 * mientras el pedido todavia esta en la tienda solo se puede dar un rango por
 * etapa. Por eso siempre se muestra con "aprox" y nunca una hora exacta: es
 * peor prometer 7 minutos y llegar en 25 que decir de entrada "entre 15 y 25".
 */
const VELOCIDAD_MOTO_KMH = 18;   // promedio real en calle de pueblo, con semaforos y huecos
const MINUTOS_ENTREGA_FINAL = 2; // parquear, timbrar y entregar
const FACTOR_CALLES = 1.3;       // nadie viaja en linea recta: hay que dar la vuelta por las manzanas

// Distancia en linea recta entre dos puntos (formula del semiverseno)
const distanciaKm = (a, b) => {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371;
  const rad = g => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

// Rango de minutos por etapa, para cuando todavia no hay repartidor en la calle
const RANGO_POR_ESTADO = {
  'Confirmado':         [30, 45],
  'En preparación':     [25, 35],
  'Listo para recoger': [15, 25],
  'En camino':          [10, 20],
};

const textoDistancia = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

const EstimadoEntrega = ({ estado, driverPos, destino, enCamino }) => {
  const km = enCamino ? distanciaKm(driverPos, destino) : null;

  if (km != null) {
    const kmPorCalle = km * FACTOR_CALLES;
    const minutos = Math.max(3, Math.round((kmPorCalle / VELOCIDAD_MOTO_KMH) * 60) + MINUTOS_ENTREGA_FINAL);
    return (
      <div className={C.eta}>
        <Icon name="reloj" size={18} />
        <div>
          <p className={C.etaMin}>Llega en {minutos} min aprox</p>
          <p className={C.etaSub}>Tu repartidor está a {textoDistancia(km)} de la dirección</p>
        </div>
      </div>
    );
  }

  const rango = RANGO_POR_ESTADO[estado];
  if (!rango) return null;

  return (
    <div className={C.eta}>
      <Icon name="reloj" size={18} />
      <div>
        <p className={C.etaMin}>Entre {rango[0]} y {rango[1]} min aprox</p>
        <p className={C.etaSub}>
          {estado === 'En camino'
            ? 'Tu pedido ya salió. En cuanto veamos al repartidor en el mapa te damos el tiempo exacto.'
            : 'Es un estimado; se ajusta cuando el repartidor salga con tu pedido'}
        </p>
      </div>
    </div>
  );
};

/* ── Seguimiento de pedido (mapa real + estado real) ──────── */
const SeguimientoModal = ({ pedido, onClose }) => {
  const { isLoaded } = useLoadScript({ googleMapsApiKey: MAPS_KEY, libraries: MAPS_LIBRARIES });
  const [driverPos, setDriverPos] = useState(null);
  const [destino, setDestino]     = useState(null);
  const [ubicacion, setUbicacion] = useState(null);
  const [pasos, setPasos]         = useState([]);

  useEffect(() => {
    if (!pedido) return;
    let activo = true;
    const cargarUbicacion = async () => {
      try {
        const { data } = await ordenesService.ubicacionDomiciliario(pedido.idCompleto);
        if (!activo) return;
        setUbicacion(data);
        if (data.lat != null && data.lng != null) setDriverPos({ lat: data.lat, lng: data.lng });
      } catch { /* sin permiso o sin domiciliario aún */ }
    };
    cargarUbicacion();
    const interval = setInterval(cargarUbicacion, 12000);
    return () => { activo = false; clearInterval(interval); };
  }, [pedido]);

  useEffect(() => {
    if (!pedido) return;
    let activo = true;
    ordenesService.seguimiento(pedido.idCompleto)
      .then(({ data }) => { if (activo) setPasos(data); })
      .catch(() => { if (activo) setPasos([]); });
    return () => { activo = false; };
  }, [pedido]);

  useEffect(() => {
    if (pedido?.destino) { setDestino(pedido.destino); return; }
    if (!pedido || !isLoaded || !window.google || !pedido.direccion) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: `${pedido.direccion}, Garzón, Huila, Colombia` }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const loc = results[0].geometry.location;
        setDestino({ lat: loc.lat(), lng: loc.lng() });
      }
    });
  }, [pedido, isLoaded]);

  if (!pedido) return null;

  return (
    <div className={C.modalOverlay} onClick={onClose}>
      <div className={C.modal} onClick={e => e.stopPropagation()}>
        <div className={C.modalHeader}>
          <h3>Seguimiento {pedido.id}</h3>
          <button className={C.modalClose} onClick={onClose}>✕</button>
        </div>

        <div className={C.trackMap}>
          {!MAPS_KEY ? (
            <div className={C.trackMapMsg}>Mapa no disponible</div>
          ) : isLoaded ? (
            <GoogleMap mapContainerStyle={MAP_STYLE} center={driverPos || destino || GARZON} zoom={14}>
              {destino   && <Marker position={destino}   label="Destino" />}
              {driverPos && <Marker position={driverPos} label="Repartidor" />}
            </GoogleMap>
          ) : (
            <div className={C.trackMapMsg}><ZLoader size="sm" label="Cargando mapa..." /></div>
          )}
        </div>

        <EstimadoEntrega
          estado={pedido.estado}
          driverPos={driverPos}
          destino={destino}
          enCamino={pedido.estado === 'En camino' && !!ubicacion?.asignado}
        />

        <LineaEstado
          estado={pedido.estado}
          tieneRepartidor={!!ubicacion?.asignado}
          nombreRepartidor={ubicacion?.domiciliario_nombre}
        />

        <div className={C.trackStatus}>
          {ubicacion?.asignado ? (
            <>
              <p><Icon name="repartidores" size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} /><strong>{ubicacion.domiciliario_nombre || 'Un repartidor'}</strong> va en camino con tu pedido.</p>
              {ubicacion.domiciliario_telefono && (
                <a className={C.trackCallBtn} href={`tel:${ubicacion.domiciliario_telefono}`}>
                  <Icon name="telefono" size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />Llamar al repartidor
                </a>
              )}
            </>
          ) : pedido.estado === 'En camino' ? (
            <p><Icon name="repartidores" size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />Tu pedido va en camino.</p>
          ) : (
            <p><Icon name="paquete" size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />Tu pedido está siendo preparado. Aún no hay un repartidor asignado.</p>
          )}
        </div>

        {ubicacion?.asignado && <OrdenChat ordenId={pedido.idCompleto} />}

        {pasos.length > 0 && (
          <div className={C.trackSteps}>
            {pasos.map(s => (
              <div key={s.id} className={C.trackStep}>
                <span className={C.trackStepDot} />
                <div>
                  <p className={C.trackStepLabel}>{PASO_LABEL[s.estado_nuevo] || s.estado_nuevo}</p>
                  <p className={C.trackStepFecha}>{fechaHoraLarga(s.fecha)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Guardados ───────────────────────────────────────────── */
const SeccionGuardados = ({ addItem, addToast }) => {
  const [guardados, setGuardados] = useState([]);
  const [cargando, setCargando]   = useState(true);

  useEffect(() => {
    clienteService.favoritos()
      .then(({ data }) => setGuardados(data || []))
      .catch(() => setGuardados([]))
      .finally(() => setCargando(false));
  }, []);

  const quitar = async (item) => {
    try {
      await clienteService.quitarFavorito(item.producto_id);
      setGuardados(prev => prev.filter(g => g.id !== item.id));
      addToast('Producto quitado de guardados', 'success');
    } catch {
      addToast('No se pudo quitar el producto', 'error');
    }
  };

  if (cargando) {
    return <div className={C.empty}><p>Cargando tus productos guardados…</p></div>;
  }

  return guardados.length === 0 ? (
    <div className={C.empty}>
      <span><Icon name="corazon" size={40} strokeWidth={1.2} /></span>
      <p>No tienes productos guardados</p>
    </div>
  ) : (
    <div className={C.savedGrid}>
      {guardados.map(p => (
        <div key={p.id} className={C.savedCard}>
          <div className={C.savedPhoto}>
            {p.foto
              ? <img src={urlImagen(p.foto)} alt={p.nombre} loading="lazy" />
              : <span><Icon name="paquete" size={26} strokeWidth={1.4} /></span>}
            <button className={C.savedRemove} onClick={() => quitar(p)}>✕</button>
          </div>
          <div className={C.savedInfo}>
            <p className={C.savedName}>{p.nombre}</p>
            <p className={C.savedTienda}>{p.tienda}</p>
            <p className={C.savedPrice}>{fmt(p.precio)}</p>
            <button
              className={C.savedAdd}
              onClick={() => { addItem({ ...p, negocioId: p.negocioId || p.negocio_id }); addToast(`${p.nombre} agregado`, 'success'); }}
            >
              + Agregar al carrito
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

/* ── Direcciones ─────────────────────────────────────────── */
const SeccionDirecciones = ({ addToast }) => {
  const [dirs, setDirs]         = useState([]);
  const [cargando, setCargando] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ label: '', dir: '', ciudad: 'Garzón', referencia: '' });
  const [ubic, setUbic]         = useState(null);

  useEffect(() => {
    clienteService.direcciones()
      .then(({ data }) => setDirs(data || []))
      .catch(() => setDirs([]))
      .finally(() => setCargando(false));
  }, []);

  const agregar = async (e) => {
    e.preventDefault();
    if (!form.label || !form.dir) return;
    if (!ubic) { addToast('Marca en el mapa dónde queda tu casa', 'error'); return; }
    try {
      const { data } = await clienteService.agregarDireccion({
        etiqueta: form.label,
        direccion: form.dir,
        referencia: form.referencia,
        lat: ubic.lat,
        lng: ubic.lng,
      });
      setDirs(prev => [...prev.map(d => ({ ...d, principal: data.principal ? false : d.principal })), data]);
      setForm({ label: '', dir: '', ciudad: 'Garzón', referencia: '' });
      setUbic(null);
      setShowForm(false);
      addToast('Dirección agregada', 'success');
    } catch {
      addToast('No se pudo guardar la dirección', 'error');
    }
  };

  const setPrincipal = async (id) => {
    try {
      await clienteService.marcarPrincipal(id);
      setDirs(prev => prev.map(d => ({ ...d, principal: d.id === id })));
    } catch {
      addToast('No se pudo cambiar la dirección principal', 'error');
    }
  };

  const eliminar = async (id) => {
    try {
      await clienteService.eliminarDireccion(id);
      setDirs(prev => prev.filter(d => d.id !== id));
      addToast('Dirección eliminada', 'success');
    } catch {
      addToast('No se pudo eliminar la dirección', 'error');
    }
  };

  if (cargando) {
    return <div className={C.empty}><p>Cargando tus direcciones…</p></div>;
  }

  return (
    <div className={C.list}>
      {dirs.length === 0 && !showForm && (
        <div className={C.empty}>
          <span><Icon name="ubicacion" size={40} strokeWidth={1.2} /></span>
          <p>Aún no tienes direcciones guardadas</p>
        </div>
      )}
      {dirs.map(d => (
        <div key={d.id} className={cx('rounded-[14px] border-2 border-solid bg-white px-4 py-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.07)] dark:bg-noche-card', d.principal ? 'border-zippy' : 'border-transparent')}>
          <div className={C.addrTop}>
            <div>
              <span className={C.addrLabel}>{d.etiqueta || d.label}</span>
              {d.principal && <span className={C.addrChip}>Principal</span>}
            </div>
            <div className={C.addrActions}>
              {!d.principal && (
                <button className={cx(C.addrBtn, 'border-slate-200 text-slate-600 hover:border-zippy hover:text-zippy dark:border-noche-borde dark:text-slate-400')} onClick={() => setPrincipal(d.id)}>Usar</button>
              )}
              <button className={cx(C.addrBtn, 'border-red-200 text-red-500 hover:border-red-500 hover:bg-red-50 dark:border-red-500/30')} onClick={() => eliminar(d.id)} aria-label="Eliminar dirección">✕</button>
            </div>
          </div>
          <p className={C.addrDir}><Icon name="ubicacion" size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />{d.dir}</p>
          {d.referencia && <p className={C.addrCiudad}>{d.referencia}</p>}
          <p className={C.addrCiudad}><Icon name={d.lat != null ? 'ubicacion' : 'alerta'} size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />{d.lat != null ? 'Marcada en el mapa' : 'Sin ubicación en el mapa'}</p>
        </div>
      ))}

      {showForm ? (
        <form className={C.addrForm} onSubmit={agregar}>
          <input
            placeholder="Etiqueta (Casa, Trabajo...)"
            value={form.label}
            onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
            required
          />
          <input
            placeholder="Dirección completa"
            value={form.dir}
            onChange={e => setForm(p => ({ ...p, dir: e.target.value }))}
            required
          />
          <input
            placeholder="Referencia (casa azul, frente al parque...)"
            value={form.referencia}
            onChange={e => setForm(p => ({ ...p, referencia: e.target.value }))}
          />
          <SelectorUbicacion direccion={form.dir} valor={ubic} onChange={setUbic} />
          <div className={C.addrFormRow}>
            <button type="submit" className={C.btnPrimary}>Guardar</button>
            <button type="button" className={C.btnSecondary} onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </form>
      ) : (
        <button className={C.addDirBtn} onClick={() => setShowForm(true)}>
          + Agregar dirección
        </button>
      )}
    </div>
  );
};

/* ── Cuenta ──────────────────────────────────────────────── */
const SeccionCuenta = ({ addToast }) => {
  const navigate = useNavigate();
  const { isDark, toggle } = useTheme();
  const stored   = JSON.parse(localStorage.getItem('usuario') || '{}');
  const [form, setForm] = useState({ nombre: stored.nombre || '', telefono: stored.telefono || '' });
  const [notifs, setNotifs] = useState({ pedidos: true, ofertas: true, guardados: false });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await usuariosService.actualizarPerfil({ nombre: form.nombre, telefono: form.telefono });
      localStorage.setItem('usuario', JSON.stringify({ ...stored, nombre: form.nombre, telefono: form.telefono }));
      addToast('Perfil actualizado', 'success');
    } catch (err) {
      addToast(err.response?.data?.detail || 'No se pudo actualizar el perfil', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    if (!window.confirm('¿Seguro que quieres cerrar sesión?')) return;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('usuario');
    navigate('/login');
  };

  return (
    <div className={C.list}>
      <form className={C.cuentaCard} onSubmit={handleSave}>
        <p className={C.cuentaSection}>Información personal</p>
        <div className={C.field}>
          <label>Nombre</label>
          <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Tu nombre" />
        </div>
        <div className={C.field}>
          <label>Teléfono</label>
          <input value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} placeholder="300-000-0000" />
        </div>
        <div className={C.field}>
          <label>Email</label>
          <input type="email" value={stored.email || ''} disabled />
        </div>
        <button type="submit" className={C.btnPrimary} disabled={saving}>
          {saving ? 'Guardando...' : '✓ Guardar cambios'}
        </button>
      </form>

      <div className={C.cuentaCard}>
        <p className={C.cuentaSection}>Notificaciones</p>
        {[
          { id: 'pedidos',   label: 'Estado de mis pedidos', desc: 'Cuando tu orden cambia de estado' },
          { id: 'ofertas',   label: 'Ofertas y promociones', desc: 'Descuentos de tus tiendas favoritas' },
          { id: 'guardados', label: 'Vuelven al stock',      desc: 'Cuando un guardado vuelve a estar disponible' },
        ].map(n => (
          <div key={n.id} className={C.notifRow}>
            <div>
              <p className={C.notifLabel}>{n.label}</p>
              <p className={C.notifDesc}>{n.desc}</p>
            </div>
            <button
              className={cx('relative h-[25px] w-11 shrink-0 cursor-pointer rounded-full border-0 p-0 transition-colors', notifs[n.id] ? 'bg-zippy' : 'bg-slate-200 dark:bg-noche-borde')}
              onClick={() => setNotifs(p => ({ ...p, [n.id]: !p[n.id] }))}
            >
              <span className={cx('pointer-events-none absolute left-[3px] top-[3px] h-[19px] w-[19px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform', notifs[n.id] && 'translate-x-[19px]')} />
            </button>
          </div>
        ))}
      </div>

      <div className={C.cuentaCard}>
        <p className={C.cuentaSection}>Apariencia</p>
        <div className={C.notifRow}>
          <div>
            <p className={C.notifLabel}>Modo oscuro</p>
            <p className={C.notifDesc}>Cambia la apariencia de toda la app</p>
          </div>
          <button
            className={cx('relative h-[25px] w-11 shrink-0 cursor-pointer rounded-full border-0 p-0 transition-colors', isDark ? 'bg-zippy' : 'bg-slate-200 dark:bg-noche-borde')}
            onClick={() => { toggle(); addToast(isDark ? 'Modo claro activado' : 'Modo oscuro activado', 'info'); }}
          >
            <span className={cx('pointer-events-none absolute left-[3px] top-[3px] h-[19px] w-[19px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform', isDark && 'translate-x-[19px]')} />
          </button>
        </div>
      </div>

      <div className={C.cuentaCard}>
        <p className={C.cuentaSection}>Eliminar mi cuenta</p>
        <EliminarCuenta />
      </div>

      <button className={C.logoutBtn} onClick={handleLogout}>
        <Icon name="salir" size={17} style={{ verticalAlign: '-3px', marginRight: 7 }} />Cerrar sesión
      </button>
    </div>
  );
};

/* ── Main page ───────────────────────────────────────────── */
// vista: 'perfil' (Guardados / Direcciones / Cuenta) o 'pedidos'. Son dos
// pantallas de la barra de abajo que comparten este componente porque las dos
// necesitan la lista de pedidos y sus ventanas de seguimiento y calificacion.
const UserPanelPage = ({ vista = 'perfil' }) => {
  const navigate    = useNavigate();
  const { addItem } = useCart();
  const { addToast }= useToast();
  // /tienda/perfil?tab=direcciones abre esa pestaña. Antes el enlace existia
  // pero nadie leia el parametro, y siempre caia en la primera pestaña.
  const [searchParams] = useSearchParams();
  const tabPedida = searchParams.get('tab');
  const [tab, setTab] = useState(TABS.some(t => t.id === tabPedida) ? tabPedida : 'guardados');
  const [repitiendo, setRepitiendo] = useState(null);
  const [cancelando, setCancelando] = useState(null);
  const [porCancelar, setPorCancelar] = useState(null);

  const [pedidos, setPedidos] = useState([]);
  const [loadingPedidos, setLoadingPedidos] = useState(true);
  const [trackingPedido, setTrackingPedido] = useState(null);
  const [calificarPedido, setCalificarPedido] = useState(null);

  const usuario  = JSON.parse(localStorage.getItem('usuario') || '{}');
  // Sin sesion esta pantalla mostraba un perfil inventado ("Usuario",
  // usuario@zippy.com, 0 pedidos) con botones de editar y cerrar sesion que no
  // hacian nada. Parecia que la app se hubiera dañado o que la cuenta se
  // hubiera borrado, cuando lo unico que pasa es que no hay sesion: la tienda
  // se puede ver sin cuenta a proposito (Apple no deja exigir registro para
  // mirar), pero el perfil no existe hasta que alguien entra.
  const haySesion = !!localStorage.getItem('access_token');

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        // Ordenes normales y pedidos especiales en paralelo. Los especiales
        // se guardaban bien (201) pero nunca se consultaban aqui, por eso no
        // aparecian en la pestana de Pedidos.
        const [ordenesRes, especialesRes] = await Promise.all([
          ordenesService.listar(),
          pedidosEspecialesService.misPedidos().catch(() => ({ data: [] })),
        ]);
        const ordenesRaw    = ordenesRes.data;
        const especialesRaw = Array.isArray(especialesRes.data) ? especialesRes.data : (especialesRes.data?.items || []);

        const negocioIds  = [...new Set(ordenesRaw.map(o => o.negocio_id))];
        const productoIds = [...new Set(ordenesRaw.flatMap(o => o.items.map(it => it.producto_id)))];

        const [negociosPairs, productosPairs] = await Promise.all([
          Promise.all(negocioIds.map(id => negociosService.obtener(id).then(({ data }) => [id, data.nombre_negocio]).catch(() => [id, 'Tienda']))),
          Promise.all(productoIds.map(id => productosService.obtener(id).then(({ data }) => [id, data.nombre]).catch(() => [id, 'Producto']))),
        ]);
        const negociosMap  = Object.fromEntries(negociosPairs);
        const productosMap = Object.fromEntries(productosPairs);

        const pedidosReales = ordenesRaw.map(o => ({
          id: `#${o.id.slice(0, 8)}`,
          idCompleto: o.id,
          fecha: fmtFecha(o.fecha_creacion),
          fechaRaw: o.fecha_creacion,
          estado: (o.requiere_validacion && !o.fecha_validacion && o.estado === 'pendiente')
            ? 'En validación' : (ESTADO_UI[o.estado] || 'Pendiente'),
          items: o.items.map(it => `${productosMap[it.producto_id] || 'Producto'} x${it.cantidad}`).join(', '),
          total: Number(o.total),
          tienda: negociosMap[o.negocio_id] || 'Tienda',
          direccion: o.direccion_entrega,
          destino: o.latitud_entrega != null && o.longitud_entrega != null
            ? { lat: Number(o.latitud_entrega), lng: Number(o.longitud_entrega) } : null,
          negocioId: o.negocio_id,
          tieneRepartidor: !!o.domiciliario_id,
          // Se guarda el detalle crudo para poder repetir el pedido despues
          itemsRaw: (o.items || []).map(it => ({ producto_id: it.producto_id, cantidad: it.cantidad })),
        }));

        const especialesUI = especialesRaw.map(e => ({
          id: `#${e.id.slice(0, 8)}`,
          idCompleto: e.id,
          fecha: fmtFecha(e.fecha_creacion),
          fechaRaw: e.fecha_creacion,
          estado: ESTADO_UI[e.estado] || 'Pendiente',
          items: (e.items || []).map(it => `${it.descripcion}${it.cantidad ? ` x${it.cantidad}` : ''}`).join(', ') || 'Mandado',
          // El total de un mandado es el servicio; lo que valga la compra lo
          // sabe el repartidor hasta que llega a la tienda.
          total: e.costo_servicio != null ? Number(e.costo_servicio) : null,
          tienda: 'Mandado',
          direccion: e.direccion,
          esEspecial: true,
          tieneRepartidor: !!e.domiciliario_id,
        }));

        const todos = [...pedidosReales.map(p => ({ ...p, fechaRaw: p.fechaRaw }))]
          .concat(especialesUI)
          .sort((a, b) => (fechaServidor(b.fechaRaw)?.getTime() || 0) - (fechaServidor(a.fechaRaw)?.getTime() || 0));

        if (activo) setPedidos(todos);
      } catch {
        if (activo) setPedidos([]);
      } finally {
        if (activo) setLoadingPedidos(false);
      }
    })();
    return () => { activo = false; };
  }, []);

  /*
   * Cancelar pedido.
   *
   * El servidor es el que manda: si el negocio ya empezo a preparar responde
   * que no se puede, y ese mensaje se le muestra tal cual al cliente en vez de
   * un "error" generico. Al cancelar, el servidor devuelve el inventario y le
   * avisa al vendedor; aqui solo se refleja el cambio en la pantalla.
   */
  const handleCancelar = async () => {
    const pedido = porCancelar;
    if (!pedido) return;
    setPorCancelar(null);
    setCancelando(pedido.idCompleto);
    try {
      if (pedido.esEspecial) {
        await pedidosEspecialesService.cancelar(pedido.idCompleto);
      } else {
        await ordenesService.cancelar(pedido.idCompleto);
      }
      setPedidos(prev => prev.map(p => p.idCompleto === pedido.idCompleto ? { ...p, estado: 'Cancelado' } : p));
      addToast('Tu pedido quedó cancelado', 'success');
    } catch (err) {
      addToast(err.response?.data?.detail || 'No pudimos cancelar el pedido. Escríbenos por soporte.', 'error');
    } finally {
      setCancelando(null);
    }
  };

  /*
   * Repetir pedido.
   *
   * No se copian los precios viejos: se vuelve a consultar cada producto para
   * que el cliente pague lo que vale HOY y no un precio de hace tres semanas.
   * Lo que ya no se vende, o quedo sin existencias, se dice por nombre en vez
   * de dejar el carrito a medias sin explicar nada.
   */
  const handleRepetir = async (pedido) => {
    if (!pedido?.itemsRaw?.length) {
      addToast('Este pedido no tiene productos para repetir', 'error');
      return;
    }
    setRepitiendo(pedido.idCompleto);
    try {
      const negocio = await negociosService.obtener(pedido.negocioId)
        .then(({ data }) => data)
        .catch(() => null);

      const consultados = await Promise.all(
        pedido.itemsRaw.map(it =>
          productosService.obtener(it.producto_id)
            .then(({ data }) => ({ it, prod: data }))
            .catch(() => ({ it, prod: null }))
        )
      );

      const noDisponibles = [];
      let agregados = 0;

      consultados.forEach(({ it, prod }) => {
        const disponible = prod && prod.estado === 'activo' && prod.es_visible !== false && Number(prod.stock) > 0;
        if (!disponible) {
          noDisponibles.push(prod?.nombre || 'un producto');
          return;
        }
        const cantidad = Math.max(1, Math.min(Number(it.cantidad) || 1, Number(prod.stock)));
        const paraCarrito = {
          id: prod.id,
          nombre: prod.nombre,
          descripcion: prod.descripcion,
          precio: Number(prod.precio),
          foto: prod.imagenes?.[0] || null,
          categoria: prod.categoria || 'Otros',
          stock: prod.stock,
          tienda: negocio?.nombre_negocio || pedido.tienda,
          negocioId: prod.negocio_id,
          categoriaNegocio: negocio?.categoria,
          hora_apertura: negocio?.hora_apertura,
          hora_cierre: negocio?.hora_cierre,
          dias_operacion: negocio?.dias_operacion,
        };
        // addItem suma de uno en uno; llamarlo n veces respeta lo que ya
        // hubiera en el carrito en lugar de pisarlo con una cantidad fija.
        for (let i = 0; i < cantidad; i++) addItem(paraCarrito);
        agregados++;
      });

      if (agregados === 0) {
        addToast('Los productos de ese pedido ya no están disponibles', 'error');
        return;
      }
      if (noDisponibles.length) {
        addToast(`Ya no está disponible: ${noDisponibles.join(', ')}. Agregamos el resto al carrito.`, 'error');
      } else {
        addToast('Listo, tu pedido está otra vez en el carrito', 'success');
      }
      navigate('/tienda/carrito');
    } catch {
      addToast('No pudimos repetir el pedido. Intenta de nuevo.', 'error');
    } finally {
      setRepitiendo(null);
    }
  };

  const handleLogout = () => {
    if (!window.confirm('¿Seguro que quieres cerrar sesión?')) return;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('usuario');
    navigate('/login');
  };
  const inicial  = (usuario.nombre || 'U').charAt(0).toUpperCase();

  if (!haySesion) {
    return (
      <UserLayout>
        <div className={C.sinSesion}>
          <div className={C.sinSesionIcono}><Icon name="perfil" size={34} /></div>
          <h2 className={C.sinSesionTitulo}>Entra a tu cuenta</h2>
          <p className={C.sinSesionTexto}>
            {vista === 'pedidos'
              ? 'Aquí vas a ver tus pedidos y por dónde van. Puedes seguir mirando la tienda sin cuenta, pero para pedir necesitas entrar.'
              : 'Aquí aparecen tus direcciones y lo que has guardado. Puedes seguir mirando la tienda sin cuenta, pero para pedir necesitas entrar.'}
          </p>
          <button className={C.sinSesionBtn} onClick={() => navigate('/login')}>
            Iniciar sesión
          </button>
          <button className={C.sinSesionLink} onClick={() => navigate('/register')}>
            No tengo cuenta, quiero crear una
          </button>
        </div>
      </UserLayout>
    );
  }

  const content = {
    guardados:   <SeccionGuardados addItem={addItem} addToast={addToast} />,
    direcciones: <SeccionDirecciones addToast={addToast} />,
    cuenta:      <SeccionCuenta addToast={addToast} />,
  };

  // Ventanas que comparten las dos vistas
  const ventanas = (
    <>
      <SeguimientoModal pedido={trackingPedido} onClose={() => setTrackingPedido(null)} />
      <CalificarModal pedido={calificarPedido} onClose={() => setCalificarPedido(null)} />
      <ConfirmModal
        isOpen={!!porCancelar}
        title="¿Cancelar este pedido?"
        message={porCancelar
          ? `Vamos a cancelar el pedido ${porCancelar.id} de ${porCancelar.tienda}. Si el negocio ya empezó a prepararlo, el servidor no lo va a permitir y te lo decimos.`
          : ''}
        confirmLabel="Sí, cancelar"
        cancelLabel="No, dejarlo"
        danger
        onConfirm={handleCancelar}
        onCancel={() => setPorCancelar(null)}
      />
    </>
  );

  if (vista === 'pedidos') {
    const andando = pedidos.filter(p => !['Entregado', 'Cancelado', 'Rechazado'].includes(p.estado)).length;
    return (
      <UserLayout>
        <div className={C.pedidosCabecera}>
          <h1 className={C.pedidosTitulo}>Mis pedidos</h1>
          {!loadingPedidos && pedidos.length > 0 && (
            <p className={C.pedidosResumen}>
              {andando > 0 ? `${andando} en curso · ` : ''}{pedidos.length} en total
            </p>
          )}
        </div>
        <div className={C.content}>
          <SeccionPedidos pedidos={pedidos} loading={loadingPedidos} onTrack={setTrackingPedido} onCalificar={setCalificarPedido} onRepetir={handleRepetir} repitiendo={repitiendo} onCancelar={setPorCancelar} cancelando={cancelando} />
        </div>
        {ventanas}
      </UserLayout>
    );
  }

  return (
    <UserLayout>
      {/* Profile header */}
      <div className={C.profile}>
        <span className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className={C.profileAvatar}>{inicial}</div>
        <div className={C.profileInfo}>
          <p className={C.profileName}>{usuario.nombre || 'Usuario'}</p>
          <p className={C.profileEmail}>{usuario.email || 'usuario@zippy.com'}</p>
        </div>
        <div className={C.profileActions}>
          <button className={C.profileEdit} onClick={() => setTab('cuenta')} aria-label="Editar perfil"><Icon name="editar" size={17} /></button>
          <button className={C.profileLogout} onClick={handleLogout} title="Cerrar sesión" aria-label="Cerrar sesión"><Icon name="salir" size={17} /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className={C.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={cx(
              'flex min-w-[64px] flex-1 cursor-pointer flex-col items-center gap-[3px] whitespace-nowrap rounded-[10px] border-0 px-2 py-[9px] font-[inherit] text-[11px] font-semibold transition-colors',
              tab === t.id ? 'bg-zippy text-white' : 'bg-transparent text-slate-400 hover:bg-zippy-50 hover:text-zippy dark:hover:bg-noche-alt'
            )}
            onClick={() => setTab(t.id)}
          >
            <span><Icon name={t.icon} size={18} /></span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className={C.content}>
        {content[tab]}
      </div>

      {ventanas}
    </UserLayout>
  );
};

export default UserPanelPage;