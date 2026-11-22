// Compartir un texto (y un enlace) desde la app (nov 2026).
// En el celular abre el menú de compartir del sistema (WhatsApp, Facebook...);
// en el navegador usa el de la web, y si no hay, abre WhatsApp con el texto.
import { Capacitor } from '@capacitor/core';

export const compartir = async ({ titulo, texto, url }) => {
  const completo = url ? `${texto}\n${url}` : texto;
  try {
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title: titulo, text: texto, url, dialogTitle: titulo });
      return true;
    }
    if (navigator.share) {
      await navigator.share({ title: titulo, text: texto, url });
      return true;
    }
  } catch (e) {
    // Cerró el menú sin escoger: no es un error
    if (String(e?.message || e).toLowerCase().includes('cancel')) return false;
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(completo)}`, '_blank', 'noopener');
  return true;
};

// Enlace público a la tienda de un negocio (abre la app web en esa tienda)
export const enlaceTienda = (negocioId) => `https://zippygo-app.onrender.com/tienda?tienda=${negocioId}`;
