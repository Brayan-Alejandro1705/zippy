import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { ordenesService } from '../../config/api';
import '../../styles/UserCheckout.css';

const ENVIO_POR_TIENDA = 3000;
const fmt = n => `$${n.toLocaleString('es-CO')}`;

const UserCheckoutPage = () => {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCart();
  const { addToast } = useToast();

  const [pago, setPago]       = useState('tarjeta');
  const [nota, setNota]       = useState('');
  const [loading, setLoading] = useState(false);

  const tiendas    = [...new Set(items.map(i => i.tienda))];
  const envioTotal = tiendas.length * ENVIO_POR_TIENDA;
  const total      = subtotal + envioTotal;

  if (items.length === 0) {
    navigate('/tienda');
    return null;
  }

  const handleConfirmar = async () => {
    setLoading(true);

    // El backend crea una orden por negocio: agrupamos el carrito por negocioId
    const porNegocio = {};
    items.forEach(item => {
      if (!porNegocio[item.negocioId]) porNegocio[item.negocioId] = [];
      porNegocio[item.negocioId].push(item);
    });

    try {
      await Promise.all(
        Object.entries(porNegocio).map(([negocio_id, itemsNegocio]) =>
          ordenesService.crear({
            negocio_id,
            items: itemsNegocio.map(i => ({ producto_id: i.id, cantidad: i.qty })),
            metodo_pago: pago,
            direccion_entrega: 'Cra 5 #23-45, Apto 402',
            notas_cliente: nota || undefined,
          })
        )
      );
      clearCart();
      addToast('¡Orden confirmada! Recibirás un correo de confirmación.', 'success');
      navigate('/tienda/perfil');
    } catch (err) {
      const msg = err.response?.data?.detail || 'No se pudo confirmar la orden. Intenta de nuevo.';
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ucho-page">
      {/* Orange header */}
      <div className="ucho-header">
        <button className="ucho-back" onClick={() => navigate('/tienda/carrito')}>← Volver</button>
        <div className="ucho-header-center">
          <p className="ucho-header-title">Confirmar Orden</p>
          <p className="ucho-header-sub">Resumen de compra</p>
        </div>
      </div>

      <div className="ucho-card">
        {/* Items summary */}
        <div className="ucho-section">
          {items.map(item => (
            <div key={item.id} className="ucho-item">
              <div>
                <p className="ucho-item-name">{item.nombre}</p>
                <p className="ucho-item-meta">
                  Cantidad: {item.qty} · Precio: {fmt(item.precio)} c/u
                </p>
              </div>
              <span className="ucho-item-total">{fmt(item.precio * item.qty)}</span>
            </div>
          ))}
        </div>

        {/* Delivery address */}
        <div className="ucho-section ucho-section--address">
          <p className="ucho-section-label">Dirección de entrega</p>
          <div className="ucho-address">
            <span className="ucho-address-icon">📍</span>
            <div>
              <p className="ucho-address-text">Cra 5 #23-45, Apto 402</p>
              <button className="ucho-address-change">Cambiar dirección</button>
            </div>
          </div>
        </div>

        {/* Payment method */}
        <div className="ucho-section">
          <p className="ucho-section-label">Método de pago</p>
          <div className="ucho-pay-tabs">
            <button
              className={`ucho-pay-tab ${pago === 'tarjeta' ? 'ucho-pay-tab--active' : ''}`}
              onClick={() => setPago('tarjeta')}
            >
              🏧 Tarjeta
            </button>
            <button
              className={`ucho-pay-tab ${pago === 'efectivo' ? 'ucho-pay-tab--active' : ''}`}
              onClick={() => setPago('efectivo')}
            >
              👤 Efectivo
            </button>
          </div>
        </div>

        {/* Notes */}
        <div className="ucho-section">
          <textarea
            className="ucho-notes"
            rows={3}
            placeholder="Ej: Entrega sin sal, llamar al llegar..."
            value={nota}
            onChange={e => setNota(e.target.value)}
          />
        </div>

        {/* Total */}
        <div className="ucho-total-box">
          <span className="ucho-total-label">Total</span>
          <span className="ucho-total-val">{fmt(total)}</span>
        </div>

        {/* CTA */}
        <button
          className="ucho-btn-confirm"
          onClick={handleConfirmar}
          disabled={loading}
        >
          {loading ? 'Procesando...' : 'Confirmar Orden'}
        </button>
        <p className="ucho-confirm-note">Recibirás confirmación en tu correo</p>
      </div>
    </div>
  );
};

export default UserCheckoutPage;
