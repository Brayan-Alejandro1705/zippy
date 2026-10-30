import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AccountSwitcher from '../../components/AccountSwitcher';
import AvisoSinConexion from '../../components/AvisoSinConexion';
import CampoPesos from '../../components/CampoPesos';
import ZLoader from '../../components/ZLoader';
import Icon from '../../components/Icons';
import { useToast } from '../../context/ToastContext';
import { useTheme } from '../../context/ThemeContext';
import { viajesService } from '../../config/api';
import { registrarPush, cerrarSesionAqui } from '../../utils/push';
import { minutosDesde } from '../../utils/fechas';
import { contenedor, Encabezado, Logo, botonEncabezado, contenido } from '../../components/layout/piezas';
import { cx, tarjeta } from '../../ui/tw';

// ============================================================================
// ConductorPage — app del conductor independiente de moto o carro (oct 2026).
//
// Se pone en línea, ve los viajes que piden cerca, dice cuánto cobra y lo
// toma. El pasajero le paga directo a él: lo de "Cobrado hoy" es plata suya,
// no de ZIPPYGO.
//
// Si un documento o la mensualidad se vencen, el servidor no lo deja ponerse
// en línea y aquí se le dice exactamente qué falta.
// ============================================================================

const plata = n => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;
// Botones de precio rápido: el carro arranca más arriba que la moto
const PRECIOS_RAPIDOS = { moto: [3000, 4000, 5000, 6000], carro: [6000, 7000, 8000, 10000] };
const usuarioGuardado = () => { try { return JSON.parse(localStorage.getItem('usuario') || '{}'); } catch { return {}; } };

const telWa = (t) => {
  const d = String(t || '').replace(/\D/g, '');
  return d.length === 10 ? `57${d}` : d;
};

const enMapa = (lat, lng, texto) => (lat != null && lng != null)
  ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${texto}, Garzón, Huila`)}`;

const btnPrincipal = 'flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-0 bg-zippy px-4 py-[14px] font-[inherit] text-[15px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50';
const btnLinea = 'flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-solid border-slate-200 bg-white px-2 py-2.5 font-[inherit] text-[13px] font-extrabold text-slate-700 no-underline dark:border-noche-borde dark:bg-noche-alt dark:text-slate-200';

const PASO = {
  aceptado: { titulo: 'Ve a recoger al pasajero', boton: 'Ya llegué', accion: 'llegue' },
  llego: { titulo: 'Esperando al pasajero', boton: 'Se subió: iniciar viaje', accion: 'iniciar' },
  en_viaje: { titulo: 'En viaje', boton: 'Terminar viaje', accion: 'terminar' },
};

const ConductorPage = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { isDark, toggle } = useTheme();
  const usuario = usuarioGuardado();

  const [estado, setEstado] = useState(null);
  const [disponibles, setDisponibles] = useState([]);
  const [precios, setPrecios] = useState({});
  const [ocupado, setOcupado] = useState(false);
  const posicion = useRef(null);

  useEffect(() => { registrarPush(); }, []);

  // La ubicación solo sirve para ordenar los viajes por cercanía
  useEffect(() => {
    if (!navigator.geolocation) return undefined;
    const id = navigator.geolocation.watchPosition(
      p => { posicion.current = { lat: p.coords.latitude, lng: p.coords.longitude }; },
      () => {},
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const cargarEstado = useCallback(async () => {
    try {
      const { data } = await viajesService.estado();
      setEstado(data);
      return data;
    } catch (e) {
      return null; // sin señal: se conserva lo último bueno
    }
  }, []);

  const cargarDisponibles = useCallback(async () => {
    try {
      const { data } = await viajesService.disponibles(posicion.current || undefined);
      setDisponibles(data);
    } catch (e) { /* se conserva la lista */ }
  }, []);

  useEffect(() => {
    cargarEstado();
    const t = setInterval(cargarEstado, 10000);
    return () => clearInterval(t);
  }, [cargarEstado]);

  const buscando = estado?.en_linea && !estado?.viaje_actual;
  useEffect(() => {
    if (!buscando) { setDisponibles([]); return undefined; }
    cargarDisponibles();
    const t = setInterval(cargarDisponibles, 6000);
    return () => clearInterval(t);
  }, [buscando, cargarDisponibles]);

  const hacer = async (fn, okMsg) => {
    setOcupado(true);
    try {
      await fn();
      if (okMsg) addToast(okMsg, 'success');
    } catch (e) {
      addToast(e?.response?.data?.detail || 'No se pudo hacer. Intenta de nuevo.', 'error');
    } finally {
      await cargarEstado();
      setOcupado(false);
    }
  };

  const cambiarEnLinea = () => hacer(() => viajesService.enLinea(!estado.en_linea));

  const aceptar = (v) => {
    const precio = Number(precios[v.id] || 0);
    if (!precio) { addToast('Elige cuánto cobras por el viaje', 'error'); return; }
    hacer(async () => { await viajesService.aceptar(v.id, precio); setDisponibles([]); }, 'Viaje tomado. Ve a recoger al pasajero.');
  };

  const avanzar = (v) => {
    const paso = PASO[v.estado];
    hacer(() => viajesService[paso.accion](v.id), v.estado === 'en_viaje' ? `Viaje terminado. Cobra ${plata(v.precio)}.` : null);
  };

  const soltar = (v, motivo) => {
    const texto = motivo === 'no_aparecio'
      ? '¿El pasajero no apareció? El viaje se cancela.'
      : '¿No puedes ir? El viaje vuelve a la lista para otro conductor.';
    if (!window.confirm(texto)) return;
    hacer(() => viajesService.soltar(v.id, motivo));
  };

  const salir = () => {
    if (!window.confirm('¿Seguro que quieres cerrar sesión?')) return;
    cerrarSesionAqui();
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('usuario');
    navigate('/login');
  };

  const v = estado?.viaje_actual;
  const esCarro = estado?.tipo_vehiculo === 'carro';

  return (
    <div className={contenedor}>
      <Encabezado>
        <Logo onClick={() => {}} />
        <span className="rounded-md bg-white/25 px-2 py-1 text-[11px] font-black tracking-[0.5px] text-white">{esCarro ? 'CARRO' : 'MOTO'}</span>
        <span className="flex-1" />
        <button className={botonEncabezado} onClick={toggle} aria-label="Cambiar tema"><Icon name={isDark ? 'sol' : 'luna'} size={19} /></button>
        <AccountSwitcher variant="icon" />
        <button className={botonEncabezado} onClick={salir} aria-label="Cerrar sesión"><Icon name="salir" size={19} /></button>
      </Encabezado>
      <AvisoSinConexion />

      <main className={cx(contenido, 'px-4 pb-10 pt-4 md:max-w-[620px]')}>
        {!estado ? <ZLoader size="md" label="Cargando..." /> : (
          <>
            {/* ── Quién soy y el botón de en línea ── */}
            <div className={cx(tarjeta, 'mb-3 p-4')}>
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zippy text-lg font-black text-white">{(usuario.nombre || 'C').charAt(0).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-[16px] text-slate-800 dark:text-slate-100">{usuario.nombre || 'Conductor'}</b>
                  <span className="block text-[12.5px] text-slate-500">{[estado.perfil.moto, estado.perfil.placa].filter(Boolean).join(' · ')}</span>
                  {esCarro && (estado.perfil.empresa || estado.perfil.numero_interno) && (
                    <span className="block text-[12px] text-slate-500">{[estado.perfil.empresa, estado.perfil.numero_interno && `Móvil ${estado.perfil.numero_interno}`].filter(Boolean).join(' · ')}</span>
                  )}
                </div>
              </div>
              {/* Con un viaje andando no se puede desconectar: se oculta el botón */}
              {!v && estado.estado_inscripcion === 'aprobado' && <button
                type="button"
                onClick={cambiarEnLinea}
                disabled={ocupado || (!estado.en_linea && (!estado.puede_trabajar || !estado.servicio_activo))}
                className={cx(
                  'mt-3.5 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl border-0 px-4 py-3.5 font-[inherit] text-[15px] font-extrabold disabled:cursor-not-allowed disabled:opacity-60',
                  estado.en_linea ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700 dark:bg-noche-alt dark:text-slate-200'
                )}
              >
                <span className={cx('h-3 w-3 rounded-full', estado.en_linea ? 'bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.35)]' : 'bg-slate-400')} />
                {estado.en_linea ? 'En línea · recibiendo viajes' : 'Desconectado · toca para ponerte en línea'}
              </button>}
            </div>

            {!estado.servicio_activo && (
              <p className="m-0 mb-3 rounded-2xl bg-slate-100 px-4 py-3 text-[13px] text-slate-600 dark:bg-noche-alt dark:text-slate-300">
                El servicio de {esCarro ? 'carro' : 'moto'} todavía no está encendido. Te avisamos cuando arranque.
              </p>
            )}

            {/* Inscrito desde la app y todavía sin revisar, o rechazado */}
            {estado.estado_inscripcion === 'pendiente' && (
              <div className="mb-3 rounded-2xl bg-blue-50 px-4 py-4 text-[13.5px] leading-snug text-blue-800 dark:bg-blue-500/10 dark:text-blue-300">
                <b className="mb-1 flex items-center gap-1.5 text-[15px]"><Icon name="reloj" size={18} />Tu inscripción está en revisión</b>
                Estamos revisando tus papeles. Te llega una notificación apenas quedes aprobado; después pagas la mensualidad y ya puedes recibir viajes.
              </div>
            )}
            {estado.estado_inscripcion === 'rechazado' && (
              <div className="mb-3 rounded-2xl bg-red-50 px-4 py-4 text-[13.5px] leading-snug text-red-700 dark:bg-red-500/10 dark:text-red-300">
                <b className="mb-1 flex items-center gap-1.5 text-[15px]"><Icon name="alerta" size={18} />Tu inscripción no fue aprobada</b>
                {(estado.problemas[0] || '').replace('Tu inscripción no fue aprobada: ', '')}
                <span className="mt-1.5 block text-[12.5px]">Escríbenos por WhatsApp desde la sección de ayuda para corregirlo.</span>
              </div>
            )}

            {estado.estado_inscripcion === 'aprobado' && estado.problemas.length > 0 && (
              <div className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-[13px] text-red-700 dark:bg-red-500/10 dark:text-red-300">
                <b className="mb-1 flex items-center gap-1.5"><Icon name="alerta" size={16} />No puedes recibir viajes todavía</b>
                <ul className="m-0 pl-5">{estado.problemas.map(p => <li key={p}>{p}</li>)}</ul>
                <span className="mt-1.5 block text-[12px]">Comunícate con ZIPPYGO para ponerte al día.</span>
              </div>
            )}

            {/* ── Números del día ── */}
            {estado.estado_inscripcion === 'aprobado' && <div className="mb-3 grid grid-cols-3 gap-2">
              {[
                [estado.viajes_hoy, 'Viajes hoy'],
                [plata(estado.cobrado_hoy), 'Cobrado hoy'],
                [estado.total_calificaciones > 0 ? `${Number(estado.calificacion).toFixed(1)} ★` : '—', 'Calificación'],
              ].map(([val, lbl]) => (
                <div key={lbl} className={cx(tarjeta, 'px-2 py-3 text-center')}>
                  <b className="block text-[17px] font-black text-slate-800 dark:text-slate-100">{val}</b>
                  <span className="text-[11px] text-slate-500">{lbl}</span>
                </div>
              ))}
            </div>}

            {/* ── Viaje en curso ── */}
            {v && (
              <div className={cx(tarjeta, 'mb-3 overflow-hidden')}>
                <div className={cx('px-4 py-3 text-white', v.estado === 'en_viaje' ? 'bg-emerald-600' : 'bg-zippy')}>
                  <b className="block text-[15px]">{PASO[v.estado].titulo}</b>
                  <span className="text-[12.5px] text-white/90">{v.corto} · Cobras {plata(v.precio)} al llegar</span>
                </div>
                <div className="p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block text-[11px] font-bold uppercase text-slate-400">Pasajero</span>
                      <b className="text-[15px] text-slate-800 dark:text-slate-100">{v.pasajero?.nombre}</b>
                    </div>
                    <div className="flex gap-1.5">
                      <a className={cx(btnLinea, 'flex-none px-3')} href={`tel:${v.pasajero?.telefono}`} aria-label="Llamar"><Icon name="telefono" size={18} /></a>
                      <a className={cx(btnLinea, 'flex-none px-3')} href={`https://wa.me/${telWa(v.pasajero?.telefono)}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><Icon name="whatsapp" size={18} /></a>
                    </div>
                  </div>
                  <Punto titulo="Recoger en" texto={v.origen} nota={v.referencia} href={v.estado !== 'en_viaje' ? enMapa(v.origen_lat, v.origen_lng, v.origen) : null} color="bg-emerald-500" />
                  <Punto titulo="Llevar a" texto={v.destino} nota={v.distancia_km ? `${Number(v.distancia_km).toFixed(1)} km aprox.` : ''} href={v.estado === 'en_viaje' ? enMapa(v.destino_lat, v.destino_lng, v.destino) : null} color="bg-zippy" />

                  <button type="button" className={cx(btnPrincipal, 'mt-3')} disabled={ocupado} onClick={() => avanzar(v)}>{PASO[v.estado].boton}</button>
                  {v.estado !== 'en_viaje' && (
                    <div className="mt-2 flex justify-center gap-5">
                      {v.estado === 'llego' && (
                        <button type="button" onClick={() => soltar(v, 'no_aparecio')} className="cursor-pointer border-0 bg-transparent font-[inherit] text-[13px] font-bold text-slate-500">El pasajero no apareció</button>
                      )}
                      <button type="button" onClick={() => soltar(v, 'no_puedo')} className="cursor-pointer border-0 bg-transparent font-[inherit] text-[13px] font-bold text-red-600">No puedo ir</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Viajes pidiendo moto ── */}
            {buscando && (
              <>
                <h2 className="m-0 mb-2 mt-4 flex items-center gap-2 text-[16px] font-extrabold text-slate-800 dark:text-slate-100">
                  Viajes cerca <span className="rounded-full bg-zippy px-2 py-0.5 text-[12px] text-white">{disponibles.length}</span>
                </h2>
                {disponibles.length === 0 ? (
                  <div className={cx(tarjeta, 'p-6 text-center text-[13.5px] text-slate-500')}>
                    <Icon name={esCarro ? 'carro' : 'moto'} size={30} style={{ opacity: 0.4 }} />
                    <p className="m-0 mt-2">Todavía no hay viajes. Te avisamos con una notificación apenas alguien pida.</p>
                  </div>
                ) : disponibles.map(d => (
                  <div key={d.id} className={cx(tarjeta, 'mb-3 p-4')}>
                    <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11.5px] font-bold">
                      {d.a_km != null && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">A {d.a_km.toFixed(1)} km de ti</span>}
                      {d.distancia_km ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-noche-alt dark:text-slate-300">Viaje de {Number(d.distancia_km).toFixed(1)} km</span> : null}
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-noche-alt dark:text-slate-300">Hace {minutosDesde(d.fecha_creacion)} min</span>
                    </div>
                    <Punto titulo="Recoger" texto={d.origen} nota={[d.pasajero?.nombre, d.referencia].filter(Boolean).join(' · ')} color="bg-emerald-500" />
                    <Punto titulo="Llevar a" texto={d.destino} color="bg-zippy" />

                    <span className="mb-1.5 mt-3 block text-[12px] font-extrabold text-slate-600 dark:text-slate-300">¿Cuánto cobras?</span>
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {PRECIOS_RAPIDOS[esCarro ? 'carro' : 'moto'].map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPrecios(x => ({ ...x, [d.id]: String(p) }))}
                          className={cx(
                            'cursor-pointer rounded-full border-[1.5px] border-solid px-3 py-1.5 font-[inherit] text-[13px] font-extrabold',
                            Number(precios[d.id]) === p ? 'border-zippy bg-zippy text-white' : 'border-slate-200 bg-white text-slate-700 dark:border-noche-borde dark:bg-noche-alt dark:text-slate-200'
                          )}
                        >{plata(p)}</button>
                      ))}
                    </div>
                    <CampoPesos
                      name="precio"
                      value={precios[d.id] || ''}
                      onChange={e => setPrecios(x => ({ ...x, [d.id]: e.target.value }))}
                      placeholder="Otro valor"
                      className="box-border w-full rounded-xl border-[1.5px] border-solid border-slate-200 bg-white py-2.5 pr-3 font-[inherit] text-[14px] text-slate-800 outline-none focus:border-zippy dark:border-noche-borde dark:bg-noche-alt dark:text-slate-100"
                    />
                    <button type="button" className={cx(btnPrincipal, 'mt-3')} disabled={ocupado || !precios[d.id]} onClick={() => aceptar(d)}>
                      {precios[d.id] ? `Aceptar por ${plata(precios[d.id])}` : 'Elige el precio para aceptar'}
                    </button>
                  </div>
                ))}
              </>
            )}

            <p className="m-0 mt-5 text-center text-[11.5px] leading-snug text-slate-400">
              Trabajas como conductor independiente. El pasajero te paga directo a ti; ZIPPYGO solo te pone en contacto con él.
              {!esCarro && ' Lleva siempre casco para el pasajero.'}
            </p>
          </>
        )}
      </main>
    </div>
  );
};

const Punto = ({ titulo, texto, nota, href, color }) => (
  <div className="mb-2 flex gap-2.5">
    <span className={cx('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', color)} />
    <div className="min-w-0 flex-1">
      <span className="block text-[11px] font-bold uppercase text-slate-400">{titulo}</span>
      <b className="block text-[14px] text-slate-800 dark:text-slate-100">{texto}</b>
      {nota ? <span className="block text-[12px] text-slate-500">{nota}</span> : null}
    </div>
    {href && (
      <a href={href} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-1 self-center rounded-lg bg-blue-50 px-2.5 py-1.5 text-[12px] font-extrabold text-blue-700 no-underline dark:bg-blue-500/15 dark:text-blue-300">
        <Icon name="mapa" size={14} />Cómo llegar
      </a>
    )}
  </div>
);

export default ConductorPage;
