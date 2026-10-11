import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Icon from './Icons';
import { registrarPush } from '../utils/push';
import { contenedor, Encabezado, Logo, botonEncabezado, Buscador, contenido, BarraInferior, ItemBarra } from './layout/piezas';

// Secciones del panel de vendedor. Ojo: estas rutas son /vendor/*, NO /tienda/*.
// Antes este archivo era una copia literal de UserLayout, asi que el vendedor
// veia la barra del cliente y las paginas de ordenes, ventas, pagos, reportes,
// perfil y configuracion no tenian NINGUN enlace que llevara a ellas.
const NAV_ITEMS = [
  { path: '/vendor/productos', icon: 'paquete',     label: 'Productos' },
  { path: '/vendor/ordenes',   icon: 'solicitudes', label: 'Órdenes'   },
  { path: '/vendor/ventas',    icon: 'dinero',      label: 'Ventas'    },
  { path: '/vendor/pagos',     icon: 'billete',     label: 'Pagos'     },
  { path: '/vendor/reportes',  icon: 'reportes',    label: 'Reportes'  },
];

const VendorLayout = ({ children, onSearch, searchPlaceholder = 'Buscar...' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');

  useEffect(() => { registrarPush(); }, []);

  // startsWith para que /vendor/productos/nuevo siga marcando "Productos"
  const activeNav =
    NAV_ITEMS.find(n => location.pathname.startsWith(n.path))?.path || '/vendor/productos';

  return (
    <div className={contenedor}>
      <Encabezado>
        <Logo onClick={() => navigate('/vendor/productos')} />

        {/* La barra de busqueda solo se muestra si la pagina realmente la usa.
            Antes salia en todas, pero solo Productos escucha onSearch, asi que
            en el resto era un campo muerto. */}
        {onSearch ? (
          <Buscador
            placeholder={searchPlaceholder}
            value={query}
            onChange={e => { setQuery(e.target.value); onSearch(e.target.value); }}
          />
        ) : (
          <div className="flex-1" />
        )}

        {/* Configuracion y Perfil van siempre en el encabezado: la barra de
            abajo del negocio ya lleva otras cinco secciones. */}
        <button className={botonEncabezado} onClick={() => navigate('/vendor/config')} title="Configuración" aria-label="Configuración">
          <Icon name="config" size={20} />
        </button>
        <button className={botonEncabezado} onClick={() => navigate('/vendor/perfil')} title="Perfil de mi negocio" aria-label="Perfil de mi negocio">
          <Icon name="perfil" size={20} />
        </button>
      </Encabezado>

      {/* px-3/xs:px-4: margen a los lados en celular. Antes era 0 y todo el
          panel del negocio quedaba pegado a los bordes de la pantalla. */}
      <main className={`${contenido} px-3 pt-4 xs:px-4 md:px-8 md:pt-6`} style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
        {children}
      </main>

      <BarraInferior enPC>
        {NAV_ITEMS.map(item => (
          <ItemBarra
            key={item.path}
            activo={activeNav === item.path}
            icono={item.icon}
            etiqueta={item.label}
            onClick={() => navigate(item.path)}
          />
        ))}
      </BarraInferior>
    </div>
  );
};

export default VendorLayout;