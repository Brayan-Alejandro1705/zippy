import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icons';
import { viajesService } from '../config/api';

// ============================================================================
// BannerMoto — entrada a "Pide un viaje" (moto o carro) en el inicio del cliente (oct 2026).
// Solo aparece si el súper admin encendió el servicio. Si el cliente ya tiene
// un viaje andando, en vez de invitar a pedir le dice cómo va.
// ============================================================================

const VIVOS = { buscando: 'Buscando tu conductor…', aceptado: 'Tu conductor va en camino', llego: 'Tu conductor llegó', en_viaje: 'Estás en viaje' };

const BannerMoto = ({ className = '' }) => {
  const navigate = useNavigate();
  const [servicio, setServicio] = useState(null);
  const [viaje, setViaje] = useState(null);

  useEffect(() => {
    let activo = true;
    viajesService.servicio().then(({ data }) => { if (activo) setServicio(data); }).catch(() => {});
    if (localStorage.getItem('access_token')) {
      viajesService.mio().then(({ data }) => { if (activo) setViaje(data.viaje); }).catch(() => {});
    }
    return () => { activo = false; };
  }, []);

  if (!servicio?.activo) return null;
  const enCurso = viaje && VIVOS[viaje.estado];
  const moto = servicio.tipos?.moto?.activo;
  const carro = servicio.tipos?.carro?.activo;
  const invitacion = moto && carro ? '¿Necesitas moverte? Pide moto o carro' : carro ? '¿Necesitas moverte? Pide un carro' : '¿Necesitas moverte? Pide una moto';
  const icono = enCurso ? (viaje.tipo_vehiculo === 'carro' ? 'carro' : 'moto') : (carro && !moto ? 'carro' : 'moto');

  return (
    <button
      type="button"
      onClick={() => navigate('/tienda/moto')}
      className={`flex w-full cursor-pointer items-center gap-3.5 rounded-2xl border-0 bg-slate-800 px-4 py-3.5 text-left font-[inherit] text-white shadow-[0_6px_20px_rgba(15,23,42,0.18)] dark:bg-noche-card dark:ring-1 dark:ring-noche-borde ${className}`}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zippy"><Icon name={icono} size={28} /></span>
      <span className="min-w-0 flex-1">
        <b className="block text-[15.5px] font-extrabold">{enCurso ? VIVOS[viaje.estado] : invitacion}</b>
        <span className="block text-[12.5px] text-white/70">
          {enCurso
            ? 'Toca para ver tu viaje'
            : servicio.conductores_en_linea > 0
              ? `${servicio.conductores_en_linea} conductor${servicio.conductores_en_linea === 1 ? '' : 'es'} en línea en Garzón`
              : 'Conductores independientes de Garzón'}
        </span>
      </span>
      <span className="text-xl text-zippy">→</span>
    </button>
  );
};

export default BannerMoto;
