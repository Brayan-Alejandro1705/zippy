import { Capacitor } from '@capacitor/core';

// ============================================================================
// exportarCSV.js - Entregar archivos (tablas CSV, facturas PDF) a la persona.
//
//  - En el computador se descargan como cualquier archivo.
//  - En la app del celular no hay "descargas": se guarda el archivo y se abre
//    el menu de compartir (WhatsApp, correo, Drive...). Eso necesita los
//    plugins nativos Filesystem y Share, que llegan con la version de tienda;
//    si la app instalada todavia no los tiene, se intenta compartir con el
//    navegador y, si tampoco se puede, se avisa en vez de fingir que funciono.
//
// Detalles del CSV para que Excel en espanol lo abra bien:
//  - Separador ";" (con "," Excel en Colombia mete todo en una sola columna).
//  - BOM al inicio (sin el, las tildes y la ñ salen como "GarzÃ³n").
// ============================================================================

const SEP = ';';
const BOM = '﻿';

const celda = (v) => {
  const texto = v === null || v === undefined ? '' : String(v);
  return `"${texto.replace(/"/g, '""')}"`;
};

export const armarCSV = (encabezados, filas) =>
  BOM + [encabezados, ...filas].map(f => f.map(celda).join(SEP)).join('\r\n');

const descargarEnNavegador = (blob, nombre) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const blobABase64 = (blob) => new Promise((ok, mal) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1]);
  r.onerror = mal;
  r.readAsDataURL(blob);
});

const compartirNativo = async (blob, nombre) => {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);
  // En base64 sirve igual para texto (CSV) y para binarios (PDF)
  const { uri } = await Filesystem.writeFile({
    path: nombre,
    data: await blobABase64(blob),
    directory: Directory.Cache,
  });
  await Share.share({ title: nombre, files: [uri], dialogTitle: 'Enviar archivo' });
};

const compartirWeb = async (blob, nombre) => {
  const archivo = new File([blob], nombre, { type: blob.type });
  if (!navigator.canShare || !navigator.canShare({ files: [archivo] })) return false;
  await navigator.share({ files: [archivo], title: nombre });
  return true;
};

/**
 * Entrega un archivo: lo descarga en el computador o abre el menu de
 * compartir en el celular.
 * Devuelve 'descargado' | 'compartido' | 'cancelado' | 'no_disponible'.
 */
export const entregarArchivo = async (blob, nombre) => {
  if (!Capacitor.isNativePlatform()) {
    descargarEnNavegador(blob, nombre);
    return 'descargado';
  }
  try {
    if (Capacitor.isPluginAvailable('Share') && Capacitor.isPluginAvailable('Filesystem')) {
      await compartirNativo(blob, nombre);
      return 'compartido';
    }
    return (await compartirWeb(blob, nombre)) ? 'compartido' : 'no_disponible';
  } catch (e) {
    // Cerrar el menu de compartir sin elegir nada tambien llega aqui.
    if (/cancel|abort/i.test(String(e?.message || e?.name || e))) return 'cancelado';
    throw e;
  }
};

export const exportarCSV = (nombreBase, encabezados, filas) => {
  const blob = new Blob([armarCSV(encabezados, filas)], { type: 'text/csv;charset=utf-8' });
  return entregarArchivo(blob, `${nombreBase}_${new Date().toISOString().slice(0, 10)}.csv`);
};

// Mensaje para el aviso (toast) segun como termino.
export const avisoExportacion = {
  descargado:    ['Archivo descargado', 'success'],
  compartido:    ['Archivo listo para enviar', 'success'],
  cancelado:     null,
  no_disponible: ['Actualiza la app desde la tienda para exportar, o hazlo desde el computador', 'info'],
};
