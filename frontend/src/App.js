import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { CartProvider } from './context/CartContext';
import UserHomePage from './pages/user/UserHomePage';
import UserCartPage from './pages/user/UserCartPage';
import UserCheckoutPage from './pages/user/UserCheckoutPage';
import UserPanelPage from './pages/user/UserPanelPage';
import PedidoEspecialPage from './pages/user/PedidoEspecialPage';
import ServiciosPage from './pages/user/ServiciosPage';
import RepartidorPage from './pages/repartidor/RepartidorPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import NuevoVendedorPage from './pages/NuevoVendedorPage';
import UsuariosPage from './pages/UsuariosPage';
import UsuarioDetallePage from './pages/UsuarioDetallePage';
import ConfigPage from './pages/ConfigPage';
import VendedoresPage from './pages/VendedoresPage';
import SolicitudesPage from './pages/SolicitudesPage';
import RepartidoresPage from './pages/RepartidoresPage';
import RolesPermisosPage from './pages/RolesPermisosPage';
import LogsActividadPage from './pages/LogsActividadPage';
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

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('access_token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

const App = () => (
  <ThemeProvider>
    <ToastProvider>
      <CartProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/usuarios/:id" element={<ProtectedRoute><UsuarioDetallePage /></ProtectedRoute>} />
          <Route path="/usuarios"     element={<ProtectedRoute><UsuariosPage /></ProtectedRoute>} />
          <Route path="/vendedores/nuevo" element={<ProtectedRoute><NuevoVendedorPage /></ProtectedRoute>} />
          <Route path="/vendedores" element={<ProtectedRoute><VendedoresPage /></ProtectedRoute>} />
          <Route path="/solicitudes" element={<ProtectedRoute><SolicitudesPage /></ProtectedRoute>} />
          <Route path="/repartidores" element={<ProtectedRoute><RepartidoresPage /></ProtectedRoute>} />
          <Route path="/roles" element={<ProtectedRoute><RolesPermisosPage /></ProtectedRoute>} />
          <Route path="/logs" element={<ProtectedRoute><LogsActividadPage /></ProtectedRoute>} />
          <Route path="/config" element={<ProtectedRoute><ConfigPage /></ProtectedRoute>} />
          <Route path="/vendor/productos/nuevo"       element={<ProtectedRoute><VendorNuevoProductoPage /></ProtectedRoute>} />
          <Route path="/vendor/productos/:id/editar" element={<ProtectedRoute><VendorEditarProductoPage /></ProtectedRoute>} />
          <Route path="/vendor/productos"            element={<ProtectedRoute><VendorProductosPage /></ProtectedRoute>} />
          <Route path="/vendor/ventas"          element={<ProtectedRoute><VendorVentasPage /></ProtectedRoute>} />
          <Route path="/vendor/ordenes"   element={<ProtectedRoute><VendorOrdenesPage /></ProtectedRoute>} />
          <Route path="/vendor/reportes"  element={<ProtectedRoute><VendorReportesPage /></ProtectedRoute>} />
          <Route path="/vendor/perfil"    element={<ProtectedRoute><VendorPerfilPage /></ProtectedRoute>} />
          <Route path="/vendor/pagos"     element={<ProtectedRoute><VendorPagosPage /></ProtectedRoute>} />
          <Route path="/vendor/config"    element={<ProtectedRoute><VendorConfigPage /></ProtectedRoute>} />
          <Route path="/vendor" element={<Navigate to="/vendor/productos" replace />} />
          <Route path="/tienda"          element={<UserHomePage />} />
          <Route path="/tienda/carrito"  element={<UserCartPage />} />
          <Route path="/tienda/checkout" element={<UserCheckoutPage />} />
          <Route path="/tienda/perfil"          element={<UserPanelPage />} />
          <Route path="/tienda/pedido-especial" element={<PedidoEspecialPage />} />
          <Route path="/tienda/servicios"       element={<ServiciosPage />} />
          <Route path="/repartidor"             element={<RepartidorPage />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
      </CartProvider>
    </ToastProvider>
  </ThemeProvider>
);

export default App;
