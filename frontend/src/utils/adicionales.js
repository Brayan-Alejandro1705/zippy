import { textoOpcionesItem } from './opciones';

// Adicionales de un producto en una orden (nov 2026): el servidor los guarda
// copiados en item.especificaciones.adicionales = [{ id, nombre, precio }].

export const adicionalesDeItem = (it) => (it?.especificaciones?.adicionales || []).filter(a => a && a.nombre);

// "Granizado Jamaica + Gomas, Shot 30 ml"
// Nov 2026: con tamaño y licor si los tiene: "Granizado Lulo (20 oz · sin licor) + Gomas"
export const conAdicionales = (nombre, it) => {
  const op = textoOpcionesItem(it);
  const base = op ? `${nombre} (${op})` : nombre;
  const lista = adicionalesDeItem(it).map(a => a.nombre);
  return lista.length ? `${base} + ${lista.join(', ')}` : base;
};
