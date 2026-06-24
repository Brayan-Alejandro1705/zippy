import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
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
      const { data } = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, { refresh: refreshToken });
      localStorage.setItem('access_token', data.access);
      api.defaults.headers.Authorization = `Bearer ${data.access}`;
      processQueue(null, data.access);
      original.headers.Authorization = `Bearer ${data.access}`;
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
};

export const adminService = {
  estadisticas: () => api.get('/admin/estadisticas/'),
};

export const usuariosService = {
  listar:       (params) => api.get('/usuarios/', { params }),
  obtener:      (id) => api.get(`/usuarios/${id}/`),
  cambiarEstado:(id, estado) => api.patch(`/usuarios/${id}/`, { estado }),
  actualizarPerfil: (datos) => api.put('/usuarios/me/', datos),
};

export const vendedoresService = {
  crear:        (datos) => api.post('/usuarios/vendedor/', datos),
  listar:       (params) => api.get('/usuarios/vendedores/', { params }),
  obtener:      (id) => api.get(`/usuarios/vendedores/${id}/`),
  cambiarEstado:(id, estado) => api.patch(`/usuarios/${id}/`, { estado }),
};

export const productosService = {
  listar:    (negocio_id, params = {}) => api.get('/productos/', { params: { negocio_id, ...params } }),
  obtener:   (id) => api.get(`/productos/${id}`),
  crear:     (negocio_id, datos) => api.post('/productos/', datos, { params: { negocio_id } }),
  actualizar:(id, datos) => api.put(`/productos/${id}`, datos),
  eliminar:  (id) => api.delete(`/productos/${id}`),
  subirImagen:(file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/productos/upload-imagen', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const negociosService = {
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
};

export const resenasService = {
  crear:           (datos) => api.post('/resenas/', datos),
  obtenerPorOrden: (ordenId) => api.get(`/resenas/orden/${ordenId}`),
  listarPorNegocio:(negocioId, params = {}) => api.get(`/resenas/negocio/${negocioId}`, { params }),
};
