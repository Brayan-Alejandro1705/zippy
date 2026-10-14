import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { cerrarUltimoAbierto } from '../utils/atras';
import { rutaPorTipo } from '../utils/cuentas';

// ============================================================================
// Boton "atras" del celular (Android).
//
// Antes hacia lo mismo que un navegador: volver a la pagina anterior del
// historial. Eso se sentia como una pagina web (atras recorria cada pestaña
// visitada) y, peor, despues de cambiar de cuenta regresaba a la pantalla de
// la cuenta anterior (por ejemplo, del cliente al panel de super admin).
//
// Ahora funciona como una app:
//   1. Si hay una ventana o menu abierto, lo cierra.
//   2. Si estas en una pantalla interna (ej. "Nuevo vendedor"), sube a la
//      lista de donde salio ("Vendedores").
//   3. Si estas en una pestaña (ej. "Usuarios"), vuelve al inicio de tu cuenta.
//   4. Si ya estas en el inicio, sale de la app.
// No usa el historial del navegador, asi que nunca te lleva a otra cuenta.
// ============================================================================

const tipoActual = () => {
  try {
    if (!localStorage.getItem('access_token')) return null;
    return JSON.parse(localStorage.getItem('usuario') || '{}').tipo_usuario || 'cliente';
  } catch {
    return null;
  }
};

// Pantallas internas cuyo "padre" no es solo quitar el ultimo pedazo
const PADRE_ESPECIAL = {
  '/tienda/checkout': '/tienda/carrito',
  '/verificar': '/login',
  '/login': '/bienvenida',
  '/register': '/bienvenida',
  '/recuperar': '/login',
};

// Listas a las que se sube desde sus pantallas internas
const LISTAS = ['/usuarios', '/vendedores', '/repartidores', '/vendor/productos', '/tienda/carrito'];

export const pantallaAnterior = (ruta, tipo) => {
  const inicio = tipo ? rutaPorTipo(tipo) : '/bienvenida';
  const limpia = ruta.replace(/\/+$/, '') || '/';
  if (limpia === inicio || limpia === '/') return null; // salir de la app

  // Sin sesion, el inicio es la bienvenida (y la tienda se puede ver sin cuenta)
  if (!tipo && limpia === '/tienda') return '/bienvenida';
  if (!tipo && limpia.startsWith('/tienda/')) return limpia === '/tienda/checkout' ? '/tienda/carrito' : '/tienda';
  if (PADRE_ESPECIAL[limpia]) return PADRE_ESPECIAL[limpia];

  // Subir hasta la lista mas cercana: /usuarios/123 -> /usuarios,
  // /vendor/productos/9/editar -> /vendor/productos
  const partes = limpia.split('/').filter(Boolean);
  for (let n = partes.length - 1; n >= 1; n--) {
    const padre = '/' + partes.slice(0, n).join('/');
    if (LISTAS.includes(padre)) return padre;
  }
  // Cualquier otra pestaña vuelve al inicio de la cuenta
  return inicio;
};

const BackButtonHandler = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const rutaRef = useRef(location.pathname);
  rutaRef.current = location.pathname;

  useEffect(() => {
    let listenerHandle;
    let activo = true;

    CapacitorApp.addListener('backButton', () => {
      if (cerrarUltimoAbierto()) return;
      const destino = pantallaAnterior(rutaRef.current, tipoActual());
      if (destino) navigate(destino, { replace: true });
      else CapacitorApp.exitApp();
    }).then((handle) => {
      if (activo) listenerHandle = handle;
      else handle.remove();
    });

    return () => {
      activo = false;
      listenerHandle?.remove();
    };
  }, [navigate]);

  return null;
};

export default BackButtonHandler;
