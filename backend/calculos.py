"""
calculos.py - El dinero se calcula en UN solo lugar.

Antes habia dos funciones distintas sumando totales: una en routes_ordenes.py
y otra en routes_carrito.py. La del carrito no incluia el domicilio, asi que
el cliente veia un total en el carrito y otro al pagar.

Cuando la misma cuenta vive en dos archivos, tarde o temprano se separan:
alguien arregla uno y olvida el otro. Por eso todo lo que sume plata pasa por
aqui.
"""

from decimal import Decimal

from sqlalchemy.orm import Session

from config import settings
from models import ConfiguracionSistema

# Clave en configuracion_sistema, la misma que usa el panel de administracion.
CLAVE_DOMICILIO = "costo_domicilio"


def costo_domicilio(db: Session) -> Decimal:
    """Costo del domicilio, tal como lo dejo el administrador.

    Vive en la base de datos para que se pueda cambiar desde el panel sin
    tocar codigo. Si aun no lo han configurado, o si quedo guardado algo
    invalido, se usa el respaldo de config.py: una venta nunca debe fallar
    por un dato mal escrito en una tabla de configuracion.
    """
    try:
        fila = db.query(ConfiguracionSistema).filter(
            ConfiguracionSistema.clave == CLAVE_DOMICILIO
        ).first()
        if fila and fila.valor:
            return Decimal(str(fila.valor))
    except Exception:
        pass

    return Decimal(str(settings.COSTO_DOMICILIO_BASE))


def desglose(subtotal: Decimal, db: Session, con_domicilio: bool = True) -> dict:
    """Calcula impuesto, domicilio y total a partir del subtotal.

    con_domicilio=False sirve para mostrar un subtotal sin envio, por ejemplo
    si algun dia se agrega la opcion de recoger en el local.
    """
    subtotal = Decimal(str(subtotal))
    impuesto = subtotal * (Decimal(str(settings.IMPUESTO_IVA)) / 100)
    domicilio = costo_domicilio(db) if con_domicilio else Decimal(0)

    return {
        "subtotal": subtotal,
        "impuesto": impuesto,
        "costo_domicilio": domicilio,
        "total": subtotal + impuesto + domicilio,
    }
