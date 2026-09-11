import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { adminService } from '../config/api';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.zippygo.app';
const CLAVE_DESCARTADA = 'zippy_update_dismissed_version';

// En cada apertura, revisa contra el backend cual es la ultima version
// (version_minima) que el super admin publico y compara contra la version
// instalada (el versionCode nativo de Android). Hay dos niveles:
//
//   1) Si la version instalada quedo desactualizada, se muestra un boton
//      flotante "Actualizar app" (no bloquea nada, se puede descartar).
//   2) Si ademas el super admin marco la actualizacion como obligatoria,
//      se bloquea toda la pantalla hasta que la persona actualice.
//
// Solo aplica dentro de la app nativa de Android (en el navegador/escritorio
// no hay versionCode que comparar). Si la verificacion falla (sin internet,
// backend caido), no bloquea ni avisa a nadie: es mejor dejar usar la app
// que tumbarla por un fallo de red.
const UpdateGate = () => {
  const [bloqueado, setBloqueado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [mostrarBoton, setMostrarBoton] = useState(false);
  const [versionMinima, setVersionMinima] = useState(null);

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
        const hayActualizacion =
          versionInstalada > 0 && versionInstalada < data.version_minima;

        if (!activo || !hayActualizacion) return;

        if (data?.obligatoria) {
          setMensaje(data.mensaje);
          setBloqueado(true);
          return;
        }

        // Actualizacion disponible pero no obligatoria: aviso descartable.
        // Se guarda cual version se descarto para no volver a molestar con
        // la misma version en cada apertura, pero si sale una version mas
        // nueva todavia, el aviso vuelve a aparecer.
        const descartada = parseInt(localStorage.getItem(CLAVE_DESCARTADA), 10) || 0;
        if (descartada < data.version_minima) {
          setVersionMinima(data.version_minima);
          setMostrarBoton(true);
        }
      } catch {
        // Sin conexion o backend caido: no se bloquea, se deja usar la app.
      }
    })();

    return () => { activo = false; };
  }, []);

  const descartarAviso = () => {
    if (versionMinima) localStorage.setItem(CLAVE_DESCARTADA, String(versionMinima));
    setMostrarBoton(false);
  };

  if (bloqueado) {
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
  }

  if (!mostrarBoton) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        zIndex: 999998,
        background: '#1e1e24',
        color: '#fff',
        borderRadius: 16,
        padding: '12px 12px 12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        maxWidth: 420,
        margin: '0 auto',
      }}
    >
      <span style={{ fontSize: 22, flexShrink: 0 }}>🚀</span>
      <span style={{ flex: 1, fontSize: 13.5, lineHeight: 1.4 }}>
        Hay una nueva versión de Zippy disponible
      </span>
      <a
        href={PLAY_STORE_URL}
        onClick={descartarAviso}
        style={{
          background: '#FF7A00',
          color: '#fff',
          padding: '9px 16px',
          borderRadius: 999,
          fontWeight: 700,
          textDecoration: 'none',
          fontSize: 13,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Actualizar
      </a>
      <button
        onClick={descartarAviso}
        aria-label="Cerrar aviso de actualización"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#9a9aa2',
          fontSize: 18,
          lineHeight: 1,
          cursor: 'pointer',
          padding: 4,
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
};

export default UpdateGate;
