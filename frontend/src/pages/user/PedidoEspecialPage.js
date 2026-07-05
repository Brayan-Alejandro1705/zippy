import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UserLayout from '../../components/UserLayout';
import { useToast } from '../../context/ToastContext';
import '../../styles/PedidoEspecial.css';

const UNIDADES = ['unidad', 'kg', 'g', 'libra', 'litro', 'ml', 'paquete', 'caja', 'lata', 'botella'];

const itemVacio = () => ({ id: Date.now() + Math.random(), descripcion: '', cantidad: 1, unidad: 'unidad' });

const PedidoEspecialPage = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [items, setItems] = useState([itemVacio()]);
  const [direccion, setDireccion] = useState('');
  const [barrio, setBarrio] = useState('');
  const [telefono, setTelefono] = useState('');
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);

  const agregarItem = () => setItems(prev => [...prev, itemVacio()]);

  const eliminarItem = id => setItems(prev => prev.filter(i => i.id !== id));

  const actualizarItem = (id, campo, valor) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, [campo]: valor } : i));

  const itemsValidos = items.filter(i => i.descripcion.trim() !== '');

  const handleSubmit = e => {
    e.preventDefault();
    if (itemsValidos.length === 0) {
      addToast('Agrega al menos un producto al pedido', 'warning');
      return;
    }
    if (!direccion.trim()) {
      addToast('Ingresa la dirección de entrega', 'warning');
      return;
    }

    setEnviando(true);

    // Guardar en localStorage para que el repartidor lo vea (mock)
    const pedido = {
      id: `#PE${Date.now().toString().slice(-4)}`,
      tipo: 'especial',
      estado: 'pendiente',
      fecha: new Date().toLocaleDateString('es-CO'),
      cliente: JSON.parse(localStorage.getItem('usuario') || '{}').nombre || 'Cliente',
      telefono: telefono.trim() || 'No especificado',
      direccion: direccion.trim(),
      barrio: barrio.trim() || 'Sin barrio',
      items: itemsValidos,
      notas: notas.trim(),
      total: 0,
      eta: 25,
      distancia: 3.5,
      position: { lat: 2.1974, lng: -75.6246 },
      color: '#8b5cf6',
      pago: 'pendiente',
      propina: 0,
      retraso: false,
      emoji: '📋',
    };

    const anteriores = JSON.parse(localStorage.getItem('pedidos_especiales') || '[]');
    localStorage.setItem('pedidos_especiales', JSON.stringify([pedido, ...anteriores]));

    setTimeout(() => {
      setEnviando(false);
      addToast('¡Pedido especial enviado! El domiciliario lo recibirá pronto.', 'success');
      navigate('/tienda');
    }, 1200);
  };

  return (
    <UserLayout>
      <div className="pe-page">
        <div className="pe-header">
<div className="pe-title-wrap">
            <span className="pe-icon">📋</span>
            <div>
              <h1 className="pe-title">Pedido Especial</h1>
              <p className="pe-subtitle">Describe exactamente lo que necesitas y el domiciliario lo consigue</p>
            </div>
          </div>
        </div>

        <form className="pe-form" onSubmit={handleSubmit}>

          {/* Lista de productos */}
          <section className="pe-section">
            <div className="pe-section-header">
              <h2 className="pe-section-title">¿Qué necesitas?</h2>
              <span className="pe-section-hint">Sé lo más específico posible</span>
            </div>

            <div className="pe-items">
              {items.map((item, idx) => (
                <div key={item.id} className="pe-item">
                  <div className="pe-item-num">{idx + 1}</div>
                  <div className="pe-item-fields">
                    <input
                      className="pe-input pe-input--desc"
                      placeholder="Ej: Leche entera, marca Alquería"
                      value={item.descripcion}
                      onChange={e => actualizarItem(item.id, 'descripcion', e.target.value)}
                    />
                    <div className="pe-item-row">
                      <div className="pe-qty-wrap">
                        <label className="pe-label">Cantidad</label>
                        <div className="pe-qty-ctrl">
                          <button
                            type="button"
                            className="pe-qty-btn"
                            onClick={() => actualizarItem(item.id, 'cantidad', Math.max(1, item.cantidad - 1))}
                          >−</button>
                          <input
                            className="pe-qty-input"
                            type="number"
                            min="1"
                            value={item.cantidad}
                            onChange={e => actualizarItem(item.id, 'cantidad', Math.max(1, parseInt(e.target.value) || 1))}
                          />
                          <button
                            type="button"
                            className="pe-qty-btn"
                            onClick={() => actualizarItem(item.id, 'cantidad', item.cantidad + 1)}
                          >+</button>
                        </div>
                      </div>
                      <div className="pe-unit-wrap">
                        <label className="pe-label">Unidad</label>
                        <select
                          className="pe-select"
                          value={item.unidad}
                          onChange={e => actualizarItem(item.id, 'unidad', e.target.value)}
                        >
                          {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      {items.length > 1 && (
                        <button
                          type="button"
                          className="pe-remove"
                          onClick={() => eliminarItem(item.id)}
                          title="Eliminar"
                        >✕</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button type="button" className="pe-add-item" onClick={agregarItem}>
              + Agregar otro producto
            </button>
          </section>

          {/* Entrega */}
          <section className="pe-section">
            <h2 className="pe-section-title">Datos de entrega</h2>
            <div className="pe-field">
              <label className="pe-label">Dirección *</label>
              <input
                className="pe-input"
                placeholder="Ej: Cra 5 #23-45, Apto 301"
                value={direccion}
                onChange={e => setDireccion(e.target.value)}
                required
              />
            </div>
            <div className="pe-field-row">
              <div className="pe-field">
                <label className="pe-label">Barrio</label>
                <input
                  className="pe-input"
                  placeholder="Ej: Centro"
                  value={barrio}
                  onChange={e => setBarrio(e.target.value)}
                />
              </div>
              <div className="pe-field">
                <label className="pe-label">Teléfono de contacto</label>
                <input
                  className="pe-input"
                  placeholder="Ej: 310-000-0000"
                  value={telefono}
                  onChange={e => setTelefono(e.target.value)}
                />
              </div>
            </div>
            <div className="pe-field">
              <label className="pe-label">Instrucciones adicionales</label>
              <textarea
                className="pe-textarea"
                placeholder="Ej: Golpear la puerta, no hay timbre. Traer factura."
                value={notas}
                onChange={e => setNotas(e.target.value)}
                rows={3}
              />
            </div>
          </section>

          {/* Resumen */}
          {itemsValidos.length > 0 && (
            <div className="pe-summary">
              <p className="pe-summary-title">Resumen del pedido</p>
              <ul className="pe-summary-list">
                {itemsValidos.map(i => (
                  <li key={i.id} className="pe-summary-item">
                    <span className="pe-summary-desc">{i.descripcion}</span>
                    <span className="pe-summary-qty">{i.cantidad} {i.unidad}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button type="submit" className={`pe-submit ${enviando ? 'pe-submit--loading' : ''}`} disabled={enviando}>
            {enviando ? '⏳ Enviando pedido...' : '📤 Enviar pedido especial'}
          </button>
        </form>
      </div>
    </UserLayout>
  );
};

export default PedidoEspecialPage;
