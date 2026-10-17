// ============================================================================
// media.js — Resuelve las URLs de imágenes que devuelve el backend.
//
// El endpoint /productos/upload-imagen devuelve una ruta relativa como
// "/uploads/productos/abc.jpg". Esa ruta se resuelve contra el origen de la
// PÁGINA (Firebase Hosting, o capacitor://localhost dentro del APK), no contra
// Render, así que la imagen nunca carga. Hay que anteponerle el origen de la API.
// ============================================================================

import { API_BASE_URL } from '../config/api';

// De "https://zippy-eedd.onrender.com/api/v1" saca "https://zippy-eedd.onrender.com"
const ORIGEN_API = (API_BASE_URL || '').replace(/\/api\/v\d+\/?$/, '');

/*
 * Oct 2026: el servidor guarda cada foto en dos tamaños (backend/imagenes.py):
 * "...-g.webp" (grande, para el detalle) y "...-m.webp" (mini, para listas).
 * Con mini = true se pide la pequeña: en la tienda una foto ocupa media
 * pantalla y no vale la pena bajar la grande. Las fotos viejas que no tengan
 * ese nombre se devuelven tal cual.
 */
export const urlImagen = (ruta, mini = false) => {
  if (!ruta) return null;
  let url = ruta;
  if (!/^(https?:|data:|blob:)/i.test(ruta)) {
    url = `${ORIGEN_API}${ruta.startsWith('/') ? '' : '/'}${ruta}`;
  }
  return mini ? url.replace(/-g\.webp$/, '-m.webp') : url;
};

export default urlImagen;