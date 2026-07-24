import axios from 'axios';

// ── URLs base ────────────────────────────────────────────────────────────────
const PROD_API_URL  = 'https://zippy-eedd.onrender.com/api/v1';  // servidor en la nube (Render)
const LOCAL_API_URL = 'http://localhost:8000/api/v1';            // desarrollo web local

const getApiBaseUrl = () => {
  // 1. Override manual por variable de entorno
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;

  // 2. Dentro del APK (Capacitor) → SIEMPRE el servidor en la nube
  if (window.Capacitor) return PROD_API_URL;

  // 3. Desarrollo web en tu PC → backend local
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return LOCAL_API_URL;
  }

  // 4. Cualquier otro caso (web desplegada) → nube
  return PROD_API_URL;
};

const API_BASE_URL = getApiBaseUrl();
export { API_BASE_URL };

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request: attach access token ─────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response: auto-refresh on 401 ────────────────────────────────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => error ? reject(error) : resolve(token));
  failedQueue = [];
};

const redirectToLogin = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('usuario');
  window.location.href = '/login';
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then(token => {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) { redirectToLogin(); return Promise.reject(error); }

    try {
      const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
      localStorage.setItem('access_token', data.access_token);
      api.defaults.headers.Authorization = `Bearer ${data.access_token}`;
      processQueue(null, data.access_token);
      original.headers.Authorization = `Bearer ${data.access_token}`;
      return api(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      redirectToLogin();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;

// ── Servicios ─────────────────────────────────────────────────────────────────

export const authService = {
  login:    (email, password) => api.post('/auth/login', { email, password }),
  registro: (datos) => api.post('/auth/registro', datos),
  me:       () => api.get('/auth/me'),
  logout:   () => api.post('/auth/logout'),
  verificarCodigo: (email, codigo) => api.post('/auth/verificar-codigo', { email, codigo }),
  reenviarCodigo:  (email, metodo_verificacion) => api.post('/auth/reenviar-codigo', { email, metodo_verificacion }),
};

export const pedidosEspecialesService = {
  crear:        (datos) => api.post('/pedidos-especiales/', datos),
  misPedidos:   () => api.get('/pedidos-especiales/mis-pedidos/'),
  cancelar:     (id) => api.post(`/pedidos-especiales/${id}/cancelar/`),
  // domiciliario
  disponibles:  () => api.get('/pedidos-especiales/disponibles/'),
  misEntregas:  () => api.get('/pedidos-especiales/mis-entregas/'),
  aceptar:      (id) => api.post(`/pedidos-especiales/${id}/aceptar/`),
  entregar:     (id) => api.post(`/pedidos-especiales/${id}/entregar/`),
};

export const clienteService = {
  // Productos guardados
  favoritos:        () => api.get('/cliente/favoritos/'),
  agregarFavorito:  (producto_id) => api.post('/cliente/favoritos/', { producto_id }),
  quitarFavorito:   (producto_id) => api.delete(`/cliente/favoritos/${producto_id}/`),

  // Direcciones
  direcciones:       () => api.get('/cliente/direcciones/'),
  agregarDireccion:  (datos) => api.post('/cliente/direcciones/', datos),
  marcarPrincipal:   (id) => api.patch(`/cliente/direcciones/${id}/principal/`),
  eliminarDireccion: (id) => api.delete(`/cliente/direcciones/${id}/`),
};

export const adminService = {
  estadisticas: () => api.get('/admin/estadisticas/'),
  obtenerSoporte:    () => api.get('/admin/configuracion/soporte'),
  actualizarSoporte: (whatsapp) => api.put('/admin/configuracion/soporte', { whatsapp }),
};

// Lectura del WhatsApp de soporte. El endpoint es público, lo usa el centro
// de ayuda de todos los perfiles (cliente, vendedor, repartidor y admin).
export const soporteService = {
  obtener: () => api.get('/admin/configuracion/soporte'),
};

export const usuariosService = {
  listar:       (params) => api.get('/usuarios/', { params }),
  obtener:      (id) => api.get(`/usuarios/${id}/`),
  cambiarEstado:(id, estado) => api.patch(`/usuarios/${id}/`, { estado: estado.toLowerCase() }),
  actualizarPerfil: (datos) => api.put('/usuarios/me/', datos),
  cambiarPassword: (passwordActual, passwordNueva) =>
    api.post('/usuarios/me/password/', { password_actual: passwordActual, password_nueva: passwordNueva }),
};

export const vendedoresService = {
  crear:        (datos) => api.post('/usuarios/vendedor/', datos),
  listar:       (params) => api.get('/usuarios/vendedores/', { params }),
  obtener:      (id) => api.get(`/usuarios/vendedores/${id}/`),
  cambiarEstado:(id, estado) => api.patch(`/usuarios/${id}/`, { estado: estado.toLowerCase() }),
};

export const productosService = {
  listar:    (negocio_id, params = {}) => api.get('/productos/', { params: { negocio_id, ...params } }),
  obtener:   (id) => api.get(`/productos/${id}`),
  crear:     (negocio_id, datos) => api.post('/productos/', datos, { params: { negocio_id } }),
  actualizar:(id, datos) => api.put(`/productos/${id}`, datos),
  eliminar:  (id) => api.delete(`/productos/${id}`),
  crearOferta:   (id, datos) => api.post(`/productos/${id}/oferta`, datos),
  cancelarOferta:(id) => api.delete(`/productos/${id}/oferta`),
  subirImagen:(file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/productos/upload-imagen', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const negociosService = {
  listarServicios: () => api.get('/negocios/', { params: { es_servicio: true, limit: 100 } }),
  listar:      (params) => api.get('/negocios/', { params }),
  miNegocio:   () => api.get('/negocios/mi-negocio'),
  obtener:     (id) => api.get(`/negocios/${id}`),
  actualizar:  (id, datos) => api.put(`/negocios/${id}`, datos),
  estadisticas:(id) => api.get(`/negocios/${id}/estadisticas`),
  productos:   (id) => api.get(`/negocios/${id}/productos`),
};

export const ordenesService = {
  listar:    (params = {}) => api.get('/ordenes/', { params }),
  obtener:   (id) => api.get(`/ordenes/${id}`),
  crear:     (datos) => api.post('/ordenes/', datos),
  actualizar:(id, datos) => api.put(`/ordenes/${id}`, datos),
  seguimiento:(id) => api.get(`/ordenes/${id}/seguimiento`),
  ubicacionDomiciliario:(id) => api.get(`/ordenes/${id}/ubicacion`),
  estadoChat:    (id) => api.get(`/ordenes/${id}/chat-estado`),
  mensajes:      (id) => api.get(`/ordenes/${id}/mensajes`),
  enviarMensaje: (id, contenido) => api.post(`/ordenes/${id}/mensajes`, { contenido }),
};

export const logsService = {
  listar: (accion) => api.get('/logs/', { params: accion && accion !== 'Todas' ? { accion } : {} }),
};

export const resenasService = {
  crear:           (datos) => api.post('/resenas/', datos),
  obtenerPorOrden: (ordenId) => api.get(`/resenas/orden/${ordenId}`),
  listarPorNegocio:(negocioId, params = {}) => api.get(`/resenas/negocio/${negocioId}`, { params }),
};