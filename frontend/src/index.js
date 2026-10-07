import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { avisarQueArranco } from './utils/actualizaciones';
import { registrarSinInternet } from './utils/sinInternet';

// Lo primero de todo: confirmarle a Capgo que esta version arranco bien. Si no
// se avisa, el plugin asume que la actualizacion rompio la app y vuelve a la
// anterior. Va antes de pintar nada para que ni un error de React lo impida.
avisarQueArranco();

// Pantalla propia cuando se cae la señal, en vez del aviso gris de Android.
registrarSinInternet();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
