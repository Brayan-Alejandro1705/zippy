import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import UserLayout from '../../components/UserLayout';
import '../../styles/UserCart.css';
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

  useEffect(() => {
    domicilioService.obtener()
      .then(({ data }) => {
        if (typeof data?.costo_domicilio === 'number') {
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

  if (items.length === 0) {
    return (
      <UserLayout>
        <div className="uc-empty">
          <div className="uc-empty-icon"><Icon name="carrito" size={44} strokeWidth={1.2} /></div>
          <p className="uc-empty-title">Tu carrito está vacío</p>
          <p className="uc-empty-sub">Agrega productos para comenzar a comprar</p>
          <button className="uc-btn-explore" onClick={() => navigate('/tienda')}>
            Explorar
          </button>
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout>
      <div className="uc-header">
        <button className="uc-back" onClick={() => navigate('/tienda')} aria-label="Volver">← Volver</button>
        <h1 className="uc-title">Mi carrito</h1>
        <span className="uc-header-count">{items.length} producto{items.length === 1 ? '' : 's'}</span>
      </div>

      <div className="uc-layout">
        {/* Items */}
        <div className="uc-items">
          {tiendas.map(tienda => {
            const tiendaItems = items.filter(i => i.tienda === tienda);
            const tiendaSubtotal = tiendaItems.reduce((s, i) => s + i.precio * i.qty, 0);
            const tiendaCerrada = tiendaItems.length > 0 && !estaAbierto(tiendaItems[0]);
            return (
              <div key={tienda} className="uc-store-block">
                <div className="uc-store-header">
                  <span><Icon name="vendedores" size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />{tienda}</span>
                  <span className="uc-store-envio">Envío: {fmt(envioUnitario)}</span>
                </div>

                {tiendaCerrada && (
                  <p className="uc-store-cerrada"><Icon name="reloj" size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} />Producto no disponible: tienda cerrada · {textoCerrado(tiendaItems[0])}</p>
                )}

                {tiendaItems.map(item => (
                  <div key={item.id} className="uc-item">
                    <div className="uc-item-img">
                      {item.foto
                        ? <img src={urlImagen(item.foto)} alt={item.nombre} loading="lazy" />
                        : <Icon name="paquete" size={24} strokeWidth={1.3} />}
                    </div>
                    <div className="uc-item-info">
                      <p className="uc-item-name">{item.nombre}</p>
                      <p className="uc-item-tienda">{item.tienda}</p>
                      <p className="uc-item-price">{fmt(item.precio)}</p>
                    </div>
                    <div className="uc-qty">
                      <button className="uc-qty-btn" onClick={() => updateQty(item.id, item.qty - 1)}>−</button>
                      <span className="uc-qty-num">{item.qty}</span>
                      <button className="uc-qty-btn uc-qty-btn--plus" onClick={() => updateQty(item.id, item.qty + 1)}>+</button>
                    </div>
                    <p className="uc-item-total">{fmt(item.precio * item.qty)}</p>
                    <button className="uc-remove" onClick={() => removeItem(item.id)}>✕</button>
                  </div>
                ))}

                <div className="uc-store-subtotal">
                  Subtotal tienda: <strong>{fmt(tiendaSubtotal)}</strong>
                </div>
              </div>
              );
          })}
        </div>

        {/* Summary panel */}
        <div className="uc-summary">
          <div className="uc-summary-row">
            <span>Subtotal productos:</span>
            <span>{fmt(subtotal)}</span>
          </div>
          <div className="uc-summary-row">
            <span>Envío:</span>
            <span>{fmt(envioTotal)}</span>
          </div>
          <div className="uc-total-row">
            <span>$</span>
            <span className="uc-total-val">{fmt(total).replace('$', '')}</span>
          </div>

          {hayTiendaCerrada && (
            <p className="uc-cerrada-aviso"><Icon name="alerta" size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} />Tienes productos de una tienda cerrada. Quítalos del carrito para continuar.</p>
          )}
          <button className="uc-btn-pago" onClick={() => navigate(hayCuenta() ? '/tienda/checkout' : '/login')} disabled={hayTiendaCerrada}>
            {hayTiendaCerrada ? 'Hay tiendas cerradas' : 'Proceder al Pago'}
          </button>
          <button className="uc-btn-seguir" onClick={() => navigate('/tienda')}>
            Seguir Comprando
          </button>
          <p className="uc-secure"><Icon name="candado" size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />Compra segura y protegida</p>
        </div>
      </div>
    </UserLayout>
  );
};

export default UserCartPage;
