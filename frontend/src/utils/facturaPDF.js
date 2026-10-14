// ============================================================================
// facturaPDF.js - Arma la factura de un pedido como PDF.
//
// Antes la factura se abria en una ventana nueva para imprimir. En la app del
// celular eso dejaba una pantalla en blanco: ahi no hay ventanas ni impresora.
// Un PDF sirve en los dos lados: en el computador se descarga y en el celular
// se manda por WhatsApp, correo, etc.
//
// jsPDF se carga solo cuando alguien pide una factura, para no hacer mas
// pesada la carga inicial de la app.
// ============================================================================

const NARANJA = [255, 122, 0];
const GRIS = [100, 116, 139];
const OSCURO = [30, 41, 59];

const plata = n => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;

// Las fuentes basicas del PDF no traen emojis ni simbolos raros: se quitan
// para que no salgan cuadritos. Tildes y ñ si se conservan.
const limpio = (t) => String(t ?? '').replace(/[^ -ÿ]/g, '').replace(/\s+/g, ' ').trim();

/**
 * orden: { id, negocio, fecha, cliente, dir, items[{nombre, qty, precio}],
 *          subtotal, total }  (precio = total de esa linea)
 * Devuelve { blob, nombre }.
 */
export const facturaPDF = async (orden) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16;
  const codigo = String(orden.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase();

  // Encabezado naranja
  doc.setFillColor(...NARANJA);
  doc.rect(0, 0, W, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(doc.splitTextToSize(limpio(orden.negocio) || 'Zippy Go', W - 2 * M - 50)[0], M, 14);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Factura de venta', M, 22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`#${codigo}`, W - M, 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (orden.fecha) doc.text(limpio(orden.fecha), W - M, 22, { align: 'right' });

  // Datos del cliente
  let y = 42;
  doc.setTextColor(...GRIS);
  doc.setFontSize(9);
  const dato = (etiqueta, valor) => {
    if (!valor) return;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GRIS);
    doc.text(etiqueta, M, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...OSCURO);
    const lineas = doc.splitTextToSize(limpio(valor), W - 2 * M - 32);
    doc.text(lineas, M + 32, y);
    y += 5 * lineas.length + 1;
  };
  dato('Cliente', orden.cliente);
  dato('Entregar en', orden.dir);
  y += 4;

  // Tabla de productos
  const cols = { prod: M, cant: W - M - 72, unit: W - M - 30, sub: W - M };
  doc.setDrawColor(226, 232, 240);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GRIS);
  doc.text('Producto', cols.prod, y);
  doc.text('Cant.', cols.cant, y, { align: 'center' });
  doc.text('Precio unit.', cols.unit, y, { align: 'right' });
  doc.text('Subtotal', cols.sub, y, { align: 'right' });
  y += 2.5;
  doc.line(M, y, W - M, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  for (const item of orden.items || []) {
    const qty = Number(item.qty) || 1;
    const lineas = doc.splitTextToSize(limpio(item.nombre), cols.cant - M - 12);
    if (y + 5 * lineas.length > H - 40) { doc.addPage(); y = 20; }
    doc.setTextColor(...OSCURO);
    doc.text(lineas, cols.prod, y);
    doc.text(String(qty), cols.cant, y, { align: 'center' });
    doc.text(plata(item.precio / qty), cols.unit, y, { align: 'right' });
    doc.text(plata(item.precio), cols.sub, y, { align: 'right' });
    y += 5 * lineas.length + 2;
    doc.setDrawColor(241, 245, 249);
    doc.line(M, y - 3.5, W - M, y - 3.5);
  }

  // Totales
  y += 4;
  const subtotal = Number(orden.subtotal) || 0;
  const total = Number(orden.total) || 0;
  const domicilio = total - subtotal;
  const fila = (etiqueta, valor, fuerte = false) => {
    doc.setFont('helvetica', fuerte ? 'bold' : 'normal');
    doc.setFontSize(fuerte ? 13 : 10);
    doc.setTextColor(...(fuerte ? OSCURO : GRIS));
    doc.text(etiqueta, cols.unit, y, { align: 'right' });
    doc.setTextColor(...OSCURO);
    doc.text(valor, cols.sub, y, { align: 'right' });
    y += fuerte ? 8 : 6;
  };
  fila('Subtotal', plata(subtotal));
  if (domicilio > 0) fila('Domicilio', plata(domicilio));
  doc.setDrawColor(...OSCURO);
  doc.line(cols.cant - 10, y - 3, W - M, y - 3);
  y += 3;
  fila('Total', plata(total), true);

  // Pie
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRIS);
  doc.text('Pedido hecho con Zippy Go · Garzón, Huila', W / 2, H - 12, { align: 'center' });

  return { blob: doc.output('blob'), nombre: `factura_${codigo || 'pedido'}.pdf` };
};
