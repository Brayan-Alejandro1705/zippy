import React from 'react';
import UserLayout from '../../components/UserLayout';
import CentroAyuda from '../../components/CentroAyuda';

/*
 * La ayuda del cliente, con boton propio en la barra de abajo.
 *
 * Antes era la ultima pestaña del Perfil: quien tenia un problema con un
 * pedido tenia que adivinar que la ayuda estaba ahi. No pide sesion a
 * proposito, porque quien no logra entrar a su cuenta tambien necesita ayuda.
 */
const AyudaPage = () => (
  <UserLayout>
    <div className="px-4 pb-1 pt-5 md:px-0">
      <h1 className="m-0 text-[22px] font-extrabold text-slate-800 dark:text-slate-100">Ayuda</h1>
      <p className="m-0 mt-1 text-[13px] text-slate-500 dark:text-slate-400">Estamos para resolverte</p>
    </div>
    <div className="px-4 pb-2 pt-3 md:px-0">
      <CentroAyuda perfil="cliente" />
    </div>
  </UserLayout>
);

export default AyudaPage;
