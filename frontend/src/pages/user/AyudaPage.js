import React from 'react';
import UserLayout from '../../components/UserLayout';
import CentroAyuda from '../../components/CentroAyuda';
import '../../styles/UserPanel.css';

/*
 * La ayuda del cliente, con boton propio en la barra de abajo.
 *
 * Antes era la ultima pestaña del Perfil: quien tenia un problema con un
 * pedido tenia que adivinar que la ayuda estaba ahi. No pide sesion a
 * proposito, porque quien no logra entrar a su cuenta tambien necesita ayuda.
 */
const AyudaPage = () => (
  <UserLayout>
    <div className="up-pedidos-cabecera">
      <h1 className="up-pedidos-titulo">Ayuda</h1>
      <p className="up-pedidos-resumen">Estamos para resolverte</p>
    </div>
    <div className="up-content">
      <CentroAyuda perfil="cliente" />
    </div>
  </UserLayout>
);

export default AyudaPage;
