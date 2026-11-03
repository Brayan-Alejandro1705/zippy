import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import BotonesFoto from '../../components/BotonesFoto';
import Icon from '../../components/Icons';
import { useToast } from '../../context/ToastContext';
import { viajesService } from '../../config/api';
import { guardarCuentaActual } from '../../utils/cuentas';
import { contenedor, Encabezado, Logo } from '../../components/layout/piezas';
import { cx, tarjeta } from '../../ui/tw';

// ============================================================================
// InscripcionConductorPage — el conductor de moto o carro se inscribe solo
// (oct 2026).
//
// Llena sus datos, sube fotos de sus papeles y queda dentro de una vez, sin
// código de correo ni aprobación (así lo decidió el dueño). Las fotos quedan
// en un lugar privado para que el súper admin las consulte si hace falta.
//
// Las fotos se achican en el celular antes de subirlas: una foto de cámara
// pesa 3-5 MB y con cinco se demoraba mucho en datos.
// ============================================================================

const campo = 'box-border w-full rounded-xl border-[1.5px] border-solid border-slate-200 bg-white px-3.5 py-3 font-[inherit] text-[14px] text-slate-800 outline-none focus:border-zippy dark:border-noche-borde dark:bg-noche-alt dark:text-slate-100';
const lbl = 'mb-1.5 block text-[13px] font-extrabold text-slate-700 dark:text-slate-200';
const seccion = cx(tarjeta, 'mb-3 p-4');
const tituloSeccion = 'm-0 mb-3 flex items-center gap-2 text-[16px] font-extrabold text-slate-800 dark:text-slate-100';

const VACIO = {
  tipo_vehiculo: 'moto', nombre: '', apellido: '', documento: '', telefono: '', email: '', password: '',
  placa: '', vehiculo: '',
  licencia_vence: '', soat_vence: '', tecnomecanica_vence: '',
};

// Deja la foto en 1800 px como máximo y en JPEG: se lee bien y pesa poco
const achicar = (archivo) => new Promise((resolver) => {
  const url = URL.createObjectURL(archivo);
  const img = new Image();
  img.onload = () => {
    const escala = Math.min(1, 1800 / Math.max(img.width, img.height));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(img.width * escala);
    lienzo.height = Math.round(img.height * escala);
    lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
    URL.revokeObjectURL(url);
    lienzo.toBlob(b => resolver(b || archivo), 'image/jpeg', 0.85);
  };
  img.onerror = () => { URL.revokeObjectURL(url); resolver(archivo); };
  img.src = url;
});

const Foto = ({ titulo, ayuda, archivo, onArchivo }) => (
  <div className="mb-4">
    <span className={lbl}>{titulo}</span>
    {ayuda && <span className="-mt-1 mb-1.5 block text-[12px] text-slate-500">{ayuda}</span>}
    {archivo ? (
      <div className="relative overflow-hidden rounded-xl border-[1.5px] border-solid border-emerald-300 dark:border-emerald-500/40">
        <img src={archivo.vista} alt={titulo} className="block h-40 w-full object-cover" />
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[11.5px] font-extrabold text-white"><Icon name="check" size={13} />Lista</span>
      </div>
    ) : (
      <div className="flex h-24 items-center justify-center rounded-xl border-[1.5px] border-dashed border-slate-300 bg-slate-50 text-[12.5px] text-slate-400 dark:border-noche-borde dark:bg-noche-alt">
        <Icon name="camara" size={20} style={{ marginRight: 6 }} />Todavía sin foto
      </div>
    )}
    <BotonesFoto hayFoto={!!archivo} onArchivo={onArchivo} />
  </div>
);

const InscripcionConductorPage = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [form, setForm] = useState(VACIO);
  const [fotos, setFotos] = useState({});
  const [verClave, setVerClave] = useState(false);
  const [acepta, setAcepta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const carro = form.tipo_vehiculo === 'carro';

  const cambiar = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const ponerFoto = (campoFoto) => async (archivo) => {
    const blob = await achicar(archivo);
    setFotos(f => ({ ...f, [campoFoto]: { blob, vista: URL.createObjectURL(blob) } }));
  };

  const enviar = async (e) => {
    e.preventDefault();
    const faltan = [
      ['foto_cedula', 'la cédula'], ['foto_licencia', 'la licencia'], ['foto_soat', 'el SOAT'],
      ['foto_vehiculo', carro ? 'el carro' : 'la moto'],
    ].filter(([c]) => !fotos[c]);
    if (faltan.length) { addToast(`Falta la foto de ${faltan[0][1]}`, 'error'); return; }
    if (!acepta) { addToast('Acepta las condiciones para enviar la inscripción', 'error'); return; }

    const datos = new FormData();
    Object.entries(form).forEach(([k, v]) => datos.append(k, v));
    datos.append('acepta_condiciones', 'true');
    Object.entries(fotos).forEach(([k, f]) => datos.append(k, f.blob, `${k}.jpg`));

    setEnviando(true);
    try {
      const { data } = await viajesService.inscribirse(datos);
      // Queda con la sesión iniciada, igual que al hacer login
      guardarCuentaActual();
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('usuario', JSON.stringify(data.usuario));
      guardarCuentaActual();
      addToast('¡Listo! Ya eres conductor de Aventón', 'success');
      navigate('/conductor', { replace: true });
    } catch (err) {
      const d = err?.response?.data?.detail;
      addToast(typeof d === 'string' ? d : 'No se pudo enviar la inscripción. Revisa tu señal e intenta de nuevo.', 'error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className={contenedor}>
      <Encabezado>
        <Logo onClick={() => navigate('/')} />
        <span className="flex-1 text-[15px] font-extrabold text-white">Conductores de Aventón</span>
      </Encabezado>

      <form onSubmit={enviar} autoComplete="off" className="box-border w-full max-w-[600px] self-center px-4 pb-12 pt-4">
        <div className="mb-3 rounded-2xl bg-slate-800 p-4 text-white dark:bg-noche-card dark:ring-1 dark:ring-noche-borde">
          <b className="block text-[19px] font-black">Trabaja con ZIPPYGO</b>
          <span className="mt-1 block text-[13px] leading-snug text-white/80">
            Inscríbete con tu moto o tu carro y empieza a recibir viajes de una vez.
          </span>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2.5">
          {[['moto', 'Moto'], ['carro', 'Carro']].map(([t, n]) => (
            <button
              key={t}
              type="button"
              onClick={() => setForm(f => ({ ...f, tipo_vehiculo: t }))}
              className={cx('flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-solid py-3.5 font-[inherit] text-[15px] font-extrabold',
                form.tipo_vehiculo === t ? 'border-zippy bg-orange-50 text-zippy dark:bg-zippy/10' : 'border-transparent bg-white text-slate-600 shadow-[0_1px_4px_rgba(15,23,42,0.07)] dark:bg-noche-card dark:text-slate-300')}
            ><Icon name={t} size={24} />Tengo {n.toLowerCase()}</button>
          ))}
        </div>

        <div className={seccion}>
          <h2 className={tituloSeccion}><Icon name="perfil" size={19} />Tus datos</h2>
          <div className="grid grid-cols-2 gap-2.5">
            <div><label className={lbl}>Nombre</label><input className={campo} name="nombre" value={form.nombre} onChange={cambiar} required /></div>
            <div><label className={lbl}>Apellido</label><input className={campo} name="apellido" value={form.apellido} onChange={cambiar} required /></div>
            <div><label className={lbl}>Cédula</label><input className={campo} name="documento" value={form.documento} onChange={cambiar} inputMode="numeric" required /></div>
            <div><label className={lbl}>Celular</label><input className={campo} name="telefono" value={form.telefono} onChange={cambiar} inputMode="tel" required /></div>
            <div className="col-span-2"><label className={lbl}>Correo</label><input className={campo} type="email" name="email" value={form.email} onChange={cambiar} required autoComplete="email" /></div>
            <div className="col-span-2">
              <label className={lbl}>Crea una contraseña</label>
              <div className="relative">
                <input className={cx(campo, 'pr-11')} type={verClave ? 'text' : 'password'} name="password" value={form.password} onChange={cambiar} minLength={8} required autoComplete="new-password" />
                <button type="button" onClick={() => setVerClave(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-1.5 text-slate-500" aria-label={verClave ? 'Ocultar' : 'Mostrar'}><Icon name="ver" size={18} /></button>
              </div>
              <span className="mt-1 block text-[11.5px] text-slate-500">Mínimo 8 caracteres, con una mayúscula y un número.</span>
            </div>
          </div>
        </div>

        <div className={seccion}>
          <h2 className={tituloSeccion}><Icon name={carro ? 'carro' : 'moto'} size={19} />Tu {carro ? 'carro' : 'moto'}</h2>
          <div className="grid grid-cols-2 gap-2.5">
            <div><label className={lbl}>Placa</label><input className={cx(campo, 'uppercase')} name="placa" value={form.placa} onChange={cambiar} maxLength={8} required /></div>
            <div><label className={lbl}>Marca y color</label><input className={campo} name="vehiculo" value={form.vehiculo} onChange={cambiar} placeholder={carro ? 'Chevrolet Spark gris' : 'Honda CB 125 roja'} /></div>
          </div>
          <div className="mt-3">
            <Foto titulo={`Foto ${carro ? 'del carro' : 'de la moto'}`} ayuda="Que se vea la placa." archivo={fotos.foto_vehiculo} onArchivo={ponerFoto('foto_vehiculo')} />
          </div>
        </div>

        <div className={seccion}>
          <h2 className={tituloSeccion}><Icon name="identificacion" size={19} />Tus papeles</h2>
          <p className="-mt-1 mb-3 text-[12.5px] leading-snug text-slate-500">Toma las fotos con buena luz y que se lean bien. Solo las ve el equipo de ZIPPYGO.</p>

          <Foto titulo="Cédula (por delante)" archivo={fotos.foto_cedula} onArchivo={ponerFoto('foto_cedula')} />

          <label className={lbl}>Licencia de conducción: vence</label>
          <input className={cx(campo, 'mb-1')} type="date" name="licencia_vence" value={form.licencia_vence} onChange={cambiar} required />
          <span className="mb-2 block text-[11.5px] text-slate-500">{carro ? 'Para carro (B1 o superior).' : 'Para moto (A2).'}</span>
          <Foto titulo="Foto de la licencia" archivo={fotos.foto_licencia} onArchivo={ponerFoto('foto_licencia')} />

          <label className={lbl}>SOAT: vence</label>
          <input className={cx(campo, 'mb-3')} type="date" name="soat_vence" value={form.soat_vence} onChange={cambiar} required />
          <Foto titulo="Foto del SOAT" archivo={fotos.foto_soat} onArchivo={ponerFoto('foto_soat')} />

          <label className={lbl}>Tecnomecánica: vence <span className="font-semibold text-slate-400">(vacía si el vehículo es nuevo)</span></label>
          <input className={cx(campo, 'mb-4')} type="date" name="tecnomecanica_vence" value={form.tecnomecanica_vence} onChange={cambiar} />

        </div>

        <label className="mb-3 flex cursor-pointer gap-2.5 rounded-2xl bg-slate-100 px-3.5 py-3 text-[12.5px] leading-snug text-slate-600 dark:bg-noche-alt dark:text-slate-300">
          <input type="checkbox" checked={acepta} onChange={e => setAcepta(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF7A00]" />
          <span>
            Soy conductor <b>independiente</b>: ZIPPYGO solo me pone en contacto con pasajeros, no es mi empleador y no cobra mis viajes.
            Si ZIPPYGO cobra una mensualidad por aparecer en la app, la pagaré. Autorizo a ZIPPYGO SAS a guardar mis datos y las fotos de mis documentos
            para verificar mi identidad, según la Ley 1581 de 2012.
          </span>
        </label>

        <button type="submit" disabled={enviando} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-0 bg-zippy px-4 py-[15px] font-[inherit] text-[15px] font-extrabold text-white shadow-[0_6px_18px_rgba(255,122,0,0.3)] disabled:opacity-60">
          {enviando ? 'Enviando fotos…' : 'Enviar inscripción'}
        </button>
        <p className="m-0 mt-3 text-center text-[13px] text-slate-500">
          ¿Ya te inscribiste? <Link to="/login" className="font-bold text-zippy no-underline">Inicia sesión</Link>
        </p>
      </form>
    </div>
  );
};

export default InscripcionConductorPage;
