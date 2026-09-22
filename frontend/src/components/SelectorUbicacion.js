import React, { useState, useCallback } from 'react';
import { useLoadScript, GoogleMap, Marker } from '@react-google-maps/api';
import { MAPS_KEY, MAPS_LIBRARIES, GARZON } from '../config/googleMaps';
import Icon from './Icons';

// ============================================================================
// SelectorUbicacion — el cliente marca en el mapa el punto exacto de entrega.
//
// Antes solo se guardaba el texto ("Cra 5 #23-45") y el repartidor lo
// geocodificaba con Google. En Garzón muchas direcciones no existen en Google
// y el pin caía en el centro del pueblo. Ahora el punto lo pone el cliente
// (GPS, búsqueda o arrastrando el pin) y se guarda con la dirección.
// ============================================================================

const MAP_STYLE = { width: '100%', height: '240px', borderRadius: '12px' };
const MAP_OPTS  = { disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy', clickableIcons: false };

const btn = {
  flex: 1, padding: '10px 8px', borderRadius: 10, border: '1.5px solid #FF7A00',
  background: 'transparent', color: '#FF7A00', fontWeight: 700, fontSize: 13,
  cursor: 'pointer', fontFamily: 'inherit',
};

const SelectorUbicacion = ({ direccion, valor, onChange }) => {
  const { isLoaded, loadError } = useLoadScript({ googleMapsApiKey: MAPS_KEY, libraries: MAPS_LIBRARIES });
  const [centro, setCentro] = useState(valor || GARZON);
  const [aviso, setAviso]   = useState('Marca en el mapa dónde queda tu casa.');

  const poner = useCallback((pos, fuente) => {
    onChange({ lat: pos.lat, lng: pos.lng, fuente });
    setCentro(pos);
  }, [onChange]);

  const buscar = () => {
    if (!isLoaded || !window.google) return;
    if (!direccion || !direccion.trim()) { setAviso('Escribe primero la dirección.'); return; }
    setAviso('Buscando…');
    new window.google.maps.Geocoder().geocode(
      { address: `${direccion}, Garzón, Huila, Colombia`, region: 'co' },
      (res, st) => {
        if (st === 'OK' && res[0]) {
          const l = res[0].geometry.location;
          poner({ lat: l.lat(), lng: l.lng() }, 'busqueda');
          setAviso('Revisa que el pin quede en tu casa. Si no, arrástralo o toca el punto correcto.');
        } else {
          setAviso('No encontramos esa dirección. Toca en el mapa el punto de tu casa.');
        }
      }
    );
  };

  const miUbicacion = () => {
    if (!navigator.geolocation) { setAviso('Tu teléfono no permite compartir la ubicación.'); return; }
    setAviso('Obteniendo tu ubicación…');
    navigator.geolocation.getCurrentPosition(
      p => {
        poner({ lat: p.coords.latitude, lng: p.coords.longitude }, 'gps');
        setAviso('Listo. Si el pin no quedó justo en tu casa, arrástralo.');
      },
      () => setAviso('No pudimos obtener tu ubicación. Revisa el permiso o toca tu casa en el mapa.'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const desdeEvento = e => ({ lat: e.latLng.lat(), lng: e.latLng.lng() });

  if (!MAPS_KEY || loadError) {
    return <p style={{ fontSize: 13, color: '#ef4444', margin: '6px 0' }}>El mapa no está disponible en este momento.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '4px 0 8px' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" style={btn} onClick={miUbicacion}><Icon name="ubicacion" size={15} style={{ verticalAlign: '-3px', marginRight: 5 }} />Estoy en mi casa</button>
        <button type="button" style={btn} onClick={buscar}><Icon name="buscar" size={15} style={{ verticalAlign: '-3px', marginRight: 5 }} />Buscar dirección</button>
      </div>
      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={MAP_STYLE}
          center={centro}
          zoom={valor ? 17 : 14}
          options={MAP_OPTS}
          onClick={e => { poner(desdeEvento(e), 'manual'); setAviso('Punto marcado. Puedes arrastrar el pin para ajustarlo.'); }}
        >
          {valor && (
            <Marker
              position={{ lat: valor.lat, lng: valor.lng }}
              draggable
              onDragEnd={e => { poner(desdeEvento(e), 'manual'); setAviso('Punto ajustado.'); }}
            />
          )}
        </GoogleMap>
      ) : (
        <div style={{ ...MAP_STYLE, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(148,163,184,0.15)', fontSize: 13 }}>
          Cargando mapa…
        </div>
      )}
      <p style={{ fontSize: 12.5, margin: 0, color: valor ? '#16a34a' : '#64748b', lineHeight: 1.4 }}>
        {valor && <Icon name="check" size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />}{aviso}
      </p>
    </div>
  );
};

export default SelectorUbicacion;
