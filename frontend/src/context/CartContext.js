import React, { createContext, useContext, useState } from 'react';

const CartContext = createContext(null);

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState([]);

  // Nov 2026: cada linea del carrito es un producto CON sus adicionales. El
  // mismo granizado con gomas y sin gomas son dos lineas (linea = id|ids de
  // adicionales). El precio de la linea ya incluye los adicionales; el
  // servidor lo vuelve a calcular al crear la orden.
  const addItem = (product, adicionales = []) => {
    const lista = [...(adicionales || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const linea = `${product.id}|${lista.map(a => a.id).join(',')}`;
    const precioBase = product.precioBase ?? product.precio;
    const precio = precioBase + lista.reduce((s, a) => s + Number(a.precio || 0), 0);
    setItems(prev => {
      const found = prev.find(i => i.linea === linea);
      if (found) return prev.map(i => i.linea === linea ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, linea, precioBase, precio, adicionales: lista, qty: 1 }];
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
