import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { CartProvider } from './context/CartContext';
import UserHomePage from './pages/user/UserHomePage';
import BienvenidaPage from './pages/BienvenidaPage';
import AyudaPage from './pages/user/AyudaPage';
import UserCartPage from './pages/user/UserCartPage';
import UserCheckoutPage from './pages/user/UserCheckoutPage';
import UserPanelPage from './pages/user/UserPanelPage';
import PedidoEspecialPage from './pages/user/PedidoEspecialPage';
// ServiciosPage pausado — ver frontend/src/pages/user/ServiciosPage.js (queda el archivo, solo se desconectó del router)
import RepartidorPage from './pages/repartidor/RepartidorPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerificarCuentaPage from './pages/VerificarCuentaPage';
import DashboardPage from './pages/DashboardPage';
import NuevoVendedorPage from './pages/NuevoVendedorPage';
import UsuariosPage from './pages/UsuariosPage';
import UsuarioDetallePage from './pages/UsuarioDetallePage';
import ConfigPage from './pages/ConfigPage';
import VendedoresPage from './pages/VendedoresPage';
import SolicitudesPage from './pages/SolicitudesPage';
import ValidacionPage from './pages/ValidacionPage';
import RepartidoresPage from './pages/RepartidoresPage';
import RepartidorDomiciliosPage from './pages/RepartidorDomiciliosPage';
import NuevoRepartidorPage from './pages/NuevoRepartidorPage';
import RecuperarPasswordPage from './pages/RecuperarPasswordPage';
import CompletarTelefonoPage from './pages/CompletarTelefonoPage';
import RolesPermisosPage from './pages/RolesPermisosPage';
import LogsActividadPage from './pages/LogsActividadPage';
import NegociosPage from './pages/NegociosPage';
import VendorProductosPage from './pages/vendor/VendorProductosPage';
import VendorNuevoProductoPage from './pages/vendor/VendorNuevoProductoPage';
import VendorEditarProductoPage from './pages/vendor/VendorEditarProductoPage';
import VendorVentasPage from './pages/vendor/VendorVentasPage';
import VendorOrdenesPage from './pages/vendor/VendorOrdenesPage';
import VendorReportesPage from './pages/vendor/VendorReportesPage';
import VendorPerfilPage from './pages/vendor/VendorPerfilPage';
import VendorPagosPage from './pages/vendor/VendorPagosPage';
import VendorConfigPage from './pages/vendor/VendorConfigPage';
import './App.css';
import './styles/dark-theme.css';
import BackButtonHandler from './components/BackButtonHandler';
import UpdateGate from './components/UpdateGate';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('access_token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

// Pantallas de un solo tipo de cuenta. Si la cuenta activa es de otro tipo
// (por ejemplo, despues de cambiar de super admin a cliente) se manda a su
// propio inicio en vez de mostrarle un panel que no es suyo.
const SoloRol = ({ roles, children }) => {
  if (!localStorage.getItem('access_token')) return <Navigate to="/login" replace />;
  const tipo = getStoredTipoUsuario() || 'cliente';
  if (!roles.includes(tipo)) return <Navigate to={homeRouteFor(tipo)} replace />;
  return children;
};
const Admin = ({ children }) => <SoloRol roles={['admin']}>{children}</SoloRol>;
const Vendedor = ({ children }) => <SoloRol roles={['vendedor']}>{children}</SoloRol>;
const Repartidor = ({ children }) => <SoloRol roles={['domiciliario']}>{children}</SoloRol>;

// ── Persistencia de sesión ───────────────────────────────────────────────────
// Si ya hay un token guardado (login previo), la persona no debe ver el login
// otra vez al cerrar y volver a abrir la app: se manda directo a su pantalla.
const homeRouteFor = (tipo) => {
  if (tipo === 'admin')        return '/dashboard';
  if (tipo === 'vendedor')     return '/vendor/productos';
  if (tipo === 'domiciliario') return '/repartidor';
  return '/tienda';
};

const isAuthenticated = () => !!localStorage.getItem('access_token');

const getStoredTipoUsuario = () => {
  try {
    return JSON.parse(localStorage.getItem('usuario') || '{}').tipo_usuario;
  } catch {
    return undefined;
  }
};

// Ruta raíz ("/"): si ya hay sesión, va directo a la pantalla correspondiente;
// si no, al login.
const RootRedirect = () => {
  if (isAuthenticated()) {
    return <Navigate to={homeRouteFor(getStoredTipoUsuario())} replace />;
  }
  // Sin sesion, lo primero es la bienvenida: crear cuenta o entrar. Desde ahi
  // se puede seguir a la tienda sin cuenta, porque Apple (5.1.1) no permite
  // exigir registro para ver negocios y productos, solo para pedir.
  return <Navigate to="/bienvenida" replace />;
};

// Evita que alguien ya logueado vuelva a ver la pantalla de login/registro.
// Excepción: si viene con ?agregar=1 es porque está añadiendo otra cuenta al
// selector de cuentas a propósito, así que sí debe ver el formulario.
const vieneAAgregarCuenta = () =>
  new URLSearchParams(window.location.search).get('agregar') === '1';

const PublicOnlyRoute = ({ children }) => {
  if (isAuthenticated() && !vieneAAgregarCuenta()) {
    return <Navigate to={homeRouteFor(getStoredTipoUsuario())} replace />;
  }
  return children;
};

const App = () => (
  <ThemeProvider>
    <UpdateGate />
    <ToastProvider>
      <CartProvider>
      <BrowserRouter>
        <BackButtonHandler />
        <Routes>
          <Route path="/bienvenida" element={<PublicOnlyRoute><BienvenidaPage /></PublicOnlyRoute>} />
          <Route path="/login"    element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
          <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
          <Route path="/verificar" element={<VerificarCuentaPage />} />
          <Route path="/recuperar" element={<RecuperarPasswordPage />} />
          <Route path="/completar-telefono" element={<ProtectedRoute><CompletarTelefonoPage /></ProtectedRoute>} />
          <Route path="/dashboard" element={<Admin><DashboardPage /></Admin>} />
          <Route path="/usuarios/:id" element={<Admin><UsuarioDetallePage /></Admin>} />
          <Route path="/usuarios"     element={<Admin><UsuariosPage /></Admin>} />
          <Route path="/vendedores/nuevo" element={<Admin><NuevoVendedorPage /></Admin>} />
          <Route path="/vendedores" element={<Admin><VendedoresPage /></Admin>} />
          <Route path="/solicitudes" element={<Admin><SolicitudesPage /></Admin>} />
          <Route path="/validacion" element={<Admin><ValidacionPage /></Admin>} />
          <Route path="/negocios"    element={<Admin><NegociosPage /></Admin>} />
          <Route path="/repartidores" element={<Admin><RepartidoresPage /></Admin>} />
          <Route path="/repartidores/nuevo" element={<Admin><NuevoRepartidorPage /></Admin>} />
          <Route path="/repartidores/:id/domicilios" element={<Admin><RepartidorDomiciliosPage /></Admin>} />
          <Route path="/roles" element={<Admin><RolesPermisosPage /></Admin>} />
          <Route path="/logs" element={<Admin><LogsActividadPage /></Admin>} />
          <Route path="/config" element={<Admin><ConfigPage /></Admin>} />
          <Route path="/vendor/productos/nuevo"       element={<Vendedor><VendorNuevoProductoPage /></Vendedor>} />
          <Route path="/vendor/productos/:id/editar" element={<Vendedor><VendorEditarProductoPage /></Vendedor>} />
          <Route path="/vendor/productos"            element={<Vendedor><VendorProductosPage /></Vendedor>} />
          <Route path="/vendor/ventas"          element={<Vendedor><VendorVentasPage /></Vendedor>} />
          <Route path="/vendor/ordenes"   element={<Vendedor><VendorOrdenesPage /></Vendedor>} />
          <Route path="/vendor/reportes"  element={<Vendedor><VendorReportesPage /></Vendedor>} />
          <Route path="/vendor/perfil"    element={<Vendedor><VendorPerfilPage /></Vendedor>} />
          <Route path="/vendor/pagos"     element={<Vendedor><VendorPagosPage /></Vendedor>} />
          <Route path="/vendor/config"    element={<Vendedor><VendorConfigPage /></Vendedor>} />
          <Route path="/vendor" element={<Navigate to="/vendor/productos" replace />} />
          <Route path="/tienda"          element={<UserHomePage />} />
          <Route path="/tienda/carrito"  element={<UserCartPage />} />
          <Route path="/tienda/checkout" element={<UserCheckoutPage />} />
          <Route path="/tienda/perfil"          element={<UserPanelPage />} />
          <Route path="/tienda/pedidos"         element={<UserPanelPage vista="pedidos" />} />
          <Route path="/tienda/ayuda"           element={<AyudaPage />} />
          <Route path="/tienda/pedido-especial" element={<PedidoEspecialPage />} />
          <Route path="/repartidor"             element={<Repartidor><RepartidorPage /></Repartidor>} />
          <Route path="/" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
      </CartProvider>
    </ToastProvider>
  </ThemeProvider>
);

export default App;