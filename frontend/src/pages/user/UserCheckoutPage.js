import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { ordenesService, clienteService, domicilioService } from '../../config/api';
import '../../styles/UserCheckout.css';
import { ENVIO_POR_TIENDA } from '../../constants/envio';
import { estaAbierto, textoCerrado } from '../../utils/horario';
import { urlImagen } from '../../utils/media';
import Icon from '../../components/Icons';
import SelectorUbicacion from '../../components/SelectorUbicacion';

const fmt = n => `$${Number(n || 0).toLocaleString('es-CO')}`;

const CAT_ALCOHOL = ['cerveza', 'aguardiente y ron', 'whisky y otros licores', 'vinos', 'licores'];
const sinTildes = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const esAlcohol = i => CAT_ALCOHOL.includes(sinTildes(i.categoria)) || sinTildes(i.categoriaNegocio || i.negocio_categoria) === 'licorera';

const UserCheckoutPage = () => {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCart();
  const { addToast } = useToast();

  // Mismo criterio que el carrito: manda el servidor, el archivo es respaldo.
  const [envioUnitario, setEnvioUnitario] = useState(ENVIO_POR_TIENDA);

  useEffect(() => {
    domicilioService.obtener()
      .then(({ data }) => {
        if (typeof data?.costo_domicilio === 'number') {
          setEnvioUnitario(data.costo_domicilio);
        }
      })
      .catch(() => {});
  }, []);

  const [pago]                = useState('efectivo');
  const [nota, setNota]       = useState('');
  const [loading, setLoading] = useState(false);
  const [mayorEdad, setMayorEdad] = useState(false);
  const [pideEdad, setPideEdad]   = useState(false);

  // La direccion venia escrita a mano en el codigo ('Cra 5 #23-45, Apto 402'),
  // asi que TODAS las ordenes salian con la misma direccion falsa. Ahora se
  // cargan las que el cliente guardo y no se deja confirmar sin una.
  const [direcciones, setDirecciones]     = useState([]);
  const [dirId, setDirId]                 = useState(null);
  const [cargandoDirs, setCargandoDirs]   = useState(true);

  // Pedir si necesita cuenta; ver la tienda no (Apple 5.1.1)
  useEffect(() => {
    if (!localStorage.getItem('access_token')) navigate('/login');
  }, [navigate]);

  useEffect(() => {
    let activo = true;
    clienteService.direcciones()
      .then(({ data }) => {
        if (!activo) return;
        const lista = Array.isArray(data) ? data : (data?.items || []);
        setDirecciones(lista);
        const principal = lista.find(d => d.principal) || lista[0];
        if (principal) setDirId(principal.id);
      })
      .catch(() => { if (activo) setDirecciones([]); })
      .finally(() => { if (activo) setCargandoDirs(false); });
    return () => { activo = false; };
  }, []);

  const dirElegida = direcciones.find(d => d.id === dirId) || null;

  /*
   * Elegir o agregar la direccion SIN salir del pedido.
   *
   * Antes, para agregar una direccion habia que irse al Perfil: el enlace
   * sacaba al cliente de la compra, caia en la pestaña equivocada y despues
   * tenia que encontrar el camino de vuelta al carrito. Ahora sube una hoja
   * desde abajo, se elige o se agrega ahi mismo, y la compra sigue donde iba.
   *
   * hojaDir: null (cerrada) | 'elegir' | 'nueva'
   */
  const [hojaDir, setHojaDir]       = useState(null);
  const [dirMarcada, setDirMarcada] = useState(null);
  const [formDir, setFormDir]       = useState({ etiqueta: '', direccion: '', referencia: '' });
  const [ubicDir, setUbicDir]       = useState(null);
  const [guardandoDir, setGuardandoDir] = useState(false);

  const abrirHojaDir = () => {
    setDirMarcada(dirId);
    setHojaDir(direcciones.length === 0 ? 'nueva' : 'elegir');
  };

  const guardarDireccionNueva = async (e) => {
    e.preventDefault();
    if (guardandoDir) return;
    if (!formDir.etiqueta.trim() || !formDir.direccion.trim()) return;
    if (!ubicDir) { addToast('Marca en el mapa dónde queda, para que el repartidor llegue exacto', 'error'); return; }
    setGuardandoDir(true);
    try {
      const { data } = await clienteService.agregarDireccion({
        etiqueta: formDir.etiqueta.trim(),
        direccion: formDir.direccion.trim(),
        referencia: formDir.referencia.trim(),
        lat: ubicDir.lat,
        lng: ubicDir.lng,
      });
      setDirecciones(prev => [...prev, data]);
      setDirId(data.id);
      setFormDir({ etiqueta: '', direccion: '', referencia: '' });
      setUbicDir(null);
      setHojaDir(null);
      addToast('Dirección guardada', 'success');
    } catch {
      addToast('No se pudo guardar la dirección. Intenta de nuevo.', 'error');
    } finally {
      setGuardandoDir(false);
    }
  };

  const tiendas    = [...new Set(items.map(i => i.tienda))];
  const envioTotal = tiendas.length * envioUnitario;
  const total      = subtotal + envioTotal;
  const itemsCerrados = items.filter(i => !estaAbierto(i));
  // Bebidas alcoholicas: el backend es quien decide (tambien mira la categoria
  // del negocio). Si responde que falta la confirmacion, se muestra la casilla.
  const tieneAlcohol = pideEdad || items.some(esAlcohol);

  // Si el carrito queda vacio (p.ej. tras confirmar), volver a la tienda.
  // OJO: navigate() no puede llamarse durante el render -> pantalla en blanco.
  // Por eso va dentro de useEffect y aqui solo cortamos el render con null.
  useEffect(() => {
    if (items.length === 0) navigate('/tienda');
  }, [items.length, navigate]);

  if (items.length === 0) return null;

  const handleConfirmar = async () => {
    if (!dirElegida) {
      addToast('Agrega una direccion de entrega antes de confirmar.', 'error');
      return;
    }
    if (itemsCerrados.length > 0) {
      addToast(`Producto no disponible: ${itemsCerrados[0].tienda} está cerrada · ${textoCerrado(itemsCerrados[0])}`, 'error');
      return;
    }
    if (tieneAlcohol && !mayorEdad) {
      addToast('Confirma que eres mayor de 18 años para pedir bebidas alcohólicas.', 'error');
      return;
    }
    setLoading(true);

    // El backend crea una orden por negocio: agrupamos el carrito por negocio.
    // Segun la pantalla desde donde se agrego, el producto trae 'negocioId'
    // (mapeado) o 'negocio_id' (crudo del backend). Aceptamos ambos: si solo
    // miramos uno, los productos agregados desde la otra pantalla quedaban con
    // clave undefined y el backend rechazaba la orden con 422.
    const porNegocio = {};
    const sinNegocio = [];
    items.forEach(item => {
      const nid = item.negocioId || item.negocio_id;
      if (!nid) { sinNegocio.push(item); return; }
      if (!porNegocio[nid]) porNegocio[nid] = [];
      porNegocio[nid].push(item);
    });

    if (sinNegocio.length > 0 || Object.keys(porNegocio).length === 0) {
      setLoading(false);
      addToast('Un producto del carrito no tiene tienda asociada. Quitalo y vuelve a agregarlo.', 'error');
      return;
    }

    try {
      const respuestas = await Promise.all(
        Object.entries(porNegocio).map(([negocio_id, itemsNegocio]) =>
          ordenesService.crear({
            negocio_id,
            items: itemsNegocio.map(i => ({ producto_id: i.id, cantidad: i.qty })),
            metodo_pago: pago,
            direccion_entrega: dirElegida.referencia ? `${dirElegida.dir} · ${dirElegida.referencia}` : dirElegida.dir,
            latitud_entrega: dirElegida.lat ?? undefined,
            longitud_entrega: dirElegida.lng ?? undefined,
            notas_cliente: nota || undefined,
            confirma_mayor_edad: mayorEdad,
          })
        )
      );
      clearCart();
      if (respuestas.some(r => r?.data?.requiere_validacion)) {
        addToast('Recibimos tu pedido. Como es tu primer pedido, soporte te va a contactar para confirmarlo.', 'success');
      } else {
        addToast('¡Orden confirmada! Recibirás un correo de confirmación.', 'success');
      }
      navigate('/tienda/pedidos');
    } catch (err) {
      const detail = err.response?.data?.detail;
      let msg = 'No se pudo confirmar la orden. Intenta de nuevo.';
      if (typeof detail === 'string') {
        msg = detail;
        if (detail.includes('mayor de 18')) setPideEdad(true);
      } else if (Array.isArray(detail) && detail.length > 0) {
        // Error 422 de validación de FastAPI/Pydantic: detail es una lista de
        // objetos {type, loc, msg, input, url}, no un string. Antes esto se
        // pasaba directo a addToast() y React tumbaba toda la app al intentar
        // renderizar un objeto como hijo (por eso la pantalla se ponia en blanco).
        msg = detail.map(d => d.msg || JSON.stringify(d)).join(' · ');
        // eslint-disable-next-line no-console
        console.error('Detalle completo del error 422 al confirmar orden:', detail);
      }
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ucho-page">
      {/* Orange header */}
      <div className="ucho-header">
        <button className="ucho-back" onClick={() => navigate('/tienda/carrito')}>← Volver</button>
        <div className="ucho-header-center">
          <p className="ucho-header-title">Confirmar Orden</p>
          <p className="ucho-header-sub">Resumen de compra</p>
        </div>
      </div>

      <div className="ucho-card">
        {/* Items summary */}
        <div className="ucho-section">
          {items.map(item => {
            const cerrado = !estaAbierto(item);
            return (
              <div key={item.id} className="ucho-item">
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 10, background: '#f1f5f9', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                    {item.foto
                      ? <img src={urlImagen(item.foto)} alt={item.nombre} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      : <Icon name="paquete" size={20} strokeWidth={1.3} />}
                  </div>
                  <div style={{ minWidth: 0 }}>
                  <p className="ucho-item-name">{item.nombre}</p>
                  <p className="ucho-item-meta">
                    Cantidad: {item.qty} · Precio: {fmt(item.precio)} c/u
                  </p>
                  {cerrado && (
                    <p className="ucho-item-cerrado"><Icon name="reloj" size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />Producto no disponible · tienda cerrada · {textoCerrado(item)}</p>
                  )}
                  </div>
                </div>
                <span className="ucho-item-total">{fmt(item.precio * item.qty)}</span>
              </div>
            );
          })}
        </div>

        {/* Delivery address */}
        <div className="ucho-section ucho-section--address">
          <p className="ucho-section-label">Dirección de entrega</p>
          {cargandoDirs ? (
            <p className="ucho-address-text">Cargando direcciones...</p>
          ) : (
            <div className="ucho-address">
              <span className="ucho-address-icon"><Icon name="ubicacion" size={18} /></span>
              <div className="ucho-address-info">
                {dirElegida ? (
                  <>
                    <p className="ucho-address-text">{dirElegida.etiqueta || 'Dirección'}</p>
                    <p className="ucho-address-sub">{dirElegida.dir}{dirElegida.referencia ? ` · ${dirElegida.referencia}` : ''}</p>
                  </>
                ) : (
                  <>
                    <p className="ucho-address-text">Sin dirección</p>
                    <p className="ucho-address-sub">Dinos a dónde llevarlo</p>
                  </>
                )}
              </div>
              <button
                type="button"
                className={`ucho-address-btn ${dirElegida ? 'ucho-address-btn--borde' : ''}`}
                onClick={abrirHojaDir}
              >
                {dirElegida ? 'Cambiar' : '+ Agregar'}
              </button>
            </div>
          )}
        </div>

        {/* Payment method */}
        <div className="ucho-section">
          <p className="ucho-section-label">Método de pago</p>
          <div className="ucho-pay-fixed">
            <Icon name="billete" size={18} style={{ verticalAlign: '-4px', marginRight: 8, color: '#16a34a' }} />
            Efectivo contra entrega
          </div>
        </div>

        {/* Notes */}
        <div className="ucho-section">
          <textarea
            className="ucho-notes"
            rows={3}
            placeholder="Ej: Entrega sin sal, llamar al llegar..."
            value={nota}
            onChange={e => setNota(e.target.value)}
          />
        </div>

        {dirElegida && dirElegida.lat == null && (
          <p style={{ fontSize: 13, color: '#b45309', background: 'rgba(245,158,11,0.12)', padding: '10px 12px', borderRadius: 10, margin: '0 0 12px', lineHeight: 1.4 }}>
            Esta dirección no está marcada en el mapa. Para que el repartidor llegue exacto, agrégala de nuevo en Perfil → Direcciones y marca tu casa.
          </p>
        )}

        {tieneAlcohol && (
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '4px 0 14px', fontSize: 14, lineHeight: 1.4, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={mayorEdad}
              onChange={e => setMayorEdad(e.target.checked)}
              style={{ width: 20, height: 20, marginTop: 1, flexShrink: 0 }}
            />
            <span>Confirmo que soy mayor de 18 años. El repartidor puede pedir mi documento al entregar. La venta de alcohol a menores está prohibida.</span>
          </label>
        )}

        {/* Total */}
        <div className="ucho-total-box">
          <span className="ucho-total-label">Total</span>
          <span className="ucho-total-val">{fmt(total)}</span>
        </div>

        {/* CTA */}
        <button
          className="ucho-btn-confirm"
          onClick={handleConfirmar}
          disabled={loading || !dirElegida || itemsCerrados.length > 0 || (tieneAlcohol && !mayorEdad)}
        >
          {loading
            ? 'Procesando...'
            : itemsCerrados.length > 0
              ? 'Hay productos no disponibles'
              : (!dirElegida ? 'Agrega una dirección' : 'Confirmar Orden')}
        </button>
        <p className="ucho-confirm-note">Recibirás confirmación en tu correo</p>
      </div>

      {/* Hoja para elegir o agregar la direccion */}
      {hojaDir && (
        <div className="ucho-hoja-velo" onClick={() => setHojaDir(null)}>
          <div className="ucho-hoja" role="dialog" aria-label="Dirección de entrega" onClick={e => e.stopPropagation()}>
            <div className="ucho-hoja-asa" />

            {hojaDir === 'elegir' ? (
              <>
                <p className="ucho-hoja-titulo">¿A dónde lo llevamos?</p>
                <div className="ucho-address-list">
                  {direcciones.map(d => (
                    <label
                      key={d.id}
                      className={`ucho-address-opt ${dirMarcada === d.id ? 'ucho-address-opt--sel' : ''}`}
                    >
                      <input
                        type="radio"
                        name="direccion"
                        checked={dirMarcada === d.id}
                        onChange={() => setDirMarcada(d.id)}
                      />
                      <span>
                        <strong>{d.etiqueta || 'Dirección'}</strong>
                        <em>{d.dir}</em>
                        {d.referencia && <small>{d.referencia}</small>}
                      </span>
                    </label>
                  ))}
                </div>
                <button type="button" className="ucho-hoja-nueva" onClick={() => setHojaDir('nueva')}>
                  + Agregar nueva dirección
                </button>
                <button
                  type="button"
                  className="ucho-btn-confirm ucho-hoja-ok"
                  disabled={!dirMarcada}
                  onClick={() => { setDirId(dirMarcada); setHojaDir(null); }}
                >
                  Usar esta dirección
                </button>
              </>
            ) : (
              <form onSubmit={guardarDireccionNueva} className="ucho-hoja-form">
                <p className="ucho-hoja-titulo">Nueva dirección</p>
                <input
                  placeholder="Nombre (Casa, Trabajo...)"
                  value={formDir.etiqueta}
                  onChange={e => setFormDir(p => ({ ...p, etiqueta: e.target.value }))}
                  required
                />
                <input
                  placeholder="Dirección completa"
                  value={formDir.direccion}
                  onChange={e => setFormDir(p => ({ ...p, direccion: e.target.value }))}
                  required
                />
                <input
                  placeholder="Referencia (casa azul, frente al parque...)"
                  value={formDir.referencia}
                  onChange={e => setFormDir(p => ({ ...p, referencia: e.target.value }))}
                />
                <SelectorUbicacion direccion={formDir.direccion} valor={ubicDir} onChange={setUbicDir} />
                <button type="submit" className="ucho-btn-confirm ucho-hoja-ok" disabled={guardandoDir}>
                  {guardandoDir ? 'Guardando…' : 'Guardar y usar esta dirección'}
                </button>
                <button
                  type="button"
                  className="ucho-hoja-volver"
                  onClick={() => setHojaDir(direcciones.length > 0 ? 'elegir' : null)}
                >
                  {direcciones.length > 0 ? 'Volver a mis direcciones' : 'Cancelar'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserCheckoutPage;