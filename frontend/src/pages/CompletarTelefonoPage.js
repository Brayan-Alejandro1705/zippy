import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usuariosService } from '../config/api';
import ZLoader from '../components/ZLoader';
import Icon from '../components/Icons';
import PantallaAuth, { TituloAuth, ErrorAuth, CampoAuth, etiquetaAuth, botonAuth } from '../components/auth/PantallaAuth';

// ============================================================================
// CompletarTelefonoPage - Despues de entrar con Google o Apple.
// Ninguno de los dos entrega el numero de celular, y sin el el repartidor no
// tiene como avisar que llego. Se pide una sola vez.
// ============================================================================

const CompletarTelefonoPage = () => {
  const navigate = useNavigate();
  const usuario = (() => { try { return JSON.parse(localStorage.getItem('usuario') || '{}'); } catch { return {}; } })();
  const [telefono, setTelefono] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const guardar = async (e) => {
    e.preventDefault();
    const limpio = telefono.replace(/[^\d+]/g, '');
    if (limpio.replace(/\D/g, '').length < 10) { setError('Escribe tu número de celular completo (10 dígitos)'); return; }
    setGuardando(true);
    setError('');
    try {
      const { data } = await usuariosService.actualizarPerfil({ telefono: limpio });
      localStorage.setItem('usuario', JSON.stringify({ ...usuario, ...data, telefono: data?.telefono || limpio }));
      navigate('/tienda', { replace: true });
    } catch (err) {
      const d = err.response?.data?.detail;
      setError((typeof d === 'string' && d) || (Array.isArray(d) && d[0]?.msg) || 'No pudimos guardar el número');
      setGuardando(false);
    }
  };

  return (
    <PantallaAuth>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zippy/15 text-zippy">
        <Icon name="telefono" size={26} />
      </div>
      <div className="text-center">
        <TituloAuth
          titulo={`¡Hola${usuario.nombre ? `, ${usuario.nombre}` : ''}!`}
          sub="Un último paso: ¿a qué número te llama el repartidor cuando llegue con tu pedido?"
        />
      </div>
      <form onSubmit={guardar} noValidate>
        {error && <ErrorAuth>{error}</ErrorAuth>}
        <div className="mb-[18px]">
          <label htmlFor="ct-tel" className={etiquetaAuth}>Celular</label>
          <CampoAuth
            id="ct-tel"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="320 123 4567"
            icono={<Icon name="telefono" size={16} />}
            value={telefono}
            onChange={e => setTelefono(e.target.value)}
            disabled={guardando}
            autoFocus
          />
          <p className="m-0 mt-2 text-xs leading-snug text-white/40">Solo lo ven el negocio y el repartidor de tu pedido.</p>
        </div>
        <button type="submit" className={botonAuth} disabled={guardando}>
          {guardando ? <ZLoader size="sm" inverted /> : 'Guardar y entrar'}
        </button>
      </form>
    </PantallaAuth>
  );
};

export default CompletarTelefonoPage;
