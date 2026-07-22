# ============================================================================
# routes_pedidos_especiales.py - Encargos directos cliente <-> domiciliario
#
# Antes vivían solo en localStorage (cada quien veía los suyos). Ahora se
# guardan en la base para que los pedidos del cliente lleguen de verdad al
# domiciliario.
# ============================================================================

from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from config import get_db
from models import Usuario, PedidoEspecial
from routes_auth import get_current_user

router = APIRouter(prefix="/api/v1/pedidos-especiales", tags=["Pedidos especiales"])


# ============================================================================
# HELPERS
# ============================================================================

def _tipo(usuario: Usuario) -> str:
    t = usuario.tipo_usuario
    return (t.value if hasattr(t, "value") else str(t)).lower()


def _corto_id(pedido_id) -> str:
    """Código legible tipo #PE4829 a partir del UUID."""
    return "#PE" + str(pedido_id).replace("-", "")[-4:].upper()


def _a_dict(p: PedidoEspecial, db: Session) -> dict:
    cliente = db.query(Usuario).filter(Usuario.id == p.cliente_id).first()

    nombre_cliente = ""
    if cliente:
        nombre_cliente = f"{cliente.nombre} {cliente.apellido or ''}".strip()

    return {
        "id": _corto_id(p.id),
        "idCompleto": str(p.id),
        "estado": p.estado,
        "items": p.items or [],
        "direccion": p.direccion,
        "barrio": p.barrio or "",
        "telefono": p.telefono or (cliente.telefono if cliente else ""),
        "notas": p.notas or "",
        "cliente": nombre_cliente or "Cliente",
        "domiciliario_id": str(p.domiciliario_id) if p.domiciliario_id else None,
        "fecha": p.fecha_creacion.strftime("%d/%m/%Y") if p.fecha_creacion else "",
        "fecha_creacion": p.fecha_creacion.isoformat() if p.fecha_creacion else None,
    }


# ============================================================================
# CLIENTE
# ============================================================================

@router.post(
    "/",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    summary="Crear un pedido especial (cliente)",
)
async def crear_pedido_especial(
    datos: dict,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = datos.get("items") or []
    items = [
        {
            "descripcion": str(it.get("descripcion", "")).strip(),
            "cantidad": it.get("cantidad", 1),
            "unidad": it.get("unidad", "unidad"),
        }
        for it in items
        if str(it.get("descripcion", "")).strip()
    ]

    if not items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Agrega al menos un producto al pedido",
        )

    direccion = (datos.get("direccion") or "").strip()
    if not direccion:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La dirección de entrega es obligatoria",
        )

    pedido = PedidoEspecial(
        cliente_id=current_user.id,
        estado="pendiente",
        items=items,
        direccion=direccion[:500],
        barrio=(datos.get("barrio") or "").strip()[:150] or None,
        telefono=(datos.get("telefono") or "").strip()[:30] or None,
        notas=(datos.get("notas") or "").strip() or None,
    )

    db.add(pedido)
    db.commit()
    db.refresh(pedido)

    return _a_dict(pedido, db)


@router.get(
    "/mis-pedidos/",
    response_model=List[dict],
    summary="Pedidos especiales del cliente autenticado",
)
async def mis_pedidos_especiales(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pedidos = db.query(PedidoEspecial).filter(
        PedidoEspecial.cliente_id == current_user.id
    ).order_by(PedidoEspecial.fecha_creacion.desc()).all()

    return [_a_dict(p, db) for p in pedidos]


# ============================================================================
# DOMICILIARIO
# ============================================================================

@router.get(
    "/disponibles/",
    response_model=List[dict],
    summary="Pedidos especiales sin tomar (para domiciliarios)",
)
async def pedidos_disponibles(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _tipo(current_user) != "domiciliario":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los domiciliarios pueden ver los pedidos disponibles",
        )

    pedidos = db.query(PedidoEspecial).filter(
        PedidoEspecial.estado == "pendiente",
        PedidoEspecial.domiciliario_id.is_(None),
    ).order_by(PedidoEspecial.fecha_creacion.asc()).all()

    return [_a_dict(p, db) for p in pedidos]


@router.get(
    "/mis-entregas/",
    response_model=List[dict],
    summary="Pedidos especiales que tomó el domiciliario",
)
async def mis_entregas(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _tipo(current_user) != "domiciliario":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo para domiciliarios",
        )

    pedidos = db.query(PedidoEspecial).filter(
        PedidoEspecial.domiciliario_id == current_user.id,
    ).order_by(PedidoEspecial.fecha_creacion.desc()).all()

    return [_a_dict(p, db) for p in pedidos]


@router.post(
    "/{pedido_id}/aceptar/",
    response_model=dict,
    summary="Un domiciliario toma un pedido especial",
)
async def aceptar_pedido(
    pedido_id: UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _tipo(current_user) != "domiciliario":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los domiciliarios pueden tomar pedidos",
        )

    pedido = db.query(PedidoEspecial).filter(PedidoEspecial.id == pedido_id).first()
    if not pedido:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")

    if pedido.domiciliario_id and pedido.domiciliario_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Otro domiciliario ya tomó este pedido",
        )

    pedido.domiciliario_id = current_user.id
    pedido.estado = "en_camino"
    pedido.fecha_aceptacion = datetime.utcnow()
    db.commit()
    db.refresh(pedido)

    return _a_dict(pedido, db)


@router.post(
    "/{pedido_id}/entregar/",
    response_model=dict,
    summary="Marcar un pedido especial como entregado",
)
async def entregar_pedido(
    pedido_id: UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pedido = db.query(PedidoEspecial).filter(PedidoEspecial.id == pedido_id).first()
    if not pedido:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")

    if pedido.domiciliario_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el domiciliario asignado puede entregar este pedido",
        )

    pedido.estado = "entregada"
    pedido.fecha_entrega = datetime.utcnow()
    db.commit()
    db.refresh(pedido)

    return _a_dict(pedido, db)


@router.post(
    "/{pedido_id}/cancelar/",
    response_model=dict,
    summary="El cliente cancela su pedido especial (si aún no lo toman)",
)
async def cancelar_pedido(
    pedido_id: UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pedido = db.query(PedidoEspecial).filter(PedidoEspecial.id == pedido_id).first()
    if not pedido:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")

    if pedido.cliente_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el cliente puede cancelar su pedido",
        )

    if pedido.estado not in ("pendiente",):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este pedido ya fue tomado y no se puede cancelar",
        )

    pedido.estado = "cancelada"
    db.commit()
    db.refresh(pedido)

    return _a_dict(pedido, db)