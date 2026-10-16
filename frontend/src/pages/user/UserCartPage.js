import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import UserLayout from '../../components/UserLayout';
import { cx, tarjeta } from '../../ui/tw';
import { ENVIO_POR_TIENDA } from '../../constants/envio';
import { domicilioService } from '../../config/api';
import { estaAbierto, textoCerrado } from '../../utils/horario';
import { urlImagen } from '../../utils/media';
import Icon from '../../components/Icons';

const fmt = n => `$${n.toLocaleString('es-CO')}`;
const hayCuenta = () => !!localStorage.getItem('access_token');

const UserCartPage = () => {
  const navigate = useNavigate();
  const { items, removeItem, updateQty, subtotal } = useCart();

  // El costo lo decide el servidor: el administrador puede cambiarlo desde el
  // panel sin que haya que reconstruir la app. El valor del archivo queda
  // como respaldo mientras carga o si la red falla.
  const [envioUnitario, setEnvioUnitario] = useState(ENVIO_POR_TIENDA);
  // Con domicilio por zonas el carrito todavia no sabe a donde va el pedido:
  // muestra "desde" (la zona mas barata) y el precio exacto sale al confirmar.
  const [porZonas, setPorZonas] = useState(false);

  useEffect(() => {
    domicilioService.obtener()
      .then(({ data }) => {
        if (data?.por_zonas && typeof data?.desde === 'number') {
          setPorZonas(true);
          setEnvioUnitario(data.desde);
        } else if (typeof data?.costo_domicilio === 'number') {
          setEnvioUnitario(data.costo_domicilio);
        }
      })
      .catch(() => {});
  }, []);

  const tiendas = [...new Set(items.map(i => i.tienda))];
  const numTiendas = tiendas.length;
  const envioTotal = numTiendas * envioUnitario;
  const total = subtotal + envioTotal;
  const hayTiendaCerrada = items.some(i => !estaAbierto(i));

  const botonPrincipal = 'w-full cursor-pointer rounded-[10px] border-0 bg-zippy p-3.5 text-[15px] font-extrabold text-white transition-colors hover:bg-zippy-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500';
  const avisoRojo = 'm-0 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:bg-red-500/10 dark:text-red-300';

  if (items.length === 0) {
    return (
      <UserLayout>
        <div className={cx(tarjeta, 'mx-3 mt-5 flex flex-col items-center justify-center px-4 py-[60px] text-center md:mx-0 md:px-5 md:py-20')}>
          <div className="mb-4 text-slate-400 opacity-60"><Icon name="carrito" size={44} strokeWidth={1.2} /></div>
          <p className="m-0 mb-1.5 text-lg font-bold text-slate-800 dark:text-slate-100">Tu carrito está vacío</p>
          <p className="m-0 mb-6 text-[13px] text-slate-400">Agrega productos para comenzar a comprar</p>
          <button className={cx(botonPrincipal, 'w-auto px-8 py-3 text-sm font-bold')} onClick={() => navigate('/tienda')}>
            Explorar
          </button>
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout>
      {/* Franja naranja pegada al encabezado */}
      <div className="mb-3.5 flex items-center justify-between gap-3 bg-zippy px-4 py-3 md:mb-4 md:rounded-xl md:px-5 md:py-3.5">
        <button className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold text-white hover:underline" onClick={() => navigate('/tienda')} aria-label="Volver">← Volver</button>
        <h1 className="m-0 text-base font-extrabold text-white md:text-lg">Mi carrito</h1>
        <span className="text-xs font-semibold text-white/85">{items.length} producto{items.length === 1 ? '' : 's'}</span>
      </div>

      <div className="flex flex-col items-stretch gap-3 px-3 md:flex-row md:items-start md:gap-5 md:px-0">
        {/* Productos, agrupados por tienda */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {tiendas.map(tienda => {
            const tiendaItems = items.filter(i => i.tienda === tienda);
            const tiendaSubtotal = tiendaItems.reduce((s, i) => s + i.precio * i.qty, 0);
            const tiendaCerrada = tiendaItems.length > 0 && !estaAbierto(tiendaItems[0]);
            return (
              <div key={tienda} className={cx(tarjeta, 'overflow-hidden rounded-xl')}>
                <div className="flex items-center justify-between gap-3 bg-[#4c1d95] px-3.5 py-2.5 text-[13px] font-bold text-white md:px-4 md:py-[11px] md:text-sm">
                  <span className="flex min-w-0 items-center gap-1.5"><Icon name="vendedores" size={15} /><span className="truncate">{tienda}</span></span>
                  <span className="shrink-0 text-xs font-medium opacity-85">Envío: {porZonas ? 'desde ' : ''}{fmt(envioUnitario)}</span>
                </div>

                {tiendaCerrada && (
                  <p className={cx(avisoRojo, 'm-3 mb-1.5 flex items-center gap-1.5')}><Icon name="reloj" size={14} />Producto no disponible: tienda cerrada · {textoCerrado(tiendaItems[0])}</p>
                )}

                {tiendaItems.map(item => (
                  // En celular: foto + nombre arriba; cantidad, total y quitar en una segunda fila
                  <div key={item.id} className="flex flex-wrap items-center gap-2 gap-y-2.5 border-0 border-b border-solid border-slate-100 p-3 last:border-b-0 dark:border-noche-borde sm:flex-nowrap sm:gap-3 sm:px-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-slate-100 text-slate-400 dark:bg-noche-alt dark:text-slate-500 sm:h-14 sm:w-14">
                      {item.foto
                        ? <img src={urlImagen(item.foto)} alt={item.nombre} loading="lazy" className="block h-full w-full object-cover" />
                        : <Icon name="paquete" size={24} strokeWidth={1.3} />}
                    </div>
                    <div className="min-w-0 flex-1 basis-[calc(100%-64px)] sm:basis-auto">
                      <p className="m-0 mb-0.5 text-[13px] font-bold text-slate-800 dark:text-slate-100 sm:text-sm">{item.nombre}</p>
                      <p className="m-0 mb-1 text-[11px] text-slate-400">{item.tienda}</p>
                      <p className="m-0 text-[13px] font-bold text-zippy">{fmt(item.precio)}</p>
                    </div>
                    <div className="ml-14 flex items-center gap-1.5 sm:ml-0">
                      <button className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-md border-0 bg-[#f0f0f0] text-[15px] font-bold hover:bg-[#e0e0e0] dark:bg-noche-alt dark:text-slate-200 dark:hover:bg-noche-borde" onClick={() => updateQty(item.id, item.qty - 1)} aria-label="Quitar uno">−</button>
                      <span className="min-w-[20px] text-center text-[13px] font-bold text-slate-800 dark:text-slate-100">{item.qty}</span>
                      <button className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-md border-0 bg-zippy text-[15px] font-bold text-white hover:bg-zippy-600" onClick={() => updateQty(item.id, item.qty + 1)} aria-label="Agregar uno">+</button>
                    </div>
                    <p className="m-0 ml-auto min-w-[56px] shrink-0 text-right text-[13px] font-extrabold text-slate-800 dark:text-slate-100 sm:ml-0 sm:min-w-[68px] sm:text-sm">{fmt(item.precio * item.qty)}</p>
                    <button className="cursor-pointer border-0 bg-transparent p-1 text-base leading-none text-red-500 hover:text-red-600" onClick={() => removeItem(item.id)} aria-label="Quitar del carrito">✕</button>
                  </div>
                ))}

                <div className="bg-green-50 px-4 py-2.5 text-right text-[13px] text-slate-600 dark:bg-[#142a1f] dark:text-slate-400">
                  Subtotal tienda: <strong className="text-sm text-emerald-500">{fmt(tiendaSubtotal)}</strong>
                </div>
              </div>
            );
          })}
        </div>

        {/* Resumen: abajo en celular, a la derecha (y fijo al bajar) en PC */}
        <div className={cx(tarjeta, 'rounded-xl p-4 md:sticky md:top-[72px] md:w-[260px] md:shrink-0 md:p-5')}>
          <div className="mb-2 flex justify-between text-[13px] text-slate-600 dark:text-slate-400">
            <span>Subtotal productos:</span><span>{fmt(subtotal)}</span>
          </div>
          <div className="mb-2 flex justify-between text-[13px] text-slate-600 dark:text-slate-400">
            <span>Envío:</span><span>{porZonas ? 'desde ' : ''}{fmt(envioTotal)}</span>
          </div>
          {porZonas && (
            <p className="m-0 mb-2 text-[11.5px] leading-snug text-slate-400">El domicilio depende de qué tan lejos queda tu dirección. Lo ves exacto al confirmar.</p>
          )}
          <div className="mb-4 mt-3.5 flex items-baseline justify-end gap-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <span>$</span>
            <span className="text-[22px] font-black text-zippy md:text-[26px]">{fmt(total).replace('$', '')}</span>
          </div>

          {hayTiendaCerrada && (
            <p className={cx(avisoRojo, 'mb-2 flex items-center justify-center gap-1.5 text-center')}><Icon name="alerta" size={14} />Tienes productos de una tienda cerrada. Quítalos del carrito para continuar.</p>
          )}
          <button className={cx(botonPrincipal, 'mb-2.5')} onClick={() => navigate(hayCuenta() ? '/tienda/checkout' : '/login')} disabled={hayTiendaCerrada}>
            {hayTiendaCerrada ? 'Hay tiendas cerradas' : 'Proceder al Pago'}
          </button>
          <button className="mb-3 w-full cursor-pointer rounded-[10px] border-[1.5px] border-solid border-slate-200 bg-white p-[11px] text-[13px] font-semibold text-slate-600 transition-colors hover:border-zippy hover:text-zippy dark:border-noche-borde dark:bg-noche-alt dark:text-slate-400" onClick={() => navigate('/tienda')}>
            Seguir Comprando
          </button>
          <p className="m-0 flex items-center justify-center gap-1.5 text-[11px] text-slate-400"><Icon name="candado" size={13} />Compra segura y protegida</p>
        </div>
      </div>
    </UserLayout>
  );
};

export default UserCartPage;
