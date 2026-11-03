# ============================================================================
# routes/negocios.py - Rutas de Negocios
# ============================================================================

import uuid as _uuid
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List
from uuid import UUID
from datetime import datetime

from config import get_db, settings
from models import Negocio, Usuario, Producto, Orden
from pedidos_utils import cancelar_pedidos_de_negocio
from schemas import NegocioCreate, NegocioUpdate, NegocioResponse
from routes_auth import get_current_user
from storage_supabase import subir_archivo, SupabaseStorageError
import imagenes
from rate_limit import limiter

router = APIRouter(prefix="/api/v1/negocios", tags=["Negocios"])

# ============================================================================
# ENDPOINTS: CRUD DE NEGOCIOS
# ============================================================================

@router.post(
    "/",
    response_model=NegocioResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear nuevo negocio",
    description="Crea un nuevo negocio/tienda"
)
async def crear_negocio(
    negocio: NegocioCreate,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Crea un nuevo negocio
    
    Solo usuarios de tipo 'vendedor' pueden crear negocios
    
    - **nombre_negocio**: Nombre de la tienda
    - **categoria**: Categoría del negocio
    - **descripcion**: Descripción de la tienda
    """
    
    # Verificar que el usuario es vendedor
    if current_user.tipo_usuario != "vendedor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo vendedores pueden crear negocios"
        )
    
    # Verificar que el vendedor no tenga otro negocio
    negocio_existente = db.query(Negocio).filter(
        Negocio.vendedor_id == current_user.id
    ).first()
    
    if negocio_existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya tienes un negocio registrado. Solo puedes tener uno."
        )
    
    # Crear negocio
    nuevo_negocio = Negocio(
        vendedor_id=current_user.id,
        nombre_negocio=negocio.nombre_negocio,
        descripcion=negocio.descripcion,
        categoria=negocio.categoria,
        direccion=negocio.direccion,
        telefono=negocio.telefono,
        whatsapp=negocio.whatsapp,
        hora_apertura=negocio.hora_apertura,
        hora_cierre=negocio.hora_cierre,
        estado="activo",
        fecha_creacion=datetime.utcnow()
    )
    
    db.add(nuevo_negocio)
    db.commit()
    db.refresh(nuevo_negocio)
    
    return NegocioResponse.from_orm(nuevo_negocio)

@router.get(
    "/",
    response_model=List[NegocioResponse],
    summary="Listar negocios",
    description="Lista todos los negocios disponibles"
)
async def listar_negocios(
    categoria: str = Query(None, description="Filtrar por categoría"),
    es_servicio: bool = Query(None, description="true = solo servicios, false = solo tiendas"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Lista todos los negocios
    
    Parámetros:
    - **categoria**: Filtrar por categoría (opcional)
    - **skip**: Saltar N negocios
    - **limit**: Límite de negocios a retornar
    """
    
    query = db.query(Negocio).filter(Negocio.estado == "activo")
    
    if categoria:
        query = query.filter(Negocio.categoria.ilike(f"%{categoria}%"))

    if es_servicio is not None:
        query = query.filter(Negocio.es_servicio == es_servicio)

    negocios = query.offset(skip).limit(limit).all()
    
    return [NegocioResponse.from_orm(n) for n in negocios]

@router.get(
    "/mi-negocio",
    response_model=NegocioResponse,
    summary="Obtener mi negocio",
    description="Retorna los datos del negocio del usuario autenticado"
)
async def mi_negocio(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtiene el negocio del usuario autenticado
    
    Solo vendedores tienen negocio
    """
    
    if current_user.tipo_usuario != "vendedor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo vendedores tienen negocio"
        )
    
    negocio = db.query(Negocio).filter(
        Negocio.vendedor_id == current_user.id
    ).first()
    
    if not negocio:
        negocio = Negocio(
            vendedor_id=current_user.id,
            nombre_negocio=f"Negocio de {current_user.nombre}",
            descripcion="Descripción de mi negocio",
            categoria="General",
            estado="activo",
            fecha_creacion=datetime.utcnow()
        )
        db.add(negocio)
        db.commit()
        db.refresh(negocio)
    
    return NegocioResponse.from_orm(negocio)

# ============================================================================
# FOTOS DE LA CARTA (nov 2026)
# El negocio guarda las fotos de su carta (las mismas que usa para "Subir mi
# menú con una foto", o desde su perfil) y el cliente las ve en la tienda con
# "Ver la carta". Hasta 4 páginas. Se guardan más grandes que las fotos de
# producto para que se lean los precios.
# ============================================================================

MAX_PAGINAS_CARTA = 4
TAMANO_MAXIMO_CARTA = 10 * 1024 * 1024


def _negocio_del_vendedor(db: Session, usuario: Usuario) -> Negocio:
    if usuario.tipo_usuario != "vendedor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo los negocios tienen carta")
    negocio = db.query(Negocio).filter(Negocio.vendedor_id == usuario.id).first()
    if not negocio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No encontramos tu negocio")
    return negocio


@router.post("/mi-negocio/carta", response_model=NegocioResponse, summary="Guardar fotos de la carta")
@limiter.limit("20/hour")
async def subir_carta(
    request: Request,
    fotos: List[UploadFile] = File(...),
    reemplazar: bool = Form(False),
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """reemplazar=True deja solo las fotos nuevas (al subir el menú otra vez);
    si no, se agregan a las que ya hay."""
    negocio = _negocio_del_vendedor(db, current_user)
    actuales = [] if reemplazar else list(negocio.fotos_carta or [])
    if len(actuales) + len(fotos) > MAX_PAGINAS_CARTA:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"La carta puede tener hasta {MAX_PAGINAS_CARTA} fotos")
    nuevas = []
    for f in fotos:
        contenido = await f.read()
        if len(contenido) > TAMANO_MAXIMO_CARTA:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Una de las fotos pesa demasiado (máximo 10 MB)")
        try:
            webp = imagenes.documento(contenido)
        except imagenes.ImagenInvalida:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Una de las fotos no es una imagen válida")
        try:
            nuevas.append(subir_archivo(webp, f"carta/{negocio.id}/{_uuid.uuid4()}.webp", "image/webp", cache=imagenes.CACHE))
        except SupabaseStorageError as e:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
    negocio.fotos_carta = actuales + nuevas
    db.commit()
    db.refresh(negocio)
    return NegocioResponse.from_orm(negocio)


@router.delete("/mi-negocio/carta/{indice}", response_model=NegocioResponse, summary="Quitar una foto de la carta")
async def quitar_foto_carta(
    indice: int,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    negocio = _negocio_del_vendedor(db, current_user)
    fotos = list(negocio.fotos_carta or [])
    if not 0 <= indice < len(fotos):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Esa foto ya no está")
    fotos.pop(indice)
    # Lista nueva para que SQLAlchemy note el cambio en la columna JSON
    negocio.fotos_carta = fotos
    db.commit()
    db.refresh(negocio)
    return NegocioResponse.from_orm(negocio)


@router.get(
    "/{negocio_id}",
    response_model=NegocioResponse,
    summary="Obtener negocio por ID",
    description="Retorna los detalles de un negocio específico"
)
async def obtener_negocio(
    negocio_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Obtiene un negocio específico
    
    - **negocio_id**: UUID del negocio
    """
    
    negocio = db.query(Negocio).filter(Negocio.id == negocio_id).first()
    
    if not negocio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Negocio no encontrado"
        )
    
    return NegocioResponse.from_orm(negocio)

@router.put(
    "/{negocio_id}",
    response_model=NegocioResponse,
    summary="Actualizar negocio",
    description="Actualiza los datos de un negocio"
)
async def actualizar_negocio(
    negocio_id: UUID,
    negocio_actualizado: NegocioUpdate,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Actualiza un negocio existente
    
    Solo el vendedor dueño del negocio puede actualizarlo
    
    - **negocio_id**: UUID del negocio
    - **datos**: Campos a actualizar
    """
    
    # Obtener negocio
    negocio = db.query(Negocio).filter(Negocio.id == negocio_id).first()
    
    if not negocio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Negocio no encontrado"
        )
    
    # Verificar que el usuario es dueño del negocio
    if negocio.vendedor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes actualizar un negocio que no te pertenece"
        )
    
    # Actualizar campos
    datos_actualizacion = negocio_actualizado.dict(exclude_unset=True)
    
    for campo, valor in datos_actualizacion.items():
        setattr(negocio, campo, valor)
    
    negocio.fecha_ultima_actualizacion = datetime.utcnow()
    
    db.commit()
    db.refresh(negocio)
    
    return NegocioResponse.from_orm(negocio)

@router.delete(
    "/{negocio_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar negocio",
    description="Marca un negocio como inactivo"
)
async def eliminar_negocio(
    negocio_id: UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Elimina (desactiva) un negocio
    
    Solo el vendedor dueño del negocio puede eliminarlo
    
    - **negocio_id**: UUID del negocio
    """
    
    # Obtener negocio
    negocio = db.query(Negocio).filter(Negocio.id == negocio_id).first()
    
    if not negocio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Negocio no encontrado"
        )
    
    # Verificar que el usuario es dueño del negocio
    if negocio.vendedor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes eliminar un negocio que no te pertenece"
        )
    
    # Marcar como inactivo
    negocio.estado = "inactivo"
    negocio.fecha_ultima_actualizacion = datetime.utcnow()

    # Sus pedidos en curso no se pueden quedar esperando a un negocio que ya
    # no existe.
    cancelar_pedidos_de_negocio(db, negocio)
    
    db.commit()

# ============================================================================
# ENDPOINTS: INFORMACIÓN DEL NEGOCIO
# ============================================================================



@router.get(
    "/{negocio_id}/productos",
    response_model=List,
    summary="Productos de un negocio",
    description="Lista todos los productos de un negocio"
)
async def productos_negocio(
    negocio_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Obtiene todos los productos de un negocio
    
    - **negocio_id**: UUID del negocio
    - **skip**: Saltar N productos
    - **limit**: Límite de productos a retornar
    """
    
    # Verificar que el negocio existe
    negocio = db.query(Negocio).filter(Negocio.id == negocio_id).first()
    
    if not negocio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Negocio no encontrado"
        )
    
    # Obtener productos
    productos = db.query(Producto).filter(
        and_(
            Producto.negocio_id == negocio_id,
            Producto.es_visible == True,
            Producto.estado == "activo"
        )
    ).offset(skip).limit(limit).all()
    
    return productos

@router.get(
    "/{negocio_id}/estadisticas",
    response_model=dict,
    summary="Estadísticas del negocio",
    description="Retorna estadísticas e información del negocio"
)
async def estadisticas_negocio(
    negocio_id: UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtiene estadísticas del negocio
    
    Solo el dueño del negocio puede ver sus estadísticas
    
    - **negocio_id**: UUID del negocio
    """
    
    # Obtener negocio
    negocio = db.query(Negocio).filter(Negocio.id == negocio_id).first()
    
    if not negocio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Negocio no encontrado"
        )
    
    # Verificar que el usuario es dueño del negocio
    if negocio.vendedor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes ver estadísticas de un negocio que no te pertenece"
        )
    
    # Contar productos
    total_productos = db.query(Producto).filter(
        Producto.negocio_id == negocio_id
    ).count()
    
    # Contar órdenes completadas
    ordenes_completadas = db.query(Orden).filter(
        and_(
            Orden.negocio_id == negocio_id,
            Orden.estado == "entregada"
        )
    ).count()
    
    # Ingresos totales
    ingresos_totales = db.query(Orden).filter(
        and_(
            Orden.negocio_id == negocio_id,
            Orden.estado == "entregada"
        )
    ).all()
    
    total_ingresos = sum(float(orden.total) for orden in ingresos_totales) if ingresos_totales else 0
    
    return {
        "negocio_id": str(negocio_id),
        "nombre_negocio": negocio.nombre_negocio,
        "total_productos": total_productos,
        "total_ordenes": negocio.total_ordenes,
        "ordenes_completadas": ordenes_completadas,
        "total_ingresos": total_ingresos,
        "calificacion_promedio": float(negocio.calificacion_promedio),
        "comision_porcentaje": settings.COMISION_TOUTAIN,
        "estado": negocio.estado
    }

# ============================================================================
# ENDPOINTS: BÚSQUEDA Y FILTROS
# ============================================================================

@router.get(
    "/buscar/por-nombre",
    response_model=List[NegocioResponse],
    summary="Buscar negocios por nombre",
    description="Busca negocios que coincidan con el nombre"
)
async def buscar_negocios_por_nombre(
    nombre: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Busca negocios por nombre
    
    - **nombre**: Nombre a buscar
    - **limit**: Límite de resultados
    """
    
    negocios = db.query(Negocio).filter(
        and_(
            Negocio.nombre_negocio.ilike(f"%{nombre}%"),
            Negocio.estado == "activo"
        )
    ).limit(limit).all()
    
    return [NegocioResponse.from_orm(n) for n in negocios]

@router.get(
    "/mejor-calificados",
    response_model=List[NegocioResponse],
    summary="Negocios mejor calificados",
    description="Lista los negocios con mejor calificación"
)
async def negocios_mejor_calificados(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    Obtiene los negocios mejor calificados
    
    - **limit**: Cantidad de negocios a retornar
    """
    
    negocios = db.query(Negocio).filter(
        Negocio.estado == "activo"
    ).order_by(Negocio.calificacion_promedio.desc()).limit(limit).all()
    
    return [NegocioResponse.from_orm(n) for n in negocios]