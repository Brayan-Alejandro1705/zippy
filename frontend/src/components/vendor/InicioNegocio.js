import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../Icons';
import { negociosService } from '../../config/api';
import { compartir, enlaceTienda } from '../../utils/compartir';
import { cx } from '../../ui/tw';

// ============================================================================
// InicioNegocio — lo de arriba en "Mis Productos" (nov 2026):
//  - Aviso si falta la ubicación o el horario (si el súper admin lo exige, la
//    tienda sale cerrada mientras tanto).
//  - "Primeros pasos": lista con avance para el negocio nuevo, con pedido de
//    prueba y el video de 2 minutos.
//  - "Comparte tu tienda" por WhatsApp o Facebook.
// ============================================================================

// Video "Cómo vender en ZIPPYGO" (2 min). Está en el almacenamiento público.
export const VIDEO_GUIA = process.env.REACT_APP_VIDEO_GUIA || 'https://nirpuiwtarmoxozbtotg.supabase.co/storage/v1/object/public/productos/guias/como-vender-zippygo.mp4';

const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

export const marcarPruebaHecha = (negocioId) => guardar(`zippy_prueba_${negocioId}`, '1');

export const VideoGuia = ({ onCerrar }) => (
  <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/80 p-3" role="dialog" aria-label="Video: cómo vender en ZIPPYGO" onClick={onCerrar}>
    <div className="w-full max-w-[420px]" onClick={e => e.stopPropagation()}>
      <video src={VIDEO_GUIA} controls autoPlay playsInline className="max-h-[80vh] w-full rounded-2xl bg-black" />
      <button type="button" onClick={onCerrar} className="mt-3 w-full cursor-pointer rounded-xl border-0 bg-white p-3 font-[inherit] text-[15px] font-extrabold text-slate-800">Cerrar</button>
    </div>
  </div>
);

const Paso = ({ hecho, titulo, nota, onIr }) => (
  <div className="flex items-center gap-3 border-0 border-t border-solid border-slate-100 py-2.5 first:border-t-0 dark:border-noche-borde">
    <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[14px] font-black',
      hecho ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15' : 'border-2 border-solid border-slate-300 dark:border-slate-600')}>
      {hecho ? '✓' : ''}
    </span>
    <div className="min-w-0 flex-1">
      <b className={cx('block text-[14px]', hecho ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100')}>{titulo}</b>
      {!hecho && nota && <span className="block text-[12px] leading-snug text-slate-500">{nota}</span>}
    </div>
    {!hecho && <button type="button" onClick={onIr} className="shrink-0 cursor-pointer rounded-full border-0 bg-zippy px-3 py-1.5 font-[inherit] text-[12.5px] font-extrabold text-white">Ir</button>}
  </div>
);

const InicioNegocio = ({ productos = [], cargando }) => {
  const navigate = useNavigate();
  const [negocio, setNegocio] = useState(null);
  const [video, setVideo] = useState(false);
  const [oculto, setOculto] = useState(() => leer('zippy_pasos_ocultos') === '1');

  useEffect(() => {
    negociosService.miNegocio().then(({ data }) => setNegocio(data)).catch(() => {});
  }, []);

  if (!negocio) return null;

  const tieneUbicacion = negocio.latitud != null && negocio.longitud != null;
  const tieneHorario = !!(negocio.hora_apertura && negocio.hora_cierre && (negocio.dias_operacion || '').trim());
  const conFoto = productos.filter(p => p.foto && !p.pausado).length;
  const pruebaHecha = leer(`zippy_prueba_${negocio.id}`) === '1';
  const videoVisto = leer('zippy_video_visto') === '1';
  const exigido = negocio.cerrado_aviso === 'Tienda cerrada por ahora';

  const pasos = [
    { hecho: !!negocio.logo, titulo: 'Pon tu logo', nota: 'Una foto de tu negocio o tu logo', ir: () => navigate('/vendor/perfil') },
    { hecho: tieneHorario, titulo: 'Escribe tu horario y tus días', nota: 'Para no recibir pedidos cuando estás cerrado', ir: () => navigate('/vendor/perfil') },
    { hecho: tieneUbicacion, titulo: 'Marca tu local en el mapa', nota: 'Para que el repartidor sepa dónde recoger', ir: () => navigate('/vendor/config') },
    { hecho: conFoto >= 3, titulo: 'Sube 3 productos con foto', nota: `Llevas ${conFoto}. Con la foto de la carta es más rápido`, ir: () => navigate('/vendor/productos/menu') },
    { hecho: pruebaHecha, titulo: 'Haz un pedido de prueba', nota: 'Practica sin cliente real', ir: () => navigate('/vendor/ordenes?prueba=1') },
    { hecho: videoVisto, titulo: 'Mira el video de 2 minutos', nota: 'Cómo vender en ZIPPYGO', ir: () => { guardar('zippy_video_visto', '1'); setVideo(true); } },
  ];
  const hechos = pasos.filter(p => p.hecho).length;
  const verPasos = !cargando && !oculto && hechos < pasos.length;
  const faltanDatos = !tieneUbicacion || !tieneHorario;

  const compartirTienda = () => compartir({
    titulo: negocio.nombre_negocio,
    texto: `Pide en ${negocio.nombre_negocio} por ZIPPYGO y te llega a domicilio en Garzón.`,
    url: enlaceTienda(negocio.id),
  });

  return (
    <>
      {/* 7. Ubicación y horario */}
      {faltanDatos && (exigido || !verPasos) && (
        <div className="mb-4 rounded-2xl border-[1.5px] border-solid border-amber-200 bg-amber-50 p-3.5 dark:border-amber-500/30 dark:bg-amber-500/10">
          <b className="flex items-center gap-2 text-[14.5px] text-amber-900 dark:text-amber-200"><Icon name="alerta" size={18} />Tu tienda está incompleta</b>
          <p className="m-0 mt-1 text-[13px] leading-snug text-amber-800 dark:text-amber-200/90">
            {exigido
              ? <>Mientras falte esto, tu tienda sale <b>cerrada</b> para los clientes.</>
              : 'Complétalo para que el repartidor sepa dónde recoger y no te lleguen pedidos cuando estás cerrado.'}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {!tieneUbicacion && <button type="button" onClick={() => navigate('/vendor/config')} className="cursor-pointer rounded-full border-0 bg-zippy px-3.5 py-2 font-[inherit] text-[13px] font-extrabold text-white"><Icon name="ubicacion" size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />Poner ubicación</button>}
            {!tieneHorario && <button type="button" onClick={() => navigate('/vendor/perfil')} className="cursor-pointer rounded-full border-0 bg-zippy px-3.5 py-2 font-[inherit] text-[13px] font-extrabold text-white"><Icon name="reloj" size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />Poner horario</button>}
          </div>
        </div>
      )}

      {/* 9. Primeros pasos */}
      {verPasos && (
        <div className="mb-4 rounded-2xl bg-white p-4 pb-2 shadow-[0_2px_10px_rgba(0,0,0,0.06)] dark:bg-noche-card">
          <div className="flex items-center justify-between">
            <b className="text-[16px] text-slate-800 dark:text-slate-100">Primeros pasos</b>
            <span className="text-[14px] font-extrabold text-zippy">{hechos} de {pasos.length}</span>
          </div>
          <div className="my-2.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-noche-alt">
            <span className="block h-full rounded-full bg-zippy transition-all" style={{ width: `${(hechos / pasos.length) * 100}%` }} />
          </div>
          {pasos.map(p => <Paso key={p.titulo} hecho={p.hecho} titulo={p.titulo} nota={p.nota} onIr={p.ir} />)}
          <button type="button" onClick={() => { guardar('zippy_pasos_ocultos', '1'); setOculto(true); }}
            className="mt-1 w-full cursor-pointer border-0 bg-transparent py-2 font-[inherit] text-[12.5px] font-bold text-slate-400">Ocultar esta lista</button>
        </div>
      )}

      {/* 2. Comparte tu tienda */}
      <div className="mb-4 flex items-center gap-3 rounded-2xl border-[1.5px] border-solid border-orange-200 bg-orange-50 p-3 dark:border-zippy/30 dark:bg-zippy/10">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-zippy/20 dark:text-orange-300"><Icon name="enviar" size={20} /></span>
        <span className="min-w-0 flex-1">
          <b className="block text-[14.5px] text-slate-800 dark:text-slate-100">Comparte tu tienda</b>
          <span className="text-[12.5px] text-slate-500 dark:text-slate-400">Ponla en tus estados de WhatsApp y en Facebook</span>
        </span>
        <button type="button" onClick={compartirTienda} className="shrink-0 cursor-pointer rounded-full border-0 bg-zippy px-3.5 py-2 font-[inherit] text-[13px] font-extrabold text-white">Compartir</button>
      </div>

      {video && <VideoGuia onCerrar={() => setVideo(false)} />}
    </>
  );
};

export default InicioNegocio;
