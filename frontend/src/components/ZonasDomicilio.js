import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLoadScript, GoogleMap, Marker, Circle } from '@react-google-maps/api';
import { MAPS_KEY, MAPS_LIBRARIES, GARZON } from '../config/googleMaps';
import { adminService } from '../config/api';
import { useToast } from '../context/ToastContext';
import Icon from './Icons';
import { cx } from '../ui/tw';

// ============================================================================
// ZonasDomicilio — Súper admin → Configuración → Precios (oct 2026).
//
// El domicilio se cobra por anillos alrededor del centro de Garzón: cada zona
// llega hasta cierta distancia (en línea recta) y tiene un precio fijo. Más
// lejos de la última zona no se entrega. La cuenta la hace el servidor
// (backend/calculos.py); aquí solo se configura.
// ============================================================================

const COLORES = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#ec4899', '#64748b', '#14b8a6'];
const MAX_ZONAS = 8;
const MAP_STYLE = { width: '100%', height: '280px', borderRadius: '14px' };
const MAP_OPTS = { disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy', clickableIcons: false };

// Zonas de ejemplo para arrancar (las mismas de la imagen aprobada)
const EJEMPLO = [
  { nombre: 'Garzón', hasta_km: '1.6', precio: '4000' },
  { nombre: 'Zona 2', hasta_km: '4', precio: '7000' },
  { nombre: 'Zona 3', hasta_km: '8', precio: '10000' },
];

const numero = (v) => Number(String(v ?? '').replace(',', '.'));

// Zoom para que se vea el anillo más grande completo en el mapa
const zoomPara = (km) => {
  if (!km || km <= 0) return 14;
  return Math.max(9, Math.min(15, Math.round(14.6 - Math.log2(km))));
};

const ZonasDomicilio = () => {
  const { addToast } = useToast();
  const { isLoaded, loadError } = useLoadScript({ googleMapsApiKey: MAPS_KEY, libraries: MAPS_LIBRARIES });

  const [activo, setActivo]     = useState(false);
  const [centro, setCentro]     = useState(GARZON);
  const [zonas, setZonas]       = useState(EJEMPLO);
  const [original, setOriginal] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const foto = (a, c, z) => JSON.stringify({ a, c, z });

  useEffect(() => {
    adminService.obtenerZonas()
      .then(({ data }) => {
        const z = (data?.zonas || []).map(x => ({ nombre: x.nombre, hasta_km: String(x.hasta_km), precio: String(x.precio) }));
        const c = data?.centro?.lat != null ? { lat: data.centro.lat, lng: data.centro.lng } : GARZON;
        const a = Boolean(data?.activo);
        const lista = z.length ? z : EJEMPLO;
        setActivo(a); setCentro(c); setZonas(lista);
        setOriginal(foto(a, c, lista));
      })
      .catch(() => addToast('No se pudieron cargar las zonas', 'error'))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cambio = !cargando && foto(activo, centro, zonas) !== original;
  const maxKm = useMemo(() => Math.max(0, ...zonas.map(z => numero(z.hasta_km) || 0)), [zonas]);
  const [zoom, setZoom] = useState(13);
  useEffect(() => { setZoom(zoomPara(maxKm)); }, [maxKm]);

  const cambiarZona = (i, campo, valor) =>
    setZonas(prev => prev.map((z, j) => (j === i ? { ...z, [campo]: valor } : z)));

  const agregar = () => {
    if (zonas.length >= MAX_ZONAS) return;
    const ultimo = numero(zonas[zonas.length - 1]?.hasta_km) || 0;
    const precio = numero(zonas[zonas.length - 1]?.precio) || 4000;
    setZonas(prev => [...prev, { nombre: `Zona ${prev.length + 1}`, hasta_km: String(ultimo + 3), precio: String(precio + 3000) }]);
  };

  const quitar = (i) => setZonas(prev => prev.filter((_, j) => j !== i));

  const moverCentro = useCallback((e) => setCentro({ lat: e.latLng.lat(), lng: e.latLng.lng() }), []);

  const guardar = async () => {
    // Las mismas reglas del servidor, para avisar antes de enviar
    let anterior = 0;
    for (let i = 0; i < zonas.length; i += 1) {
      const km = numero(zonas[i].hasta_km);
      const pr = numero(String(zonas[i].precio).replace(/\./g, ''));
      if (!km || km <= anterior) { addToast(`La zona ${i + 1} tiene que llegar más lejos que la anterior`, 'error'); return; }
      if (Number.isNaN(pr) || pr < 0 || pr > 100000) { addToast(`Revisa el precio de la zona ${i + 1}`, 'error'); return; }
      anterior = km;
    }
    if (activo && zonas.length === 0) { addToast('Agrega al menos una zona', 'error'); return; }

    setGuardando(true);
    try {
      const { data } = await adminService.guardarZonas({
        activo,
        centro,
        zonas: zonas.map(z => ({ nombre: z.nombre, hasta_km: numero(z.hasta_km), precio: numero(String(z.precio).replace(/\./g, '')) })),
      });
      const z = (data?.zonas || []).map(x => ({ nombre: x.nombre, hasta_km: String(x.hasta_km), precio: String(x.precio) }));
      const lista = z.length ? z : zonas;
      setZonas(lista);
      setOriginal(foto(Boolean(data?.activo), data?.centro || centro, lista));
      addToast(data?.mensaje || 'Zonas guardadas', 'success');
    } catch (err) {
      const d = err?.response?.data?.detail;
      addToast(typeof d === 'string' ? d : 'No se pudieron guardar las zonas', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const campo = 'box-border w-full rounded-lg border border-solid border-slate-300 bg-white px-2 py-1.5 font-[inherit] text-[13px] font-semibold text-slate-800 focus:border-zippy focus:outline-none dark:border-noche-borde dark:bg-noche dark:text-slate-100';

  return (
    <div className="cfg-card">
      <div className="flex items-center justify-between gap-3">
        <div className="cfg-card-title" style={{ marginBottom: 0 }}>Domicilio por zonas</div>
        <button
          type="button"
          className={`cfg-toggle ${activo ? 'cfg-toggle--on' : ''}`}
          onClick={() => setActivo(v => !v)}
          disabled={cargando}
          aria-label={activo ? 'Apagar el cobro por zonas' : 'Cobrar por zonas'}
        >
          <span className="cfg-toggle-thumb" />
        </button>
      </div>
      <p className="cfg-notif-desc" style={{ margin: '8px 0 0' }}>
        {activo
          ? 'Encendido: el domicilio depende de qué tan lejos del centro queda la casa del cliente (en línea recta). Se cobra una vez por cada tienda del pedido.'
          : 'Apagado: se cobra el precio único de abajo a todos. Arma las zonas y enciéndelo cuando estés listo.'}
      </p>

      <div className="relative mt-3">
        {!MAPS_KEY || loadError ? (
          <p className="m-0 rounded-xl bg-red-50 p-3 text-[13px] text-red-600">El mapa no está disponible en este momento. Puedes guardar las zonas igual.</p>
        ) : isLoaded ? (
          <GoogleMap mapContainerStyle={MAP_STYLE} center={centro} zoom={zoom} options={MAP_OPTS} onClick={moverCentro}>
            {[...zonas].map((z, i) => ({ z, i })).reverse().map(({ z, i }) => (
              <Circle
                key={`${i}-${z.hasta_km}`}
                center={centro}
                radius={(numero(z.hasta_km) || 0) * 1000}
                options={{
                  strokeColor: COLORES[i % COLORES.length],
                  strokeWeight: 2.5,
                  fillColor: COLORES[i % COLORES.length],
                  fillOpacity: 0.12,
                  clickable: false,
                }}
              />
            ))}
            <Marker position={centro} draggable onDragEnd={moverCentro} title="Centro de las zonas" />
          </GoogleMap>
        ) : (
          <div className="flex h-[280px] items-center justify-center rounded-[14px] bg-slate-100 text-[13px] text-slate-500 dark:bg-noche-alt">Cargando mapa…</div>
        )}
        <p className="m-0 mt-1.5 text-[11.5px] text-slate-400">Arrastra el pin (o toca el mapa) para mover el centro. Lo normal es el parque principal.</p>
      </div>

      <div className="mt-3 grid grid-cols-[12px_1fr_76px_86px_26px] items-center gap-2 text-[10.5px] font-extrabold uppercase tracking-wide text-slate-400">
        <span /><span>Zona</span><span className="text-right">Hasta (km)</span><span className="text-right">Domicilio</span><span />
      </div>
      {zonas.map((z, i) => (
        <div key={i} className="grid grid-cols-[12px_1fr_76px_86px_26px] items-center gap-2 border-0 border-b border-solid border-slate-100 py-2 last:border-b-0 dark:border-noche-borde">
          <span className="h-3 w-3 rounded-full" style={{ background: COLORES[i % COLORES.length] }} />
          <input className={campo} value={z.nombre} maxLength={30} onChange={e => cambiarZona(i, 'nombre', e.target.value)} aria-label={`Nombre de la zona ${i + 1}`} />
          <input className={cx(campo, 'text-right')} inputMode="decimal" value={z.hasta_km} onChange={e => cambiarZona(i, 'hasta_km', e.target.value)} aria-label={`Hasta cuántos km llega la zona ${i + 1}`} />
          <input className={cx(campo, 'text-right')} inputMode="numeric" value={z.precio} onChange={e => cambiarZona(i, 'precio', e.target.value.replace(/[^\d]/g, ''))} aria-label={`Precio de la zona ${i + 1}`} />
          <button type="button" className="flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => quitar(i)} aria-label={`Quitar la zona ${i + 1}`}>
            <Icon name="cerrar" size={14} />
          </button>
        </div>
      ))}

      {zonas.length < MAX_ZONAS && (
        <button type="button" className="mt-2 w-full cursor-pointer rounded-[10px] border-[1.5px] border-dashed border-zippy bg-transparent p-2 font-[inherit] text-[13px] font-extrabold text-zippy" onClick={agregar}>
          + Agregar zona
        </button>
      )}

      {zonas.length > 0 && (
        <div className="mt-3 flex items-center justify-between rounded-[10px] bg-red-50 px-3 py-2.5 text-[12.5px] text-red-900 dark:bg-red-500/10 dark:text-red-200">
          <span>Más lejos de {String(maxKm).replace('.', ',')} km</span>
          <strong className="text-red-700 dark:text-red-300">No se entrega</strong>
        </div>
      )}

      {activo && zonas.length > 0 && (
        <p className="cfg-notif-desc" style={{ marginTop: 10 }}>
          El cliente ve su zona y el precio antes de confirmar. Si su dirección no tiene punto en el mapa, se le pide marcarlo.
        </p>
      )}

      <div className="cfg-actions" style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button type="button" className="cfg-btn-save" onClick={guardar} disabled={cargando || guardando || !cambio}>
          {guardando ? 'Guardando…' : 'Guardar zonas'}
        </button>
      </div>
    </div>
  );
};

export default ZonasDomicilio;
