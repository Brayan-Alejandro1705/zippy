// Tamaños y "con o sin licor" de los productos de Granizados (nov 2026).
// Producto.opciones = { tamanos: [{nombre, precio}], con_licor, sin_licor (descuento o null) }
// Lo que escoge el cliente: { tamano: '20 oz', sin_licor: false }
// El servidor vuelve a calcular el precio al crear la orden (opciones_producto.py).

export const tieneOpciones = (p) => !!p?.opciones?.tamanos?.length;

export const opcionesIniciales = (p) => (tieneOpciones(p) ? { tamano: p.opciones.tamanos[0].nombre, sin_licor: false } : null);

export const precioConOpciones = (p, sel) => {
  if (!tieneOpciones(p)) return p.precioBase ?? p.precio;
  const t = p.opciones.tamanos.find(x => x.nombre === sel?.tamano) || p.opciones.tamanos[0];
  const descuento = p.opciones.con_licor && sel?.sin_licor && p.opciones.sin_licor != null ? Number(p.opciones.sin_licor) : 0;
  return Math.max(0, Number(t.precio) - descuento);
};

export const llevaLicor = (p, sel) => (tieneOpciones(p) && p.opciones.con_licor ? !sel?.sin_licor : null);

// "20 oz · sin licor"
export const textoOpciones = (p, sel) => {
  if (!tieneOpciones(p) || !sel) return '';
  const partes = [sel.tamano];
  if (p.opciones.con_licor) partes.push(sel.sin_licor ? 'sin licor' : 'con licor');
  return partes.filter(Boolean).join(' · ');
};

// Para un item ya guardado en una orden: especificaciones.opciones = {tamano, licor}
export const textoOpcionesItem = (it) => {
  const o = it?.especificaciones?.opciones;
  if (!o) return '';
  return [o.tamano, o.licor && o.licor.toLowerCase()].filter(Boolean).join(' · ');
};
