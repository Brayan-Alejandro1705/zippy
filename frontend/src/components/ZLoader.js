import React from 'react';
import '../styles/ZLoader.css';

/**
 * Loader de marca: la "Z" de Zippy rebotando.
 * size: 'sm' (inline, junto a texto) | 'md' (default) | 'lg' (pantalla completa de una sección)
 * fullscreen: si es true, cubre todo el viewport (para la carga inicial de la app)
 */
const ZLoader = ({ size = 'md', label, fullscreen = false, inverted = false, className = '' }) => {
  const contenido = (
    <div className={`zl-wrap zl-wrap--${size} ${inverted ? 'zl-wrap--inverted' : ''} ${className}`}>
      <div className="zl-mark">Z</div>
      {label && <p className="zl-label">{label}</p>}
    </div>
  );

  if (fullscreen) {
    return <div className="zl-fullscreen">{contenido}</div>;
  }

  return contenido;
};

export default ZLoader;
