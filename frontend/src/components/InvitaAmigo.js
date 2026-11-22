import React, { useEffect, useState, useCallback } from 'react';
import Icon from './Icons';
import { invitacionesService } from '../config/api';
import { useToast } from '../context/ToastContext';
import { compartir } from '../utils/compartir';

// ============================================================================
// InvitaAmigo — "Invita a un amigo" en el perfil del cliente (nov 2026).
// Cuando el amigo hace su primer pedido, los dos ganan un domicilio gratis.
// También deja escribir el código de quien te invitó (antes del primer pedido).
// Ver backend/routes_invitaciones.py.
// ============================================================================

const InvitaAmigo = () => {
  const { addToast } = useToast();
  const [info, setInfo] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [verInvitados, setVerInvitados] = useState(false);

  const cargar = useCallback(() => {
    invitacionesService.mia().then(({ data }) => setInfo(data)).catch(() => setInfo(null));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  if (!info || !info.activo) return null;

  const invitar = () => compartir({ titulo: 'Te regalo un domicilio en ZIPPYGO', texto: info.texto_compartir });

  const canjear = async (e) => {
    e.preventDefault();
    if (!codigo.trim()) return;
    setEnviando(true);
    try {
      const { data } = await invitacionesService.canjear(codigo.trim());
      addToast(`Listo. Cuando te entreguen tu primer pedido, tú y ${data.invitado_por} ganan un domicilio gratis.`, 'success');
      setCodigo('');
      cargar();
    } catch (err) {
      addToast(err?.response?.data?.detail || 'No se pudo usar ese código', 'error');
    } finally {
      setEnviando(false);
    }
  };

  const premiados = info.invitados.filter(i => i.premiado).length;

  return (
    <div className="mx-4 mb-3 mt-1 overflow-hidden rounded-[18px] bg-[linear-gradient(135deg,#FF7A00,#F26A00)] text-white shadow-[0_6px_18px_rgba(242,106,0,0.3)] md:mx-0">
      <div className="flex items-center gap-3 px-4 pt-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white/20"><Icon name="regalo" size={24} /></span>
        <div className="min-w-0 flex-1">
          <b className="block text-[16px]">Invita a un amigo</b>
          <span className="block text-[12.5px] leading-snug text-white/90">Cuando haga su primer pedido, <b>los dos</b> ganan un domicilio gratis.</span>
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 pt-3">
        <span className="flex-1 rounded-xl border-2 border-dashed border-white/60 bg-white/15 py-2 text-center text-[18px] font-black tracking-[2px]">{info.codigo}</span>
        <button type="button" onClick={invitar} className="flex cursor-pointer items-center gap-1.5 rounded-xl border-0 bg-white px-3.5 py-2.5 font-[inherit] text-[14px] font-extrabold text-orange-600">
          <Icon name="enviar" size={16} />Invitar
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 bg-black/10 px-4 py-2.5 text-[13px]">
        <span>Domicilios gratis: <b className="text-[15px]">{info.domicilios_gratis}</b>{info.domicilios_gratis > 0 && ' · se usan solos en tu próximo pedido'}</span>
        {info.invitados.length > 0 && (
          <button type="button" onClick={() => setVerInvitados(v => !v)} className="cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-[12.5px] font-bold text-white underline">
            {info.invitados.length} invitado{info.invitados.length === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {verInvitados && (
        <div className="bg-black/10 px-4 pb-3 text-[13px]">
          {info.invitados.map((i, k) => (
            <div key={k} className="flex justify-between border-0 border-t border-solid border-white/15 py-1.5">
              <span>{i.nombre}</span><b>{i.premiado ? '✓ Ganaste 1 domicilio' : 'Aún no pide'}</b>
            </div>
          ))}
          {premiados > 0 && <p className="m-0 mt-1 text-[12px] text-white/85">Ya ganaste {premiados} domicilio{premiados === 1 ? '' : 's'} invitando.</p>}
        </div>
      )}

      {info.puede_canjear && (
        <form onSubmit={canjear} className="flex gap-2 bg-white px-4 py-3 dark:bg-noche-card">
          <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} maxLength={20} placeholder="¿Te invitó un amigo? Su código"
            className="min-w-0 flex-1 rounded-[10px] border-[1.5px] border-solid border-slate-200 px-3 py-2.5 font-[inherit] text-[14px] text-slate-800 outline-none focus:border-zippy dark:border-noche-borde dark:bg-noche-alt dark:text-slate-100" />
          <button type="submit" disabled={enviando || !codigo.trim()} className="cursor-pointer rounded-[10px] border-0 bg-zippy px-4 font-[inherit] text-[14px] font-extrabold text-white disabled:opacity-50">Usar</button>
        </form>
      )}
      {info.invitado_por && !info.puede_canjear && info.domicilios_gratis === 0 && !info.invitados.length && (
        <p className="m-0 bg-black/10 px-4 pb-3 text-[12.5px]">Te invitó {info.invitado_por}. Cuando te entreguen tu primer pedido, los dos ganan un domicilio gratis.</p>
      )}
    </div>
  );
};

export default InvitaAmigo;
