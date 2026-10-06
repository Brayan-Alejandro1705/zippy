# ============================================================================
# routes_pedidos_especiales.py - Encargos directos cliente <-> domiciliario
#
# Antes vivían solo en localStorage (cada quien veía los suyos). Ahora se
# guardan en la base para que los pedidos del cliente lleguen de verdad al
# domiciliario.
# ============================================================================

from datetime import datetime, timedelta
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from config import get_db
from models import Usuario, PedidoEspecial, EstadoUsuario, ConfiguracionSistema, MensajeMandado
from routes_auth import get_current_user
from push import notificar_usuario, notificar_usuarios


# Lo que cobra ZIPPYGO por el mandado, aparte de lo que valga la compra.
# Vive en configuracion_sistema para que se cambie desde el panel sin tocar
# codigo; este numero es solo el respaldo si todavia no se ha configurado.
COSTO_MANDADO_POR_DEFECTO = 4000

# Todo en la base se guarda con datetime.utcnow(). Colombia va cinco horas
# atras y no cambia de hora en todo el ano, asi que restar cinco es exacto.
# Hace falta para la fecha que se arma aqui como texto: sin restarlas, un
# mandado hecho a las 8 de la noche salia con la fecha del dia siguiente.
HORAS_COLOMBIA = 5


def _fecha_colombia(momento):
    if not momento:
        return ""
    return (momento - timedelta(hours=HORAS_COLOMBIA)).strftime("%d/%m/%Y")


def _costo_mandado(db: Session) -> float:
    fila = db.query(ConfiguracionSistema).filter(
        ConfiguracionSistema.clave == "costo_mandado"
    ).first()
    if fila and fila.valor:
        try:
            return float(fila.valor)
        except ValueError:
            pass
    return float(COSTO_MANDADO_POR_DEFECTO)

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
        "origen": p.origen or "",
        "direccion": p.direccion,
        "barrio": p.barrio or "",
        # Lo que el repartidor le cobra al cliente por el servicio, aparte de
        # lo que valga la compra.
        "costo_servicio": float(p.costo_servicio) if p.costo_servicio is not None else None,
        "telefono": p.telefono or (cliente.telefono if cliente else ""),
        "notas": p.notas or "",
        "cliente": nombre_cliente or "Cliente",
        "domiciliario_id": str(p.domiciliario_id) if p.domiciliario_id else None,
        "fecha": _fecha_colombia(p.fecha_creacion),
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
        origen=(datos.get("origen") or "").strip()[:300] or None,
        direccion=direccion[:500],
        barrio=(datos.get("barrio") or "").strip()[:150] or None,
        telefono=(datos.get("telefono") or "").strip()[:30] or None,
        notas=(datos.get("notas") or "").strip() or None,
        # Se congela el precio del dia: si manana sube la tarifa, este pedido
        # conserva lo que se le dijo al cliente.
        costo_servicio=_costo_mandado(db),
    )

    db.add(pedido)
    db.commit()
    db.refresh(pedido)

    # Avisarle a los repartidores. Esto faltaba por completo: el mandado se
    # guardaba bien y aparecia en la lista, pero nadie se enteraba. El
    # repartidor solo lo veia si tenia la app abierta y esperaba a que la
    # pantalla se refrescara sola, asi que un mandado podia quedarse horas ahi.
    #
    # Va envuelto en try porque el pedido YA quedo guardado: si falla el aviso,
    # se pierde el aviso, no el pedido.
    try:
        domiciliarios = db.query(Usuario).filter(
            Usuario.tipo_usuario == "domiciliario",
            Usuario.estado == EstadoUsuario.ACTIVO,
            Usuario.fcm_token.isnot(None),
        ).all()
        cuantos = len(pedido.items or [])
        detalle = f"{cuantos} cosa{'s' if cuantos != 1 else ''}"
        donde = f" desde {pedido.origen}" if pedido.origen else ""
        notificar_usuarios(
            db, domiciliarios,
            tipo="mandado_nuevo",
            titulo="Mandado nuevo",
            mensaje=f"Un cliente pide {detalle}{donde} para {pedido.barrio or pedido.direccion}",
            relacionado_tabla="pedidos_especiales",
            relacionado_id=pedido.id,
        )
        # notificar_usuarios solo hace db.add(); sin este commit la fila del
        # historial se descarta al cerrar la sesion y el aviso solo existia
        # como push.
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[mandado] no se pudo avisar a los repartidores: {e}")

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


# ============================================================================
# CHAT DEL MANDADO
# ============================================================================
#
# En un mandado el chat hace mas falta que en un pedido normal: el repartidor
# esta parado en la tienda y la lista decia "leche", no cual marca ni de cuantos
# litros. Sin chat eso se resuelve con una llamada, y muchas veces ni eso.
#
# Mismas reglas que el chat de las ordenes, para que la gente no tenga que
# aprender dos comportamientos distintos: se abre cuando un repartidor toma el
# mandado, se cierra al entregarlo y se borra una hora despues.

CHAT_HORAS_TRAS_ENTREGA = 1


def _puede_ver_chat(pedido: PedidoEspecial, usuario: Usuario):
    """Solo los dos que estan en la conversacion, y el admin."""
    if _tipo(usuario) == "admin":
        return
    if usuario.id in (pedido.cliente_id, pedido.domiciliario_id):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Este chat no es tuyo",
    )


def _estado_chat(pedido: PedidoEspecial, db: Session) -> str:
    """sin_domiciliario | activo | cerrado | expirado"""
    if not pedido.domiciliario_id:
        return "sin_domiciliario"

    if pedido.estado not in ("entregada", "cancelada"):
        return "activo"

    referencia = pedido.fecha_entrega or pedido.fecha_creacion
    if referencia and datetime.utcnow() - referencia >= timedelta(hours=CHAT_HORAS_TRAS_ENTREGA):
        # Se borra de verdad, no se esconde: es una conversacion entre dos
        # personas sobre una compra, no hay por que guardarla para siempre.
        db.query(MensajeMandado).filter(MensajeMandado.pedido_especial_id == pedido.id).delete()
        db.commit()
        return "expirado"

    return "cerrado"


def _buscar_pedido(pedido_id: UUID, db: Session) -> PedidoEspecial:
    pedido = db.query(PedidoEspecial).filter(PedidoEspecial.id == pedido_id).first()
    if not pedido:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mandado no encontrado")
    return pedido


@router.get("/{pedido_id}/chat-estado/", summary="Estado del chat del mandado")
async def estado_chat_mandado(
    pedido_id: UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pedido = _buscar_pedido(pedido_id, db)
    _puede_ver_chat(pedido, current_user)
    estado = _estado_chat(pedido, db)
    return {"estado": estado, "activo": estado == "activo"}


@router.get("/{pedido_id}/mensajes/", response_model=List[dict], summary="Mensajes del mandado")
async def listar_mensajes_mandado(
    pedido_id: UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pedido = _buscar_pedido(pedido_id, db)
    _puede_ver_chat(pedido, current_user)

    # Se consulta el estado antes de listar: si ya expiro, el borrado pasa aqui
    # y la lista sale vacia, que es justo lo que se quiere.
    _estado_chat(pedido, db)

    mensajes = db.query(MensajeMandado).filter(
        MensajeMandado.pedido_especial_id == pedido.id
    ).order_by(MensajeMandado.fecha_creacion.asc()).all()

    return [
        {
            "id": str(m.id),
            "contenido": m.contenido,
            "fecha": m.fecha_creacion.isoformat() if m.fecha_creacion else None,
            "es_mio": m.remitente_id == current_user.id,
            "remitente": m.remitente.nombre if m.remitente else "",
        }
        for m in mensajes
    ]


@router.post("/{pedido_id}/mensajes/", status_code=status.HTTP_201_CREATED, summary="Enviar un mensaje en el mandado")
async def enviar_mensaje_mandado(
    pedido_id: UUID,
    datos: dict,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pedido = _buscar_pedido(pedido_id, db)
    _puede_ver_chat(pedido, current_user)

    estado = _estado_chat(pedido, db)
    if estado != "activo":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este chat ya no admite mensajes",
        )

    contenido = (datos.get("contenido") or "").strip()
    if not contenido:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El mensaje esta vacio")
    if len(contenido) > 1000:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El mensaje es demasiado largo")

    mensaje = MensajeMandado(
        pedido_especial_id=pedido.id,
        remitente_id=current_user.id,
        contenido=contenido,
    )
    db.add(mensaje)
    db.commit()
    db.refresh(mensaje)

    # Avisarle al otro. Sin esto el mensaje se queda esperando a que la otra
    # persona abra la app por casualidad, que es la mitad del problema que este
    # chat viene a resolver.
    try:
        otro_id = pedido.domiciliario_id if current_user.id == pedido.cliente_id else pedido.cliente_id
        otro = db.query(Usuario).filter(Usuario.id == otro_id).first() if otro_id else None
        if otro:
            notificar_usuario(
                db, otro,
                tipo="mensaje_mandado",
                titulo=f"Mensaje de {current_user.nombre}",
                mensaje=contenido[:120],
                relacionado_tabla="pedidos_especiales",
                relacionado_id=pedido.id,
            )
            # Igual que arriba: sin commit la notificacion no queda guardada.
            db.commit()
    except Exception as e:
        db.rollback()
        print(f"[mandado] no se pudo avisar del mensaje: {e}")

    return {
        "id": str(mensaje.id),
        "contenido": mensaje.contenido,
        "fecha": mensaje.fecha_creacion.isoformat() if mensaje.fecha_creacion else None,
        "es_mio": True,
        "remitente": current_user.nombre,
    }
