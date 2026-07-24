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

export const urlImagen = (ruta) => {
  if (!ruta) return null;
  if (/^(https?:|data:|blob:)/i.test(ruta)) return ruta;   // ya es absoluta
  return `${ORIGEN_API}${ruta.startsWith('/') ? '' : '/'}${ruta}`;
};

export default urlImagen;