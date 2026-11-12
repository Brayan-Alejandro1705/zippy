// Adicionales de un producto en una orden (nov 2026): el servidor los guarda
// copiados en item.especificaciones.adicionales = [{ id, nombre, precio }].

export const adicionalesDeItem = (it) => (it?.especificaciones?.adicionales || []).filter(a => a && a.nombre);

// "Granizado Jamaica + Gomas, Shot 30 ml"
export const conAdicionales = (nombre, it) => {
  const lista = adicionalesDeItem(it).map(a => a.nombre);
  return lista.length ? `${nombre} + ${lista.join(', ')}` : nombre;
};
