import React, { useRef } from 'react';
import Icon from './Icons';

// ============================================================================
// BotonesFoto — "Tomar foto" y "Elegir de la galería" (oct 2026).
//
// Antes habia un solo recuadro que abria el selector de archivos. En el
// celular eso iba casi siempre a la galeria, y el negocio que queria tomarle
// la foto al producto en ese momento tenia que salir de la app, tomarla con la
// camara y volver a buscarla.
//
// "Tomar foto" usa capture="environment": el celular abre directo la camara
// de atras. Los permisos de camara ya estan declarados en Android
// (AndroidManifest) y en iPhone (NSCameraUsageDescription, ver build-ios.yml).
// ============================================================================

const boton = 'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-[1.5px] border-solid px-3 py-3 font-[inherit] text-[14px] font-extrabold transition-colors active:translate-y-px';

const BotonesFoto = ({ onArchivo, hayFoto = false }) => {
  const camara = useRef(null);
  const galeria = useRef(null);

  const elegido = (e) => {
    const archivo = e.target.files && e.target.files[0];
    if (archivo) onArchivo(archivo);
    // Se limpia para que elegir la misma foto otra vez tambien funcione
    e.target.value = '';
  };

  return (
    <div className="mt-2.5 flex gap-2.5">
      <button
        type="button"
        className={`${boton} border-zippy bg-zippy text-white hover:bg-zippy-600`}
        onClick={() => camara.current && camara.current.click()}
      >
        <Icon name="camara" size={19} /> {hayFoto ? 'Tomar otra' : 'Tomar foto'}
      </button>
      <button
        type="button"
        className={`${boton} border-zippy bg-transparent text-zippy hover:bg-zippy-50 dark:hover:bg-noche-alt`}
        onClick={() => galeria.current && galeria.current.click()}
      >
        <Icon name="galeria" size={19} /> {hayFoto ? 'Elegir otra' : 'De la galería'}
      </button>
      <input ref={camara} type="file" accept="image/*" capture="environment" className="hidden" onChange={elegido} />
      <input ref={galeria} type="file" accept="image/*" className="hidden" onChange={elegido} />
    </div>
  );
};

export default BotonesFoto;
