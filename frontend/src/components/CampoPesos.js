import React from 'react';

// ============================================================================
// CampoPesos — casilla para escribir precios en pesos colombianos.
//
// Antes los precios se escribian en una casilla de "numero" del navegador. En
// Colombia el punto separa los miles ("32.000"), pero el navegador lo toma
// como decimal: un negocio escribio 32.000 y el producto quedo costando $32.
//
// Aqui solo se aceptan digitos y se muestran con sus puntos de miles mientras
// se escribe (32.000). Al formulario le llega el numero limpio ("32000").
// ============================================================================

export const PRECIO_MINIMO = 100;

const conPuntos = (digitos) => (digitos ? Number(digitos).toLocaleString('es-CO') : '');

const CampoPesos = ({ name, value, onChange, className = '', placeholder = '0', ...resto }) => {
  // Del servidor el precio puede llegar como "32000.00": se redondea. Lo que
  // escribe la persona ya llega aqui sin puntos (ver cambiar).
  const crudo = String(value ?? '');
  const digitos = /^\d+\.\d+$/.test(crudo) ? String(Math.round(Number(crudo))) : crudo.replace(/\D/g, '');

  const cambiar = (e) => {
    const limpio = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 9);
    // Se imita el evento de un input normal para que sirva con handleChange
    onChange({ target: { name, value: limpio } });
  };

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] font-bold text-slate-400">$</span>
      <input
        {...resto}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={conPuntos(digitos)}
        onChange={cambiar}
        placeholder={placeholder}
        className={className}
        style={{ paddingLeft: 26, ...(resto.style || {}) }}
      />
    </div>
  );
};

export default CampoPesos;
