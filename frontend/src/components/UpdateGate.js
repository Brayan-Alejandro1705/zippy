import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { adminService } from '../config/api';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.zippygo.app';

// En cada apertura, revisa si el super admin marco una actualizacion como
// obligatoria y si la version instalada quedo por debajo de la minima
// requerida. Si es asi, bloquea toda la pantalla hasta que la persona
// actualice desde Play Store. Solo aplica dentro de la app nativa de
// Android (en el navegador/escritorio no hay versionCode que comparar).
// Si la verificacion falla (sin internet, backend caido), no bloquea a
// nadie: es mejor dejar usar la app que tumbarla por un fallo de red.
const UpdateGate = () => {
  const [bloqueado, setBloqueado] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let activo = true;

    (async () => {
      try {
        const [{ data }, info] = await Promise.all([
          adminService.obtenerActualizacion(),
          CapacitorApp.getInfo(),
        ]);

        const versionInstalada = parseInt(info?.build, 10) || 0;

        if (
          activo &&
          data?.obligatoria &&
          versionInstalada > 0 &&
          versionInstalada < data.version_minima
        ) {
          setMensaje(data.mensaje);
          setBloqueado(true);
        }
      } catch {
        // Sin conexion o backend caido: no se bloquea, se deja usar la app.
      }
    })();

    return () => { activo = false; };
  }, []);

  if (!bloqueado) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(12, 12, 16, 0.97)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 44, marginBottom: 16 }}>⬆️</div>
      <h2 style={{ color: '#fff', margin: '0 0 12px', fontSize: 20 }}>
        Actualización requerida
      </h2>
      <p style={{ color: '#d8d8dc', maxWidth: 360, marginBottom: 28, lineHeight: 1.55, fontSize: 15 }}>
        {mensaje}
      </p>
      <a
        href={PLAY_STORE_URL}
        style={{
          background: '#ffffff',
          color: '#111111',
          padding: '14px 30px',
          borderRadius: 999,
          fontWeight: 700,
          textDecoration: 'none',
          fontSize: 15,
        }}
      >
        Actualizar ahora
      </a>
    </div>
  );
};

export default UpdateGate;
