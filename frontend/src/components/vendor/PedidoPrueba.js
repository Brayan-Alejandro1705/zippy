import React, { useState } from 'react';
import Icon from '../Icons';
import { cx, tarjeta, btn } from '../../ui/tw';
import { marcarPruebaHecha } from './InicioNegocio';

// ============================================================================
// PedidoPrueba — el negocio nuevo practica un pedido sin cliente real (nov 2026).
// Todo pasa en esta pantalla: no se guarda en el servidor, no cuenta en las
// ventas y no le llega a ningún repartidor.
// ============================================================================

const PASOS = {
  nuevo:     { badge: 'Pendiente', boton: 'Aceptar pedido', ayuda: 'Te sonó el celular: llegó un pedido. Acéptalo para que el cliente sepa que ya lo estás preparando.' },
  preparando:{ badge: 'Preparando', boton: 'Marcar listo para recoger', ayuda: 'Prepáralo y empácalo. Cuando esté listo, márcalo para que le avisemos a los repartidores.' },
  listo:     { badge: 'Listo para recoger', boton: 'Terminar la prueba', ayuda: 'Un repartidor de ZIPPYGO va por él. Entrégaselo cuando te muestre el código de recogida ZP-0000.' },
};

const PedidoPrueba = ({ negocioId, onCerrar }) => {
  const [paso, setPaso] = useState('nuevo');
  const p = PASOS[paso];

  const avanzar = () => {
    if (paso === 'nuevo') setPaso('preparando');
    else if (paso === 'preparando') setPaso('listo');
    else { if (negocioId) marcarPruebaHecha(negocioId); onCerrar(true); }
  };

  return (
    <div className={cx(tarjeta, 'mb-4 border-0 border-l-4 border-solid border-l-violet-500 p-4')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 font-mono text-[15px] font-bold text-slate-800 dark:text-slate-100">#PRUEBA</p>
          <p className="m-0 mt-0.5 text-xs text-slate-400">Cliente de prueba · ZIPPYGO</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[11.5px] font-extrabold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">Pedido de prueba</span>
          <span className="text-[12px] font-bold text-slate-500">{p.badge}</span>
        </div>
      </div>
      <p className="m-0 mt-2.5 text-[13px] text-slate-700 dark:text-slate-300">1 × Producto de prueba · $10.000</p>
      {paso === 'listo' && (
        <p className="m-0 mt-2 flex items-center gap-1.5 text-[13px] font-bold text-amber-700 dark:text-amber-300"><Icon name="llave" size={14} /> Código de recogida: ZP-0000</p>
      )}
      <div className="mt-2.5 rounded-xl bg-violet-50 p-3 text-[13px] leading-snug text-violet-900 dark:bg-violet-500/10 dark:text-violet-200">{p.ayuda}</div>
      <div className="mt-3 flex gap-2">
        <button type="button" className={cx(paso === 'listo' ? btn.principal : btn.azul, 'flex-1')} onClick={avanzar}>{p.boton}</button>
        <button type="button" className={btn.borde} onClick={() => onCerrar(false)}>Salir</button>
      </div>
      <p className="m-0 mt-2 text-[11.5px] text-slate-400">No cuenta en tus ventas y no le llega a ningún repartidor.</p>
    </div>
  );
};

export default PedidoPrueba;
