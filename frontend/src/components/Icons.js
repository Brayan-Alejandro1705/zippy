import React from 'react';

// ============================================================================
// Icons.js - Íconos SVG de línea, estilo profesional.
// Uso: <Icon name="dashboard" />   |   <Icon name="config" size={22} />
// Heredan el color del texto (currentColor), así funcionan en claro y oscuro.
// ============================================================================

const PATHS = {
  dashboard: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),

  negocios: (
    <>
      <path d="M3 21h18M4 21V9m16 12V9" />
      <path d="M3 9l1.5-5h15L21 9a3 3 0 01-6 0 3 3 0 01-6 0 3 3 0 01-6 0z" />
      <path d="M10 21v-5h4v5" />
    </>
  ),

  vendedores: (
    <>
      <path d="M3 21h18M4 21v-9m16 9v-9" />
      <path d="M2.5 12h19l-1.2-6H3.7L2.5 12z" />
      <path d="M8 21v-4h4v4" />
    </>
  ),

  repartidores: (
    <>
      <circle cx="5.5" cy="17.5" r="3" />
      <circle cx="18.5" cy="17.5" r="3" />
      <path d="M8.5 17.5h7M15.5 17.5l-3-9h-2M12.5 8.5h4l2 9" />
      <path d="M6 11h4" />
    </>
  ),

  usuarios: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20a6.5 6.5 0 0113 0" />
      <path d="M16 5.2a3.2 3.2 0 010 5.6M17.5 20a6.5 6.5 0 00-2-4.7" />
    </>
  ),

  roles: (
    <>
      <path d="M12 3l7.5 3v5.5c0 4.4-3.1 8.4-7.5 9.5-4.4-1.1-7.5-5.1-7.5-9.5V6L12 3z" />
      <path d="M9.5 12l1.8 1.8L15 10" />
    </>
  ),

  logs: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4" />
      <path d="M9.5 12h6M9.5 15.5h6M9.5 8.5h2.5" />
    </>
  ),

  config: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 14.5a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5v.2a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z" />
    </>
  ),

  perfil: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20.5a7.5 7.5 0 0115 0" />
    </>
  ),

  notificaciones: (
    <>
      <path d="M18 8.5a6 6 0 10-12 0c0 6-2 7.5-2 7.5h16s-2-1.5-2-7.5z" />
      <path d="M13.7 19.5a2 2 0 01-3.4 0" />
    </>
  ),

  apariencia: (
    <>
      <path d="M12 3a9 9 0 000 18c1 0 1.8-.8 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H16a5 5 0 005-5c0-4.4-4-7-9-7z" />
      <circle cx="7.5" cy="11" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="11" cy="7" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),

  soporte: (
    <>
      <path d="M4 13v-1a8 8 0 0116 0v1" />
      <path d="M4 13h2.5v5H5a1 1 0 01-1-1v-4zM20 13h-2.5v5H19a1 1 0 001-1v-4z" />
      <path d="M17.5 18v.5a2.5 2.5 0 01-2.5 2.5h-2" />
    </>
  ),

  whatsapp: (
    <>
      <path d="M3.5 20.5l1.3-4.3A8.2 8.2 0 013.7 12a8.3 8.3 0 118.3 8.3 8.4 8.4 0 01-4-1l-4.5 1.2z" />
      <path d="M9 9.2c.2-.5.4-.5.6-.5h.5c.2 0 .4 0 .6.5l.6 1.4c.1.2 0 .4-.1.5l-.4.5c-.1.2-.2.3 0 .6a6 6 0 002.7 2.3c.3.1.4 0 .6-.1l.5-.6c.2-.2.3-.2.5-.1l1.4.7c.2.1.4.2.4.4v.5c-.1.5-.6 1-1.1 1.1-.5.1-1.1.2-3.4-.8a8 8 0 01-3.5-3.5c-.8-1.6-.5-2.4-.3-2.9z" />
    </>
  ),

  salir: (
    <>
      <path d="M9.5 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4.5" />
      <path d="M16 16l5-4-5-4M21 12H9.5" />
    </>
  ),

  cerrar: (
    <>
      <path d="M6 6l12 12M18 6L6 18" />
    </>
  ),


  bloqueado: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 6l12 12" />
    </>
  ),

  buscar: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L21 21" />
    </>
  ),

  ubicacion: (
    <>
      <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),

  calendario: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),

  paquete: (
    <>
      <path d="M20.5 7.5L12 3 3.5 7.5v9L12 21l8.5-4.5v-9z" />
      <path d="M3.5 7.5L12 12l8.5-4.5M12 12v9" />
    </>
  ),

  identificacion: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <circle cx="8.5" cy="11" r="2.2" />
      <path d="M5 16a3.6 3.6 0 017 0M14 10h4M14 13.5h4" />
    </>
  ),

  ver: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),

  check: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.2l2.4 2.4 4.6-5" />
    </>
  ),

  categorias: (
    <>
      <path d="M12 3v9l7.8 4.5A9 9 0 1012 3z" />
      <path d="M12 3a9 9 0 017.8 13.5" />
    </>
  ),

  reloj: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),

  alerta: (
    <>
      <path d="M12 4l9 15.5H3L12 4z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="16.8" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),


  carrito: (
    <>
      <path d="M2.5 3.5h2.2l2.3 11.2a1.6 1.6 0 001.6 1.3h8.6a1.6 1.6 0 001.6-1.2l1.7-6.8H6" />
      <circle cx="9.5" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
    </>
  ),

  herramientas: (
    <>
      <path d="M14.5 6.5a3.8 3.8 0 005 5l-9 9a2.1 2.1 0 01-3-3l9-9-2-2z" />
      <path d="M5.5 5.5l3 3" />
    </>
  ),

  telefono: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.4" />
      <path d="M10.5 5.5h3" />
      <circle cx="12" cy="18" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),


  correo: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),

  estrella: (
    <>
      <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8L12 3.5z" />
    </>
  ),

  descargar: (
    <>
      <path d="M12 3.5v11M7.5 10.5l4.5 4.5 4.5-4.5" />
      <path d="M4 17.5v1.5a2 2 0 002 2h12a2 2 0 002-2v-1.5" />
    </>
  ),

  rayo: (
    <>
      <path d="M13.5 2.5L4.5 13.5h6l-.5 8 9-11h-6l.5-8z" />
    </>
  ),

  llave: (
    <>
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9M18 12v3.5M15.5 12v2.5" />
    </>
  ),

  equis: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),

  luna: (
    <>
      <path d="M20 14.5A8.5 8.5 0 019.5 4 8.5 8.5 0 1020 14.5z" />
    </>
  ),

  sol: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8L6 18M18 6l1.8-1.8" />
    </>
  ),

  guardar: (
    <>
      <path d="M4.5 4.5h11L20 9v10.5a1 1 0 01-1 1H5.5a1 1 0 01-1-1v-14a1 1 0 011-1z" />
      <path d="M8 4.5v5h6v-5M8 20.5v-5.5h8v5.5" />
    </>
  ),

  reportes: (
    <>
      <path d="M3.5 20.5h17" />
      <path d="M4 15.5l5-5 3.5 3.5L20 6.5" />
      <path d="M15.5 6.5H20V11" />
    </>
  ),

  solicitudes: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M9 3.5h6v3H9zM8.5 11h7M8.5 15h4.5" />
    </>
  ),

  filtro: (
    <>
      <path d="M3.5 5.5h17l-6.5 7.5v6l-4 2v-8L3.5 5.5z" />
    </>
  ),

  dinero: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v10M14.5 9.5c0-1.1-1.1-1.8-2.5-1.8s-2.5.7-2.5 1.8c0 2.6 5 1.4 5 4 0 1.1-1.1 1.8-2.5 1.8s-2.5-.7-2.5-1.8" />
    </>
  ),

  candado: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 018 0v3.5" />
      <circle cx="12" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
};

export const Icon = ({ name, size = 20, strokeWidth = 1.7, className = '', style }) => {
  const path = PATHS[name];
  if (!path) return null;

  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {path}
    </svg>
  );
};

export default Icon;