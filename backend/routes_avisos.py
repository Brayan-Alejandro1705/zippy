# ============================================================================
# routes_avisos.py - Avisos de novedades y promociones (nov 2026)
#
# - El súper admin escribe un aviso (título, mensaje y, si quiere, una tienda
#   que se abre al tocarlo) y les llega a los clientes que aceptaron.
# - Automático: cuando un negocio nuevo ya tiene 3 productos publicados, se
#   les avisa "Nuevo en ZIPPYGO: ..." una sola vez (anunciar_si_toca).
#
# Reglas: solo a quien aceptó (Usuario.acepta_novedades, Apple 4.5.4) y
# máximo un aviso cada 20 horas, para que la gente no se aburra y desinstale.
# ============================================================================

from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config import get_db
from models import AvisoMasivo, ConfiguracionSistema, EstadoUsuario, Negocio, Producto, Usuario
from push import notificar_usuario
from routes_auth import get_current_user

router = APIRouter(prefix="/api/v1/avisos", tags=["Avisos"])

CLAVE_AUTO = "avisos_negocios_nuevos"
HORAS_ENTRE_AVISOS = 20
PRODUCTOS_PARA_ANUNCIAR = 3
TIPO_PUSH = "novedad"


class Preferencia(BaseModel):
    acepta: bool


class AvisoNuevo(BaseModel):
    titulo: str = Field(..., min_length=3, max_length=120)
    mensaje: str = Field(..., min_length=3, max_length=300)
    negocio_id: Optional[UUID] = None


class Auto(BaseModel):
    activo: bool


def _es_admin(u: Usuario) -> bool:
    return str(getattr(u.tipo_usuario, "value", u.tipo_usuario)).lower() == "admin"


def _solo_admin(u: Usuario):
    if not _es_admin(u):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores")


def _destinatarios(db: Session):
    return db.query(Usuario).filter(
        Usuario.tipo_usuario == "cliente",
        Usuario.estado == EstadoUsuario.ACTIVO,
        Usuario.acepta_novedades == True,  # noqa: E712
        Usuario.fcm_token.isnot(None),
    ).all()


def _ultimo_aviso(db: Session):
    return db.query(AvisoMasivo).order_by(AvisoMasivo.fecha_creacion.desc()).first()


def _puede_enviar(db: Session) -> Optional[datetime]:
    """None si ya se puede mandar otro aviso; si no, desde cuándo se podrá (UTC)."""
    ultimo = _ultimo_aviso(db)
    if ultimo and ultimo.fecha_creacion > datetime.utcnow() - timedelta(hours=HORAS_ENTRE_AVISOS):
        return ultimo.fecha_creacion + timedelta(hours=HORAS_ENTRE_AVISOS)
    return None


def _auto_activo(db: Session) -> bool:
    fila = db.query(ConfiguracionSistema).filter(ConfiguracionSistema.clave == CLAVE_AUTO).first()
    return bool(fila and fila.valor == "1")


def _enviar(db: Session, titulo: str, mensaje: str, negocio_id=None, tipo="manual", enviado_por=None) -> AvisoMasivo:
    aviso = AvisoMasivo(titulo=titulo.strip(), mensaje=mensaje.strip(), negocio_id=negocio_id,
                        tipo=tipo, enviado_por=enviado_por)
    db.add(aviso)
    db.flush()
    tokens = set()
    for u in _destinatarios(db):
        # Un celular con varias cuentas suena una sola vez
        if u.fcm_token in tokens:
            continue
        tokens.add(u.fcm_token)
        notificar_usuario(db, u, TIPO_PUSH, aviso.titulo, aviso.mensaje,
                          relacionado_tabla="avisos_masivos", relacionado_id=aviso.id)
    aviso.enviados = len(tokens)
    db.commit()
    db.refresh(aviso)
    return aviso


def _fila(a: AvisoMasivo, db: Session) -> dict:
    negocio = db.query(Negocio).filter(Negocio.id == a.negocio_id).first() if a.negocio_id else None
    autor = db.query(Usuario).filter(Usuario.id == a.enviado_por).first() if a.enviado_por else None
    return {
        "id": str(a.id), "titulo": a.titulo, "mensaje": a.mensaje, "tipo": a.tipo,
        "negocio": negocio.nombre_negocio if negocio else None,
        "autor": autor.nombre if autor else None,
        "enviados": a.enviados, "abiertos": a.abiertos,
        "fecha": a.fecha_creacion.isoformat() if a.fecha_creacion else None,
    }


# ── Cliente ────────────────────────────────────────────────────────────────

@router.get("/mi-preferencia", summary="¿Acepta avisos de novedades? (null = no se le ha preguntado)")
async def mi_preferencia(current_user: Usuario = Depends(get_current_user)):
    return {"acepta": current_user.acepta_novedades}


@router.put("/mi-preferencia", summary="Aceptar o no los avisos de novedades")
async def cambiar_preferencia(datos: Preferencia, current_user: Usuario = Depends(get_current_user),
                              db: Session = Depends(get_db)):
    current_user.acepta_novedades = datos.acepta
    db.commit()
    return {"acepta": datos.acepta}


@router.post("/{aviso_id}/abierto", summary="El cliente tocó el aviso: a dónde llevarlo")
async def aviso_abierto(aviso_id: UUID, db: Session = Depends(get_db),
                        current_user: Usuario = Depends(get_current_user)):
    aviso = db.query(AvisoMasivo).filter(AvisoMasivo.id == aviso_id).first()
    if not aviso:
        return {"negocio_id": None}
    aviso.abiertos = (aviso.abiertos or 0) + 1
    db.commit()
    return {"negocio_id": str(aviso.negocio_id) if aviso.negocio_id else None}


# ── Súper admin ────────────────────────────────────────────────────────────

@router.get("/", summary="Historial, a cuántos les llega y si ya se puede mandar otro")
async def panel_avisos(current_user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    _solo_admin(current_user)
    historial = db.query(AvisoMasivo).order_by(AvisoMasivo.fecha_creacion.desc()).limit(30).all()
    proximo = _puede_enviar(db)
    return {
        "destinatarios": len({u.fcm_token for u in _destinatarios(db)}),
        "clientes_con_app": db.query(Usuario).filter(Usuario.tipo_usuario == "cliente",
                                                     Usuario.fcm_token.isnot(None)).count(),
        "auto_activo": _auto_activo(db),
        "proximo_permitido": proximo.isoformat() if proximo else None,
        "historial": [_fila(a, db) for a in historial],
    }


@router.post("/", summary="Mandar un aviso a los clientes que aceptaron")
async def mandar_aviso(datos: AvisoNuevo, current_user: Usuario = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    _solo_admin(current_user)
    if _puede_enviar(db):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Ya se mandó un aviso hoy. Para no cansar a los clientes, espera hasta mañana.")
    if datos.negocio_id and not db.query(Negocio).filter(Negocio.id == datos.negocio_id, Negocio.estado == "activo").first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esa tienda no está activa")
    aviso = _enviar(db, datos.titulo, datos.mensaje, datos.negocio_id, "manual", current_user.id)
    return _fila(aviso, db)


@router.put("/auto", summary="Encender o apagar el aviso automático de negocios nuevos")
async def cambiar_auto(datos: Auto, current_user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    _solo_admin(current_user)
    fila = db.query(ConfiguracionSistema).filter(ConfiguracionSistema.clave == CLAVE_AUTO).first()
    if not fila:
        fila = ConfiguracionSistema(clave=CLAVE_AUTO, descripcion="Anunciar negocios nuevos a los clientes", tipo_dato="bool")
        db.add(fila)
    fila.valor = "1" if datos.activo else "0"
    db.commit()
    return {"auto_activo": datos.activo}


# ── Automático ─────────────────────────────────────────────────────────────

def anunciar_si_toca(db: Session, negocio: Negocio) -> None:
    """Se llama cuando un negocio publica un producto. Si es nuevo (nunca se
    anunció), ya tiene 3 productos a la vista y hoy no se ha mandado otro
    aviso, les cuenta a los clientes que llegó. Nunca tumba la creación del
    producto: cualquier error se queda en el log."""
    try:
        if negocio is None or negocio.anunciado_en is not None or negocio.estado != "activo":
            return
        if not _auto_activo(db) or _puede_enviar(db):
            return
        publicados = db.query(Producto).filter(Producto.negocio_id == negocio.id, Producto.es_visible == True,  # noqa: E712
                                               Producto.estado == "activo").count()
        if publicados < PRODUCTOS_PARA_ANUNCIAR:
            return
        negocio.anunciado_en = datetime.utcnow()
        que = (negocio.categoria or "").strip()
        mensaje = (f"{que} en Garzón. " if que and que.lower() != "general" else "") + "Toca para ver su carta y pedir."
        _enviar(db, f"Nuevo en ZIPPYGO: {negocio.nombre_negocio}"[:120], mensaje, negocio.id, "automatico")
    except Exception as e:
        db.rollback()
        print(f"[avisos] no se pudo anunciar el negocio nuevo: {e}")
