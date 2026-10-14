import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import GlobalSearch from './GlobalSearch';
import Icon from './Icons';
import { getMatrix } from '../utils/permissions';
import { olvidarCuenta } from '../utils/cuentas';
import AccountSwitcher from './AccountSwitcher';
import { cx } from '../ui/tw';
import '../styles/Dashboard.css';
import '../styles/dark-theme.css';
import { useCerrarConAtras } from '../utils/atras';

// permId: null = siempre visible, string = requiere ese permiso
const NAV = [
  { path: '/dashboard',    icon: 'dashboard',    label: 'Dashboard',    permId: null          },
  { path: '/negocios',     icon: 'negocios',     label: 'Negocios',     permId: null          },
  { path: '/validacion',   icon: 'check',        label: 'Validación',   permId: null          },
  { path: '/vendedores',   icon: 'vendedores',   label: 'Vendedores',   permId: 'vendedores'  },
  { path: '/repartidores', icon: 'repartidores', label: 'Repartidores', permId: 'repartidores'},
  { path: '/usuarios',     icon: 'usuarios',     label: 'Usuarios',     permId: 'usuarios'    },
  { path: '/roles',        icon: 'roles',        label: 'Roles',        permId: 'roles'       },
  { path: '/logs',         icon: 'logs',         label: 'Logs',         permId: 'logs'        },
  { path: '/config',       icon: 'config',       label: 'Config',       permId: 'config'      },
];

const BOTTOM_NAV = [
  { path: '/dashboard',  icon: 'dashboard',  label: 'Inicio'    , permId: null         },
  { path: '/vendedores', icon: 'vendedores', label: 'Vendedores', permId: 'vendedores' },
  { path: '/negocios',   icon: 'negocios',   label: 'Negocios'  , permId: null         },
  { path: '/usuarios',   icon: 'usuarios',   label: 'Usuarios'  , permId: 'usuarios'   },
];

const canSee = (permId, rolKey, matrix) => {
  if (!permId) return true;
  if (rolKey === 'super_admin') return true;
  return matrix[rolKey]?.[permId] ?? false;
};

const getRolKey = (usuario) => {
  if (usuario.es_super_admin) return 'super_admin';
  if (usuario.tipo_usuario === 'admin') return 'admin';
  return 'sin_rol';
};

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  useCerrarConAtras(menuOpen, () => setMenuOpen(false));
  const [showPwBanner, setShowPwBanner] = useState(
    () => !sessionStorage.getItem('pw_banner_dismissed')
  );

  const usuario  = JSON.parse(localStorage.getItem('usuario') || '{}');
  const matrix   = getMatrix();
  const rolKey   = getRolKey(usuario);

  const dismissPwBanner = () => {
    sessionStorage.setItem('pw_banner_dismissed', '1');
    setShowPwBanner(false);
  };

  const irACambiarPassword = () => {
    dismissPwBanner();
    navigate('/config');
  };

  const visibleNav    = NAV.filter(({ permId }) => canSee(permId, rolKey, matrix));
  const visibleBottom = BOTTOM_NAV.filter(({ permId }) => canSee(permId, rolKey, matrix));

  const handleLogout = () => {
    if (!window.confirm('¿Seguro que quieres cerrar sesión?')) return;
    olvidarCuenta(usuario.id);
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('usuario');
    navigate('/login');
  };

  const isActive = (path) => {
    if (path === '/usuarios')   return location.pathname.startsWith('/usuarios');
    if (path === '/vendedores') return location.pathname.startsWith('/vendedores');
    return location.pathname === path;
  };

  // Clases del menu lateral (PC) y del menu desplegable (celular)
  const itemMenu = (activo) => cx(
    'mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm no-underline transition-colors',
    activo ? 'bg-zippy font-semibold text-white' : 'text-[#bdc3c7] hover:bg-zippy/15 hover:text-zippy dark:text-slate-400'
  );
  const itemDrawer = (activo) => cx(
    'flex items-center gap-3 border-0 border-b border-solid border-white/5 px-5 py-4 text-[15px] no-underline transition-colors',
    activo ? 'bg-zippy font-semibold text-white' : 'text-[#bdc3c7]'
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#f0f2f5] dark:bg-noche">
      {/* Encabezado. En el celular se dibuja detras de la barra de estado (la
          hora, la bateria): el naranja llega hasta arriba pero el contenido
          baja lo que mida esa barra. */}
      <header className="sticky top-0 z-[100] box-border bg-zippy px-3 pt-[env(safe-area-inset-top)] shadow-[0_2px_8px_rgba(0,0,0,0.1)] xs:px-4 md:px-6">
        <div className="mx-auto flex h-[58px] w-full max-w-[1600px] items-center gap-2.5 xs:gap-3 md:h-[68px] md:gap-10">
          <Link to="/dashboard" className="flex shrink-0 items-center md:min-w-[200px]" aria-label="Inicio">
            <img src="/logo-zippy.jpeg" alt="Zippy Go" className="h-9 w-auto rounded-md object-contain" />
          </Link>
          <div className="header-search min-w-0 flex-1">
            <GlobalSearch />
          </div>
          <div className="header-right flex shrink-0 items-center gap-1">
            <AccountSwitcher variant="header" />
            <button
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] border-0 bg-transparent p-0 text-white md:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Abrir menú"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Menu desplegable del celular */}
      {menuOpen && (
        <div className="fixed inset-0 z-[999] bg-black/50 md:hidden" onClick={() => setMenuOpen(false)}>
          <div
            className="absolute right-0 top-0 box-border flex h-full w-3/4 max-w-[280px] flex-col overflow-y-auto bg-[#2c3e50] pb-[env(safe-area-inset-bottom)] dark:bg-noche-card"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-zippy px-4 pb-4 pt-[calc(16px+env(safe-area-inset-top))] text-white">
              <img src="/logo-zippy.jpeg" alt="Zippy Go" className="h-8 w-auto rounded-md object-contain" />
              <button className="cursor-pointer border-0 bg-transparent p-1 text-white" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú">
                <Icon name="cerrar" size={20} />
              </button>
            </div>
            {visibleNav.map(({ path, icon, label }) => (
              <Link key={path} to={path} className={itemDrawer(isActive(path))} onClick={() => setMenuOpen(false)}>
                <span className="inline-flex"><Icon name={icon} size={20} /></span> {label}
              </Link>
            ))}

            <AccountSwitcher variant="drawer" />

            <button
              className="m-4 mt-auto cursor-pointer rounded-lg border-0 bg-[#c0392b] p-3.5 text-[15px] font-semibold text-white"
              onClick={handleLogout}
            >
              <span className="mr-1.5 inline-flex align-[-4px]"><Icon name="salir" size={20} /></span> Cerrar sesión
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col md:flex-row">
        {/* Menu lateral de PC */}
        <aside className="hidden w-[200px] shrink-0 flex-col bg-[#2c3e50] py-5 shadow-[2px_0_8px_rgba(0,0,0,0.1)] dark:bg-[#0f1a2b] md:flex">
          <div className="flex-1 px-3">
            <div className="mb-4 px-3 text-xs font-semibold tracking-wider text-[#7f8c8d]">MENÚ</div>
            {visibleNav.map(({ path, icon, label }) => (
              <Link key={path} to={path} className={itemMenu(isActive(path))}>
                <span className="inline-flex"><Icon name={icon} size={20} /></span> {label}
              </Link>
            ))}
          </div>
          <button
            className="mx-3 mt-4 flex cursor-pointer items-center gap-3 rounded-lg border-0 bg-transparent px-3 py-2.5 text-sm text-[#e74c3c] hover:bg-[#e74c3c]/10"
            onClick={handleLogout}
          >
            <span className="inline-flex"><Icon name="salir" size={20} /></span> Cerrar sesión
          </button>
        </aside>

        {/* El relleno de abajo deja libre la barra inferior y la rayita de inicio */}
        <main className="dashboard-content box-border min-w-0 flex-1 p-4 pb-[calc(80px+env(safe-area-inset-bottom))] xs:p-4 xs:pb-[calc(80px+env(safe-area-inset-bottom))] md:p-8">
          {showPwBanner && (
            <div className="pw-banner">
              <span><Icon name="candado" size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} /> Por seguridad, te recomendamos cambiar tu contraseña.</span>
              <div className="pw-banner-actions">
                <button className="pw-banner-btn pw-banner-btn--primary" onClick={irACambiarPassword}>Cambiar ahora</button>
                <button className="pw-banner-btn" onClick={dismissPwBanner}>Ahora no</button>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Barra de abajo del celular */}
      <nav className="fixed inset-x-0 bottom-0 z-[100] box-border flex h-[calc(64px+env(safe-area-inset-bottom))] border-0 border-t border-solid border-white/10 bg-[#2c3e50] pb-[env(safe-area-inset-bottom)] dark:bg-noche-card md:hidden">
        {visibleBottom.map(({ path, icon, label }) => {
          const activo = isActive(path);
          return (
            <Link
              key={path}
              to={path}
              className={cx('flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 no-underline transition-colors', activo ? 'text-zippy' : 'text-[#7f8c8d] dark:text-slate-400')}
            >
              <span className="inline-flex"><Icon name={icon} size={22} /></span>
              <span className="max-w-full truncate text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default Layout;