import React, { createContext, useContext, useState } from 'react';
import { tieneOpciones, opcionesIniciales, precioConOpciones, textoOpciones, llevaLicor } from '../utils/opciones';

const CartContext = createContext(null);

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState([]);

  // Nov 2026: cada linea del carrito es un producto CON sus adicionales. El
  // mismo granizado con gomas y sin gomas son dos lineas (linea = id|ids de
  // adicionales). El precio de la linea ya incluye los adicionales; el
  // servidor lo vuelve a calcular al crear la orden.
  // Nov 2026: tambien con tamaño y con/sin licor (Granizados): otra linea.
  const addItem = (product, adicionales = [], opciones = null) => {
    const lista = [...(adicionales || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const op = tieneOpciones(product) ? (opciones || opcionesIniciales(product)) : null;
    const linea = `${product.id}|${op ? `${op.tamano}|${op.sin_licor ? 'sin' : 'con'}` : ''}|${lista.map(a => a.id).join(',')}`;
    const precioBase = op ? precioConOpciones(product, op) : (product.precioBase ?? product.precio);
    const precio = precioBase + lista.reduce((s, a) => s + Number(a.precio || 0), 0);
    const extra = op ? { opcionesElegidas: op, opcionesTexto: textoOpciones(product, op), conLicor: llevaLicor(product, op) } : {};
    setItems(prev => {
      const found = prev.find(i => i.linea === linea);
      if (found) return prev.map(i => i.linea === linea ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, ...extra, linea, precioBase, precio, adicionales: lista, qty: 1 }];
    });
  };

  const removeItem = (linea) => setItems(prev => prev.filter(i => i.linea !== linea));

  const updateQty = (linea, qty) => {
    if (qty < 1) { removeItem(linea); return; }
    setItems(prev => prev.map(i => i.linea === linea ? { ...i, qty } : i));
  };

  const clearCart = () => setItems([]);

  const totalItems = items.reduce((s, i) => s + i.qty, 0);
  const subtotal   = items.reduce((s, i) => s + i.precio * i.qty, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearCart, totalItems, subtotal }}>
      {children}
    </CartContext.Provider>
  );
};
