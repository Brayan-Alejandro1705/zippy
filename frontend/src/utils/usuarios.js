// El backend expone tipo_usuario/estado en minúsculas (enum de Python);
// el resto del panel admin fue construido esperando etiquetas capitalizadas
// ('Vendedor', 'Repartidor', 'Activo', ...). Este mapeo evita que cada página
// tenga que conocer la convención cruda del backend.

export const TIPO_TO_ROL = {
  cliente: 'Cliente',
  vendedor: 'Vendedor',
  domiciliario: 'Repartidor',
  admin: 'Admin',
};

export const ROL_TO_TIPO = {
  Cliente: 'cliente',
  Vendedor: 'vendedor',
  Repartidor: 'domiciliario',
  Admin: 'admin',
};

export const ESTADO_TO_LABEL = {
  activo: 'Activo',
  suspendido: 'Suspendido',
  inactivo: 'Inactivo',
  eliminado: 'Eliminado',
};

export const ESTADO_LABEL_TO_RAW = {
  Activo: 'activo',
  Suspendido: 'suspendido',
  Inactivo: 'inactivo',
  Eliminado: 'eliminado',
};

export const mapUsuario = (u) => ({
  id: u.id,
  nombre: u.nombre,
  email: u.email,
  telefono: u.telefono,
  documento: u.documento,
  rol: TIPO_TO_ROL[u.tipo] || u.tipo,
  estado: ESTADO_TO_LABEL[u.estado] || u.estado,
  fechaRegistro: u.fecha_creacion ? u.fecha_creacion.slice(0, 10) : null,
  productos: u.productos ?? 0,
  entregas: u.entregas ?? 0,
});
