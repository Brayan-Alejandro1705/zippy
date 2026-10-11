import React from 'react';
import { useNavigate } from 'react-router-dom';

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

  const boton = 'cursor-pointer rounded-full p-4 font-[inherit] text-base font-extrabold active:translate-y-px';

  return (
    // min-h-[100dvh]: en el celular la barra del navegador no tapa los botones
    <div className="box-border flex min-h-screen min-h-[100dvh] flex-col justify-between bg-[linear-gradient(165deg,#FF8A24_0%,#FF7A00_55%,#E86400_100%)] px-6 pb-[calc(28px+env(safe-area-inset-bottom))] pt-[calc(40px+env(safe-area-inset-top))] text-white xs:px-7 xs:pt-[calc(48px+env(safe-area-inset-top))]">
      <div className="flex flex-1 flex-col items-center justify-center gap-3.5 text-center">
        <img
          src="/logo-zippy.jpeg"
          alt="Zippy Go"
          className="mb-2.5 h-[88px] w-[88px] rounded-3xl bg-white object-contain shadow-[0_10px_28px_rgba(120,50,0,0.3)] xs:h-[104px] xs:w-[104px]"
        />
        <h1 className="m-0 max-w-[300px] text-[24px] font-extrabold leading-tight xs:text-[27px]">Pide lo que quieras en Garzón</h1>
        <p className="m-0 max-w-[290px] text-[15px] leading-normal text-white/90">Comida, mercado y mandados, de los negocios de aquí a tu puerta.</p>
      </div>

      <div className="mx-auto mt-8 flex w-full max-w-[380px] flex-col gap-3">
        <button className={`${boton} border-0 bg-white text-[#E86400] shadow-[0_8px_20px_rgba(120,50,0,0.25)]`} onClick={() => navigate('/register')}>
          Crear cuenta
        </button>
        <button className={`${boton} border-2 border-solid border-white/85 bg-transparent text-white`} onClick={() => navigate('/login')}>
          Ya tengo cuenta
        </button>
        <button className="cursor-pointer border-0 bg-transparent p-2.5 font-[inherit] text-sm font-semibold text-white/90 underline" onClick={() => navigate('/tienda')}>
          Mirar sin cuenta
        </button>
      </div>
    </div>
  );
};

export default BienvenidaPage;
