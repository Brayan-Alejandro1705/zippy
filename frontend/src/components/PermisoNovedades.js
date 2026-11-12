import React, { useState, useEffect } from 'react';
import { avisosService } from '../config/api';

// ============================================================================
// PermisoNovedades — "¿Te avisamos de lo nuevo?" (nov 2026).
//
// Apple (regla 4.5.4) y Google piden permiso explícito antes de mandar
// avisos de propaganda. Se pregunta una sola vez, al cliente con sesión y
// solo si nunca ha respondido (acepta_novedades = null en el servidor). Lo
// puede cambiar después en Perfil → Cuenta → Avisos.
// ============================================================================

const YA_SE_VIO = 'novedades_preguntado';

const PermisoNovedades = () => {
  const [ver, setVer] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('access_token')) return;
    try { if (sessionStorage.getItem(YA_SE_VIO)) return; } catch { /* sin almacenamiento */ }
    let activo = true;
    // Un momento después de abrir: que primero vea la tienda
    const t = setTimeout(() => {
      avisosService.miPreferencia()
        .then(({ data }) => { if (activo && data && data.acepta === null) setVer(true); })
        .catch(() => {});
    }, 2500);
    return () => { activo = false; clearTimeout(t); };
  }, []);

  const responder = async (acepta) => {
    setEnviando(true);
    try { sessionStorage.setItem(YA_SE_VIO, '1'); } catch { /* sin almacenamiento */ }
    try { await avisosService.cambiarPreferencia(acepta); } catch { /* se vuelve a preguntar otro día */ }
    setVer(false);
    setEnviando(false);
  };

  if (!ver) return null;
  return (
    <div className="fixed inset-0 z-[650] flex items-center justify-center bg-slate-900/55 px-4" role="dialog" aria-label="Avisos de novedades">
      <div className="w-full max-w-[360px] rounded-[22px] bg-white p-5 text-center shadow-[0_20px_50px_rgba(0,0,0,0.3)] dark:bg-noche-card">
        <div className="mx-auto mb-2.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-zippy dark:bg-zippy/15">
          <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 003.4 0" /></svg>
        </div>
        <b className="block text-[18px] text-slate-800 dark:text-slate-100">¿Te avisamos de lo nuevo?</b>
        <p className="m-0 mb-4 mt-2 text-[13.5px] leading-snug text-slate-500 dark:text-slate-400">
          Negocios que llegan a ZIPPYGO y promociones de Garzón. Pocas veces, nunca más de una al día. Lo cambias cuando quieras en tu perfil.
        </p>
        <button type="button" disabled={enviando} onClick={() => responder(true)} className="w-full cursor-pointer rounded-2xl border-0 bg-zippy p-3.5 font-[inherit] text-[15px] font-extrabold text-white shadow-[0_6px_18px_rgba(255,122,0,0.3)]">
          Sí, avísame
        </button>
        <button type="button" disabled={enviando} onClick={() => responder(false)} className="mt-1.5 w-full cursor-pointer rounded-2xl border-0 bg-transparent p-3 font-[inherit] text-[15px] font-extrabold text-slate-500">
          Ahora no
        </button>
      </div>
    </div>
  );
};

export default PermisoNovedades;
