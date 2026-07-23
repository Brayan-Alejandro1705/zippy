import React, { useState, useEffect } from 'react';
import { soporteService } from '../config/api';
import Icon from './Icons';
import '../styles/CentroAyuda.css';

// ============================================================================
// CentroAyuda.js - Pestaña de ayuda con contenido distinto según el perfil.
// Uso: <CentroAyuda perfil="cliente" />   perfiles: cliente | vendedor |
//      repartidor | admin
// El número de WhatsApp lo configura un súper admin en Config > Soporte.
// ============================================================================

const CONTENIDO = {
  cliente: {
    intro: 'Resolvemos las dudas más comunes al pedir en Zippy.',
    mensaje: 'Hola, soy cliente de Zippy y necesito ayuda con',
    temas: [
      {
        p: '¿Cómo hago un pedido?',
        r: 'Entra a Inicio, elige la tienda, agrega los productos al carrito y confirma en Pagar. Vas a ver el total con el domicilio incluido antes de confirmar.',
      },
      {
        p: '¿Cómo puedo pagar?',
        r: 'Por ahora el pago es en efectivo al recibir. Al confirmar el pedido eliges esa opción y el repartidor te cobra al entregar. Ten el valor listo para agilizar la entrega.',
      },
      {
        p: '¿Puedo cancelar un pedido?',
        r: 'Sí, mientras el pedido siga en estado Pendiente. Cuando la tienda lo confirma y empieza a prepararlo ya no se puede cancelar desde la app; en ese caso escríbenos por soporte.',
      },
      {
        p: '¿Cómo sigo mi pedido?',
        r: 'En Pedidos toca Ver seguimiento. Ahí ves en qué paso va y, cuando haya un repartidor asignado, su ubicación en el mapa.',
      },
      {
        p: '¿Cómo hablo con el repartidor?',
        r: 'Cuando un repartidor toma tu pedido se habilita un chat dentro del seguimiento. Ese chat se cierra al entregar y la conversación se borra una hora después.',
      },
      {
        p: 'Llegó algo mal o incompleto, ¿qué hago?',
        r: 'Escríbenos por soporte con el número del pedido. Revisamos el caso con la tienda y te damos una respuesta.',
      },
    ],
  },

  vendedor: {
    intro: 'Todo lo que necesitas para manejar tu tienda en Zippy.',
    mensaje: 'Hola, soy vendedor en Zippy y necesito ayuda con',
    temas: [
      {
        p: '¿Cómo publico un producto?',
        r: 'En Productos toca Nuevo producto. Llena nombre, precio, categoría y foto. Puedes dejarlo agotado sin borrarlo cuando no tengas existencias.',
      },
      {
        p: '¿Cómo funciona una oferta por tiempo limitado?',
        r: 'Al editar un producto activas la oferta, pones el precio con descuento y la duración. Cuando se cumple el plazo el precio vuelve solo al original, no tienes que hacer nada.',
      },
      {
        p: '¿Qué es el código de recogida?',
        r: 'Cada pedido genera un código con el formato ZP-0000. El repartidor te lo muestra al recoger y tú lo validas. Ese código es la prueba de que el pedido salió de tu tienda.',
      },
      {
        p: '¿Cómo recibo el dinero de mis ventas?',
        r: 'El cliente paga en efectivo al repartidor y él te entrega lo recaudado. La comisión de Zippy se factura a fin de mes sumando los códigos de recogida confirmados.',
      },
      {
        p: '¿Puedo rechazar un pedido?',
        r: 'Sí, en Órdenes mientras esté Pendiente. Rechaza si no tienes el producto o estás fuera de horario; el cliente recibe el aviso al instante.',
      },
      {
        p: '¿Cómo cambio mi horario de atención?',
        r: 'En Configuración, pestaña Mi Tienda, ajustas hora de apertura y cierre. Fuera de ese horario tu tienda aparece cerrada y no recibe pedidos.',
      },
    ],
  },

  repartidor: {
    intro: 'Lo esencial para tus entregas del día.',
    mensaje: 'Hola, soy repartidor en Zippy y necesito ayuda con',
    temas: [
      {
        p: '¿Cómo tomo un pedido?',
        r: 'En la pantalla principal ves los pedidos disponibles con la dirección y el valor. Toca Aceptar y queda asignado a ti. Solo puedes tener un pedido activo a la vez.',
      },
      {
        p: '¿Qué hago al llegar a la tienda?',
        r: 'Muestra el código de recogida ZP-0000 que aparece en el pedido. El vendedor lo valida y te entrega la orden. Sin ese código la tienda no debe entregarte nada.',
      },
      {
        p: '¿Cómo cobro un pedido en efectivo?',
        r: 'En el detalle del pedido ves el valor exacto a cobrar. Recíbelo al entregar y marca el pedido como Entregado. Lo recaudado lo cuadras al cerrar turno.',
      },
      {
        p: 'El cliente no responde o la dirección está mala, ¿qué hago?',
        r: 'Intenta por el chat del pedido y luego por llamada. Si después de unos minutos no hay respuesta, escríbenos por soporte antes de devolver el pedido.',
      },
      {
        p: '¿Cómo cierro mi turno?',
        r: 'Toca Cierre de turno. Ahí registras lo recaudado por cada método de pago y queda el resumen del día.',
      },
    ],
  },

  admin: {
    intro: 'Guía rápida de administración de la plataforma.',
    mensaje: 'Hola, soy administrador de Zippy y necesito ayuda con',
    temas: [
      {
        p: '¿Cómo configuro el WhatsApp de soporte?',
        r: 'En Configuración, pestaña Soporte, solo visible para súper admin. Ese número es el que ven todos los usuarios en su centro de ayuda.',
      },
      {
        p: '¿Cómo suspendo o reactivo un usuario?',
        r: 'En Usuarios busca la cuenta y usa Suspender. La cuenta suspendida no puede iniciar sesión, pero sus datos e historial se conservan.',
      },
      {
        p: '¿Cómo cambio los permisos de un rol?',
        r: 'En Roles y permisos marcas lo que puede hacer cada rol. El cambio se guarda en el servidor, así que aplica para todos los dispositivos. Los permisos de súper admin no se pueden reducir.',
      },
      {
        p: '¿Cómo apruebo un vendedor nuevo?',
        r: 'En Solicitudes revisas los datos del negocio y apruebas o rechazas. Al aprobar, la tienda queda visible para los clientes.',
      },
    ],
  },
};

const CentroAyuda = ({ perfil = 'cliente' }) => {
  const [whatsapp, setWhatsapp] = useState('');
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto]   = useState(null);

  const cfg = CONTENIDO[perfil] || CONTENIDO.cliente;

  useEffect(() => {
    let vivo = true;
    soporteService.obtener()
      .then(({ data }) => { if (vivo) setWhatsapp(data.whatsapp || ''); })
      .catch(() => { /* sin número configurado o sin conexión */ })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, []);

  const waUrl = whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(cfg.mensaje + ' ')}`
    : null;

  return (
    <div className="ca-wrap">
      <div className="ca-card">
        <div className="ca-card-title">Preguntas frecuentes</div>
        <p className="ca-card-desc">{cfg.intro}</p>

        <div className="ca-lista">
          {cfg.temas.map((t, i) => {
            const activo = abierto === i;
            return (
              <div key={i} className={`ca-item ${activo ? 'ca-item--activo' : ''}`}>
                <button
                  type="button"
                  className="ca-item-head"
                  onClick={() => setAbierto(activo ? null : i)}
                  aria-expanded={activo}
                >
                  <span className="ca-item-p">{t.p}</span>
                  <span className="ca-item-chevron">
                    <Icon name={activo ? 'equis' : 'interrogacion'} size={15} />
                  </span>
                </button>
                {activo && <p className="ca-item-r">{t.r}</p>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="ca-card">
        <div className="ca-card-title">¿No encontraste lo que buscabas?</div>
        <p className="ca-card-desc">
          Escríbenos por WhatsApp y te respondemos en horario de atención.
        </p>

        {cargando ? (
          <p className="ca-nota">Cargando…</p>
        ) : waUrl ? (
          <a className="ca-wa-btn" href={waUrl} target="_blank" rel="noopener noreferrer">
            <Icon name="whatsapp" size={18} />
            Escribir a soporte
          </a>
        ) : (
          <p className="ca-nota">
            El canal de soporte todavía no está disponible. Vuelve a intentarlo más tarde.
          </p>
        )}
      </div>
    </div>
  );
};

export default CentroAyuda;