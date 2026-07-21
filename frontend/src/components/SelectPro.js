import React, { useState, useRef, useEffect } from 'react';
import '../styles/selectpro.css';

// ============================================================================
// SelectPro.js - Desplegable propio (reemplaza al <select> nativo del sistema)
//
// Uso:
//   <SelectPro
//     value={form.categoria}
//     onChange={(v) => setForm(p => ({ ...p, categoria: v }))}
//     options={['Restaurante', 'Panadería']}
//     placeholder="Selecciona una categoría"
//   />
//
// options acepta strings o { value, label }.
// ============================================================================

const normalizar = (opt) =>
  typeof opt === 'string' ? { value: opt, label: opt } : opt;

const SelectPro = ({
  value,
  onChange,
  options = [],
  placeholder = 'Selecciona una opción',
  disabled = false,
  name,
  error = false,
}) => {
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(-1);
  const cajaRef = useRef(null);
  const listaRef = useRef(null);

  const opts = options.map(normalizar);
  const seleccionada = opts.find(o => o.value === value);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => {
      if (cajaRef.current && !cajaRef.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('touchstart', fuera);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('touchstart', fuera);
    };
  }, [abierto]);

  // Al abrir, resaltar la opción actual y llevarla a la vista
  useEffect(() => {
    if (!abierto) return;
    const idx = opts.findIndex(o => o.value === value);
    setResaltado(idx);
    requestAnimationFrame(() => {
      const activo = listaRef.current?.querySelector('.sp-opt--sel');
      activo?.scrollIntoView({ block: 'nearest' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const elegir = (val) => {
    onChange?.(val);
    setAbierto(false);
  };

  const teclado = (e) => {
    if (disabled) return;

    if (!abierto && ['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      setAbierto(true);
      return;
    }
    if (!abierto) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      setAbierto(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setResaltado(i => Math.min(i + 1, opts.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setResaltado(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (opts[resaltado]) elegir(opts[resaltado].value);
    }
  };

  return (
    <div className={`sp-wrap ${abierto ? 'sp-wrap--open' : ''}`} ref={cajaRef}>
      <button
        type="button"
        name={name}
        className={`sp-control ${error ? 'sp-control--err' : ''}`}
        onClick={() => !disabled && setAbierto(v => !v)}
        onKeyDown={teclado}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={abierto}
      >
        <span className={`sp-value ${!seleccionada ? 'sp-value--ph' : ''}`}>
          {seleccionada ? seleccionada.label : placeholder}
        </span>
        <svg className="sp-chevron" width="18" height="18" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {abierto && (
        <ul className="sp-panel" role="listbox" ref={listaRef}>
          {opts.map((o, i) => {
            const activa = o.value === value;
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={activa}
                className={`sp-opt ${activa ? 'sp-opt--sel' : ''} ${i === resaltado ? 'sp-opt--hl' : ''}`}
                onMouseEnter={() => setResaltado(i)}
                onClick={() => elegir(o.value)}
              >
                <span className="sp-opt-label">{o.label}</span>
                {activa && (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="2.4"
                       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default SelectPro;