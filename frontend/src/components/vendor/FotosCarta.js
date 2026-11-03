import React, { useState } from 'react';
import BotonesFoto from '../BotonesFoto';
import Icon from '../Icons';
import { negociosService } from '../../config/api';
import { useToast } from '../../context/ToastContext';
import { urlImagen } from '../../utils/media';

// ============================================================================
// FotosCarta — en el perfil del negocio: las fotos de la carta que ve el
// cliente con "Ver la carta" (nov 2026). Se pueden agregar (hasta 4) y quitar.
// ============================================================================

const MAX = 4;

const FotosCarta = ({ negocio, onCambio }) => {
  const { addToast } = useToast();
  const [ocupado, setOcupado] = useState(false);
  const fotos = negocio?.fotos_carta || [];

  const agregar = async (archivo) => {
    setOcupado(true);
    try {
      const { data } = await negociosService.subirCarta([archivo]);
      onCambio(data);
      addToast('Foto de la carta guardada. Tus clientes ya la pueden ver.', 'success');
    } catch (e) {
      addToast(e?.response?.data?.detail || 'No se pudo subir la foto', 'error');
    } finally {
      setOcupado(false);
    }
  };

  const quitar = async (i) => {
    if (!window.confirm('¿Quitar esta foto de la carta? Tus clientes ya no la verán.')) return;
    setOcupado(true);
    try {
      const { data } = await negociosService.quitarFotoCarta(i);
      onCambio(data);
    } catch (e) {
      addToast(e?.response?.data?.detail || 'No se pudo quitar la foto', 'error');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="mt-2">
      <p className="m-0 mb-2 text-[12.5px] text-slate-500">
        Tus clientes la ven al tocar <b>"Ver la carta"</b> en tu tienda. Hasta {MAX} fotos.
      </p>
      {fotos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {fotos.map((url, i) => (
            <div key={url} className="relative overflow-hidden rounded-xl bg-slate-100 dark:bg-noche-alt">
              <img src={urlImagen(url)} alt={`Carta, página ${i + 1}`} className="block h-36 w-full object-cover" />
              <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">Página {i + 1}</span>
              <button
                type="button"
                onClick={() => quitar(i)}
                disabled={ocupado}
                className="absolute right-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0 bg-black/60 text-white"
                aria-label={`Quitar la página ${i + 1}`}
              >
                <Icon name="equis" size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      {ocupado
        ? <p className="m-0 mt-2.5 rounded-xl bg-slate-50 py-3 text-center text-[13.5px] font-bold text-slate-500 dark:bg-noche-alt">Guardando…</p>
        : fotos.length < MAX && <BotonesFoto onArchivo={agregar} />}
    </div>
  );
};

export default FotosCarta;
