import { useEffect, useRef } from 'react';

// ============================================================================
// atras.js - Lo que hace el boton "atras" del celular cuando hay algo abierto.
//
// Una ventana (modal) o un menu abierto se registra aqui mientras esta en
// pantalla. Al tocar "atras", primero se cierra lo ultimo que se abrio, como
// en cualquier app; solo si no hay nada abierto se cambia de pantalla.
// ============================================================================

const abiertos = [];

/** Cierra lo ultimo que se abrio. Devuelve true si habia algo para cerrar. */
export const cerrarUltimoAbierto = () => {
  const cerrar = abiertos[abiertos.length - 1];
  if (!cerrar) return false;
  cerrar();
  return true;
};

/** Mientras `abierto` sea verdadero, "atras" llama a `cerrar` en vez de salir de la pantalla. */
export const useCerrarConAtras = (abierto, cerrar) => {
  const ref = useRef(cerrar);
  ref.current = cerrar;
  useEffect(() => {
    if (!abierto) return undefined;
    const fn = () => ref.current && ref.current();
    abiertos.push(fn);
    return () => {
      const i = abiertos.lastIndexOf(fn);
      if (i !== -1) abiertos.splice(i, 1);
    };
  }, [abierto]);
};
