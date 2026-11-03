import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import UserLayout from '../../components/UserLayout';
import SelectorUbicacion from '../../components/SelectorUbicacion';
import ZLoader from '../../components/ZLoader';
import Icon from '../../components/Icons';
import { useToast } from '../../context/ToastContext';
import { viajesService } from '../../config/api';
import { minutosDesde } from '../../utils/fechas';
import { cx, tarjeta } from '../../ui/tw';

// ============================================================================
// MotoPage — el cliente pide un viaje en moto o en carro (oct 2026).
//
// ZIPPYGO solo conecta: el conductor es independiente, pone el precio al
// aceptar y el pasajero se lo paga directo a él. Por eso, antes del primer
// viaje, el cliente acepta esas condiciones (y el servidor lo exige).
// ============================================================================

const plata = n => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;
const CLAVE_CONDICIONES = 'moto_condiciones_ok';
const hayCuenta = () => !!localStorage.getItem('access_token');
const usuarioGuardado = () => { try { return JSON.parse(localStorage.getItem('usuario') || '{}'); } catch { return {}; } };

const campo = 'box-border w-full rounded-xl border-[1.5px] border-solid border-slate-200 bg-white px-3.5 py-3 font-[inherit] text-[14px] text-slate-800 outline-none focus:border-zippy dark:border-noche-borde dark:bg-noche-alt dark:text-slate-100';
const etiqueta = 'mb-1.5 block text-[13px] font-extrabold text-slate-700 dark:text-slate-200';
const btnGrande = 'flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-0 bg-zippy px-4 py-[15px] font-[inherit] text-[15px] font-extrabold text-white shadow-[0_6px_18px_rgba(255,122,0,0.3)] disabled:cursor-not-allowed disabled:opacity-50';
const btnLinea = 'flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-solid border-slate-200 bg-white px-2 py-3 font-[inherit] text-[13px] font-extrabold text-slate-700 no-underline dark:border-noche-borde dark:bg-noche-alt dark:text-slate-200';

// Lo que cambia entre moto y carro
const TIPOS = {
  moto: { nombre: 'Moto', icono: 'moto', articulo: 'una moto', pedir: 'Pedir moto', seguridad: 'Antes de subirte revisa que la placa coincida y usa casco.' },
  carro: { nombre: 'Carro', icono: 'carro', articulo: 'un carro', pedir: 'Pedir carro', seguridad: 'Antes de subirte revisa que la placa y el carro coincidan con los de la app.' },
};

const ESTADO_TEXTO = {
  aceptado: ['Tu conductor va en camino', 'Está yendo al punto donde te recoge.'],
  llego: ['Tu conductor llegó', 'Te está esperando en el punto de recogida.'],
  en_viaje: ['En viaje', 'Que tengas buen viaje. Recuerda pagarle al conductor al llegar.'],
};

const telWa = (t) => {
  const d = String(t || '').replace(/\D/g, '');
  return d.length === 10 ? `57${d}` : d;
};

const Estrellas = ({ valor = 0, onElegir, tamano = 34 }) => (
  <div className="flex justify-center gap-1.5">
    {[1, 2, 3, 4, 5].map(n => (
      <button
        key={n}
        type="button"
        aria-label={`${n} estrellas`}
        onClick={() => onElegir?.(n)}
        className={cx('cursor-pointer border-0 bg-transparent p-0.5', n <= valor ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600')}
      >
        <Icon name="estrella" size={tamano} filled={n <= valor} />
      </button>
    ))}
  </div>
);

const MotoPage = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const usuario = usuarioGuardado();

  const [cargando, setCargando] = useState(true);
  const [servicio, setServicio] = useState({ activo: false, conductores_en_linea: 0 });
  const [viaje, setViaje] = useState(null);
  const [tipo, setTipo] = useState('moto');
  const [enviando, setEnviando] = useState(false);
  const [nota, setNota] = useState(0);

  const [form, setForm] = useState({ origen: '', destino: '', referencia: '', telefono: usuario.telefono || '' });
  const [puntoOrigen, setPuntoOrigen] = useState(null);
  const [puntoDestino, setPuntoDestino] = useState(null);
  const [mapaDestino, setMapaDestino] = useState(false);
  const [condiciones, setCondiciones] = useState(() => {
    try { return localStorage.getItem(CLAVE_CONDICIONES) === '1'; } catch { return false; }
  });
  const yaAcepto = useRef(condiciones);

  const cargar = useCallback(async () => {
    try {
      const [s, m] = await Promise.all([
        viajesService.servicio(),
        hayCuenta() ? viajesService.mio() : Promise.resolve({ data: { viaje: null } }),
      ]);
      setServicio(s.data);
      setViaje(m.data.viaje);
      // Si solo uno de los dos está encendido, queda elegido ese
      const t = s.data.tipos || {};
      setTipo(actual => (t[actual]?.activo ? actual : (t.moto?.activo ? 'moto' : 'carro')));
    } catch (e) {
      // Sin señal: se deja lo último que se vio, no se borra la pantalla
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Mientras hay un viaje vivo se pregunta seguido cómo va
  const vivo = viaje && ['buscando', 'aceptado', 'llego', 'en_viaje'].includes(viaje.estado);
  useEffect(() => {
    if (!vivo) return undefined;
    const t = setInterval(cargar, 5000);
    return () => clearInterval(t);
  }, [vivo, cargar]);

  const cambiar = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const pedir = async () => {
    if (!hayCuenta()) { navigate('/login'); return; }
    if (!form.origen.trim()) { addToast('Escribe dónde te recogen', 'error'); return; }
    if (!puntoOrigen) { addToast('Marca en el mapa dónde te recogen', 'error'); return; }
    if (!form.destino.trim()) { addToast('Escribe a dónde vas', 'error'); return; }
    if (!condiciones) { addToast('Acepta las condiciones del servicio', 'error'); return; }
    setEnviando(true);
    try {
      const { data } = await viajesService.pedir({
        tipo_vehiculo: tipo,
        origen: form.origen,
        origen_lat: puntoOrigen.lat,
        origen_lng: puntoOrigen.lng,
        destino: form.destino,
        destino_lat: puntoDestino?.lat,
        destino_lng: puntoDestino?.lng,
        referencia: form.referencia,
        telefono: form.telefono,
        acepta_condiciones: true,
      });
      try { localStorage.setItem(CLAVE_CONDICIONES, '1'); } catch { /* sin almacenamiento */ }
      setViaje(data);
    } catch (e) {
      addToast(e?.response?.data?.detail || 'No se pudo pedir el viaje', 'error');
      cargar();
    } finally {
      setEnviando(false);
    }
  };

  const cancelar = async () => {
    if (!window.confirm('¿Cancelar el viaje?')) return;
    try {
      await viajesService.cancelar(viaje.id);
      setViaje(null);
      addToast('Viaje cancelado', 'info');
    } catch (e) {
      addToast(e?.response?.data?.detail || 'No se pudo cancelar', 'error');
      cargar();
    }
  };

  const calificar = async (n) => {
    setNota(n);
    try {
      await viajesService.calificar(viaje.id, n);
      addToast('¡Gracias por calificar!', 'success');
      setViaje(null);
      setNota(0);
    } catch (e) {
      addToast(e?.response?.data?.detail || 'No se pudo guardar la calificación', 'error');
    }
  };

  const compartir = () => {
    const c = viaje?.conductor || {};
    const t = TIPOS[viaje.tipo_vehiculo] || TIPOS.moto;
    const texto = `Voy en un aventón de ZIPPYGO, en ${t.articulo}. Conductor: ${c.nombre}, ${c.moto || t.nombre} placa ${c.placa}` +
      (c.numero_interno ? `, móvil ${c.numero_interno}` : '') + '. ' +
      `De ${viaje.origen} a ${viaje.destino}.`;
    if (navigator.share) {
      navigator.share({ title: 'Mi aventón en ZIPPYGO', text: texto }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
    }
  };

  const Contenido = () => {
    if (cargando) return <ZLoader size="md" label="Cargando..." />;

    // ── Servicio apagado ───────────────────────────────────────────────
    if (!servicio.activo && !viaje) {
      return (
        <div className={cx(tarjeta, 'p-6 text-center')}>
          <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-zippy dark:bg-zippy/15"><Icon name="moto" size={34} /></span>
          <h2 className="m-0 text-lg font-extrabold text-slate-800 dark:text-slate-100">Muy pronto: Aventón</h2>
          <p className="m-0 mt-1.5 text-[13.5px] leading-relaxed text-slate-500">Estamos preparando este servicio para Garzón.</p>
        </div>
      );
    }

    // ── Buscando conductor ────────────────────────────────────────────
    if (viaje?.estado === 'buscando') {
      const min = minutosDesde(viaje.fecha_creacion);
      return (
        <div className={cx(tarjeta, 'p-5 text-center')}>
          <ZLoader size="md" />
          <h2 className="m-0 mt-2 text-lg font-extrabold text-slate-800 dark:text-slate-100">Buscando conductor…</h2>
          <p className="m-0 mt-1 text-[13px] text-slate-500">
            {min < 1 ? 'Les avisamos a los conductores en línea.' : `Llevamos ${min} min buscando.`} Si en 10 minutos nadie lo toma, se cancela solo.
          </p>
          <Ruta viaje={viaje} />
          <button type="button" onClick={cancelar} className="mt-4 cursor-pointer border-0 bg-transparent font-[inherit] text-[14px] font-extrabold text-red-600">Cancelar viaje</button>
        </div>
      );
    }

    // ── Conductor asignado ────────────────────────────────────────────
    if (viaje && ESTADO_TEXTO[viaje.estado]) {
      const c = viaje.conductor || {};
      const [titulo, sub] = ESTADO_TEXTO[viaje.estado];
      return (
        <>
          <div className={cx('mb-3 rounded-2xl px-4 py-3.5 text-white', viaje.estado === 'llego' ? 'bg-emerald-600' : 'bg-zippy')}>
            <b className="block text-[16px] font-extrabold">{titulo}</b>
            <span className="text-[13px] text-white/90">{sub}</span>
          </div>

          <div className={cx(tarjeta, 'mb-3 p-4')}>
            <div className="flex items-center gap-3">
              {c.foto
                ? <img src={c.foto} alt="" className="h-14 w-14 rounded-full object-cover" />
                : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zippy text-xl font-black text-white">{(c.nombre || 'C').charAt(0)}</span>}
              <div className="min-w-0 flex-1">
                <b className="block truncate text-[16px] text-slate-800 dark:text-slate-100">{c.nombre}</b>
                <span className="text-[12.5px] text-slate-500">
                  {c.total_calificaciones > 0
                    ? <><Icon name="estrella" size={13} filled style={{ verticalAlign: '-2px', color: '#f59e0b' }} /> {Number(c.calificacion).toFixed(1)} ({c.total_calificaciones})</>
                    : 'Conductor nuevo'}
                  {c.moto ? ` · ${c.moto}` : ''}
                </span>
                {c.tipo_vehiculo === 'carro' && (c.empresa || c.numero_interno) && (
                  <span className="block text-[12.5px] font-bold text-slate-600 dark:text-slate-300">
                    {[c.empresa, c.numero_interno && `Móvil ${c.numero_interno}`].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5 dark:bg-noche-alt">
              <span className="text-[12.5px] text-slate-500">Placa</span>
              {/* En Colombia la placa particular es amarilla y la de servicio público (taxi, con número de móvil) es blanca */}
              <b className={cx('rounded-md border-2 border-solid border-slate-800 px-2.5 py-0.5 font-mono text-[17px] tracking-[2px] text-slate-900', c.numero_interno ? 'bg-white' : 'bg-amber-300')}>{c.placa || '---'}</b>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-orange-50 px-3.5 py-2.5 dark:bg-zippy/10">
              <span className="text-[12.5px] text-slate-600 dark:text-slate-300">Precio del viaje<br /><small className="text-[11.5px] text-slate-500">Se lo pagas directo al conductor</small></span>
              <b className="text-[20px] font-black text-zippy">{plata(viaje.precio)}</b>
            </div>

            <div className="mt-3 flex gap-2">
              <a className={btnLinea} href={`tel:${c.telefono}`}><Icon name="telefono" size={17} />Llamar</a>
              <a className={btnLinea} href={`https://wa.me/${telWa(c.telefono)}`} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size={17} />WhatsApp</a>
              <button type="button" className={btnLinea} onClick={compartir}><Icon name="enviar" size={17} />Compartir</button>
            </div>
          </div>

          <Ruta viaje={viaje} />

          <p className="m-0 mt-3 flex gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12.5px] leading-snug text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <Icon name="alerta" size={17} style={{ flexShrink: 0 }} />
            {(TIPOS[viaje.tipo_vehiculo] || TIPOS.moto).seguridad}
          </p>

          {viaje.estado !== 'en_viaje' && (
            <button type="button" onClick={cancelar} className="mt-4 w-full cursor-pointer border-0 bg-transparent font-[inherit] text-[14px] font-extrabold text-red-600">Cancelar viaje</button>
          )}
        </>
      );
    }

    // ── Terminado: calificar ──────────────────────────────────────────
    if (viaje?.estado === 'terminado') {
      return (
        <div className={cx(tarjeta, 'p-6 text-center')}>
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15"><Icon name="check" size={30} /></span>
          <h2 className="m-0 text-lg font-extrabold text-slate-800 dark:text-slate-100">Llegaste a tu destino</h2>
          <p className="m-0 mb-4 mt-1 text-[13px] text-slate-500">¿Cómo te fue con {viaje.conductor?.nombre?.split(' ')[0] || 'el conductor'}?</p>
          <Estrellas valor={nota} onElegir={calificar} />
          <button type="button" onClick={() => setViaje(null)} className="mt-4 cursor-pointer border-0 bg-transparent font-[inherit] text-[13px] font-bold text-slate-500">Ahora no</button>
        </div>
      );
    }

    // ── Cancelado por el sistema o el conductor ───────────────────────
    const avisoCancelado = viaje?.estado === 'cancelado' ? (
      <div className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-[13px] text-red-700 dark:bg-red-500/10 dark:text-red-300">
        <b className="block">Tu viaje anterior se canceló</b>
        {viaje.motivo_cancelacion || 'Puedes pedir otro.'}
      </div>
    ) : null;

    // ── Pedir ─────────────────────────────────────────────────────────
    return (
      <>
        {avisoCancelado}
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          {Object.entries(TIPOS).map(([id, t]) => {
            const info = servicio.tipos?.[id] || {};
            const elegido = tipo === id;
            return (
              <button
                key={id}
                type="button"
                disabled={!info.activo}
                onClick={() => setTipo(id)}
                className={cx(
                  'flex cursor-pointer flex-col items-start gap-1 rounded-2xl border-2 border-solid p-3.5 text-left font-[inherit] disabled:cursor-not-allowed disabled:opacity-45',
                  elegido ? 'border-zippy bg-orange-50 dark:bg-zippy/10' : 'border-transparent bg-white shadow-[0_1px_4px_rgba(15,23,42,0.07)] dark:bg-noche-card'
                )}
              >
                <span className={cx('flex h-11 w-11 items-center justify-center rounded-xl', elegido ? 'bg-zippy text-white' : 'bg-slate-100 text-slate-600 dark:bg-noche-alt dark:text-slate-300')}><Icon name={t.icono} size={26} /></span>
                <b className="text-[15px] text-slate-800 dark:text-slate-100">{t.nombre}</b>
                <span className="text-[11.5px] text-slate-500">
                  {!info.activo ? 'Muy pronto' : info.conductores_en_linea > 0 ? `${info.conductores_en_linea} en línea` : 'Nadie en línea'}
                </span>
              </button>
            );
          })}
        </div>

        <div className={cx(tarjeta, 'mb-3 p-4')}>
          <label className={etiqueta} htmlFor="origen">¿Dónde te recogemos?</label>
          <input id="origen" name="origen" className={campo} value={form.origen} onChange={cambiar} placeholder="Ej: Parque principal, frente a la iglesia" maxLength={300} />
          <SelectorUbicacion
            direccion={form.origen}
            valor={puntoOrigen}
            onChange={setPuntoOrigen}
            lugar="punto de recogida"
            textoGps="Estoy aquí"
            textoInicial="Toca «Estoy aquí» o marca en el mapa dónde te recoge."
          />

          <label className={cx(etiqueta, 'mt-3')} htmlFor="destino">¿A dónde vas?</label>
          <input id="destino" name="destino" className={campo} value={form.destino} onChange={cambiar} placeholder="Ej: Hospital San Vicente" maxLength={300} />
          {mapaDestino ? (
            <SelectorUbicacion
              direccion={form.destino}
              valor={puntoDestino}
              onChange={setPuntoDestino}
              lugar="destino"
              textoGps="Usar mi ubicación"
              textoInicial="Marca en el mapa a dónde vas (opcional)."
            />
          ) : (
            <button type="button" onClick={() => setMapaDestino(true)} className="mt-2 cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-[13px] font-bold text-zippy">
              <Icon name="mapa" size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />Marcar el destino en el mapa (opcional)
            </button>
          )}

          <label className={cx(etiqueta, 'mt-3')} htmlFor="referencia">¿Cómo te reconoce? <span className="font-semibold text-slate-400">(opcional)</span></label>
          <input id="referencia" name="referencia" className={campo} value={form.referencia} onChange={cambiar} placeholder="Ej: camisa roja, con un bolso" maxLength={200} />

          <label className={cx(etiqueta, 'mt-3')} htmlFor="telefono">Tu celular</label>
          <input id="telefono" name="telefono" className={campo} value={form.telefono} onChange={cambiar} inputMode="tel" maxLength={15} />
        </div>


        {!yaAcepto.current && (
          <label className="mb-3 flex cursor-pointer gap-2.5 rounded-2xl bg-slate-100 px-3.5 py-3 text-[12.5px] leading-snug text-slate-600 dark:bg-noche-alt dark:text-slate-300">
            <input type="checkbox" checked={condiciones} onChange={e => setCondiciones(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF7A00]" />
            <span>
              Entiendo que el conductor es <b>independiente</b>: ZIPPYGO solo me pone en contacto con él, no presta el transporte ni cobra el viaje.
              El precio lo pone el conductor y <b>se lo pago directo a él</b>. Si voy en moto, usaré casco.
            </span>
          </label>
        )}

        <button type="button" className={btnGrande} onClick={pedir} disabled={enviando || !(servicio.tipos?.[tipo]?.conductores_en_linea > 0)}>
          <Icon name={TIPOS[tipo].icono} size={20} /> {enviando ? 'Pidiendo...' : TIPOS[tipo].pedir}
        </button>
        {!(servicio.tipos?.[tipo]?.conductores_en_linea > 0) && (
          <p className="m-0 mt-2 text-center text-[12.5px] font-bold text-slate-500">No hay conductores de {TIPOS[tipo].nombre.toLowerCase()} en línea en este momento.</p>
        )}
        <p className="m-0 mt-2.5 text-center text-[12px] text-slate-500">El conductor te dice el precio al aceptar. Si no te sirve, cancelas sin costo.</p>
        <button type="button" onClick={() => navigate('/conductor/inscripcion')} className={cx(tarjeta, 'mt-4 flex w-full cursor-pointer items-center gap-3 border-0 p-3.5 text-left font-[inherit]')}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white"><Icon name="carro" size={22} /></span>
          <span className="min-w-0 flex-1">
            <b className="block text-[14px] text-slate-800 dark:text-slate-100">¿Tienes moto o carro?</b>
            <span className="text-[12.5px] text-slate-500">Inscríbete como conductor de Aventón y recibe viajes.</span>
          </span>
          <span className="text-lg text-zippy">→</span>
        </button>
      </>
    );
  };

  return (
    <UserLayout>
      <div className="px-4 pb-6 pt-4 md:mx-auto md:max-w-[560px] md:px-0">
        <h1 className="m-0 flex items-center gap-2 text-[22px] font-black text-slate-800 dark:text-slate-100"><Icon name={TIPOS[viaje?.tipo_vehiculo || tipo].icono} size={26} />Aventón</h1>
        <p className="m-0 mb-4 mt-0.5 text-[13px] text-slate-500">Pide un aventón en moto o carro, con conductores independientes de Garzón.</p>
        {Contenido()}
      </div>
    </UserLayout>
  );
};

const Ruta = ({ viaje }) => (
  <div className={cx(tarjeta, 'mt-3 p-4 text-left')}>
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-1">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        <span className="my-1 w-0.5 flex-1 bg-slate-200 dark:bg-noche-borde" />
        <span className="h-2.5 w-2.5 rounded-sm bg-zippy" />
      </div>
      <div className="min-w-0 flex-1 text-[13.5px]">
        <span className="block text-[11px] font-bold uppercase text-slate-400">Recogida</span>
        <b className="block text-slate-800 dark:text-slate-100">{viaje.origen}</b>
        {viaje.referencia && <span className="block text-[12px] text-slate-500">{viaje.referencia}</span>}
        <span className="mt-2.5 block text-[11px] font-bold uppercase text-slate-400">Destino</span>
        <b className="block text-slate-800 dark:text-slate-100">{viaje.destino}</b>
        {viaje.distancia_km ? <span className="block text-[12px] text-slate-500">{Number(viaje.distancia_km).toFixed(1)} km aprox.</span> : null}
      </div>
    </div>
  </div>
);

export default MotoPage;
