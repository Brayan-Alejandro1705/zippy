import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import UserLayout from '../../components/UserLayout';
import '../../styles/UserCart.css';

const ENVIO_POR_TIENDA = 3000;
const fmt = n => `$${n.toLocaleString('es-CO')}`;

const UserCartPage = () => {
  const navigate = useNavigate();
  const { items, removeItem, updateQty, subtotal } = useCart();
  const [cupon, setCupon] = useState('');
  const [descuento, setDescuento] = useState(0);
  const [cuponMsg, setCuponMsg] = useState('');

  const tiendas = [...new Set(items.map(i => i.tienda))];
  const numTiendas = tiendas.length;
  const envioTotal = numTiendas * ENVIO_POR_TIENDA;
  const total = subtotal + envioTotal - descuento;

  const aplicarCupon = () => {
    if (cupon.trim().toUpperCase() === 'SAVE10') {
      const desc = Math.round(subtotal * 0.1);
      setDescuento(desc);
      setCuponMsg(`¡Cupón aplicado! -${fmt(desc)}`);
    } else {
      setDescuento(0);
      setCuponMsg('Cupón inválido');
    }
  };

  if (items.length === 0) {
    return (
      <UserLayout>
        <div className="uc-empty">
          <div className="uc-empty-icon">🛒</div>
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
        <button className="uc-back" onClick={() => navigate('/tienda')}>← Volver</button>
        <h1 className="uc-title">🛒 Mi Carrito</h1>
        <button className="uc-back" onClick={() => navigate('/tienda')}>← Volver</button>
      </div>

      <div className="uc-layout">
        {/* Items */}
        <div className="uc-items">
          {tiendas.map(tienda => {
            const tiendaItems = items.filter(i => i.tienda === tienda);
            const tiendaSubtotal = tiendaItems.reduce((s, i) => s + i.precio * i.qty, 0);
            return (
              <div key={tienda} className="uc-store-block">
                <div className="uc-store-header">
                  <span>🏪 {tienda}</span>
                  <span className="uc-store-envio">Envío: {fmt(ENVIO_POR_TIENDA)}</span>
                </div>

                {tiendaItems.map(item => (
                  <div key={item.id} className="uc-item">
                    <div className="uc-item-img">Imagen</div>
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
          {descuento > 0 && (
            <div className="uc-summary-row uc-summary-row--desc">
              <span>Descuento:</span>
              <span>−{fmt(descuento)}</span>
            </div>
          )}

          <div className="uc-cupon-row">
            <input
              className="uc-cupon-input"
              placeholder="Código (ej: SAVE10)"
              value={cupon}
              onChange={e => setCupon(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && aplicarCupon()}
            />
            <button className="uc-cupon-btn" onClick={aplicarCupon}>Aplicar</button>
          </div>
          {cuponMsg && (
            <p className={`uc-cupon-msg ${descuento > 0 ? 'uc-cupon-msg--ok' : 'uc-cupon-msg--err'}`}>
              {cuponMsg}
            </p>
          )}

          <div className="uc-total-row">
            <span>$</span>
            <span className="uc-total-val">{fmt(total).replace('$', '')}</span>
          </div>

          <button className="uc-btn-pago" onClick={() => navigate('/tienda/checkout')}>
            Proceder al Pago
          </button>
          <button className="uc-btn-seguir" onClick={() => navigate('/tienda')}>
            Seguir Comprando
          </button>
          <p className="uc-secure">🔒 Compra segura y protegida</p>
        </div>
      </div>
    </UserLayout>
  );
};

export default UserCartPage;
