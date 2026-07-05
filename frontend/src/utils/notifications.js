import { LocalNotifications } from '@capacitor/local-notifications';

const PREFS_KEY = 'notif_prefs';

const DEFAULT_PREFS = {
  nuevo_vendedor:   true,
  prod_pendiente:   true,
  orden_nueva:      false,
  vendedor_suspend: true,
  reporte_semanal:  true,
};

export const getPrefs = () => {
  try {
    const s = localStorage.getItem(PREFS_KEY);
    return s ? { ...DEFAULT_PREFS, ...JSON.parse(s) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
};

export const savePrefs = (prefs) => {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
};

// Pide permiso al usuario (solo Android/iOS)
export const requestPermission = async () => {
  try {
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  } catch {
    return false;
  }
};

// Verifica si el permiso ya fue dado
export const checkPermission = async () => {
  try {
    const result = await LocalNotifications.checkPermissions();
    return result.display === 'granted';
  } catch {
    return false;
  }
};

let notifId = Date.now();
const nextId = () => ++notifId;

// Envía una notificación local inmediata
export const sendNotification = async (titulo, cuerpo) => {
  try {
    const granted = await checkPermission();
    if (!granted) await requestPermission();
    await LocalNotifications.schedule({
      notifications: [{
        id:    nextId(),
        title: titulo,
        body:  cuerpo,
        smallIcon: 'ic_launcher',
        sound: 'default',
        schedule: { at: new Date(Date.now() + 500) },
      }],
    });
  } catch (e) {
    console.warn('Notificación no disponible:', e);
  }
};

// Notificaciones por tipo de evento
export const notifyNuevoVendedor = (nombre) => {
  const prefs = getPrefs();
  if (!prefs.nuevo_vendedor) return;
  sendNotification('🏪 Nuevo vendedor registrado', `${nombre} acaba de crear su cuenta en Zippy`);
};

export const notifyOrdenNueva = (total) => {
  const prefs = getPrefs();
  if (!prefs.orden_nueva) return;
  sendNotification('🛒 Nueva orden recibida', `Se generó una orden por $${total?.toLocaleString() ?? 0} COP`);
};

export const notifyVendedorSuspendido = (nombre) => {
  const prefs = getPrefs();
  if (!prefs.vendedor_suspend) return;
  sendNotification('⚠️ Vendedor suspendido', `${nombre} fue suspendido de la plataforma`);
};

export const notifyProdPendiente = (count) => {
  const prefs = getPrefs();
  if (!prefs.prod_pendiente) return;
  sendNotification('📦 Productos pendientes', `Hay ${count} producto(s) esperando revisión`);
};

// Programa el reporte semanal (cada lunes a las 8am)
export const scheduleReporteSemanal = async () => {
  try {
    const prefs = getPrefs();
    // Cancelar reporte anterior si existe
    await LocalNotifications.cancel({ notifications: [{ id: 99999 }] }).catch(() => {});

    if (!prefs.reporte_semanal) return;

    // Próximo lunes a las 8am
    const now  = new Date();
    const next = new Date();
    const day  = now.getDay(); // 0=dom, 1=lun...
    const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7 || 7;
    next.setDate(now.getDate() + daysUntilMonday);
    next.setHours(8, 0, 0, 0);

    await LocalNotifications.schedule({
      notifications: [{
        id:    99999,
        title: '📊 Reporte semanal Zippy',
        body:  'Tu resumen de actividad de la semana está listo',
        smallIcon: 'ic_launcher',
        schedule: { at: next, repeats: true, every: 'week' },
      }],
    });
  } catch (e) {
    console.warn('No se pudo programar reporte semanal:', e);
  }
};
