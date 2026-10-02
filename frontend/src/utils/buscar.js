/*
 * buscar.js - Una sola forma de buscar en toda la app.
 *
 * El problema que arregla: la gente escribe como habla y como le queda mas
 * facil en el teclado del celular. Buscaba "platano" y no salia "Plátano";
 * escribia "cocacola" y no salia "Coca Cola"; se le iba una letra en "arros"
 * y no salia "Arroz". Antes el filtro era un includes() pelado, asi que
 * cualquiera de esas tres cosas dejaba la pantalla vacia y el cliente pensaba
 * que la tienda no tenia el producto.
 *
 * Aqui se baja todo a minuscula, se le quitan las tildes y la enie, se sacan
 * los signos y se compara palabra por palabra. Si una palabra no aparece tal
 * cual, se acepta con un error de escritura pequeño (una letra cambiada,
 * sobrando, faltando o dos letras volteadas), siempre que la palabra sea lo
 * bastante larga para que no se vuelva un colador.
 */

// "Plátano Maduro" -> "platano maduro"
export const normalizar = (texto) =>
  String(texto == null ? '' : texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // tildes y diéresis
    .replace(/ñ/g, 'n')                // la enie ya quedo como n + tilde, pero por si acaso
    .replace(/[^a-z0-9\s]/g, ' ')      // puntos, comas, guiones: fuera
    .replace(/\s+/g, ' ')
    .trim();

/*
 * Distancia de edicion con corte temprano.
 * Si ya se paso del maximo que aceptamos, no sigue calculando.
 */
const distancia = (a, b, maximo) => {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maximo) return maximo + 1;

  // Se guardan DOS filas anteriores, no una: la de antes de la anterior es la
  // que permite contar "dos letras volteadas" como un solo error. Con una sola
  // fila, "arorz" quedaba a dos errores de "arroz" y no se encontraba.
  let dosAtras = null;
  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const actual = [i];
    let mejorFila = i;

    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      let valor = Math.min(
        anterior[j] + 1,          // borrar
        actual[j - 1] + 1,        // insertar
        anterior[j - 1] + costo,  // cambiar
      );
      // "arorz" por "arroz": dos letras volteadas cuenta como un solo error
      if (i > 1 && j > 1 && dosAtras && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        valor = Math.min(valor, dosAtras[j - 2] + 1);
      }
      actual[j] = valor;
      if (valor < mejorFila) mejorFila = valor;
    }

    if (mejorFila > maximo) return maximo + 1;
    dosAtras = anterior;
    anterior = actual;
  }

  return anterior[b.length];
};

// Cuantos errores de escritura se le perdonan a una palabra segun su largo.
const erroresPermitidos = (palabra) => {
  if (palabra.length <= 3) return 0;   // "pan", "ron": un error y ya es otra cosa
  if (palabra.length <= 6) return 1;
  return 2;
};

/*
 * ¿Esta palabra que escribio el cliente aparece en el texto?
 * Primero busca el pedazo tal cual (lo mas comun y lo mas rapido).
 * Si no, compara contra cada palabra del texto permitiendo el error.
 */
const palabraCoincide = (palabra, palabrasTexto, textoPlano) => {
  if (!palabra) return true;
  if (textoPlano.includes(palabra)) return true;

  const margen = erroresPermitidos(palabra);
  if (margen === 0) return false;

  return palabrasTexto.some((p) => {
    if (Math.abs(p.length - palabra.length) > margen) return false;
    return distancia(palabra, p, margen) <= margen;
  });
};

/*
 * coincide('Plátano', 'platanos') -> true
 *
 * Recibe el texto donde buscar (uno o varios campos) y lo que escribio el
 * cliente. Todas las palabras de la busqueda tienen que aparecer, para que
 * "arroz diana" no devuelva todo lo que tenga arroz.
 */
export const coincide = (texto, busqueda) => {
  const q = normalizar(busqueda);
  if (!q) return true;

  const campos = Array.isArray(texto) ? texto : [texto];
  const normalizados = campos.map(normalizar).filter(Boolean);
  const textoPlano = normalizados.join(' ');
  if (!textoPlano) return false;

  const pegado = normalizados.map((t) => t.replace(/ /g, '')).join(' ');
  const palabrasTexto = textoPlano.split(' ');

  return q.split(' ').every((palabra) => {
    if (palabraCoincide(palabra, palabrasTexto, textoPlano)) return true;
    // "cocacola" contra "coca cola"
    return pegado.includes(palabra.replace(/ /g, ''));
  });
};

export default coincide;
