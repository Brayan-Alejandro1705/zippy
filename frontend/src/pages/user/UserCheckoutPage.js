import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { ordenesService, clienteService } from '../../config/api';
import '../../styles/UserCheckout.css';

const ENVIO_POR_TIENDA = 3000;
const fmt = n => `$${Number(n || 0).toLocaleString('es-CO')}`;

const UserCheckoutPage = () => {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCart();
  const { addToast } = useToast();

  const [pago, setPago]       = useState('tarjeta');
  const [nota, setNota]       = useState('');
  const [loading, setLoading] = useState(false);

  // La direccion venia escrita a mano en el codigo ('Cra 5 #23-45, Apto 402'),
  // asi que TODAS las ordenes salian con la misma direccion falsa. Ahora se
  // cargan las que el cliente guardo y no se deja confirmar sin una.
  const [direcciones, setDirecciones]     = useState([]);
  const [dirId, setDirId]                 = useState(null);
  const [cargandoDirs, setCargandoDirs]   = useState(true);

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

  const tiendas    = [...new Set(items.map(i => i.tienda))];
  const envioTotal = tiendas.length * ENVIO_POR_TIENDA;
  const total      = subtotal + envioTotal;

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
      await Promise.all(
        Object.entries(porNegocio).map(([negocio_id, itemsNegocio]) =>
          ordenesService.crear({
            negocio_id,
            items: itemsNegocio.map(i => ({ producto_id: i.id, cantidad: i.qty })),
            metodo_pago: pago,
            direccion_entrega: dirElegida.dir,
            notas_cliente: nota || undefined,
          })
        )
      );
      clearCart();
      addToast('¡Orden confirmada! Recibirás un correo de confirmación.', 'success');
      navigate('/tienda/perfil');
    } catch (err) {
      const detail = err.response?.data?.detail;
      let msg = 'No se pudo confirmar la orden. Intenta de nuevo.';
      if (typeof detail === 'string') {
        msg = detail;
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
          {cargandoDirs ? (
            <p className="ucho-address-text">Cargando direcciones...</p>
          ) : direcciones.length === 0 ? (
            <div className="ucho-address ucho-address--vacia">
              <span className="ucho-address-icon">📍</span>
              <div>
                <p className="ucho-address-text">No tienes direcciones guardadas</p>
                <button
                  className="ucho-address-change"
                  onClick={() => navigate('/tienda/perfil?tab=direcciones')}
                >
                  Agregar una dirección
                </button>
              </div>
            </div>
          ) : (
            <div className="ucho-address-list">
              {direcciones.map(d => (
                <label
                  key={d.id}
                  className={`ucho-address-opt ${dirId === d.id ? 'ucho-address-opt--sel' : ''}`}
                >
                  <input
                    type="radio"
                    name="direccion"
                    checked={dirId === d.id}
                    onChange={() => setDirId(d.id)}
                  />
                  <span>
                    <strong>{d.etiqueta || 'Direccion'}</strong>
                    <em>{d.dir}</em>
                    {d.referencia && <small>{d.referencia}</small>}
                  </span>
                </label>
              ))}
            </div>
          )}
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
          disabled={loading || !dirElegida}
        >
          {loading ? 'Procesando...' : (!dirElegida ? 'Agrega una direccion' : 'Confirmar Orden')}
        </button>
        <p className="ucho-confirm-note">Recibirás confirmación en tu correo</p>
      </div>
    </div>
  );
};

export default UserCheckoutPage;