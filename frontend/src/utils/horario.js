// Ayudas para saber si un negocio está dentro de su horario configurado
// (hora_apertura, hora_cierre, dias_operacion, formato "HH:MM" / "Lunes,Martes,...").
// Si el vendedor nunca configuró horario, se asume que el negocio está
// abierto siempre (no rompe negocios existentes que no lo llenaron).

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']; // Date#getDay()

const aMinutos = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
};

export const estaAbierto = (negocio, ahora = new Date()) => {
  if (!negocio || !negocio.hora_apertura || !negocio.hora_cierre) return true;

  if (negocio.dias_operacion) {
    const dias = negocio.dias_operacion.split(',').map(d => d.trim()).filter(Boolean);
    if (dias.length > 0 && !dias.includes(DIAS_SEMANA[ahora.getDay()])) return false;
  }

  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const minApertura  = aMinutos(negocio.hora_apertura);
  const minCierre     = aMinutos(negocio.hora_cierre);

  if (minCierre > minApertura) return minutosAhora >= minApertura && minutosAhora < minCierre;
  // Horario que cruza medianoche (ej: 8:00 p.m. - 2:00 a.m.)
  return minutosAhora >= minApertura || minutosAhora < minCierre;
};

export const horaBonita = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = String(hhmm).split(':').map(Number);
  const ampm = h >= 12 ? 'p.m.' : 'a.m.';
  const h12  = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m || 0).padStart(2, '0')} ${ampm}`;
};

export const textoCerrado = (negocio) => {
  if (!negocio?.hora_apertura) return 'Tienda cerrada';
  return `Cerrado · Abre a las ${horaBonita(negocio.hora_apertura)}`;
};
