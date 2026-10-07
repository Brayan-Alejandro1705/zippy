import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Bienvenida.css';

/*
 * Lo primero que ve quien abre la app sin haber entrado.
 *
 * Antes la app caia directo en la tienda, y la gente no entendia que tenia que
 * crear una cuenta: miraba, tocaba Perfil y se encontraba una pantalla vacia.
 * Ahora lo primero es elegir: entrar o crear cuenta.
 *
 * OJO con "Mirar sin cuenta": NO se puede quitar. Apple (regla 5.1.1) rechaza
 * las apps que obligan a registrarse solo para ver productos. Por eso va
 * pequeño y abajo, pero va.
 */
const BienvenidaPage = () => {
  const navigate = useNavigate();

  return (
    <div className="bv-pantalla">
      <div className="bv-arriba">
        <img src="/logo-zippy.jpeg" alt="Zippy Go" className="bv-logo" />
        <h1 className="bv-titulo">Pide lo que quieras en Garzón</h1>
        <p className="bv-texto">Comida, mercado y mandados, de los negocios de aquí a tu puerta.</p>
      </div>

      <div className="bv-botones">
        <button className="bv-btn bv-btn--principal" onClick={() => navigate('/register')}>
          Crear cuenta
        </button>
        <button className="bv-btn bv-btn--secundario" onClick={() => navigate('/login')}>
          Ya tengo cuenta
        </button>
        <button className="bv-saltar" onClick={() => navigate('/tienda')}>
          Mirar sin cuenta
        </button>
      </div>
    </div>
  );
};

export default BienvenidaPage;
