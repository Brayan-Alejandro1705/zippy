# ============================================================================
# routes_cliente.py - Favoritos y direcciones del cliente
#
# Estas tablas ya existían en la base de datos pero no tenían endpoints,
# por eso el frontend mostraba datos de ejemplo.
# ============================================================================

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from config import get_db
from models import Usuario, Favorito, Producto, Direccion, Negocio
from routes_auth import get_current_user

router = APIRouter(prefix="/api/v1/cliente", tags=["Cliente"])


# ============================================================================
# FAVORITOS (productos guardados)
# ============================================================================

@router.get(
    "/favoritos/",
    response_model=List[dict],
    summary="Productos guardados del cliente",
)
async def listar_favoritos(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    favoritos = db.query(Favorito).filter(
        Favorito.cliente_id == current_user.id
    ).order_by(Favorito.fecha_agregado.desc()).all()

    resultado = []
    for f in favoritos:
        producto = f.producto
        if not producto:
            continue

        negocio = db.query(Negocio).filter(Negocio.id == producto.negocio_id).first()

        resultado.append({
            "id": str(f.id),
            "producto_id": str(producto.id),
            "nombre": producto.nombre,
            "tienda": negocio.nombre_negocio if negocio else "",
            "precio": float(producto.precio),
            "categoria": producto.categoria,
            "foto": producto.imagenes[0] if producto.imagenes else None,
            "stock": producto.stock,
        })

    return resultado


@router.post(
    "/favoritos/",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    summary="Guardar un producto en favoritos",
)
async def agregar_favorito(
    datos: dict,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    producto_id = datos.get("producto_id")
    if not producto_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Falta el producto",
        )

    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado",
        )

    existente = db.query(Favorito).filter(
        Favorito.cliente_id == current_user.id,
        Favorito.producto_id == producto_id,
    ).first()

    if existente:
        return {"id": str(existente.id), "mensaje": "Ya estaba guardado"}

    favorito = Favorito(cliente_id=current_user.id, producto_id=producto_id)
    db.add(favorito)
    db.commit()
    db.refresh(favorito)

    return {"id": str(favorito.id), "mensaje": "Producto guardado"}


@router.delete(
    "/favoritos/{producto_id}/",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Quitar un producto de favoritos",
)
async def quitar_favorito(
    producto_id: UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(Favorito).filter(
        Favorito.cliente_id == current_user.id,
        Favorito.producto_id == producto_id,
    ).delete()
    db.commit()


# ============================================================================
# DIRECCIONES
# ============================================================================

def _direccion_a_dict(d: Direccion) -> dict:
    return {
        "id": str(d.id),
        "etiqueta": d.etiqueta or "Sin nombre",
        "dir": d.direccion,
        "referencia": d.referencia_adicional or "",
        "principal": bool(d.es_predeterminada),
        "lat": float(d.latitud) if d.latitud is not None else None,
        "lng": float(d.longitud) if d.longitud is not None else None,
    }


@router.get(
    "/direcciones/",
    response_model=List[dict],
    summary="Direcciones guardadas del cliente",
)
async def listar_direcciones(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    direcciones = db.query(Direccion).filter(
        Direccion.usuario_id == current_user.id,
        Direccion.estado == "activa",
    ).order_by(Direccion.es_predeterminada.desc(), Direccion.fecha_creacion.asc()).all()

    return [_direccion_a_dict(d) for d in direcciones]


@router.post(
    "/direcciones/",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    summary="Agregar una dirección",
)
async def agregar_direccion(
    datos: dict,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    direccion_txt = (datos.get("direccion") or "").strip()
    if not direccion_txt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La dirección no puede estar vacía",
        )

    # Si es la primera, queda como principal
    tiene_otras = db.query(Direccion).filter(
        Direccion.usuario_id == current_user.id,
        Direccion.estado == "activa",
    ).count() > 0

    predeterminada = bool(datos.get("es_predeterminada")) or not tiene_otras

    if predeterminada:
        db.query(Direccion).filter(
            Direccion.usuario_id == current_user.id
        ).update({"es_predeterminada": False})

    nueva = Direccion(
        usuario_id=current_user.id,
        etiqueta=(datos.get("etiqueta") or "Mi dirección")[:100],
        direccion=direccion_txt[:500],
        referencia_adicional=(datos.get("referencia") or "")[:300],
        latitud=datos.get("lat"),
        longitud=datos.get("lng"),
        es_predeterminada=predeterminada,
        estado="activa",
    )

    db.add(nueva)
    db.commit()
    db.refresh(nueva)

    return _direccion_a_dict(nueva)


@router.patch(
    "/direcciones/{direccion_id}/principal/",
    response_model=dict,
    summary="Marcar una dirección como principal",
)
async def marcar_principal(
    direccion_id: UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    direccion = db.query(Direccion).filter(
        Direccion.id == direccion_id,
        Direccion.usuario_id == current_user.id,
    ).first()

    if not direccion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dirección no encontrada",
        )

    db.query(Direccion).filter(
        Direccion.usuario_id == current_user.id
    ).update({"es_predeterminada": False})

    direccion.es_predeterminada = True
    db.commit()
    db.refresh(direccion)

    return _direccion_a_dict(direccion)


@router.delete(
    "/direcciones/{direccion_id}/",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar una dirección",
)
async def eliminar_direccion(
    direccion_id: UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    direccion = db.query(Direccion).filter(
        Direccion.id == direccion_id,
        Direccion.usuario_id == current_user.id,
    ).first()

    if not direccion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dirección no encontrada",
        )

    direccion.estado = "eliminada"
    db.commit()