# ============================================================================
# routes/carrito.py - Rutas del Carrito de Compras
# ============================================================================

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Dict, Any
from uuid import UUID
from datetime import datetime
from decimal import Decimal

from config import get_db, settings
from models import Carrito, ItemCarrito, Producto, Usuario, Negocio
from schemas import ItemCarritoCreate, ItemCarritoResponse, CarritoResponse
from routes_auth import get_current_user

router = APIRouter(prefix="/api/v1/carrito", tags=["Carrito"])

# ============================================================================
# FUNCIONES AUXILIARES
# ============================================================================

def obtener_o_crear_carrito(
    cliente_id: UUID,
    negocio_id: UUID,
    db: Session
) -> Carrito:
    """Obtiene o crea un carrito activo"""
    carrito = db.query(Carrito).filter(
        and_(
            Carrito.cliente_id == cliente_id,
            Carrito.negocio_id == negocio_id,
            Carrito.estado == "activo"
        )
    ).first()
    
    if not carrito:
        carrito = Carrito(
            cliente_id=cliente_id,
            negocio_id=negocio_id,
            estado="activo",
            fecha_creacion=datetime.utcnow()
        )
        db.add(carrito)
        db.commit()
        db.refresh(carrito)
    
    return carrito

def calcular_totales_carrito(carrito: Carrito) -> Dict[str, Any]:
    """Calcula los totales del carrito"""
    subtotal = Decimal(0)
    cantidad_items = 0
    
    for item in carrito.items:
        precio = item.producto.precio
        subtotal += precio * item.cantidad
        cantidad_items += item.cantidad
    
    impuesto = subtotal * (Decimal(settings.IMPUESTO_IVA) / 100)
    total = subtotal + impuesto
    
    return {
        "subtotal": float(subtotal),
        "impuesto": float(impuesto),
        "total": float(total),
        "cantidad_items": cantidad_items
    }

# ============================================================================
# ENDPOINTS: CARRITO
# ============================================================================

@router.post(
    "/{negocio_id}/items",
    response_model=Dict[str, Any],
    status_code=status.HTTP_201_CREATED,
    summary="Agregar producto al carrito",
    description="Agrega un producto al carrito"
)
async def agregar_al_carrito(
    negocio_id: UUID,
    item: ItemCarritoCreate,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Agrega un producto al carrito
    
    Solo clientes pueden agregar al carrito
    
    - **negocio_id**: ID del negocio
    - **producto_id**: ID del producto
    - **cantidad**: Cantidad a agregar
    """
    
    # Verificar que es cliente
    if current_user.tipo_usuario != "cliente":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo clientes pueden usar el carrito"
        )
    
    # Verificar que el negocio existe
    negocio = db.query(Negocio).filter(Negocio.id == negocio_id).first()
    
    if not negocio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Negocio no encontrado"
        )
    
    # Verificar que el producto existe
    producto = db.query(Producto).filter(
        and_(
            Producto.id == item.producto_id,
            Producto.negocio_id == negocio_id
        )
    ).first()
    
    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado en este negocio"
        )
    
    # Verificar stock
    if producto.stock < item.cantidad:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stock insuficiente. Disponible: {producto.stock}"
        )
    
    # Obtener o crear carrito
    carrito = obtener_o_crear_carrito(current_user.id, negocio_id, db)
    
    # Verificar si el producto ya está en el carrito
    item_existente = db.query(ItemCarrito).filter(
        and_(
            ItemCarrito.carrito_id == carrito.id,
            ItemCarrito.producto_id == item.producto_id
        )
    ).first()
    
    if item_existente:
        # Actualizar cantidad
        nueva_cantidad = item_existente.cantidad + item.cantidad
        
        if producto.stock < nueva_cantidad:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Stock insuficiente. Disponible: {producto.stock}"
            )
        
        item_existente.cantidad = nueva_cantidad
    else:
        # Crear nuevo item
        nuevo_item = ItemCarrito(
            carrito_id=carrito.id,
            producto_id=item.producto_id,
            cantidad=item.cantidad,
            especificaciones=item.especificaciones,
            fecha_agregado=datetime.utcnow()
        )
        db.add(nuevo_item)
    
    carrito.fecha_ultima_actualizacion = datetime.utcnow()
    db.commit()
    db.refresh(carrito)
    
    totales = calcular_totales_carrito(carrito)
    
    return {
        "mensaje": "Producto agregado al carrito",
        "carrito_id": str(carrito.id),
        "negocio_id": str(negocio_id),
        "cantidad_items": len(carrito.items),
        "totales": totales
    }

@router.get(
    "/{negocio_id}",
    response_model=Dict[str, Any],
    summary="Obtener carrito",
    description="Obtiene el carrito del usuario para un negocio"
)
async def obtener_carrito(
    negocio_id: UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtiene el carrito actual del usuario
    
    - **negocio_id**: ID del negocio
    """
    
    # Verificar que es cliente
    if current_user.tipo_usuario != "cliente":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo clientes pueden ver el carrito"
        )
    
    carrito = db.query(Carrito).filter(
        and_(
            Carrito.cliente_id == current_user.id,
            Carrito.negocio_id == negocio_id,
            Carrito.estado == "activo"
        )
    ).first()
    
    if not carrito:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Carrito no encontrado"
        )
    
    items_response = []
    for item in carrito.items:
        items_response.append({
            "id": str(item.id),
            "producto_id": str(item.producto_id),
            "nombre_producto": item.producto.nombre,
            "precio": float(item.producto.precio),
            "cantidad": item.cantidad,
            "subtotal": float(item.producto.precio * item.cantidad),
            "especificaciones": item.especificaciones
        })
    
    totales = calcular_totales_carrito(carrito)
    
    return {
        "carrito_id": str(carrito.id),
        "negocio_id": str(negocio_id),
        "items": items_response,
        "cantidad_items": len(carrito.items),
        "totales": totales
    }

@router.put(
    "/{negocio_id}/items/{item_id}",
    response_model=Dict[str, Any],
    summary="Actualizar cantidad de producto",
    description="Actualiza la cantidad de un producto en el carrito"
)
async def actualizar_cantidad_carrito(
    negocio_id: UUID,
    item_id: UUID,
    cantidad: int = Query(..., gt=0, description="Nueva cantidad"),
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Actualiza la cantidad de un producto en el carrito
    
    - **negocio_id**: ID del negocio
    - **item_id**: ID del item del carrito
    - **cantidad**: Nueva cantidad
    """
    
    # Obtener item del carrito
    item = db.query(ItemCarrito).filter(ItemCarrito.id == item_id).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item del carrito no encontrado"
        )
    
    # Verificar que pertenece al usuario
    if item.carrito.cliente_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes modificar este carrito"
        )
    
    # Verificar stock
    if item.producto.stock < cantidad:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stock insuficiente. Disponible: {item.producto.stock}"
        )
    
    # Actualizar cantidad
    item.cantidad = cantidad
    item.carrito.fecha_ultima_actualizacion = datetime.utcnow()
    
    db.commit()
    db.refresh(item.carrito)
    
    totales = calcular_totales_carrito(item.carrito)
    
    return {
        "mensaje": "Cantidad actualizada",
        "item_id": str(item_id),
        "nueva_cantidad": cantidad,
        "totales": totales
    }

@router.delete(
    "/{negocio_id}/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar producto del carrito",
    description="Elimina un producto del carrito"
)
async def eliminar_del_carrito(
    negocio_id: UUID,
    item_id: UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Elimina un producto del carrito
    
    - **negocio_id**: ID del negocio
    - **item_id**: ID del item del carrito
    """
    
    # Obtener item del carrito
    item = db.query(ItemCarrito).filter(ItemCarrito.id == item_id).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item del carrito no encontrado"
        )
    
    # Verificar que pertenece al usuario
    if item.carrito.cliente_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes modificar este carrito"
        )
    
    # Eliminar item
    db.delete(item)
    item.carrito.fecha_ultima_actualizacion = datetime.utcnow()
    
    db.commit()

@router.delete(
    "/{negocio_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Vaciar carrito",
    description="Elimina todos los productos del carrito"
)
async def vaciar_carrito(
    negocio_id: UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Vacía completamente el carrito
    
    - **negocio_id**: ID del negocio
    """
    
    carrito = db.query(Carrito).filter(
        and_(
            Carrito.cliente_id == current_user.id,
            Carrito.negocio_id == negocio_id,
            Carrito.estado == "activo"
        )
    ).first()
    
    if not carrito:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Carrito no encontrado"
        )
    
    # Eliminar todos los items
    db.query(ItemCarrito).filter(
        ItemCarrito.carrito_id == carrito.id
    ).delete()
    
    # Marcar carrito como abandonado
    carrito.estado = "abandonado"
    carrito.fecha_ultima_actualizacion = datetime.utcnow()
    
    db.commit()

# ============================================================================
# ENDPOINT: RESUMEN DEL CARRITO
# ============================================================================

@router.get(
    "/{negocio_id}/resumen",
    response_model=Dict[str, Any],
    summary="Resumen del carrito",
    description="Retorna un resumen con totales del carrito"
)
async def resumen_carrito(
    negocio_id: UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtiene un resumen detallado del carrito
    
    - **negocio_id**: ID del negocio
    """
    
    carrito = db.query(Carrito).filter(
        and_(
            Carrito.cliente_id == current_user.id,
            Carrito.negocio_id == negocio_id,
            Carrito.estado == "activo"
        )
    ).first()
    
    if not carrito:
        return {
            "carrito_id": None,
            "negocio_id": str(negocio_id),
            "items": [],
            "cantidad_items": 0,
            "totales": {
                "subtotal": 0,
                "impuesto": 0,
                "total": 0,
                "cantidad_items": 0
            }
        }
    
    items_response = []
    for item in carrito.items:
        items_response.append({
            "id": str(item.id),
            "producto_id": str(item.producto_id),
            "nombre_producto": item.producto.nombre,
            "descripcion": item.producto.descripcion,
            "precio": float(item.producto.precio),
            "cantidad": item.cantidad,
            "subtotal": float(item.producto.precio * item.cantidad),
            "imagen": item.producto.imagenes[0] if item.producto.imagenes else None,
            "especificaciones": item.especificaciones
        })
    
    totales = calcular_totales_carrito(carrito)
    
    return {
        "carrito_id": str(carrito.id),
        "negocio_id": str(negocio_id),
        "items": items_response,
        "cantidad_items": len(carrito.items),
        "totales": totales
    }
