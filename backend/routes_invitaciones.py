# ============================================================================
# routes_invitaciones.py - "Invita a un amigo" (nov 2026)
#
# - Cada cliente tiene un código (ej. MARIA-4K7) que comparte por WhatsApp.
# - El amigo lo escribe en su perfil antes de su primer pedido.
# - Cuando a ese amigo le ENTREGAN su primer pedido, los dos ganan un
#   domicilio gratis (Usuario.domicilios_gratis += 1). Una sola vez por amigo.
# - El domicilio gratis se usa al confirmar un pedido: el cliente paga $0 de
#   domicilio y ZIPPYGO le paga ese valor al repartidor (Orden.domicilio_regalo).
#   Si el pedido se cancela, el domicilio gratis vuelve a la cuenta.
#
# Se puede apagar desde Súper admin → Configuración → Reglas (reglas.py).
# ============================================================================

import re
import secrets
import unicodedata

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import reglas
from config import get_db
from models import Orden, Usuario
from push import notificar_usuario
from routes_auth import get_current_user

router = APIRouter(prefix="/api/v1/invitaciones", tags=["Invitaciones"])

ENLACE_ANDROID = "https://play.google.com/store/apps/details?id=com.zippygo.app"
ENLACE_IPHONE = "https://apps.apple.com/co/app/zippygo/id6813688875"
LETRAS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # sin 0/O ni 1/I/L para que no se confundan


class Canje(BaseModel):
    codigo: str = Field(..., min_length=3, max_length=20)


def _tipo(u: Usuario) -> str:
    return str(getattr(u.tipo_usuario, "value", u.tipo_usuario)).lower()


def _limpio(texto: str) -> str:
    sin_tildes = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Z]", "", sin_tildes.upper())


def _codigo_de(db: Session, u: Usuario) -> str:
    if u.codigo_invitacion:
        return u.codigo_invitacion
    primera = (u.nombre or "").split()[0] if (u.nombre or "").split() else ""
    base = _limpio(primera)[:8]
    base = base or "AMIGO"
    for _ in range(20):
        cod = f"{base}-{''.join(secrets.choice(LETRAS) for _ in range(3))}"
        if not db.query(Usuario.id).filter(Usuario.codigo_invitacion == cod).first():
            u.codigo_invitacion = cod
            db.commit()
            return cod
    raise HTTPException(status_code=500, detail="No se pudo crear tu código. Intenta de nuevo.")


def _ya_pidio(db: Session, usuario_id) -> bool:
    return db.query(Orden.id).filter(
        Orden.cliente_id == usuario_id,
        Orden.estado.notin_(["cancelada", "rechazada"]),
    ).first() is not None


def _solo_cliente(u: Usuario):
    if _tipo(u) != "cliente":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo para clientes")


@router.get("/mia", summary="Mi código, mis domicilios gratis y mis invitados")
async def mi_invitacion(current_user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    _solo_cliente(current_user)
    activo = reglas.activa("invitaciones", db)
    invitados = db.query(Usuario).filter(Usuario.invitado_por == current_user.id).order_by(Usuario.fecha_creacion.desc()).limit(30).all()
    invitador = db.query(Usuario).filter(Usuario.id == current_user.invitado_por).first() if current_user.invitado_por else None
    codigo = _codigo_de(db, current_user) if activo else current_user.codigo_invitacion
    return {
        "activo": activo,
        "codigo": codigo,
        "domicilios_gratis": current_user.domicilios_gratis or 0,
        "puede_canjear": activo and not current_user.invitado_por and not _ya_pidio(db, current_user.id),
        "invitado_por": invitador.nombre if invitador else None,
        "invitados": [{"nombre": f"{i.nombre or ''} {(i.apellido or '')[:1]}.".strip(), "premiado": bool(i.invitacion_premiada)} for i in invitados],
        "texto_compartir": (
            f"Te regalo un domicilio gratis en ZIPPYGO, la app de domicilios de Garzón. "
            f"Descárgala, entra a tu perfil y escribe mi código {codigo}.\n"
            f"Android: {ENLACE_ANDROID}\niPhone: {ENLACE_IPHONE}"
        ) if codigo else None,
    }


@router.post("/canjear", summary="Escribir el código del amigo que me invitó")
async def canjear(datos: Canje, current_user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    _solo_cliente(current_user)
    if not reglas.activa("invitaciones", db):
        raise HTTPException(status_code=400, detail="Las invitaciones no están disponibles en este momento")
    if current_user.invitado_por:
        raise HTTPException(status_code=400, detail="Ya escribiste el código de un amigo")
    if _ya_pidio(db, current_user.id):
        raise HTTPException(status_code=400, detail="El código de un amigo solo se puede usar antes de tu primer pedido")
    codigo = re.sub(r"\s+", "", datos.codigo.upper())
    amigo = db.query(Usuario).filter(Usuario.codigo_invitacion == codigo).first()
    if not amigo or _tipo(amigo) != "cliente":
        raise HTTPException(status_code=404, detail="Ese código no existe. Revísalo con tu amigo.")
    if amigo.id == current_user.id or (amigo.email or "").lower() == (current_user.email or "").lower():
        raise HTTPException(status_code=400, detail="No puedes usar tu propio código")
    current_user.invitado_por = amigo.id
    db.commit()
    return {"ok": True, "invitado_por": amigo.nombre}


# ── Lo que usan los pedidos ────────────────────────────────────────────────

def aplicar_domicilio_gratis(db: Session, cliente: Usuario, costo_domicilio) -> bool:
    """Gasta un domicilio gratis del cliente si tiene. True si se aplicó."""
    if not costo_domicilio or float(costo_domicilio) <= 0:
        return False
    fila = db.query(Usuario).filter(Usuario.id == cliente.id).with_for_update().first()
    if not fila or (fila.domicilios_gratis or 0) <= 0:
        return False
    fila.domicilios_gratis = (fila.domicilios_gratis or 0) - 1
    return True


def devolver_domicilio_gratis(db: Session, orden: Orden) -> None:
    """El pedido se canceló: el domicilio gratis vuelve a la cuenta (una vez)."""
    if not orden.domicilio_gratis or not orden.cliente_id:
        return
    cliente = db.query(Usuario).filter(Usuario.id == orden.cliente_id).first()
    if cliente:
        cliente.domicilios_gratis = (cliente.domicilios_gratis or 0) + 1
    orden.domicilio_gratis = False


def premiar_si_toca(db: Session, orden: Orden) -> None:
    """Se llama cuando un pedido queda entregado. Si es el primero de un
    invitado, los dos ganan un domicilio gratis. Nunca tumba la entrega."""
    try:
        cliente = db.query(Usuario).filter(Usuario.id == orden.cliente_id).with_for_update().first()
        if not cliente or not cliente.invitado_por or cliente.invitacion_premiada:
            return
        amigo = db.query(Usuario).filter(Usuario.id == cliente.invitado_por).first()
        cliente.invitacion_premiada = True
        cliente.domicilios_gratis = (cliente.domicilios_gratis or 0) + 1
        notificar_usuario(db, cliente, "domicilio_gratis", "¡Ganaste un domicilio gratis!",
                          "Por llegar invitado a ZIPPYGO. Se usa solo en tu próximo pedido.")
        if amigo:
            amigo.domicilios_gratis = (amigo.domicilios_gratis or 0) + 1
            notificar_usuario(db, amigo, "domicilio_gratis", "¡Ganaste un domicilio gratis!",
                              f"{cliente.nombre} hizo su primer pedido con tu código. Se usa solo en tu próximo pedido.")
    except Exception as e:
        print(f"[invitaciones] no se pudo premiar: {e}")
