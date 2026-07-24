// ============================================================================
// categorias.js — Fuente única de categorías de negocio y de servicio.
//
// Antes esta lista estaba copiada en tres sitios (RegisterPage, VendorConfigPage
// y VendorPerfilPage) y las tres estaban desincronizadas: por eso un negocio
// registrado como "Soporte técnico" no aparecía en el desplegable del perfil.
// Todo lo que muestre categorías debe importarlas de aquí.
// ============================================================================

export const CATEGORIAS_NEGOCIO = [
  'Restaurante', 'Comida rápida', 'Panadería', 'Cafetería', 'Frutas y verduras',
  'Supermercado', 'Droguería', 'Ropa', 'Electrónica', 'Mascotas', 'General',
];

export const CATEGORIAS_SERVICIO = [
  'Aseo del hogar', 'Lavado y planchado', 'Jardinería y poda', 'Pintura',
  'Albañilería', 'Carpintería', 'Cerrajería', 'Fumigación', 'Niñera',
  'Cuidado de adultos mayores', 'Entrenador personal', 'Peluquería / barbería',
  'Manicure y pedicure', 'Maquillaje', 'Repostería por pedido',
  'Comida casera / catering', 'Fotografía y video', 'DJ / sonido', 'Decoración',
  'Meseros', 'Lavado de motos y carros', 'Mecánica a domicilio',
  'Modistería / arreglos de ropa', 'Mensajería y mandados', 'Soporte técnico',
  'Clases particulares',
];

export const TODAS_LAS_CATEGORIAS = [...CATEGORIAS_NEGOCIO, ...CATEGORIAS_SERVICIO];

/**
 * Opciones para un desplegable de categoría.
 *
 * Si el valor guardado no está en la lista (negocio viejo, categoría retirada),
 * lo agrega al inicio en vez de dejarlo fuera. Sin esto el <select> muestra la
 * primera opción de la lista aunque el valor real sea otro, que es justo lo que
 * hacía que el título de arriba y el desplegable no coincidieran.
 */
export const opcionesCategoria = (valorActual, esServicio = false) => {
  const base = esServicio ? CATEGORIAS_SERVICIO : TODAS_LAS_CATEGORIAS;
  if (valorActual && !base.includes(valorActual)) return [valorActual, ...base];
  return base;
};

// ============================================================================
// Categorias de PRODUCTO, derivadas de la categoria del NEGOCIO.
//
// Un restaurante no vende "Lacteos": vende hamburguesas, perros y almuerzos.
// Antes la lista era la misma para todos (Bebidas / Panaderia / Pasteleria /
// Frutas y Verduras / Lacteos / Carnes / Otros), heredada de cuando Zippy solo
// tenia panaderias. Cada negocio ve ahora las suyas.
//
// 'Otros' va al final de todas a proposito: es la valvula de escape para que
// nadie se quede sin poder publicar por falta de una categoria exacta.
// ============================================================================

export const CATEGORIAS_PRODUCTO_POR_NEGOCIO = {
  'Restaurante': [
    'Hamburguesas', 'Perros calientes', 'Almuerzos', 'Asados y carnes', 'Pollo',
    'Sopas y caldos', 'Arroces', 'Entradas y picadas', 'Postres', 'Bebidas', 'Otros',
  ],
  'Comida rápida': [
    'Hamburguesas', 'Perros calientes', 'Salchipapas', 'Pizza', 'Empanadas',
    'Arepas', 'Papas y fritos', 'Alitas', 'Postres', 'Bebidas', 'Otros',
  ],
  'Panadería': [
    'Pan', 'Pasteles y hojaldres', 'Tortas', 'Galletas',
    'Buñuelos y almojábanas', 'Postres', 'Bebidas', 'Otros',
  ],
  'Cafetería': [
    'Café', 'Bebidas frías', 'Desayunos', 'Sándwiches y wraps',
    'Pan y pasteles', 'Tortas y postres', 'Otros',
  ],
  'Frutas y verduras': [
    'Frutas', 'Verduras', 'Tubérculos', 'Hierbas y aliños',
    'Granos', 'Jugos y pulpas', 'Otros',
  ],
  'Supermercado': [
    'Abarrotes', 'Granos y cereales', 'Lácteos', 'Carnes y pollo',
    'Frutas y verduras', 'Panadería', 'Bebidas', 'Snacks',
    'Aseo del hogar', 'Cuidado personal', 'Mascotas', 'Otros',
  ],
  'Droguería': [
    'Medicamentos', 'Vitaminas y suplementos', 'Primeros auxilios',
    'Cuidado personal', 'Cuidado de la piel', 'Bebés', 'Otros',
  ],
  'Ropa': [
    'Ropa de hombre', 'Ropa de mujer', 'Ropa infantil', 'Calzado',
    'Ropa interior', 'Accesorios', 'Otros',
  ],
  'Electrónica': [
    'Celulares', 'Accesorios de celular', 'Audio y sonido', 'Computadores',
    'Electrodomésticos', 'Cables y cargadores', 'Otros',
  ],
  'Mascotas': [
    'Alimento para perro', 'Alimento para gato', 'Snacks y premios',
    'Juguetes', 'Accesorios', 'Higiene y cuidado', 'Otros',
  ],
  'General': [
    'Alimentos', 'Bebidas', 'Aseo del hogar', 'Cuidado personal',
    'Hogar', 'Snacks', 'Otros',
  ],
};

// Los negocios de servicio no publican productos sino lo que ofrecen.
export const CATEGORIAS_PRODUCTO_SERVICIO = [
  'Servicio a domicilio', 'Servicio en el local', 'Paquetes y combos',
  'Visita o diagnóstico', 'Materiales e insumos', 'Otros',
];

export const CATEGORIAS_PRODUCTO_GENERICO = CATEGORIAS_PRODUCTO_POR_NEGOCIO['General'];

/**
 * Categorias de producto que le corresponden a un vendedor.
 *
 * @param categoriaNegocio  la categoria del negocio (la de registro / config)
 * @param esServicio        true si el negocio es de servicios
 * @param valorActual       categoria ya guardada en el producto, si la hay
 *
 * valorActual se agrega al inicio cuando no esta en la lista. Sin eso, un
 * producto viejo (o uno creado antes de que el vendedor cambiara su categoria)
 * mostraria la primera opcion del desplegable en vez de la suya, y al guardar
 * se le cambiaria la categoria sin que nadie lo pidiera.
 */
export const categoriasDeProducto = (categoriaNegocio, esServicio = false, valorActual = '') => {
  const base = esServicio
    ? CATEGORIAS_PRODUCTO_SERVICIO
    : (CATEGORIAS_PRODUCTO_POR_NEGOCIO[categoriaNegocio] || CATEGORIAS_PRODUCTO_GENERICO);

  if (valorActual && !base.includes(valorActual)) return [valorActual, ...base];
  return base;
};