# ============================================================================
# routes/ordenes.py - Rutas de Órdenes
# ============================================================================

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from pydantic import BaseModel
from typing import Optional
from typing import List
from uuid import UUID
from datetime import datetime, timedelta
from decimal import Decimal
import secrets

from config import get_db, settings
import calculos
from models import (
    Orden, ItemOrden, Producto, Negocio, Usuario, EstadoUsuario,
    Transaccion, SeguimientoOrden, Carrito, ItemCarrito, MensajeOrden
)
from schemas import OrdenCreate, OrdenUpdate, OrdenResponse, ConfirmarRecogidaRequest
from routes_auth import get_current_user
from push import notificar_usuario, notificar_usuarios
from restricciones import es_alcohol, es_tabaco, MENSAJE_EDAD, MENSAJE_TABACO

router = APIRouter(prefix="/api/v1/ordenes", tags=["Órdenes"])

# ============================================================================
# FUNCIONES AUXILIARES
# ============================================================================

def calcular_total_orden(items_data: List[dict], db: Session) -> tuple:
    """
    Calcula subtotal, impuesto, domicilio y total de una orden.

    Retorna: (subtotal, impuesto, costo_domicilio, total)

    El domicilio se suma AQUI y no se recibe del frontend: un precio que
    llega desde el navegador lo puede modificar cualquiera con las
    herramientas de desarrollador.
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
    costo_domicilio = calculos.costo_domicilio(db)
    total = subtotal + impuesto + costo_domicilio

    return subtotal, impuesto, costo_domicilio, total

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

    # No dejar crear ordenes si la tienda esta fuera de su horario configurado
    if not negocio.esta_abierto():
        detalle = f"{negocio.nombre_negocio} esta cerrado en este momento."
        apertura = negocio.proxima_apertura_texto()
        if apertura:
            detalle += f" {apertura}."
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detalle
        )

    # Cuenta suspendida por reportes de repartidores: no puede pedir
    if str(getattr(current_user.estado, "value", current_user.estado)) != "activo":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu cuenta está suspendida. Escríbenos por WhatsApp a soporte si crees que es un error."
        )

    # Primer pedido: pasa por validacion de soporte. Un cliente es confiable si
    # ya le entregaron un pedido, si soporte ya le valido uno, o si tiene un
    # pedido en curso de antes de que existiera la validacion.
    cliente_confiable = db.query(Orden.id).filter(
        Orden.cliente_id == current_user.id,
        or_(
            Orden.estado == "entregada",
            Orden.fecha_validacion.isnot(None),
            and_(Orden.requiere_validacion == False,  # noqa: E712
                 Orden.estado.in_(["confirmada", "en_preparacion", "lista_para_retirar", "en_domicilio"])),
        ),
    ).first() is not None

    # Alcohol: exigir confirmacion de mayoria de edad. Tabaco: nunca.
    productos_pedido = db.query(Producto).filter(
        Producto.id.in_([item.producto_id for item in orden.items])
    ).all()
    if any(es_tabaco(p.nombre, p.categoria) for p in productos_pedido):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=MENSAJE_TABACO)
    if any(es_alcohol(p, negocio) for p in productos_pedido) and not orden.confirma_mayor_edad:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=MENSAJE_EDAD)

    # Calcular totales
    items_list = [{"producto_id": item.producto_id, "cantidad": item.cantidad} for item in orden.items]
    subtotal, impuesto, costo_domicilio, total = calcular_total_orden(items_list, db)
    
    # Crear orden
    nueva_orden = Orden(
        cliente_id=current_user.id,
        negocio_id=orden.negocio_id,
        estado="pendiente",
        requiere_validacion=not cliente_confiable,
        subtotal=subtotal,
        impuesto=impuesto,
        costo_domicilio=costo_domicilio,
        total=total,
        metodo_pago=orden.metodo_pago,
        estado_pago="pendiente",
        direccion_entrega=orden.direccion_entrega,
        latitud_entrega=orden.latitud_entrega,
        longitud_entrega=orden.longitud_entrega,
        notas_cliente=orden.notas_cliente,
        fecha_creacion=datetime.utcnow()
    )
    
    db.add(nueva_orden)
    db.flush()  # Para obtener el ID

    # Codigo corto que el repartidor le muestra al vendedor al recoger el pedido
    nueva_orden.codigo_recogida = f"ZP-{secrets.randbelow(10000):04d}"

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

    if nueva_orden.requiere_validacion:
        # Primer pedido: le avisamos a soporte; el negocio lo recibe cuando se apruebe
        notificar_usuarios(
            db, _admins_activos(db),
            tipo="pedido_por_validar",
            titulo="Pedido por validar",
            mensaje=f"Primer pedido de {current_user.nombre} en {negocio.nombre_negocio} por ${total:,.0f}. Confírmalo con el cliente.",
            relacionado_tabla="ordenes",
            relacionado_id=nueva_orden.id,
        )
    else:
        # Avisar al vendedor: pedido nuevo por hacer
        notificar_usuario(
            db, negocio.vendedor,
            tipo="pedido_nuevo",
            titulo="Nuevo pedido",
            mensaje=f"Pedido nuevo en {negocio.nombre_negocio} por ${total:,.0f}",
            relacionado_tabla="ordenes",
            relacionado_id=nueva_orden.id,
        )

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
            # Los pedidos que soporte todavia no valida no le llegan al negocio
            query = query.filter(or_(Orden.requiere_validacion == False,  # noqa: E712
                                     Orden.fecha_validacion.isnot(None)))
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

    respuesta = [OrdenResponse.from_orm(o) for o in ordenes]

    # Al repartidor le mostramos si el cliente es nuevo o ya ha recibido pedidos
    if current_user.tipo_usuario == "domiciliario" and respuesta:
        ids = list({o.cliente_id for o in ordenes})
        conteos = dict(db.query(Orden.cliente_id, func.count(Orden.id)).filter(
            Orden.cliente_id.in_(ids), Orden.estado == "entregada"
        ).group_by(Orden.cliente_id).all())
        for r in respuesta:
            r.cliente_pedidos_entregados = conteos.get(r.cliente_id, 0)

    return respuesta

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

    if es_vendedor and orden.requiere_validacion and orden.fecha_validacion is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este pedido todavía está en validación por soporte"
        )

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

        # Domiciliario puede: entregada (pasar a en_domicilio ahora requiere
        # confirmar el codigo de recogida con el vendedor, ver /confirmar-recogida)
        if es_domiciliario and orden_actualizada.estado not in ["entregada"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo puedes cambiar a: entregada"
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

        # Avisar a los domiciliarios disponibles: pedido nuevo por entregar
        if orden_actualizada.estado == "lista_para_retirar" and orden.domiciliario_id is None:
            domiciliarios_disponibles = db.query(Usuario).filter(
                Usuario.tipo_usuario == "domiciliario",
                Usuario.estado == EstadoUsuario.ACTIVO,
                Usuario.fcm_token.isnot(None),
            ).all()
            notificar_usuarios(
                db, domiciliarios_disponibles,
                tipo="pedido_por_entregar",
                titulo="Pedido por entregar",
                mensaje=f"Hay un pedido listo para recoger en {orden.negocio.nombre_negocio}" if orden.negocio else "Hay un pedido nuevo listo para recoger",
                relacionado_tabla="ordenes",
                relacionado_id=orden.id,
            )

        # Avisar al cliente segun el nuevo estado del pedido
        MENSAJES_CLIENTE = {
            "confirmada": ("pedido_confirmado", "Pedido confirmado",
                lambda n: f"{n} confirmo tu pedido y lo esta preparando"),
            "en_preparacion": ("pedido_en_preparacion", "Tu pedido esta en preparacion",
                lambda n: f"{n} ya esta preparando tu pedido"),
            "en_domicilio": ("pedido_en_camino", "Tu pedido va en camino",
                lambda n: "El domiciliario ya recogio tu pedido y va en camino"),
            "entregada": ("pedido_entregado", "Pedido entregado",
                lambda n: f"Tu pedido de {n} fue entregado. Buen provecho!"),
            "cancelada": ("pedido_cancelado", "Pedido cancelado",
                lambda n: f"{n} cancelo tu pedido"),
        }
        info_cliente = MENSAJES_CLIENTE.get(orden_actualizada.estado)
        if info_cliente and orden.cliente:
            tipo_notif, titulo_notif, generar_mensaje = info_cliente
            nombre_negocio = orden.negocio.nombre_negocio if orden.negocio else "El negocio"
            notificar_usuario(
                db, orden.cliente,
                tipo=tipo_notif,
                titulo=titulo_notif,
                mensaje=generar_mensaje(nombre_negocio),
                relacionado_tabla="ordenes",
                relacionado_id=orden.id,
            )
    
    # Actualizar otros campos
    if orden_actualizada.notas_vendedor:
        orden.notas_vendedor = orden_actualizada.notas_vendedor

    orden.fecha_ultima_actualizacion = datetime.utcnow()
    
    db.commit()
    db.refresh(orden)

    return OrdenResponse.from_orm(orden)

@router.post(
    "/{orden_id}/confirmar-recogida",
    response_model=OrdenResponse,
    summary="Confirmar recogida del pedido",
    description="El vendedor valida el codigo que le muestra el repartidor y marca el pedido como recogido (pasa a en_domicilio)"
)
async def confirmar_recogida(
    orden_id: UUID,
    datos: ConfirmarRecogidaRequest,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    El vendedor confirma que el repartidor le mostro el codigo correcto
    (formato ZP-0000) antes de entregarle el pedido fisicamente.
    """

    orden = db.query(Orden).filter(Orden.id == orden_id).first()

    if not orden:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orden no encontrada"
        )

    es_vendedor = orden.negocio.vendedor_id == current_user.id if orden.negocio else False
    if not es_vendedor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el vendedor puede confirmar la recogida de este pedido"
        )

    if orden.estado != "lista_para_retirar" or not orden.domiciliario_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este pedido no esta listo para ser recogido por un domiciliario"
        )

    # Los pedidos creados antes de que existiera el codigo no tienen uno; en
    # ese caso el vendedor confirma la entrega sin nada que comparar.
    codigo_real = (orden.codigo_recogida or "").strip().upper()
    codigo_ingresado = (datos.codigo or "").strip().upper()
    if codigo_real and codigo_ingresado != codigo_real:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Codigo de recogida incorrecto"
        )

    estado_anterior = orden.estado
    orden.estado = "en_domicilio"
    orden.fecha_ultima_actualizacion = datetime.utcnow()

    seguimiento = SeguimientoOrden(
        orden_id=orden.id,
        estado_anterior=estado_anterior,
        estado_nuevo="en_domicilio",
        descripcion="Recogida confirmada por el vendedor",
        fecha_creacion=datetime.utcnow()
    )
    db.add(seguimiento)

    if orden.cliente:
        nombre_negocio = orden.negocio.nombre_negocio if orden.negocio else "El negocio"
        notificar_usuario(
            db, orden.cliente,
            tipo="pedido_en_camino",
            titulo="Tu pedido va en camino",
            mensaje="El domiciliario ya recogio tu pedido y va en camino",
            relacionado_tabla="ordenes",
            relacionado_id=orden.id,
        )

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

    # Avisar al vendedor que el cliente cancelo el pedido
    if orden.negocio and orden.negocio.vendedor:
        notificar_usuario(
            db, orden.negocio.vendedor,
            tipo="pedido_cancelado_cliente",
            titulo="Pedido cancelado por el cliente",
            mensaje="Un cliente cancelo un pedido en tu negocio",
            relacionado_tabla="ordenes",
            relacionado_id=orden.id,
        )

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

# ============================================================================
# SEGURIDAD: validacion del primer pedido y reportes de repartidores (sep 2026)
# ============================================================================

MOTIVOS_REPORTE = {
    "no_aparecio": "No salió / no contestó",
    "direccion_falsa": "La dirección no existe o es falsa",
    "rechazo_pedido": "Rechazó el pedido al llegar",
    "peligro": "El repartidor se sintió en peligro",
}
REPORTES_PARA_SUSPENDER = 2


class ValidarOrdenRequest(BaseModel):
    aprobar: bool
    motivo: Optional[str] = None


class ReportarClienteRequest(BaseModel):
    motivo: str


def _solo_admin(usuario: Usuario):
    tipo = getattr(usuario.tipo_usuario, "value", usuario.tipo_usuario)
    if str(tipo).lower() != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Solo un administrador puede hacer esto")


def _admins_activos(db: Session):
    return db.query(Usuario).filter(
        Usuario.tipo_usuario == "admin",
        Usuario.estado == EstadoUsuario.ACTIVO,
    ).all()


@router.get("/validacion/pendientes", summary="Pedidos por validar (primer pedido de cada cliente)")
async def pedidos_por_validar(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _solo_admin(current_user)
    ordenes = db.query(Orden).filter(
        Orden.requiere_validacion == True,  # noqa: E712
        Orden.fecha_validacion.is_(None),
        Orden.estado == "pendiente",
    ).order_by(Orden.fecha_creacion.asc()).all()

    resultado = []
    for o in ordenes:
        c = o.cliente
        resultado.append({
            "id": str(o.id),
            "fecha_creacion": o.fecha_creacion.isoformat() if o.fecha_creacion else None,
            "total": float(o.total or 0),
            "metodo_pago": getattr(o.metodo_pago, "value", o.metodo_pago),
            "direccion_entrega": o.direccion_entrega,
            "lat": float(o.latitud_entrega) if o.latitud_entrega is not None else None,
            "lng": float(o.longitud_entrega) if o.longitud_entrega is not None else None,
            "notas_cliente": o.notas_cliente,
            "negocio": o.negocio.nombre_negocio if o.negocio else "Negocio",
            "items": [{"nombre": it.producto.nombre if it.producto else "Producto", "cantidad": it.cantidad} for it in o.items],
            "cliente": {
                "id": str(c.id) if c else None,
                "nombre": f"{c.nombre} {c.apellido or ''}".strip() if c else "Cliente",
                "telefono": c.telefono if c else None,
                "email": c.email if c else None,
                "fecha_creacion": c.fecha_creacion.isoformat() if c and c.fecha_creacion else None,
            },
        })
    return resultado


@router.post("/{orden_id}/validar", summary="Soporte aprueba o rechaza el primer pedido de un cliente")
async def validar_orden(
    orden_id: UUID,
    datos: ValidarOrdenRequest,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _solo_admin(current_user)
    orden = db.query(Orden).filter(Orden.id == orden_id).first()
    if not orden:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden no encontrada")
    if not orden.requiere_validacion or orden.fecha_validacion is not None or orden.estado != "pendiente":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Este pedido ya no está en validación")

    nombre_negocio = orden.negocio.nombre_negocio if orden.negocio else "el negocio"
    if datos.aprobar:
        orden.fecha_validacion = datetime.utcnow()
        db.add(SeguimientoOrden(orden_id=orden.id, estado_anterior="pendiente", estado_nuevo="pendiente",
                                descripcion="Validado por soporte", fecha_creacion=datetime.utcnow()))
        if orden.negocio and orden.negocio.vendedor:
            notificar_usuario(db, orden.negocio.vendedor, tipo="pedido_nuevo", titulo="Nuevo pedido",
                              mensaje=f"Pedido nuevo en {nombre_negocio} por ${float(orden.total):,.0f}",
                              relacionado_tabla="ordenes", relacionado_id=orden.id)
        if orden.cliente:
            notificar_usuario(db, orden.cliente, tipo="pedido_validado", titulo="Pedido confirmado",
                              mensaje=f"Confirmamos tu pedido. {nombre_negocio} ya lo puede preparar.",
                              relacionado_tabla="ordenes", relacionado_id=orden.id)
    else:
        orden.estado = "rechazada"
        # Devolver el stock que se descontó al crear la orden
        for it in orden.items:
            if it.producto:
                it.producto.stock = (it.producto.stock or 0) + it.cantidad
                it.producto.total_vendidos = max(0, (it.producto.total_vendidos or 0) - it.cantidad)
        db.add(SeguimientoOrden(orden_id=orden.id, estado_anterior="pendiente", estado_nuevo="rechazada",
                                descripcion=f"Rechazado por soporte: {datos.motivo or 'no se pudo confirmar'}",
                                fecha_creacion=datetime.utcnow()))
        if orden.cliente:
            notificar_usuario(db, orden.cliente, tipo="pedido_rechazado", titulo="No pudimos confirmar tu pedido",
                              mensaje="No pudimos confirmar tu pedido. Escríbenos por WhatsApp si fue un error.",
                              relacionado_tabla="ordenes", relacionado_id=orden.id)
    orden.fecha_ultima_actualizacion = datetime.utcnow()
    db.commit()
    return {"ok": True, "estado": orden.estado, "validado": orden.fecha_validacion is not None}


@router.post("/{orden_id}/reportar-cliente", summary="El repartidor reporta un problema con el cliente")
async def reportar_cliente(
    orden_id: UUID,
    datos: ReportarClienteRequest,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    orden = db.query(Orden).filter(Orden.id == orden_id).first()
    if not orden:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden no encontrada")
    if orden.domiciliario_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo el repartidor de este pedido puede reportarlo")
    if datos.motivo not in MOTIVOS_REPORTE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Motivo de reporte no válido")
    if orden.estado != "en_domicilio":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Solo puedes reportar un pedido que vas entregando")

    estado_anterior = orden.estado
    orden.estado = "cancelada"
    orden.reporte_motivo = datos.motivo
    orden.fecha_reporte = datetime.utcnow()
    orden.fecha_ultima_actualizacion = datetime.utcnow()
    db.add(SeguimientoOrden(orden_id=orden.id, estado_anterior=estado_anterior, estado_nuevo="cancelada",
                            descripcion=f"Reporte del repartidor: {MOTIVOS_REPORTE[datos.motivo]}",
                            fecha_creacion=datetime.utcnow()))

    cliente = orden.cliente
    suspendido = False
    if cliente:
        cliente.reportes_cliente = (cliente.reportes_cliente or 0) + 1
        if cliente.reportes_cliente >= REPORTES_PARA_SUSPENDER:
            cliente.estado = EstadoUsuario.SUSPENDIDO
            suspendido = True
        notificar_usuario(db, cliente, tipo="pedido_reportado", titulo="Pedido cancelado",
                          mensaje=("Tu cuenta fue suspendida por reportes de repartidores. Escríbenos por WhatsApp si fue un error."
                                   if suspendido else
                                   "El repartidor no pudo entregarte el pedido y lo reportó. Escríbenos por WhatsApp si fue un error."),
                          relacionado_tabla="ordenes", relacionado_id=orden.id)

    notificar_usuarios(db, _admins_activos(db), tipo="cliente_reportado",
                       titulo="Emergencia de repartidor" if datos.motivo == "peligro" else "Cliente reportado",
                       mensaje=f"{MOTIVOS_REPORTE[datos.motivo]} · pedido #{str(orden.id)[:8]}" + (" · cuenta suspendida" if suspendido else ""),
                       relacionado_tabla="ordenes", relacionado_id=orden.id)
    db.commit()
    return {"ok": True, "cliente_suspendido": suspendido}


@router.get("/validacion/reportados", summary="Clientes reportados por repartidores")
async def clientes_reportados(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _solo_admin(current_user)
    clientes = db.query(Usuario).filter(
        Usuario.tipo_usuario == "cliente",
        Usuario.reportes_cliente > 0,
    ).order_by(Usuario.reportes_cliente.desc()).all()

    resultado = []
    for c in clientes:
        ultima = db.query(Orden).filter(
            Orden.cliente_id == c.id, Orden.reporte_motivo.isnot(None)
        ).order_by(Orden.fecha_reporte.desc()).first()
        resultado.append({
            "id": str(c.id),
            "nombre": f"{c.nombre} {c.apellido or ''}".strip(),
            "telefono": c.telefono,
            "email": c.email,
            "reportes": c.reportes_cliente or 0,
            "estado": getattr(c.estado, "value", c.estado),
            "ultimo_motivo": MOTIVOS_REPORTE.get(ultima.reporte_motivo, ultima.reporte_motivo) if ultima else None,
            "ultimo_pedido": str(ultima.id)[:8] if ultima else None,
            "ultima_fecha": ultima.fecha_reporte.isoformat() if ultima and ultima.fecha_reporte else None,
        })
    return resultado


@router.post("/validacion/reactivar/{usuario_id}", summary="Reactivar un cliente suspendido por reportes")
async def reactivar_cliente(
    usuario_id: UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _solo_admin(current_user)
    cliente = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not cliente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    cliente.estado = EstadoUsuario.ACTIVO
    cliente.reportes_cliente = 0
    db.commit()
    return {"ok": True}
