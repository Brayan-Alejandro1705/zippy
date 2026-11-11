# ============================================================================
# pago_qr.py - Pago con transferencia por QR (nov 2026)
#
# Todavía no hay pasarela. El cliente que escoge "Transferencia con QR" paga
# al recibir el pedido: el repartidor le muestra en su celular el QR de la
# cuenta de ZIPPYGO, el cliente lo escanea con la app de su banco (Bre-B,
# Nequi, Bancolombia...) y le muestra el pago hecho. Después un súper admin
# revisa en el banco de ZIPPYGO que la plata sí llegó (Orden.transferencia_estado).
#
# Los datos de la cuenta (imagen del QR, titular, banco, llave) los pone el
# súper admin en Configuración → Pagos y se guardan en configuracion_sistema.
# ============================================================================

import json

from sqlalchemy.orm import Session

from models import ConfiguracionSistema

CLAVE = "pago_qr"

VACIO = {"activo": False, "qr": None, "titular": "", "banco": "", "llave": ""}

# Estados de la revisión de una transferencia (Orden.transferencia_estado)
POR_VERIFICAR = "por_verificar"
LLEGO = "llego"
NO_LLEGO = "no_llego"


def leer(db: Session) -> dict:
    fila = db.query(ConfiguracionSistema).filter(ConfiguracionSistema.clave == CLAVE).first()
    datos = dict(VACIO)
    if fila and fila.valor:
        try:
            datos.update({k: v for k, v in json.loads(fila.valor).items() if k in VACIO})
        except (ValueError, AttributeError):
            pass
    return datos


def guardar(db: Session, cambios: dict) -> dict:
    datos = leer(db)
    datos.update({k: v for k, v in cambios.items() if k in VACIO})
    # Sin la imagen del QR no se puede cobrar: queda apagado
    if not datos.get("qr"):
        datos["activo"] = False
    fila = db.query(ConfiguracionSistema).filter(ConfiguracionSistema.clave == CLAVE).first()
    if not fila:
        fila = ConfiguracionSistema(clave=CLAVE, descripcion="Cuenta de ZIPPYGO para cobrar con QR", tipo_dato="json")
        db.add(fila)
    fila.valor = json.dumps(datos, ensure_ascii=False)
    db.commit()
    return datos


def disponible(db: Session) -> bool:
    datos = leer(db)
    return bool(datos.get("activo") and datos.get("qr"))
