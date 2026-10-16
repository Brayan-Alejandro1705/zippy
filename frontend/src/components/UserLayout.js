import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import Icon from './Icons';
import AccountSwitcher from './AccountSwitcher';
import { registrarPush, alTocarNotificacion } from '../utils/push';
import ChatBurbuja from './ChatBurbuja';
import AvisoSinConexion from './AvisoSinConexion';
import { contenedor, Encabezado, Logo, botonEncabezado, Buscador, contenido, BarraInferior, ItemBarra } from './layout/piezas';
import { pedidosEspecialesService, ordenesService } from '../config/api';

const fmt = n => `$${n.toLocaleString('es-CO')}`;
const hayCuenta = () => !!localStorage.getItem('access_token');

// Pedidos y Ayuda vivian escondidos como pestañas dentro del Perfil: para ver
// por donde iba un pedido habia que entrar a Perfil y luego buscar la pestaña.
// Ahora estan a un toque desde cualquier pantalla. Cinco es el tope que cabe
// comodo en un celular; para meter un sexto habria que sacar alguno.
const NAV_ITEMS = [
  { path: '/tienda',                 icon: 'inicio',        label: 'Inicio'  },
  { path: '/tienda/pedido-especial', icon: 'solicitudes',   label: 'Mandado' },
  { path: '/tienda/pedidos',         icon: 'paquete',       label: 'Pedidos' },
  { path: '/tienda/perfil',          icon: 'perfil',        label: 'Perfil'  },
  { path: '/tienda/ayuda',           icon: 'interrogacion', label: 'Ayuda'   },
];

// Estados en los que un pedido ya termino y no cuenta como "en curso"
const ORDEN_TERMINADA = ['entregada', 'cancelada'];

const UserLayout = ({ children, onSearch }) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { totalItems, subtotal } = useCart();
  const [query, setQuery] = useState('');

  useEffect(() => { registrarPush(); }, []);

  /*
   * Burbuja del chat del mandado, en TODA la app del cliente.
   *
   * Antes solo aparecia dentro de Pedidos, y ahi casi no sirve: el cliente
   * pide el mandado y se va a mirar otra cosa o deja el telefono. La duda la
   * tiene el repartidor desde la tienda, asi que la respuesta tiene que estar
   * a un toque sin importar en que pantalla ande.
   *
   * Solo se consulta si hay sesion, y cada minuto: no es informacion urgente
   * —para eso esta la notificacion— sino para que la burbuja este ahi cuando
   * el cliente vuelva a mirar.
   */
  const [mandadoActivo, setMandadoActivo] = useState(null);
  // Cuantos pedidos y mandados van en curso: es el numero rojo sobre "Pedidos"
  const [enCurso, setEnCurso] = useState(0);

  useEffect(() => {
    if (!hayCuenta()) return;
    let activo = true;

    const revisar = () => {
      Promise.allSettled([
        pedidosEspecialesService.misPedidos(),
        ordenesService.listar({ limit: 50 }),
      ]).then(([resMandados, resOrdenes]) => {
        if (!activo) return;
        let cuenta = 0;

        if (resMandados.status === 'fulfilled') {
          const data = resMandados.value.data;
          const lista = Array.isArray(data) ? data : (data?.items || []);
          // El chat existe desde que un repartidor lo toma y hasta que lo entrega
          const conRepartidor = lista.find(p => p.domiciliario_id && !ORDEN_TERMINADA.includes(p.estado));
          setMandadoActivo(conRepartidor || null);
          cuenta += lista.filter(p => !ORDEN_TERMINADA.includes(p.estado)).length;
        }
        if (resOrdenes.status === 'fulfilled') {
          const lista = Array.isArray(resOrdenes.value.data) ? resOrdenes.value.data : [];
          cuenta += lista.filter(o => !ORDEN_TERMINADA.includes(o.estado)).length;
        }
        // Si fallaron las dos se deja el numero que habia: un bache de señal
        // no debe borrar el aviso de que hay un pedido andando.
        if (resMandados.status === 'fulfilled' || resOrdenes.status === 'fulfilled') setEnCurso(cuenta);
      });
    };

    revisar();
    const t = setInterval(revisar, 60000);
    return () => { activo = false; clearInterval(t); };
  }, []);

  /*
   * Notificacion de mensaje tocada: abre el chat de ese mandado de una.
   *
   * Se guarda el id aparte de `mandadoActivo` porque en arranque en frio (la
   * app estaba cerrada y se abrio tocando el aviso) el toque llega antes que
   * la respuesta del servidor, y porque el chat se pide por id: no hace falta
   * tener el pedido completo para abrirlo.
   */
  const [chatPorAviso, setChatPorAviso] = useState(null);
  const [abrirSenal, setAbrirSenal] = useState(0);

  useEffect(() => alTocarNotificacion((datos) => {
    const tipo = String(datos?.tipo || '');
    const id = String(datos?.relacionado_id || '');
    // "Ya tienes repartidor": lleva a Pedidos, donde se ve quien va y el mapa
    if (tipo === 'repartidor_asignado') { navigate('/tienda/pedidos'); return true; }
    // Mensajes del chat: del mandado (desde antes) y, desde oct 2026, tambien
    // del pedido normal de una tienda
    if (!id || (tipo !== 'mensaje_mandado' && tipo !== 'mensaje_orden')) return false;
    setChatPorAviso({ id, tipo });
    setAbrirSenal(n => n + 1);
    return true;
  }), [navigate]);

  const chatDePedido = chatPorAviso?.tipo === 'mensaje_orden';
  const idChat = chatPorAviso?.id || mandadoActivo?.idCompleto || null;
  // El numero corto del mandado (#PE4829). Si el chat se abrio por una
  // notificacion y el pedido todavia no ha llegado del servidor, no hay numero
  // corto: antes se mostraba el UUID entero de 36 caracteres en el titulo.
  const codigoChat = mandadoActivo && String(mandadoActivo.idCompleto) === String(idChat)
    ? mandadoActivo.id
    : null;

  // La barra flotante de "Ver mi carrito" solo acompaña mientras se mira la
  // tienda. En Pedidos, Perfil y Ayuda quedaba encima del contenido —tapaba el
  // boton de "Ver seguimiento"— y ahi no aporta: el carrito sigue arriba, en
  // el icono del encabezado.
  const enVitrina = location.pathname === '/tienda';
  const activeNav = NAV_ITEMS.find(n => location.pathname === n.path)?.path || '/tienda';


  return (
    <div className={contenedor}>
      <Encabezado>
        <Logo onClick={() => navigate('/tienda')} />

        <Buscador
          placeholder="Buscar productos..."
          value={query}
          onChange={e => { setQuery(e.target.value); onSearch?.(e.target.value); }}
        />

        {hayCuenta() ? (
          <>
            {/* En celular "Perfil" ya esta en la barra de abajo; este boton es para PC */}
            <button className={`${botonEncabezado} hidden md:flex`} onClick={() => navigate('/tienda/perfil')} title="Mi perfil y pedidos" aria-label="Mi perfil">
              <Icon name="perfil" size={20} />
            </button>

            <AccountSwitcher variant="icon" />
          </>
        ) : (
          <button
            className={`${botonEncabezado} w-auto whitespace-nowrap px-3 text-[13px] font-extrabold`}
            onClick={() => navigate('/login')}
            title="Iniciar sesión"
          >Entrar</button>
        )}

        <button className={botonEncabezado} onClick={() => navigate('/tienda/carrito')} aria-label="Carrito">
          <Icon name="carrito" size={20} />
          {totalItems > 0 && (
            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-solid border-zippy bg-red-500 px-1 text-[10px] font-extrabold text-white">
              {totalItems}
            </span>
          )}
        </button>
      </Encabezado>

      <AvisoSinConexion />

      <main
        className={`${contenido} md:px-8 md:pb-12 md:pt-6`}
        style={{ paddingBottom: `calc(${totalItems > 0 && enVitrina ? 140 : 80}px + env(safe-area-inset-bottom, 0px))` }}
      >
        {children}
      </main>

      {/* Barra flotante del carrito */}
      {totalItems > 0 && enVitrina && (
        <button
          className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-1/2 z-[200] flex w-[calc(100%-24px)] max-w-[560px] -translate-x-1/2 cursor-pointer items-center justify-between gap-3 rounded-2xl border-0 bg-slate-800 px-4 py-[13px] text-white shadow-[0_8px_28px_rgba(0,0,0,0.28)] transition-transform hover:-translate-y-0.5 dark:bg-noche md:bottom-6 md:max-w-[420px] xs:px-[18px]"
          onClick={() => navigate('/tienda/carrito')}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-zippy px-2 text-[13px] font-extrabold">{totalItems}</span>
            <span className="truncate text-[15px] font-bold">Ver mi carrito</span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-base font-extrabold text-zippy">{fmt(subtotal)}</span>
            <span className="text-lg text-white/50">→</span>
          </span>
        </button>
      )}

      <BarraInferior>
        {NAV_ITEMS.map(item => (
          <ItemBarra
            key={item.path}
            activo={activeNav === item.path}
            icono={item.icon}
            etiqueta={item.label}
            aviso={item.path === '/tienda/pedidos' ? enCurso : 0}
            onClick={() => navigate(item.path)}
          />
        ))}
      </BarraInferior>

      {idChat && (
        <ChatBurbuja
          id={idChat}
          servicio={chatDePedido ? ordenesService : pedidosEspecialesService}
          titulo={chatDePedido ? `Pedido #${String(idChat).slice(0, 8)}` : (codigoChat ? `Mandado ${codigoChat}` : 'Mandado')}
          arrancaAbierto={false}
          abrirSenal={abrirSenal}
          onCerrar={() => { setChatPorAviso(null); setMandadoActivo(null); }}
        />
      )}
    </div>
  );
};

export default UserLayout;