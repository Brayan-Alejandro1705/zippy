const DEFAULT_MATRIX = {
  super_admin: { vendedores: true, repartidores: true, usuarios: true, solicitudes: true, reportes: true, roles: true, config: true, logs: true },
  admin:       { vendedores: true, repartidores: true, usuarios: true, solicitudes: true, reportes: true, roles: false, config: false, logs: true },
  soporte:     { vendedores: false, repartidores: false, usuarios: true, solicitudes: false, reportes: false, roles: false, config: false, logs: true },
};

export const getMatrix = () => {
  try {
    const stored = localStorage.getItem('permissions_matrix');
    return stored ? { ...DEFAULT_MATRIX, ...JSON.parse(stored) } : DEFAULT_MATRIX;
  } catch {
    return DEFAULT_MATRIX;
  }
};

export const saveMatrix = (matrix) => {
  localStorage.setItem('permissions_matrix', JSON.stringify(matrix));
};

// Devuelve true si el usuario actual tiene un permiso específico
export const hasPermission = (permId) => {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  if (usuario.tipo_usuario !== 'admin') return false;
  // Super admins detectados por email semilla o flag
  if (usuario.es_super_admin) return true;
  const matrix = getMatrix();
  return matrix.admin?.[permId] ?? false;
};
