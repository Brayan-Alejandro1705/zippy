# ============================================================================
# pedidos_utils.py - Operaciones sobre pedidos que usan varias rutas
#
# Vive aparte para que lo puedan usar routes_negocios y routes_auth sin
# importarse entre si.
# ============================================================================

from datetime import datetime

from sqlalchemy.orm import Session

from models import Orden, SeguimientoOrden
from push import notificar_usuario

# Un pedido en estos estados todavia depende del negocio: si el negocio
# desaparece, nadie lo va a preparar ni a entregar al repartidor.
ESTADOS_QUE_DEPENDEN_DEL_NEGOCIO = ["pendiente", "confirmada", "en_preparacion", "lista_para_retirar"]


def cancelar_pedidos_de_negocio(db: Session, negocio, motivo: str = "El negocio ya no esta disponible") -> int:
    """
    Cancela los pedidos abiertos de un negocio que se elimina o se desactiva.

    Antes el negocio se marcaba inactivo y sus pedidos en curso se quedaban
    vivos: el cliente seguia esperando y el repartidor que lo habia tomado se
    quedaba con un pedido en "Recogiendo" que nadie podia confirmar, sin boton
    para salir de ahi. La unica salida era borrarlo a mano en la base.

    Los que ya van en camino (en_domicilio) no se tocan: el repartidor ya
    tiene el pedido y hay que dejar que lo entregue.

    No hace commit; queda a cargo de quien llama. Devuelve cuantos cancelo.
    """
    abiertos = db.query(Orden).filter(
        Orden.negocio_id == negocio.id,
        Orden.estado.in_(ESTADOS_QUE_DEPENDEN_DEL_NEGOCIO),
    ).all()

    for orden in abiertos:
        anterior = getattr(orden.estado, "value", orden.estado)
        orden.estado = "cancelada"
        orden.fecha_ultima_actualizacion = datetime.utcnow()
        db.add(SeguimientoOrden(
            orden_id=orden.id,
            estado_anterior=anterior,
            estado_nuevo="cancelada",
            descripcion=motivo,
            fecha_creacion=datetime.utcnow(),
        ))
        try:
            if orden.cliente:
                notificar_usuario(
                    db, orden.cliente,
                    tipo="pedido_cancelado",
                    titulo="Pedido cancelado",
                    mensaje=f"{negocio.nombre_negocio} ya no esta disponible y tu pedido fue cancelado. No se te cobro nada.",
                    relacionado_tabla="ordenes",
                    relacionado_id=orden.id,
                )
            if orden.domiciliario:
                notificar_usuario(
                    db, orden.domiciliario,
                    tipo="pedido_cancelado",
                    titulo="Pedido cancelado",
                    mensaje=f"El pedido de {negocio.nombre_negocio} fue cancelado: el negocio ya no esta disponible.",
                    relacionado_tabla="ordenes",
                    relacionado_id=orden.id,
                )
        except Exception as e:
            # El pedido se cancela igual aunque falle el aviso
            print(f"[pedidos] no se pudo avisar de la cancelacion de {orden.id}: {e}")

    return len(abiertos)
