import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import Icon from '../components/Icons';
import ZLoader from '../components/ZLoader';
import { useToast } from '../context/ToastContext';
import { viajesService } from '../config/api';
import { fechaHoraCorta } from '../utils/fechas';
import { useSearchParams } from 'react-router-dom';
import { cx, tarjeta, chip } from '../ui/tw';

// ============================================================================
// ConductoresPage — Súper admin → Viajes: motos y carros (oct 2026).
//
// Aquí se encienden o apagan los viajes en moto y en carro (por aparte), se registran los
// conductores independientes después de revisar sus papeles, se les anota
// cuándo vencen la licencia, el SOAT y la tecnomecánica, y hasta cuándo
// pagaron la mensualidad. Si algo se vence, el conductor no puede ponerse en
// línea hasta que se actualice aquí.
// ============================================================================

const plata = n => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;

// Las fechas de documentos llegan como "2026-11-23" (solo día)
const diaTxt = (iso) => {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};
const diasHasta = (iso) => {
  if (!iso) return null;
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return Math.round((new Date(a, m - 1, d) - hoy) / 86400000);
};

const ESTADO_VIAJE = {
  buscando: ['Buscando', 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'],
  aceptado: ['Va por el pasajero', 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'],
  llego: ['Esperando pasajero', 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'],
  en_viaje: ['En viaje', 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'],
  terminado: ['Terminado', 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'],
  cancelado: ['Cancelado', 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300'],
};

const TIPO_NOMBRE = { moto: 'Moto', carro: 'Carro' };

const VACIO = {
  tipo_vehiculo: 'moto', empresa: '', numero_interno: '', tarjeta_operacion_vence: '',
  nombre: '', apellido: '', documento: '', telefono: '', email: '', password: '',
  placa: '', moto: '', licencia_vence: '', soat_vence: '', tecnomecanica_vence: '', pagado_hasta: '', notas_admin: '',
};

const campo = 'box-border w-full rounded-xl border-[1.5px] border-solid border-slate-200 bg-white px-3 py-2.5 font-[inherit] text-[14px] text-slate-800 outline-none focus:border-zippy dark:border-noche-borde dark:bg-noche-alt dark:text-slate-100';
const lbl = 'mb-1 block text-[12.5px] font-extrabold text-slate-600 dark:text-slate-300';
const btnP = 'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border-0 bg-zippy px-4 py-2.5 font-[inherit] text-[13.5px] font-extrabold text-white disabled:opacity-50';
const btnB = 'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-solid border-slate-200 bg-white px-3 py-2 font-[inherit] text-[12.5px] font-extrabold text-slate-700 dark:border-noche-borde dark:bg-noche-alt dark:text-slate-200';

// Chip de un documento: verde al día, amarillo si vence en 15 días o menos, rojo vencido
const ChipDoc = ({ nombre, iso, opcional, femenino, hasta }) => {
  const dias = diasHasta(iso);
  let cls = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
  let txt = `${nombre}${hasta ? ' hasta' : ''} ${diaTxt(iso)}`;
  if (iso == null) {
    cls = opcional ? 'bg-slate-100 text-slate-500 dark:bg-noche-alt dark:text-slate-400' : 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300';
    txt = opcional ? `${nombre}: no aplica` : `${nombre}: falta`;
  } else if (dias < 0) {
    cls = 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300';
    txt = `${nombre} ${femenino ? 'vencida' : 'vencido'} ${diaTxt(iso)}`;
  } else if (dias <= 15) {
    cls = 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
    txt = `${nombre} vence ${diaTxt(iso)}`;
  }
  return <span className={cx('rounded-lg px-2 py-1 text-[11.5px] font-bold', cls)}>{txt}</span>;
};

const ConductoresPage = () => {
  const { addToast } = useToast();
  const [datos, setDatos] = useState(null);
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') === 'viajes' ? 'viajes' : 'conductores');
  const [papeles, setPapeles] = useState({});   // id -> [{nombre, url}] | 'cargando'
  const [grande, setGrande] = useState(null);   // foto abierta en grande
  const [form, setForm] = useState(null);     // null = cerrado; {…, id?} = abierto
  const [verClave, setVerClave] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const { data } = await viajesService.resumen();
      setDatos(data);
    } catch (e) {
      addToast(e?.response?.data?.detail || 'No se pudo cargar', 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const encender = async (tipo) => {
    const activo = !datos.servicios?.[tipo];
    const nombre = tipo === 'carro' ? 'carro' : 'moto';
    if (!window.confirm(activo
      ? `¿Encender los viajes en ${nombre}? Los clientes van a poder pedir ${nombre === 'carro' ? 'un carro' : 'una moto'}.`
      : `¿Apagar los viajes en ${nombre}? Los clientes dejan de verlos y los conductores de ${nombre} quedan desconectados.`)) return;
    try {
      await viajesService.encender(tipo, activo);
      addToast(`Viajes en ${nombre} ${activo ? 'encendidos' : 'apagados'}`, 'success');
      cargar();
    } catch (e) {
      addToast(e?.response?.data?.detail || 'No se pudo cambiar', 'error');
    }
  };

  const editar = async (c, cambios, msg) => {
    try {
      await viajesService.editarConductor(c.id, cambios);
      addToast(msg, 'success');
      cargar();
    } catch (e) {
      addToast(e?.response?.data?.detail || 'No se pudo guardar', 'error');
    }
  };

  const abrirNuevo = () => { setVerClave(false); setForm({ ...VACIO }); };
  const abrirEditar = (c) => setForm({
    ...VACIO, ...c,
    licencia_vence: c.licencia_vence || '', soat_vence: c.soat_vence || '',
    tecnomecanica_vence: c.tecnomecanica_vence || '', pagado_hasta: c.pagado_hasta || '',
    tarjeta_operacion_vence: c.tarjeta_operacion_vence || '',
  });

  const cambiar = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      if (form.id) {
        const resto = form;
        await viajesService.editarConductor(form.id, {
          telefono: resto.telefono, placa: resto.placa, moto: resto.moto,
          licencia_vence: resto.licencia_vence, soat_vence: resto.soat_vence,
          tecnomecanica_vence: resto.tecnomecanica_vence, pagado_hasta: resto.pagado_hasta,
          notas_admin: resto.notas_admin,
          empresa: resto.empresa, numero_interno: resto.numero_interno,
          tarjeta_operacion_vence: resto.tarjeta_operacion_vence,
        });
        addToast('Conductor actualizado', 'success');
      } else {
        await viajesService.crearConductor(form);
        addToast(`Conductor registrado. Compártele su correo y la contraseña temporal.`, 'success');
      }
      setForm(null);
      cargar();
    } catch (err) {
      addToast(err?.response?.data?.detail || 'No se pudo guardar', 'error');
    } finally {
      setGuardando(false);
    }
  };

  if (!datos) return <Layout><ZLoader size="md" label="Cargando motos..." /></Layout>;

  const enLinea = datos.conductores.filter(c => c.en_linea).length;
  const conductores = datos.conductores;

  const verPapeles = async (c) => {
    setPapeles(p => ({ ...p, [c.id]: 'cargando' }));
    try {
      const { data } = await viajesService.documentos(c.id);
      setPapeles(p => ({ ...p, [c.id]: data }));
    } catch (e) {
      setPapeles(p => ({ ...p, [c.id]: undefined }));
      addToast(e?.response?.data?.detail || 'No se pudieron cargar las fotos', 'error');
    }
  };


  return (
    <Layout>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="m-0 flex items-center gap-2 text-[22px] font-extrabold text-slate-800 dark:text-slate-100"><Icon name="moto" size={24} />Viajes en moto y carro</h1>
          <p className="m-0 mt-0.5 text-[13px] text-slate-500">Conductores independientes: ZIPPYGO solo los conecta con los pasajeros.</p>
        </div>
        <button type="button" className={btnP} onClick={abrirNuevo}><Icon name="moto" size={16} />Nuevo conductor</button>
      </div>

      {/* ── Encender / apagar cada tipo por aparte ── */}
      <div className={cx(tarjeta, 'mb-3 divide-x-0 divide-y divide-solid divide-slate-100 dark:divide-noche-borde')}>
        {['moto', 'carro'].map(t => {
          const on = !!datos.servicios?.[t];
          return (
            <div key={t} className="flex items-center justify-between gap-3 p-4">
              <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', on ? 'bg-zippy text-white' : 'bg-slate-100 text-slate-500 dark:bg-noche-alt')}><Icon name={t} size={22} /></span>
              <div className="min-w-0 flex-1">
                <b className="block text-[15px] text-slate-800 dark:text-slate-100">Viajes en {t} {on ? 'encendidos' : 'apagados'}</b>
                <span className="text-[12.5px] text-slate-500">{on ? 'Los clientes los pueden pedir.' : 'Los clientes no lo ven hasta que lo enciendas.'}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`Viajes en ${t}`}
                onClick={() => encender(t)}
                className={cx('relative h-8 w-14 shrink-0 cursor-pointer rounded-full border-0 transition-colors', on ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600')}
              >
                <span className={cx('absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all', on ? 'left-7' : 'left-1')} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mb-3.5 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {[
          [conductores.length, 'Conductores'],
          [enLinea, 'En línea ahora'],
          [datos.hoy.pedidos, 'Viajes pedidos hoy'],
          [datos.hoy.terminados, 'Terminados hoy'],
        ].map(([v, t]) => (
          <div key={t} className={cx(tarjeta, 'p-3.5')}>
            <b className="block text-xl font-black text-slate-800 dark:text-slate-100">{v}</b>
            <span className="text-[12px] text-slate-500">{t}</span>
          </div>
        ))}
      </div>

      <div className="mb-3 flex gap-2">
        <button type="button" className={chip(tab === 'conductores')} onClick={() => setTab('conductores')}>Conductores</button>
        <button type="button" className={chip(tab === 'viajes')} onClick={() => setTab('viajes')}>Viajes</button>
      </div>

      {tab === 'conductores' && (
        conductores.length === 0 ? (
          <div className={cx(tarjeta, 'p-8 text-center text-sm text-slate-500')}>Todavía no hay conductores. Registra el primero con "Nuevo conductor".</div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {conductores.map(c => (
              <div key={c.id} className={cx(tarjeta, 'min-w-0 p-4')}>
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zippy text-white" title={TIPO_NOMBRE[c.tipo_vehiculo]}><Icon name={c.tipo_vehiculo === 'carro' ? 'carro' : 'moto'} size={24} /></span>
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[15px] text-slate-800 dark:text-slate-100">{c.nombre} {c.apellido}</b>
                    <span className="block truncate text-[12.5px] text-slate-500">{TIPO_NOMBRE[c.tipo_vehiculo] || 'Moto'}{c.moto ? ` · ${c.moto}` : ''}</span>
                    <span className="block text-[12.5px] text-slate-500">
                      Placa <b className="text-slate-700 dark:text-slate-200">{c.placa}</b> · {c.telefono}
                    </span>
                    {c.fecha_inscripcion && <span className="block text-[12px] text-slate-400">Se inscribió solo desde la app · {fechaHoraCorta(c.fecha_inscripcion)}</span>}
                    <span className="text-[12px] text-slate-500">
                      {c.viajes} viaje{c.viajes === 1 ? '' : 's'}
                      {c.total_calificaciones > 0 ? ` · ${Number(c.calificacion).toFixed(1)} ★` : ''}
                    </span>
                  </div>
                  <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold',
                    c.estado !== 'activo' ? 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                      : c.en_linea ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-noche-alt dark:text-slate-400')}>
                    {c.estado_inscripcion === 'rechazado' ? 'Rechazado' : c.estado !== 'activo' ? 'Suspendido' : c.en_linea ? 'En línea' : 'Desconectado'}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <ChipDoc nombre="Licencia" iso={c.licencia_vence} femenino />
                  <ChipDoc nombre="SOAT" iso={c.soat_vence} />
                  <ChipDoc nombre="Tecno" iso={c.tecnomecanica_vence} opcional femenino />
                  {c.tarjeta_operacion_vence && <ChipDoc nombre="Tarjeta op." iso={c.tarjeta_operacion_vence} femenino />}
                  {c.pagado_hasta
                    ? <ChipDoc nombre="Mensualidad" iso={c.pagado_hasta} femenino hasta />
                    : <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11.5px] font-bold text-slate-500 dark:bg-noche-alt dark:text-slate-400">Mensualidad: sin cobrar</span>}
                </div>

                {c.problemas.length > 0 && c.estado === 'activo' && (
                  <p className="m-0 mt-2 text-[12px] font-bold text-red-600 dark:text-red-400">No puede recibir viajes: {c.problemas.join('; ')}</p>
                )}

                {Array.isArray(papeles[c.id]) && (
                  papeles[c.id].length === 0
                    ? <p className="m-0 mt-3 text-[12.5px] text-slate-400">No tiene fotos de papeles (lo registró un súper admin).</p>
                    : <div className="mt-3 grid grid-cols-3 gap-1.5">
                        {papeles[c.id].map(f => (
                          <button key={f.campo} type="button" onClick={() => f.url && setGrande(f)} className="cursor-pointer overflow-hidden rounded-lg border-0 bg-slate-100 p-0 text-left font-[inherit] dark:bg-noche-alt">
                            {f.url ? <img src={f.url} alt={f.nombre} className="block h-20 w-full object-cover" /> : <span className="flex h-20 items-center justify-center text-[11px] text-slate-400">Sin foto</span>}
                            <span className="block truncate px-1.5 py-1 text-[10.5px] font-bold text-slate-600 dark:text-slate-300">{f.nombre}</span>
                          </button>
                        ))}
                      </div>
                )}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button type="button" className={btnB} onClick={() => editar(c, { sumar_mes: true }, `Mensualidad de ${c.nombre} renovada un mes`)}>
                    <Icon name="dinero" size={15} />Pagó un mes
                  </button>
                  <button type="button" className={btnB} onClick={() => abrirEditar(c)}><Icon name="editar" size={15} />Documentos</button>
                  {!Array.isArray(papeles[c.id]) && (
                    <button type="button" className={btnB} disabled={papeles[c.id] === 'cargando'} onClick={() => verPapeles(c)}><Icon name="ver" size={15} />{papeles[c.id] === 'cargando' ? 'Cargando…' : 'Ver papeles'}</button>
                  )}
                  <button
                    type="button"
                    className={cx(btnB, c.estado === 'activo' ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-300')}
                    onClick={() => {
                      const nuevo = c.estado === 'activo' ? 'suspendido' : 'activo';
                      if (window.confirm(nuevo === 'suspendido' ? `¿Suspender a ${c.nombre}? No podrá recibir viajes.` : `¿Reactivar a ${c.nombre}?`)) {
                        editar(c, { estado: nuevo }, nuevo === 'suspendido' ? 'Conductor suspendido' : 'Conductor reactivado');
                      }
                    }}
                  >{c.estado === 'activo' ? 'Suspender' : 'Reactivar'}</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'viajes' && (
        datos.viajes.length === 0 ? (
          <div className={cx(tarjeta, 'p-8 text-center text-sm text-slate-500')}>Todavía no hay viajes.</div>
        ) : (
          <div className="flex max-w-[760px] flex-col gap-2.5">
            {datos.viajes.map(v => {
              const [txt, cls] = ESTADO_VIAJE[v.estado] || [v.estado, ''];
              return (
                <div key={v.id} className={cx(tarjeta, 'p-3.5')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <b className="text-[14px] text-slate-800 dark:text-slate-100">{v.corto} · {v.origen} → {v.destino}</b>
                      <p className="m-0 mt-0.5 text-[12.5px] text-slate-500">
                        {fechaHoraCorta(v.fecha_creacion)} · Pasajero {v.pasajero?.nombre}
                        {v.conductor ? ` · Conductor ${v.conductor.nombre}` : ''}
                      </p>
                      {v.estado === 'cancelado' && v.motivo_cancelacion && (
                        <p className="m-0 mt-0.5 text-[12px] text-red-600 dark:text-red-400">{v.motivo_cancelacion}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {v.precio ? <b className="block text-[14px] text-slate-800 dark:text-slate-100">{plata(v.precio)}</b> : null}
                      <span className={cx('mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-extrabold', cls)}>{txt}</span>
                      {v.calificacion ? <span className="block text-[11.5px] text-amber-600">{'★'.repeat(v.calificacion)}</span> : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── Foto de un papel en grande ── */}
      {grande && (
        <div className="fixed inset-0 z-[600] flex flex-col items-center justify-center gap-3 bg-black/85 p-4" onClick={() => setGrande(null)}>
          <img src={grande.url} alt={grande.nombre} className="max-h-[80vh] max-w-full rounded-xl object-contain" />
          <span className="text-[14px] font-bold text-white">{grande.nombre} · toca para cerrar</span>
        </div>
      )}

      {/* ── Formulario nuevo / editar ── */}
      {form && (
        <div className="fixed inset-0 z-[500] flex items-end justify-center bg-black/50 md:items-center" onClick={() => setForm(null)}>
          <form
            onSubmit={guardar}
            onClick={e => e.stopPropagation()}
            autoComplete="off"
            className="box-border max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-t-3xl bg-white p-5 dark:bg-noche-card md:rounded-3xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="m-0 text-lg font-extrabold text-slate-800 dark:text-slate-100">{form.id ? `Documentos de ${form.nombre}` : 'Nuevo conductor'}</h2>
              <button type="button" onClick={() => setForm(null)} className="cursor-pointer border-0 bg-transparent p-1 text-slate-500" aria-label="Cerrar"><Icon name="equis" size={20} /></button>
            </div>

            {!form.id && (
              <div className="mb-3 grid grid-cols-2 gap-2">
                {['moto', 'carro'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, tipo_vehiculo: t }))}
                    className={cx('flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-solid py-2.5 font-[inherit] text-[14px] font-extrabold',
                      form.tipo_vehiculo === t ? 'border-zippy bg-orange-50 text-zippy dark:bg-zippy/10' : 'border-slate-200 bg-white text-slate-600 dark:border-noche-borde dark:bg-noche-alt dark:text-slate-300')}
                  ><Icon name={t} size={20} />{TIPO_NOMBRE[t]}</button>
                ))}
              </div>
            )}

            {!form.id && (
              <p className="m-0 mb-3 rounded-xl bg-amber-50 px-3 py-2.5 text-[12.5px] leading-snug text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                {form.tipo_vehiculo === 'carro'
                  ? 'Antes de registrarlo revisa en físico: cédula, licencia para carro (B1 o superior) vigente, SOAT, tecnomecánica y que el carro sea suyo o tenga permiso del dueño.'
                  : 'Antes de registrarlo revisa en físico: cédula, licencia de conducción para moto (A2) vigente, SOAT, tecnomecánica y que la moto esté a su nombre o tenga permiso del dueño.'}
              </p>
            )}

            {!form.id && (
              <div className="grid grid-cols-2 gap-2.5">
                <div><label className={lbl}>Nombre</label><input className={campo} name="nombre" value={form.nombre} onChange={cambiar} required /></div>
                <div><label className={lbl}>Apellido</label><input className={campo} name="apellido" value={form.apellido} onChange={cambiar} /></div>
                <div><label className={lbl}>Cédula</label><input className={campo} name="documento" value={form.documento} onChange={cambiar} inputMode="numeric" /></div>
                <div><label className={lbl}>Celular</label><input className={campo} name="telefono" value={form.telefono} onChange={cambiar} inputMode="tel" required /></div>
                <div className="col-span-2"><label className={lbl}>Correo (con este entra a la app)</label><input className={campo} type="email" name="email" value={form.email} onChange={cambiar} required autoComplete="off" /></div>
                <div className="col-span-2">
                  <label className={lbl}>Contraseña temporal</label>
                  <div className="relative">
                    {/* new-password: que el celular no la rellene sola con una guardada */}
                    <input className={cx(campo, 'pr-11')} type={verClave ? 'text' : 'password'} name="password" value={form.password} onChange={cambiar} minLength={8} required autoComplete="new-password" placeholder="Mínimo 8 caracteres" />
                    <button type="button" onClick={() => setVerClave(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-1.5 text-slate-500" aria-label={verClave ? 'Ocultar' : 'Mostrar'}>
                      <Icon name="ver" size={18} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              {form.id && <div className="col-span-2"><label className={lbl}>Celular</label><input className={campo} name="telefono" value={form.telefono} onChange={cambiar} inputMode="tel" /></div>}
              <div><label className={lbl}>Placa</label><input className={cx(campo, 'uppercase')} name="placa" value={form.placa} onChange={cambiar} maxLength={8} required /></div>
              <div><label className={lbl}>{form.tipo_vehiculo === 'carro' ? 'Carro (marca y color)' : 'Moto (marca y color)'}</label><input className={campo} name="moto" value={form.moto} onChange={cambiar} placeholder={form.tipo_vehiculo === 'carro' ? 'Chevrolet Spark gris' : 'Honda CB 125 roja'} /></div>
              <div><label className={lbl}>Licencia vence</label><input className={campo} type="date" name="licencia_vence" value={form.licencia_vence} onChange={cambiar} required /></div>
              <div><label className={lbl}>SOAT vence</label><input className={campo} type="date" name="soat_vence" value={form.soat_vence} onChange={cambiar} required /></div>
              <div><label className={lbl}>Tecnomecánica vence</label><input className={campo} type="date" name="tecnomecanica_vence" value={form.tecnomecanica_vence} onChange={cambiar} /><span className="text-[11px] text-slate-400">Vacía si el vehículo es nuevo</span></div>
              <div><label className={lbl}>Mensualidad pagada hasta</label><input className={campo} type="date" name="pagado_hasta" value={form.pagado_hasta} onChange={cambiar} /></div>
              <div className="col-span-2"><label className={lbl}>Notas (solo las ve el súper admin)</label><textarea className={cx(campo, 'min-h-[60px]')} name="notas_admin" value={form.notas_admin} onChange={cambiar} /></div>
            </div>

            <button type="submit" disabled={guardando} className={cx(btnP, 'mt-4 w-full py-3 text-[15px]')}>
              {guardando ? 'Guardando...' : form.id ? 'Guardar cambios' : 'Registrar conductor'}
            </button>
          </form>
        </div>
      )}
    </Layout>
  );
};

export default ConductoresPage;
