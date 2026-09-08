/**
 * envio.js — Costo del domicilio, en un solo lugar.
 *
 * Antes este valor estaba duplicado en UserCartPage.js y UserCheckoutPage.js.
 * Dos copias del mismo numero es una bomba de tiempo: el dia que cambias una
 * y olvidas la otra, el carrito le muestra un precio al cliente y el checkout
 * le cobra otro. Ahora se cambia aqui y listo.
 */

// Costo por tienda. Si un pedido trae productos de dos negocios distintos,
// se cobra dos veces, porque son dos recogidas diferentes.
export const ENVIO_POR_TIENDA = 4000;

// Formato de pesos colombianos, sin decimales.
export const formatearPesos = (valor) =>
  `$${Number(valor || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
