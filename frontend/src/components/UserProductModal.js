import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import '../styles/UserProductModal.css';

const Stars = ({ n, size = 14 }) => (
  <span style={{ fontSize: size, letterSpacing: 1 }}>
    {[1, 2, 3, 4, 5].map(i => (
      <span key={i} style={{ color: i <= n ? '#fbbf24' : '#e2e8f0' }}>★</span>
    ))}
  </span>
);

const fmt = n => `$${n.toLocaleString('es-CO')}`;

const UserProductModal = ({ producto, grad, emoji, onClose }) => {
  const { addItem } = useCart();
  const { addToast } = useToast();
  const [qty, setQty] = useState(1);

  if (!producto) return null;

  const handleAdd = () => {
    for (let i = 0; i < qty; i++) addItem(producto);
    addToast(`${producto.nombre} agregado al carrito`, 'success');
    onClose();
  };

  return (
    <div className="upm-overlay" onClick={onClose}>
      <div className="upm-sheet" onClick={e => e.stopPropagation()}>

        {/* Handle + close */}
        <div className="upm-handle-wrap">
          <div className="upm-handle" />
          <button className="upm-close" onClick={onClose}>✕</button>
        </div>

        {/* Photo */}
        <div className="upm-photo" style={{ background: grad }}>
          <span className="upm-emoji">{emoji}</span>
          {producto.nuevo && <span className="upm-badge-new">NUEVO</span>}
        </div>

        {/* Scrollable body */}
        <div className="upm-body">
          <div className="upm-meta">
            <span className="upm-cat">{producto.categoria}</span>
            {producto.rating > 0 ? (
              <>
                <Stars n={Math.round(producto.rating)} />
                <span className="upm-review-count">{producto.rating.toFixed(1)}</span>
              </>
            ) : (
              <span className="upm-review-count">Sin calificaciones aún</span>
            )}
          </div>

          <h2 className="upm-name">{producto.nombre}</h2>
          <p className="upm-tienda">🏪 {producto.tienda}</p>

          {producto.stock <= 10 && (
            <p className="upm-stock-warn">⚠️ ¡Solo quedan {producto.stock} unidades!</p>
          )}

          <p className="upm-desc">{producto.descripcion || 'Este producto todavía no tiene descripción.'}</p>
        </div>

        {/* Sticky footer */}
        <div className="upm-footer">
          <p className="upm-footer-price">{fmt(producto.precio)}</p>
          <div className="upm-qty">
            <button onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
            <span>{qty}</span>
            <button onClick={() => setQty(q => q + 1)}>+</button>
          </div>
          <button className="upm-add-btn" onClick={handleAdd}>
            Agregar · {fmt(producto.precio * qty)}
          </button>
        </div>

      </div>
    </div>
  );
};

export default UserProductModal;
