// ============================================================================
// useCategoriasProducto.js — Categorías de producto del vendedor que está
// usando la app, derivadas de la categoría de su negocio.
//
// Lo usan VendorNuevoProductoPage y VendorEditarProductoPage. Va en un hook y
// no copiado en cada página para que, si mañana cambia de dónde sale la
// categoría del negocio, solo haya un sitio que tocar.
// ============================================================================

import { useState, useEffect } from 'react';
import { negociosService } from '../config/api';
import { categoriasDeProducto } from '../constants/categorias';

export const useCategoriasProducto = (valorActual = '') => {
  const [negocio, setNegocio] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    negociosService.miNegocio()
      .then(({ data }) => { if (activo) setNegocio(data); })
      .catch(() => { /* sin negocio caemos a la lista genérica */ })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, []);

  return {
    cargando,
    categoriaNegocio: negocio?.categoria || '',
    esServicio: !!negocio?.es_servicio,
    opciones: categoriasDeProducto(negocio?.categoria, !!negocio?.es_servicio, valorActual),
  };
};

export default useCategoriasProducto;