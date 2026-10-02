import React, { useState, useEffect } from 'react';
import ZLoader from './ZLoader';

// ============================================================================
// PantallaCarga — pantalla de espera con la marca.
//
// El servidor gratuito se duerme y la primera carga puede tardar casi un
// minuto; antes se veia una pantalla casi en blanco. Ahora se ve el logo y,
// si tarda, un aviso para que el cliente no crea que la app esta rota.
// ============================================================================

const PantallaCarga = ({ texto = 'Cargando…' }) => {
  const [lento, setLento] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLento(true), 6000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 14, padding: '60px 24px', minHeight: '55vh', textAlign: 'center',
    }}>
      <img
        src="/logo-zippy.jpeg" alt="ZIPPYGO"
        style={{ width: 120, height: 'auto', objectFit: 'contain', borderRadius: 16 }}
      />
      <ZLoader size="sm" label={texto} />
      {lento && (
        <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, maxWidth: 260, lineHeight: 1.45 }}>
          Esto está tardando más de lo normal. Estamos despertando el servidor, dale unos segundos.
        </p>
      )}
    </div>
  );
};

export default PantallaCarga;
