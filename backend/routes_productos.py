# ============================================================================
# routes/productos.py - Rutas de Productos
# ============================================================================

import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List
from uuid import UUID
from datetime import datetime, timedelta

from config import get_db
from models import Producto, Negocio, Usuario
from schemas import ProductoCreate, ProductoUpdate, ProductoResponse, OfertaCreate
from routes_auth import get_current_user

router = APIRouter(prefix="/api/v1/productos", tags=["Productos"])

UPLOAD_DIR = "uploads/productos"
EXTENSIONES_PERMITIDAS = {".jpg", ".jpeg", ".png", ".webp"}

# ============================================================================
# HELPER: REVERTIR OFERTAS VENCIDAS
# ============================================================================

def _revertir_oferta_si_vencio(producto: Producto, db: Session) -> None:
    """Si la oferta de este producto ya expiró, restaura el precio normal.
    Se llama antes de devolver productos, así no se necesita un job aparte:
    la oferta se 'auto-limpia' la próxima vez que alguien consulta el producto."""
    if producto.oferta_expira and producto.oferta_expira <= datetime.utcnow():
        if producto.precio_original:
            producto.precio = producto.precio_original
        producto.precio_original = None
        producto.descuento_porcentaje = 0
        producto.oferta_expira = None
        db.commit()
        db.refresh(producto)

# ============================================================================
# ENDPOINT: SUBIR IMAGEN DE PRODUCTO
# ============================================================================

@router.post(
    "/upload-imagen",
    summary="Subir imagen de producto",
    description="Sube una imagen y retorna su URL para usar en 'imagenes'"
)
async def subir_imagen_producto(
    file: UploadFile = File(...),
    current_user: Usuario = Depends(get_current_user),
):
    if current_user.tipo_usuario != "vendedor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo vendedores pueden subir imágenes de productos"
        )

    extension = os.path.splitext(file.filename or "")[1].lower()
    if extension not in EXTENSIONES_PERMITIDAS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de imagen no soportado. Usa JPG, PNG o WEBP"
        )

    nombre_archivo = f"{uuid.uuid4()}{extension}"
    ruta_destino = os.path.join(UPLOAD_DIR, nombre_archivo)

    contenido = await file.read()
    with open(ruta_destino, "wb") as destino:
        destino.write(contenido)

    return {"url": f"/uploads/productos/{nombre_archivo}"}

# ============================================================================
# ENDPOINTS: CRUD DE PRODUCTOS
# ============================================================================

@router.post(
    "/",
    response_model=ProductoResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear nuevo producto",
    description="Crea un nuevo producto en un negocio"
)
async def crear_producto(
    producto: ProductoCreate,
    negocio_id: UUID = Query(..., description="ID del negocio"),
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Crea un nuevo producto
    
    Solo vendedores pueden crear productos en sus negocios
    
    - **nombre**: Nombre del producto
    - **descripcion**: Descripción del producto
    - **precio**: Precio en COP
    - **stock**: Cantidad disponible
    - **categoria**: Categoría del producto
    """
    
    # Verificar que el usuario es vendedor
    if current_user.tipo_usuario != "vendedor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo vendedores pueden crear productos"
        )
    
    # Verificar que el negocio existe y pertenece al vendedor
    negocio = db.query(Negocio).filter(
        and_(
            Negocio.id == negocio_id,
            Negocio.vendedor_id == current_user.id
        )
    ).first()
    
    if not negocio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Negocio no encontrado o no te pertenece"
        )
    
    # Crear producto
    nuevo_producto = Producto(
        negocio_id=negocio_id,
        nombre=producto.nombre,
        descripcion=producto.descripcion,
        precio=producto.precio,
        precio_original=producto.precio_original,
        descuento_porcentaje=producto.descuento_porcentaje,
        stock=producto.stock,
        stock_minimo=producto.stock_minimo,
        categoria=producto.categoria,
        subcategoria=producto.subcategoria,
        imagenes=producto.imagenes,
        estado="activo",
        fecha_creacion=datetime.utcnow()
    )
    
    db.add(nuevo_producto)
    db.commit()
    db.refresh(nuevo_producto)
    
    return ProductoResponse.from_orm(nuevo_producto)

@router.get(
    "/",
    response_model=List[ProductoResponse],
    summary="Listar productos",
    description="Lista todos los productos con filtros opcionales"
)
async def listar_productos(
    negocio_id: UUID = Query(None, description="Filtrar por negocio"),
    categoria: str = Query(None, description="Filtrar por categoría"),
    precio_min: float = Query(None, description="Precio mínimo"),
    precio_max: float = Query(None, description="Precio máximo"),
    skip: int = Query(0, ge=0, description="Saltar N productos"),
    limit: int = Query(10, ge=1, le=100, description="Límite de resultados"),
    db: Session = Depends(get_db)
):
    """
    Lista productos con filtros opcionales
    
    Parámetros de filtro:
    - **negocio_id**: ID del negocio
    - **categoria**: Categoría del producto
    - **precio_min**: Precio mínimo
    - **precio_max**: Precio máximo
    - **skip**: Número de productos a saltar (paginación)
    - **limit**: Cantidad de productos a retornar
    """
    
    query = db.query(Producto).filter(
        Producto.es_visible == True,
        Producto.estado == "activo"
    )
    
    # Aplicar filtros
    if negocio_id:
        query = query.filter(Producto.negocio_id == negocio_id)
    
    if categoria:
        query = query.filter(Producto.categoria.ilike(f"%{categoria}%"))
    
    if precio_min is not None:
        query = query.filter(Producto.precio >= precio_min)
    
    if precio_max is not None:
        query = query.filter(Producto.precio <= precio_max)
    
    productos = query.offset(skip).limit(limit).all()

    for p in productos:
        _revertir_oferta_si_vencio(p, db)

    return [ProductoResponse.from_orm(p) for p in productos]

@router.get(
    "/{producto_id}",
    response_model=ProductoResponse,
    summary="Obtener producto por ID",
    description="Retorna los detalles de un producto específico"
)
async def obtener_producto(
    producto_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Obtiene un producto específico por su ID
    
    - **producto_id**: UUID del producto
    """
    
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    
    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado"
        )
    
    _revertir_oferta_si_vencio(producto, db)

    return ProductoResponse.from_orm(producto)

@router.put(
    "/{producto_id}",
    response_model=ProductoResponse,
    summary="Actualizar producto",
    description="Actualiza los datos de un producto"
)
async def actualizar_producto(
    producto_id: UUID,
    producto_actualizado: ProductoUpdate,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Actualiza un producto existente
    
    Solo el vendedor dueño del negocio puede actualizar sus productos
    
    - **producto_id**: UUID del producto
    - **datos**: Campos a actualizar
    """
    
    # Obtener producto
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    
    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado"
        )
    
    # Verificar que el usuario es dueño del negocio
    negocio = db.query(Negocio).filter(Negocio.id == producto.negocio_id).first()

    if negocio.vendedor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes actualizar productos que no te pertenecen"
        )
    
    # Actualizar campos
    datos_actualizacion = producto_actualizado.dict(exclude_unset=True)
    
    for campo, valor in datos_actualizacion.items():
        setattr(producto, campo, valor)
    
    producto.fecha_ultima_actualizacion = datetime.utcnow()
    
    db.commit()
    db.refresh(producto)
    
    return ProductoResponse.from_orm(producto)

@router.delete(
    "/{producto_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar producto",
    description="Marca un producto como inactivo"
)
async def eliminar_producto(
    producto_id: UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Elimina (desactiva) un producto
    
    Solo el vendedor dueño del negocio puede eliminar sus productos
    
    - **producto_id**: UUID del producto
    """
    
    # Obtener producto
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    
    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado"
        )
    
    # Verificar que el usuario es dueño del negocio
    negocio = db.query(Negocio).filter(Negocio.id == producto.negocio_id).first()
    
    if negocio.vendedor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes eliminar productos que no te pertenecen"
        )
    
    # Marcar como inactivo
    producto.estado = "inactivo"
    producto.fecha_ultima_actualizacion = datetime.utcnow()
    
    db.commit()

# ============================================================================
# ENDPOINTS: BÚSQUEDA Y FILTROS
# ============================================================================

@router.get(
    "/buscar/por-nombre",
    response_model=List[ProductoResponse],
    summary="Buscar productos por nombre",
    description="Busca productos que coincidan con el nombre"
)
async def buscar_por_nombre(
    nombre: str = Query(..., min_length=1, description="Nombre a buscar"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Busca productos por nombre (búsqueda parcial)
    
    - **nombre**: Texto a buscar en el nombre del producto
    - **limit**: Cantidad máxima de resultados
    """
    
    productos = db.query(Producto).filter(
        and_(
            Producto.nombre.ilike(f"%{nombre}%"),
            Producto.es_visible == True,
            Producto.estado == "activo"
        )
    ).limit(limit).all()
    
    for p in productos:
        _revertir_oferta_si_vencio(p, db)

    return [ProductoResponse.from_orm(p) for p in productos]

@router.get(
    "/tendencias/mas-vendidos",
    response_model=List[ProductoResponse],
    summary="Productos más vendidos",
    description="Retorna los productos más vendidos"
)
async def productos_mas_vendidos(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    Obtiene los productos más vendidos
    
    - **limit**: Cantidad de productos a retornar
    """
    
    productos = db.query(Producto).filter(
        and_(
            Producto.es_visible == True,
            Producto.estado == "activo"
        )
    ).order_by(Producto.total_vendidos.desc()).limit(limit).all()
    
    for p in productos:
        _revertir_oferta_si_vencio(p, db)

    return [ProductoResponse.from_orm(p) for p in productos]

@router.get(
    "/tendencias/mejor-calificados",
    response_model=List[ProductoResponse],
    summary="Productos mejor calificados",
    description="Retorna los productos con mejor calificación"
)
async def productos_mejor_calificados(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    Obtiene los productos mejor calificados
    
    - **limit**: Cantidad de productos a retornar
    """
    
    productos = db.query(Producto).filter(
        and_(
            Producto.es_visible == True,
            Producto.estado == "activo"
        )
    ).order_by(Producto.calificacion_promedio.desc()).limit(limit).all()
    
    for p in productos:
        _revertir_oferta_si_vencio(p, db)

    return [ProductoResponse.from_orm(p) for p in productos]

# ============================================================================
# ENDPOINTS: OFERTAS POR TIEMPO LIMITADO
# ============================================================================

@router.post(
    "/{producto_id}/oferta",
    response_model=ProductoResponse,
    summary="Crear oferta por tiempo limitado",
    description="Pone el producto en oferta con un precio especial durante el tiempo que el vendedor elija"
)
async def crear_oferta(
    producto_id: UUID,
    oferta: OfertaCreate,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Crea (o reemplaza) la oferta activa de un producto

    - **precio_oferta**: precio especial mientras dure la oferta
    - **horas**: duración en horas desde ahora (alternativa a 'fecha_fin')
    - **fecha_fin**: fecha y hora exacta en que termina la oferta (alternativa a 'horas')
    """
    producto = db.query(Producto).filter(Producto.id == producto_id).first()

    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado"
        )

    negocio = db.query(Negocio).filter(Negocio.id == producto.negocio_id).first()
    if negocio.vendedor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes crear ofertas en productos que no te pertenecen"
        )

    if not oferta.horas and not oferta.fecha_fin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Indica la duración de la oferta: 'horas' o 'fecha_fin'"
        )
    if oferta.horas and oferta.fecha_fin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Indica solo una duración: 'horas' o 'fecha_fin', no ambas"
        )

    expira = datetime.utcnow() + timedelta(hours=oferta.horas) if oferta.horas else oferta.fecha_fin

    if expira <= datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha de fin de la oferta debe ser en el futuro"
        )

    # Si no hay una oferta activa en este momento, el precio actual pasa a ser el precio "normal"
    # de referencia (para poder restaurarlo cuando la oferta termine).
    if not producto.oferta_expira or producto.oferta_expira <= datetime.utcnow():
        producto.precio_original = producto.precio

    if oferta.precio_oferta >= producto.precio_original:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El precio de oferta debe ser menor al precio normal del producto"
        )

    producto.precio = oferta.precio_oferta
    producto.descuento_porcentaje = round((1 - float(oferta.precio_oferta) / float(producto.precio_original)) * 100, 2)
    producto.oferta_expira = expira
    producto.fecha_ultima_actualizacion = datetime.utcnow()

    db.commit()
    db.refresh(producto)

    return ProductoResponse.from_orm(producto)

@router.delete(
    "/{producto_id}/oferta",
    response_model=ProductoResponse,
    summary="Cancelar oferta",
    description="Cancela la oferta activa de un producto y restaura su precio normal"
)
async def cancelar_oferta(
    producto_id: UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancela la oferta activa antes de que se cumpla el tiempo, restaurando el precio normal"""
    producto = db.query(Producto).filter(Producto.id == producto_id).first()

    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado"
        )

    negocio = db.query(Negocio).filter(Negocio.id == producto.negocio_id).first()
    if negocio.vendedor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes cancelar ofertas de productos que no te pertenecen"
        )

    if producto.precio_original:
        producto.precio = producto.precio_original
    producto.precio_original = None
    producto.descuento_porcentaje = 0
    producto.oferta_expira = None
    producto.fecha_ultima_actualizacion = datetime.utcnow()

    db.commit()
    db.refresh(producto)

    return ProductoResponse.from_orm(producto)

# ============================================================================
# ENDPOINT: ACTUALIZAR STOCK
# ============================================================================

@router.patch(
    "/{producto_id}/stock",
    response_model=ProductoResponse,
    summary="Actualizar stock del producto",
    description="Aumenta o disminuye el stock de un producto"
)
async def actualizar_stock(
    producto_id: UUID,
    cantidad_cambio: int = Query(..., description="Cantidad a sumar/restar"),
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Actualiza el stock de un producto
    
    - **producto_id**: UUID del producto
    - **cantidad_cambio**: Cantidad a sumar (positivo) o restar (negativo)
    """
    
    # Obtener producto
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    
    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado"
        )
    
    # Verificar que el usuario es dueño del negocio
    negocio = db.query(Negocio).filter(Negocio.id == producto.negocio_id).first()
    
    if negocio.vendedor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes actualizar stock de productos que no te pertenecen"
        )
    
    # Actualizar stock
    nuevo_stock = producto.stock + cantidad_cambio
    
    if nuevo_stock < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes reducir el stock por debajo de 0"
        )
    
    producto.stock = nuevo_stock
    producto.fecha_ultima_actualizacion = datetime.utcnow()
    
    db.commit()
    db.refresh(producto)
    
    return ProductoResponse.from_orm(producto)