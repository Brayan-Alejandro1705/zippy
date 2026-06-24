# ============================================================================
# routes_resenas.py - Rutas de Reseñas y Calificaciones
# ============================================================================

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from uuid import UUID
from decimal import Decimal
from datetime import datetime

from config import get_db
from models import ResenaCalificacion, Orden, Negocio, Usuario
from schemas import ResenaCreate, ResenaResponse
from routes_auth import get_current_user

router = APIRouter(prefix="/api/v1/resenas", tags=["Reseñas"])


def _recalcular_calificacion_negocio(negocio_id, db: Session):
    promedio = db.query(func.avg(ResenaCalificacion.calificacion_general)).filter(
        ResenaCalificacion.negocio_id == negocio_id
    ).scalar()
    negocio = db.query(Negocio).filter(Negocio.id == negocio_id).first()
    if negocio:
        negocio.calificacion_promedio = round(Decimal(str(promedio)), 2) if promedio is not None else Decimal(0)

@router.post(
    "/",
    response_model=ResenaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Calificar una orden entregada",
    description="El cliente deja una reseña de una orden ya entregada. Solo se permite una reseña por orden."
)
async def crear_resena(
    datos: ResenaCreate,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.tipo_usuario != "cliente":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los clientes pueden calificar órdenes"
        )

    orden = db.query(Orden).filter(Orden.id == datos.orden_id).first()
    if not orden:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden no encontrada")

    if orden.cliente_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes calificar una orden que no es tuya"
        )

    if orden.estado != "entregada":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo puedes calificar órdenes ya entregadas"
        )

    existente = db.query(ResenaCalificacion).filter(ResenaCalificacion.orden_id == orden.id).first()
    if existente:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ya calificaste esta orden")

    resena = ResenaCalificacion(
        orden_id=orden.id,
        cliente_id=current_user.id,
        negocio_id=orden.negocio_id,
        calificacion_general=datos.calificacion_general,
        calificacion_producto=datos.calificacion_producto,
        calificacion_entrega=datos.calificacion_entrega,
        calificacion_atencion=datos.calificacion_atencion,
        titulo=datos.titulo,
        comentario=datos.comentario,
        imagenes=datos.imagenes or [],
        fecha_creacion=datetime.utcnow()
    )
    db.add(resena)
    db.flush()

    _recalcular_calificacion_negocio(orden.negocio_id, db)

    db.commit()
    db.refresh(resena)
    return resena

@router.get(
    "/negocio/{negocio_id}",
    response_model=List[dict],
    summary="Listar reseñas de un negocio",
    description="Reseñas públicas de un negocio, con el nombre del cliente que la dejó"
)
async def listar_resenas_negocio(
    negocio_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    resenas = db.query(ResenaCalificacion).filter(
        ResenaCalificacion.negocio_id == negocio_id
    ).order_by(ResenaCalificacion.fecha_creacion.desc()).offset(skip).limit(limit).all()

    return [
        {
            "id": str(r.id),
            "cliente_nombre": r.cliente.nombre if r.cliente else "Cliente",
            "calificacion_general": r.calificacion_general,
            "calificacion_producto": r.calificacion_producto,
            "calificacion_entrega": r.calificacion_entrega,
            "calificacion_atencion": r.calificacion_atencion,
            "titulo": r.titulo,
            "comentario": r.comentario,
            "respuesta_vendedor": r.respuesta_vendedor,
            "fecha_creacion": r.fecha_creacion.isoformat() if r.fecha_creacion else None,
        }
        for r in resenas
    ]

@router.get(
    "/orden/{orden_id}",
    response_model=Optional[ResenaResponse],
    summary="Obtener la reseña de una orden",
    description="Retorna la reseña de una orden específica, o null si todavía no se ha calificado"
)
async def obtener_resena_de_orden(
    orden_id: UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    orden = db.query(Orden).filter(Orden.id == orden_id).first()
    if not orden:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden no encontrada")

    puede_ver = (
        orden.cliente_id == current_user.id or
        (orden.negocio.vendedor_id == current_user.id if orden.negocio else False) or
        current_user.tipo_usuario == "admin"
    )
    if not puede_ver:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver esta reseña")

    return db.query(ResenaCalificacion).filter(ResenaCalificacion.orden_id == orden_id).first()
