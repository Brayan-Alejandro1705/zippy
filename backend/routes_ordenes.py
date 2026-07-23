# ============================================================================
# routes/ordenes.py - Rutas de Órdenes
# ============================================================================

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List
from uuid import UUID
from datetime import datetime, timedelta
from decimal import Decimal

from config import get_db, settings
from models import (
    Orden, ItemOrden, Producto, Negocio, Usuario,
    Transaccion, SeguimientoOrden, Carrito, ItemCarrito, MensajeOrden
)
from schemas import OrdenCreate, OrdenUpdate, OrdenResponse
from routes_auth import get_current_user

router = APIRouter(prefix="/api/v1/ordenes", tags=["Órdenes"])

# ============================================================================
# FUNCIONES AUXILIARES
# ============================================================================

def calcular_total_orden(items_data: List[dict], db: Session) -> tuple:
    """
    Calcula subtotal, impuesto y total de una orden
    Retorna: (subtotal, impuesto, total)
    """
    subtotal = Decimal(0)
    
    for item in items_data:
        producto = db.query(Producto).filter(
            Producto.id == item['producto_id']
        ).first()
        
        if not producto:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Producto {item['producto_id']} no encontrado"
            )
        
        if producto.stock < item['cantidad']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Stock insuficiente de {producto.nombre}"
            )
        
        subtotal += producto.precio * item['cantidad']
    
    impuesto = subtotal * (Decimal(settings.IMPUESTO_IVA) / 100)
    total = subtotal + impuesto
    
    return subtotal, impuesto, total

# ============================================================================
# ENDPOINTS: CRUD DE ÓRDENES
# ============================================================================

@router.post(
    "/",
    response_model=OrdenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear nueva orden",
    description="Crea una nueva orden de compra"
)
async def crear_orden(
    orden: OrdenCreate,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Crea una nueva orden
    
    Solo clientes pueden crear órdenes
    
    - **negocio_id**: ID del negocio
    - **items**: Lista de productos con cantidad
    - **metodo_pago**: efectivo, tarjeta, transferencia, billetera
    - **direccion_entrega**: Dirección completa
    """
    
    # Verificar que el usuario es cliente
    if current_user.tipo_usuario != "cliente":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo clientes pueden crear órdenes"
        )
    
    # Verificar que el negocio existe
    negocio = db.query(Negocio).filter(Negocio.id == orden.negocio_id).first()
    
    if not negocio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Negocio no encontrado"
        )
    
    # Calcular totales
    items_list = [{"producto_id": item.producto_id, "cantidad": item.cantidad} for item in orden.items]
    subtotal, impuesto, total = calcular_total_orden(items_list, db)
    
    # Crear orden
    nueva_orden = Orden(
        cliente_id=current_user.id,
        negocio_id=orden.negocio_id,
        estado="pendiente",
        subtotal=subtotal,
        impuesto=impuesto,
        total=total,
        metodo_pago=orden.metodo_pago,
        estado_pago="pendiente",
        direccion_entrega=orden.direccion_entrega,
        notas_cliente=orden.notas_cliente,
        fecha_creacion=datetime.utcnow()
    )
    
    db.add(nueva_orden)
    db.flush()  # Para obtener el ID
    
    # Agregar items a la orden
    for item_data in orden.items:
        producto = db.query(Producto).filter(
            Producto.id == item_data.producto_id
        ).first()
        
        item_orden = ItemOrden(
            orden_id=nueva_orden.id,
            producto_id=item_data.producto_id,
            cantidad=item_data.cantidad,
            precio_unitario=producto.precio,
            subtotal=producto.precio * item_data.cantidad,
            especificaciones=item_data.especificaciones,
            fecha_creacion=datetime.utcnow()
        )
        
        # Reducir stock
        producto.stock -= item_data.cantidad
        producto.total_vendidos += item_data.cantidad
        
        db.add(item_orden)
    
    # Crear transacción
    transaccion = Transaccion(
        orden_id=nueva_orden.id,
        usuario_id=current_user.id,
        tipo_transaccion="compra",
        monto=total,
        metodo_pago=orden.metodo_pago,
        estado="pendiente",
        descripcion=f"Compra en {negocio.nombre_negocio}",
        fecha_creacion=datetime.utcnow()
    )
    
    db.add(transaccion)
    
    # Registrar en seguimiento
    seguimiento = SeguimientoOrden(
        orden_id=nueva_orden.id,
        estado_anterior=None,
        estado_nuevo="pendiente",
        descripcion="Orden creada",
        fecha_creacion=datetime.utcnow()
    )
    
    db.add(seguimiento)
    
    db.commit()
    db.refresh(nueva_orden)
    
    return OrdenResponse.from_orm(nueva_orden)

@router.get(
    "/",
    response_model=List[OrdenResponse],
    summary="Listar órdenes",
    description="Lista órdenes del usuario autenticado"
)
async def listar_ordenes(
    current_user: Usuario = Depends(get_current_user),
    estado: str = Query(None, description="Filtrar por estado"),
    disponibles: bool = Query(False, description="Solo domiciliarios: pedidos sin asignar listos para recoger"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Lista las órdenes del usuario autenticado

    Clientes ven sus compras, Vendedores ven órdenes de su negocio,
    Domiciliarios ven sus entregas asignadas (o las disponibles con disponibles=true)
    """

    query = db.query(Orden)

    if current_user.tipo_usuario == "cliente":
        query = query.filter(Orden.cliente_id == current_user.id)

    elif current_user.tipo_usuario == "vendedor":
        # Obtener negocio del vendedor
        negocio = db.query(Negocio).filter(
            Negocio.vendedor_id == current_user.id
        ).first()

        if negocio:
            query = query.filter(Orden.negocio_id == negocio.id)
        else:
            return []

    elif current_user.tipo_usuario == "domiciliario":
        if disponibles:
            query = query.filter(
                Orden.domiciliario_id.is_(None),
                Orden.estado.in_(["confirmada", "en_preparacion", "lista_para_retirar"])
            )
        else:
            query = query.filter(Orden.domiciliario_id == current_user.id)

    else:  # admin puede ver todas
        pass
    
    # Filtrar por estado
    if estado:
        query = query.filter(Orden.estado == estado)
    
    ordenes = query.order_by(Orden.fecha_creacion.desc()).offset(skip).limit(limit).all()
    
    return [OrdenResponse.from_orm(o) for o in ordenes]

@router.get(
    "/{orden_id}",
    response_model=OrdenResponse,
    summary="Obtener orden por ID",
    description="Retorna los detalles de una orden específica"
)
async def obtener_orden(
    orden_id: UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtiene una orden específica
    
    Solo el cliente, vendedor o domiciliario pueden ver la orden
    """
    
    orden = db.query(Orden).filter(Orden.id == orden_id).first()
    
    if not orden:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orden no encontrada"
        )
    
    # Verificar permisos
    puede_ver = (
        orden.cliente_id == current_user.id or
        (orden.negocio.vendedor_id == current_user.id if orden.negocio else False) or
        orden.domiciliario_id == current_user.id or
        current_user.tipo_usuario == "admin"
    )
    
    if not puede_ver:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para ver esta orden"
        )
    
    return OrdenResponse.from_orm(orden)

@router.put(
    "/{orden_id}",
    response_model=OrdenResponse,
    summary="Actualizar orden",
    description="Actualiza el estado de una orden"
)
async def actualizar_orden(
    orden_id: UUID,
    orden_actualizada: OrdenUpdate,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Actualiza el estado de una orden
    
    - **estado**: pendiente, confirmada, en_preparacion, lista_para_retirar, en_domicilio, entregada, cancelada
    """
    
    orden = db.query(Orden).filter(Orden.id == orden_id).first()

    if not orden:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orden no encontrada"
        )

    # Reclamar pedido: un domiciliario sin asignar se lo asigna a sí mismo
    if orden_actualizada.domiciliario_id is not None:
        if current_user.tipo_usuario != "domiciliario":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo un domiciliario puede tomar un pedido"
            )
        if str(orden_actualizada.domiciliario_id) != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo puedes asignarte el pedido a ti mismo"
            )
        if orden.domiciliario_id is not None and orden.domiciliario_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Este pedido ya fue tomado por otro domiciliario"
            )
        orden.domiciliario_id = current_user.id

    # Verificar permisos (con el domiciliario_id ya actualizado si se reclamó arriba)
    es_vendedor = orden.negocio.vendedor_id == current_user.id if orden.negocio else False
    es_domiciliario = orden.domiciliario_id == current_user.id
    es_cliente = orden.cliente_id == current_user.id

    # Validar cambios de estado según rol
    if orden_actualizada.estado:
        estado_anterior = orden.estado

        if not (es_vendedor or es_domiciliario or es_cliente or current_user.tipo_usuario == "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para cambiar el estado de esta orden"
            )

        # Vendedor puede: confirmada, en_preparacion, lista_para_retirar
        if es_vendedor and orden_actualizada.estado not in ["confirmada", "en_preparacion", "lista_para_retirar", "cancelada"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo puedes cambiar a estos estados: confirmada, en_preparacion, lista_para_retirar, cancelada"
            )

        # Domiciliario puede: en_domicilio, entregada
        if es_domiciliario and orden_actualizada.estado not in ["en_domicilio", "entregada"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo puedes cambiar a: en_domicilio, entregada"
            )

        # Cliente puede: cancelada
        if es_cliente and orden_actualizada.estado not in ["cancelada"]:
            if orden.estado != "pendiente":  # Solo puede cancelar si está pendiente
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Solo puedes cancelar órdenes pendientes"
                )

        orden.estado = orden_actualizada.estado
        
        # Registrar seguimiento
        seguimiento = SeguimientoOrden(
            orden_id=orden.id,
            estado_anterior=estado_anterior,
            estado_nuevo=orden_actualizada.estado,
            descripcion=orden_actualizada.estado,
            fecha_creacion=datetime.utcnow()
        )
        db.add(seguimiento)
    
    # Actualizar otros campos
    if orden_actualizada.notas_vendedor:
        orden.notas_vendedor = orden_actualizada.notas_vendedor

    orden.fecha_ultima_actualizacion = datetime.utcnow()
    
    db.commit()
    db.refresh(orden)
    
    return OrdenResponse.from_orm(orden)

@router.post(
    "/{orden_id}/confirmar-pago",
    response_model=dict,
    summary="Confirmar pago",
    description="Marca una orden como pagada"
)
async def confirmar_pago(
    orden_id: UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Confirma el pago de una orden
    
    Solo el cliente puede confirmar su pago
    """
    
    orden = db.query(Orden).filter(Orden.id == orden_id).first()
    
    if not orden:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orden no encontrada"
        )
    
    # Verificar que es el cliente
    if orden.cliente_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes confirmar el pago de una orden que no es tuya"
        )
    
    # Actualizar estado de pago
    orden.estado_pago = "completado"
    orden.estado = "confirmada"
    orden.fecha_confirmacion = datetime.utcnow()
    
    # Actualizar transacción
    transaccion = db.query(Transaccion).filter(
        Transaccion.orden_id == orden.id
    ).first()
    
    if transaccion:
        transaccion.estado = "completada"
    
    db.commit()
    
    return {
        "mensaje": "Pago confirmado",
        "orden_id": str(orden_id),
        "estado": orden.estado,
        "estado_pago": orden.estado_pago
    }

@router.delete(
    "/{orden_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cancelar orden",
    description="Cancela una orden"
)
async def cancelar_orden(
    orden_id: UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cancela una orden
    
    Solo el cliente puede cancelar su orden si está pendiente
    """
    
    orden = db.query(Orden).filter(Orden.id == orden_id).first()
    
    if not orden:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orden no encontrada"
        )
    
    # Verificar que es el cliente
    if orden.cliente_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes cancelar una orden que no es tuya"
        )
    
    # Verificar que está pendiente
    if orden.estado not in ["pendiente", "confirmada"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No puedes cancelar una orden en estado {orden.estado}"
        )
    
    # Revertir stock
    for item in orden.items:
        producto = db.query(Producto).filter(
            Producto.id == item.producto_id
        ).first()
        
        if producto:
            producto.stock += item.cantidad
            producto.total_vendidos -= item.cantidad
    
    # Marcar como cancelada
    orden.estado = "cancelada"
    orden.fecha_ultima_actualizacion = datetime.utcnow()
    
    # Revertir transacción
    transaccion = db.query(Transaccion).filter(
        Transaccion.orden_id == orden.id
    ).first()
    
    if transaccion:
        transaccion.estado = "reembolsado"
    
    db.commit()

# ============================================================================
# ENDPOINTS: SEGUIMIENTO
# ============================================================================

@router.get(
    "/{orden_id}/ubicacion",
    response_model=dict,
    summary="Ubicación del domiciliario asignado",
    description="Retorna la última posición conocida del domiciliario asignado a la orden, para seguimiento en tiempo real"
)
async def ubicacion_domiciliario(
    orden_id: UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtiene la última posición conocida del domiciliario de una orden

    Solo el cliente, vendedor o domiciliario de la orden pueden consultarla
    """

    orden = db.query(Orden).filter(Orden.id == orden_id).first()

    if not orden:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orden no encontrada"
        )

    puede_ver = (
        orden.cliente_id == current_user.id or
        (orden.negocio.vendedor_id == current_user.id if orden.negocio else False) or
        orden.domiciliario_id == current_user.id or
        current_user.tipo_usuario == "admin"
    )

    if not puede_ver:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para ver esta orden"
        )

    if not orden.domiciliario_id:
        return {"asignado": False, "lat": None, "lng": None, "domiciliario_nombre": None, "fecha_actualizacion": None}

    domiciliario = db.query(Usuario).filter(Usuario.id == orden.domiciliario_id).first()

    return {
        "asignado": True,
        "lat": float(domiciliario.latitud) if domiciliario and domiciliario.latitud is not None else None,
        "lng": float(domiciliario.longitud) if domiciliario and domiciliario.longitud is not None else None,
        "domiciliario_nombre": domiciliario.nombre if domiciliario else None,
        "domiciliario_telefono": domiciliario.telefono if domiciliario else None,
        "fecha_actualizacion": domiciliario.fecha_ultima_actualizacion.isoformat() if domiciliario and domiciliario.fecha_ultima_actualizacion else None,
    }

@router.get(
    "/{orden_id}/seguimiento",
    response_model=List[dict],
    summary="Seguimiento de orden",
    description="Retorna el histórico de cambios de estado"
)
async def seguimiento_orden(
    orden_id: UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtiene el histórico de cambios de estado de una orden
    """
    
    orden = db.query(Orden).filter(Orden.id == orden_id).first()
    
    if not orden:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orden no encontrada"
        )
    
    # Verificar permisos
    puede_ver = (
        orden.cliente_id == current_user.id or
        (orden.negocio.vendedor_id == current_user.id if orden.negocio else False) or
        orden.domiciliario_id == current_user.id or
        current_user.tipo_usuario == "admin"
    )
    
    if not puede_ver:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para ver el seguimiento"
        )
    
    seguimientos = db.query(SeguimientoOrden).filter(
        SeguimientoOrden.orden_id == orden_id
    ).order_by(SeguimientoOrden.fecha_creacion.asc()).all()
    
    return [
        {
            "id": str(s.id),
            "estado_anterior": s.estado_anterior,
            "estado_nuevo": s.estado_nuevo,
            "descripcion": s.descripcion,
            "fecha": s.fecha_creacion.isoformat()
        }
        for s in seguimientos
    ]

# ============================================================================
# ENDPOINTS: CHAT DE ORDEN (cliente ↔ domiciliario)
# ============================================================================

def _verificar_acceso_chat(orden: Orden, current_user: Usuario):
    """Cliente, domiciliario o admin de la orden pueden ver/usar el chat"""
    puede = (
        orden.cliente_id == current_user.id or
        orden.domiciliario_id == current_user.id or
        current_user.tipo_usuario == "admin"
    )
    if not puede:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para acceder a este chat"
        )

# ============================================================================
# CICLO DE VIDA DEL CHAT CLIENTE <-> REPARTIDOR
# ============================================================================

CHAT_HORAS_TRAS_ENTREGA = 1

def _estado_chat(orden, db):
    """
    Estados posibles:
      - "sin_domiciliario": todavía no hay repartidor asignado
      - "activo": se puede leer y escribir
      - "cerrado": el pedido finalizó, el chat queda bloqueado
      - "expirado": pasó 1 hora desde la entrega, los mensajes se eliminan
    """
    if not orden.domiciliario_id:
        return "sin_domiciliario"

    estado = orden.estado.value if hasattr(orden.estado, "value") else str(orden.estado)

    if estado not in ("entregada", "cancelada", "rechazada"):
        return "activo"

    referencia = orden.fecha_entrega or orden.fecha_creacion
    if referencia and datetime.utcnow() - referencia >= timedelta(hours=CHAT_HORAS_TRAS_ENTREGA):
        db.query(MensajeOrden).filter(MensajeOrden.orden_id == orden.id).delete()
        db.commit()
        return "expirado"

    return "cerrado"


@router.get(
    "/{orden_id}/chat-estado",
    response_model=dict,
    summary="Estado del chat de la orden",
    description="Indica si el chat está activo, cerrado o expirado"
)
async def estado_chat_orden(
    orden_id: UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    orden = db.query(Orden).filter(Orden.id == orden_id).first()
    if not orden:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden no encontrada")

    _verificar_acceso_chat(orden, current_user)

    estado = _estado_chat(orden, db)
    return {"estado": estado, "activo": estado == "activo"}


@router.get(
    "/{orden_id}/mensajes",
    response_model=List[dict],
    summary="Mensajes del chat de la orden",
    description="Lista los mensajes del chat entre cliente y domiciliario para esta orden"
)
async def listar_mensajes(
    orden_id: UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    orden = db.query(Orden).filter(Orden.id == orden_id).first()
    if not orden:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden no encontrada")

    _verificar_acceso_chat(orden, current_user)

    # "activo"  -> se lee y se escribe
    # "cerrado" -> solo lectura, el historial sigue visible durante 1 hora
    # "sin_domiciliario" / "expirado" -> no hay nada que mostrar
    if _estado_chat(orden, db) not in ("activo", "cerrado"):
        return []

    mensajes = db.query(MensajeOrden).filter(
        MensajeOrden.orden_id == orden_id
    ).order_by(MensajeOrden.fecha_creacion.asc()).all()

    return [
        {
            "id": str(m.id),
            "remitente_id": str(m.remitente_id),
            "es_mio": m.remitente_id == current_user.id,
            "contenido": m.contenido,
            "fecha": m.fecha_creacion.isoformat(),
        }
        for m in mensajes
    ]

@router.post(
    "/{orden_id}/mensajes",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    summary="Enviar mensaje en el chat de la orden",
    description="El cliente o el domiciliario de la orden envían un mensaje de chat"
)
async def enviar_mensaje(
    orden_id: UUID,
    datos: dict,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    orden = db.query(Orden).filter(Orden.id == orden_id).first()
    if not orden:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden no encontrada")

    es_cliente_o_domiciliario = (
        orden.cliente_id == current_user.id or
        orden.domiciliario_id == current_user.id
    )
    if not es_cliente_o_domiciliario:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el cliente o el domiciliario de la orden pueden enviar mensajes"
        )

    contenido = (datos.get("contenido") or "").strip()
    if not contenido:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El mensaje no puede estar vacío")

    estado_chat = _estado_chat(orden, db)

    if estado_chat == "sin_domiciliario":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta orden aún no tiene un domiciliario asignado"
        )

    if estado_chat != "activo":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El chat de este pedido ya fue cerrado"
        )

    mensaje = MensajeOrden(orden_id=orden_id, remitente_id=current_user.id, contenido=contenido[:1000])
    db.add(mensaje)
    db.commit()
    db.refresh(mensaje)

    return {
        "id": str(mensaje.id),
        "remitente_id": str(mensaje.remitente_id),
        "es_mio": True,
        "contenido": mensaje.contenido,
        "fecha": mensaje.fecha_creacion.isoformat(),
    }