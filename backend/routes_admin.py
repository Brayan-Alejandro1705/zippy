# ============================================================================
# routes_admin.py - Rutas de administración (estadísticas y configuración)
# ============================================================================

import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from config import get_db
from models import Usuario, ConfiguracionSistema, Orden, ItemOrden, Producto, Negocio, PedidoEspecial
from routes_auth import get_current_user
from logs_utils import registrar_log

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])

# Claves con las que se guardan los valores en configuracion_sistema
CLAVE_WHATSAPP = "whatsapp_soporte"
CLAVE_DOMICILIO = "costo_domicilio"
CLAVE_MANDADO = "costo_mandado"
CLAVE_VERSION_MINIMA = "version_minima_android"
CLAVE_ACTUALIZACION_OBLIGATORIA = "actualizacion_obligatoria"
CLAVE_MENSAJE_ACTUALIZACION = "mensaje_actualizacion_app"

# Topes de cordura: un domicilio de cero seria gratis por error, y uno de
# cien mil casi seguro es un dedazo (un cero de mas).
DOMICILIO_MINIMO = 0
DOMICILIO_MAXIMO = 50000

# Lo que cobra ZIPPYGO por un mandado, aparte de lo que valga la compra.
# Decidido con el equipo (oct 2026): tarifa unica de 4.000, sin cotizar.
# Un mandado gratis seria un error de dedo, y uno de cien mil tambien.
MANDADO_POR_DEFECTO = 4000
MANDADO_MINIMO = 1000
MANDADO_MAXIMO = 50000


# ============================================================================
# HELPERS
# ============================================================================

def _es_admin(usuario: Usuario) -> bool:
    """Verifica que el usuario sea administrador."""
    tipo = usuario.tipo_usuario
    tipo = tipo.value if hasattr(tipo, "value") else str(tipo)
    return tipo.lower() == "admin"


def _obtener_valor(db: Session, clave: str, por_defecto: str = "") -> str:
    """Lee un valor de configuracion_sistema."""
    fila = db.query(ConfiguracionSistema).filter(
        ConfiguracionSistema.clave == clave
    ).first()
    return fila.valor if fila and fila.valor else por_defecto


def _guardar_valor(db: Session, clave: str, valor: str, descripcion: str = "") -> None:
    """Crea o actualiza un valor en configuracion_sistema."""
    fila = db.query(ConfiguracionSistema).filter(
        ConfiguracionSistema.clave == clave
    ).first()

    if fila:
        fila.valor = valor
    else:
        fila = ConfiguracionSistema(
            clave=clave,
            valor=valor,
            descripcion=descripcion,
            tipo_dato="string",
        )
        db.add(fila)

    db.commit()


def _normalizar_whatsapp(numero: str) -> str:
    """
    Deja solo dígitos y antepone el indicativo de Colombia (57) si falta.
    Ej: '300 123 4567' -> '573001234567'
    """
    solo_digitos = re.sub(r"\D", "", numero or "")

    if not solo_digitos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El número de WhatsApp no puede estar vacío",
        )

    # Número colombiano de 10 dígitos -> agregar indicativo 57
    if len(solo_digitos) == 10:
        solo_digitos = "57" + solo_digitos

    if not (10 <= len(solo_digitos) <= 15):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El número de WhatsApp no es válido",
        )

    return solo_digitos


# ============================================================================
# ESTADÍSTICAS DEL PANEL
# ============================================================================

@router.get(
    "/estadisticas/",
    summary="Estadísticas del panel de administración",
    description="Contadores que muestra la pantalla de Inicio (Dashboard).",
)
async def estadisticas_admin(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Antes no pedia sesion: cualquiera podia ver cuantos usuarios tiene la app
    if not _es_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores")
    total_usuarios = db.query(Usuario).count()

    vendedores_activos = db.query(Usuario).filter(
        Usuario.tipo_usuario == "vendedor",
        Usuario.estado == "activo",
    ).count()

    vendedores_suspendidos = db.query(Usuario).filter(
        Usuario.tipo_usuario == "vendedor",
        Usuario.estado.in_(["suspendido", "inactivo"]),
    ).count()

    return {
        "total_usuarios": total_usuarios,
        "vendedores_activos": vendedores_activos,
        "vendedores_suspendidos": vendedores_suspendidos,
    }


# ============================================================================
# RESUMEN DEL NEGOCIO (panel de inicio con numeros reales)
# ============================================================================

def _dia_colombia(momento: datetime):
    """La fecha en Garzon de un momento guardado en hora universal."""
    return (momento - timedelta(hours=5)).date()


@router.get(
    "/resumen/",
    summary="Como va el negocio",
    description="Pedidos, ventas, negocios, productos y repartidores con datos reales de la base.",
)
async def resumen_negocio(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lo que antes no existia: el panel de inicio solo contaba usuarios, y la
    pantalla de Negocios mostraba "Ventas totales $0" porque esperaba un dato
    que el servidor nunca mandaba. Aqui sale todo de los pedidos reales.

    Los dias se cuentan en hora de Colombia (la base guarda hora universal):
    sin eso, todo lo pedido despues de las 7 de la noche caia en el dia
    siguiente.
    """
    if not _es_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores")

    ahora = datetime.utcnow()
    hoy = _dia_colombia(ahora)
    inicio_semana = hoy - timedelta(days=6)          # hoy y los 6 dias anteriores
    inicio_ventana = hoy - timedelta(days=29)        # ultimos 30 dias
    desde_utc = datetime.combine(inicio_ventana, datetime.min.time()) + timedelta(hours=5)

    ordenes = db.query(Orden).filter(Orden.fecha_creacion >= desde_utc).all()
    estado = lambda o: getattr(o.estado, "value", o.estado)

    # Pedidos y ventas por dia (ultimos 14 dias, para la grafica)
    dias = [hoy - timedelta(days=i) for i in range(13, -1, -1)]
    por_dia = {d: {"pedidos": 0, "ventas": 0.0} for d in dias}
    for o in ordenes:
        d = _dia_colombia(o.fecha_creacion)
        if d in por_dia and estado(o) not in ("cancelada", "rechazada"):
            por_dia[d]["pedidos"] += 1
            if estado(o) == "entregada":
                por_dia[d]["ventas"] += float(o.total or 0)

    def resumen_rango(desde):
        del_rango = [o for o in ordenes if _dia_colombia(o.fecha_creacion) >= desde]
        entregadas = [o for o in del_rango if estado(o) == "entregada"]
        ventas = sum(float(o.total or 0) for o in entregadas)
        return {
            "pedidos": len([o for o in del_rango if estado(o) not in ("cancelada", "rechazada")]),
            "entregados": len(entregadas),
            "cancelados": len([o for o in del_rango if estado(o) in ("cancelada", "rechazada")]),
            "ventas": ventas,
            "ticket_promedio": (ventas / len(entregadas)) if entregadas else 0,
        }

    # Lo mas vendido y los negocios que mas venden (ultimos 30 dias, entregados)
    entregadas_30 = [o for o in ordenes if estado(o) == "entregada"]
    ids_entregadas = [o.id for o in entregadas_30]
    top_productos = []
    if ids_entregadas:
        filas = db.query(
            ItemOrden.producto_id, func.sum(ItemOrden.cantidad), func.sum(ItemOrden.subtotal)
        ).filter(ItemOrden.orden_id.in_(ids_entregadas)).group_by(ItemOrden.producto_id) \
         .order_by(func.sum(ItemOrden.cantidad).desc()).limit(5).all()
        nombres = {p.id: p for p in db.query(Producto).filter(Producto.id.in_([f[0] for f in filas])).all()}
        for pid, cantidad, plata in filas:
            prod = nombres.get(pid)
            top_productos.append({
                "nombre": prod.nombre if prod else "Producto",
                "negocio": prod.negocio.nombre_negocio if prod and prod.negocio else "",
                "cantidad": int(cantidad or 0),
                "ventas": float(plata or 0),
            })

    ventas_negocio = {}
    for o in entregadas_30:
        ventas_negocio[o.negocio_id] = ventas_negocio.get(o.negocio_id, 0) + float(o.total or 0)
    negocios_map = {n.id: n for n in db.query(Negocio).filter(Negocio.id.in_(list(ventas_negocio.keys()))).all()} if ventas_negocio else {}
    top_negocios = sorted(
        [{"nombre": negocios_map[k].nombre_negocio if k in negocios_map else "Negocio", "ventas": v,
          "pedidos": len([o for o in entregadas_30 if o.negocio_id == k])}
         for k, v in ventas_negocio.items()],
        key=lambda x: x["ventas"], reverse=True,
    )[:5]

    # Ventas de siempre por negocio, para la pantalla de Negocios
    ventas_historicas = dict(db.query(Orden.negocio_id, func.sum(Orden.total))
                             .filter(Orden.estado == "entregada").group_by(Orden.negocio_id).all())

    negocios_activos = db.query(Negocio).filter(Negocio.estado == "activo").count()
    negocios_con_pedidos = len({o.negocio_id for o in ordenes if _dia_colombia(o.fecha_creacion) >= inicio_semana})
    minutos_5 = ahora - timedelta(minutes=5)

    mandados_semana = db.query(PedidoEspecial).filter(
        PedidoEspecial.fecha_creacion >= datetime.combine(inicio_semana, datetime.min.time()) + timedelta(hours=5)
    ).all()

    return {
        "hoy": resumen_rango(hoy),
        "semana": resumen_rango(inicio_semana),
        "mes": resumen_rango(inicio_ventana),
        "por_dia": [{"dia": d.isoformat(), **por_dia[d]} for d in dias],
        "top_productos": top_productos,
        "top_negocios": top_negocios,
        "ahora": {
            "en_curso": len([o for o in ordenes if estado(o) in
                             ("pendiente", "confirmada", "en_preparacion", "lista_para_retirar", "en_domicilio")]),
            "sin_aceptar": len([o for o in ordenes if estado(o) == "pendiente" and o.fecha_creacion <= minutos_5
                                and not (o.requiere_validacion and o.fecha_validacion is None)]),
        },
        "negocios": {
            "activos": negocios_activos,
            "con_pedidos_semana": negocios_con_pedidos,
            # La lista publica de negocios solo trae los activos, asi que la
            # pantalla de Negocios no tenia de donde contar los demas.
            "inactivos": db.query(Negocio).filter(Negocio.estado != "activo").count(),
        },
        "clientes_nuevos_semana": db.query(Usuario).filter(
            Usuario.tipo_usuario == "cliente",
            Usuario.fecha_creacion >= datetime.combine(inicio_semana, datetime.min.time()) + timedelta(hours=5),
        ).count(),
        "repartidores_activos": db.query(Usuario).filter(
            Usuario.tipo_usuario == "domiciliario", Usuario.estado == "activo"
        ).count(),
        "mandados_semana": {
            "total": len(mandados_semana),
            "entregados": len([m for m in mandados_semana if m.estado == "entregada"]),
        },
        "ventas_por_negocio": {str(k): float(v or 0) for k, v in ventas_historicas.items()},
        "productos_por_negocio": {str(k): int(v or 0) for k, v in db.query(Producto.negocio_id, func.count(Producto.id))
                                  .filter(Producto.estado == "activo").group_by(Producto.negocio_id).all()},
    }


# ============================================================================
# CONFIGURACIÓN: WHATSAPP DE SOPORTE
# ============================================================================

@router.get(
    "/configuracion/soporte",
    summary="Obtener el WhatsApp de soporte",
    description="Devuelve el número de WhatsApp al que se envían los mensajes de soporte.",
)
async def obtener_whatsapp_soporte(db: Session = Depends(get_db)):
    numero = _obtener_valor(db, CLAVE_WHATSAPP, "")

    return {
        "whatsapp": numero,
        "configurado": bool(numero),
    }


@router.put(
    "/configuracion/soporte",
    summary="Actualizar el WhatsApp de soporte",
    description="Solo administradores. Guarda el número de WhatsApp de soporte.",
)
async def actualizar_whatsapp_soporte(
    datos: dict,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _es_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un administrador puede cambiar el WhatsApp de soporte",
        )

    numero = _normalizar_whatsapp(datos.get("whatsapp", ""))

    _guardar_valor(
        db,
        CLAVE_WHATSAPP,
        numero,
        "Número de WhatsApp al que llegan los mensajes de soporte",
    )

    registrar_log(
        db,
        usuario_id=current_user.id,
        accion="Configuración",
        tabla_afectada="configuracion_sistema",
        detalle=f"WhatsApp de soporte actualizado a {numero}",
    )

    return {
        "whatsapp": numero,
        "configurado": True,
        "mensaje": "Número de WhatsApp actualizado correctamente",
    }


# ============================================================================
# COSTO DEL DOMICILIO
# ============================================================================

@router.get(
    "/configuracion/domicilio",
    summary="Obtener el costo del domicilio",
    description="Devuelve el costo fijo por domicilio. Lo consulta el frontend "
                "para mostrar el mismo valor que cobra el servidor.",
)
async def obtener_costo_domicilio(db: Session = Depends(get_db)):
    from config import settings

    # Sin configurar todavia: se usa el respaldo de config.py.
    valor = _obtener_valor(db, CLAVE_DOMICILIO, "")
    if not valor:
        return {
            "costo_domicilio": float(settings.COSTO_DOMICILIO_BASE),
            "configurado": False,
        }

    try:
        return {"costo_domicilio": float(valor), "configurado": True}
    except ValueError:
        # Alguien guardo basura: no se rompe el checkout por eso.
        return {
            "costo_domicilio": float(settings.COSTO_DOMICILIO_BASE),
            "configurado": False,
        }


@router.put(
    "/configuracion/domicilio",
    summary="Actualizar el costo del domicilio",
    description="Solo administradores. Cambia el costo fijo por domicilio.",
)
async def actualizar_costo_domicilio(
    datos: dict,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _es_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un administrador puede cambiar el costo del domicilio",
        )

    crudo = datos.get("costo_domicilio", datos.get("valor"))
    try:
        costo = float(str(crudo).replace(".", "").replace(",", "."))
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El costo debe ser un numero",
        )

    if not DOMICILIO_MINIMO <= costo <= DOMICILIO_MAXIMO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El costo debe estar entre {DOMICILIO_MINIMO} y {DOMICILIO_MAXIMO}",
        )

    anterior = _obtener_valor(db, CLAVE_DOMICILIO, "sin definir")

    _guardar_valor(
        db,
        CLAVE_DOMICILIO,
        str(int(costo)),
        "Costo fijo que se cobra por domicilio en cada orden",
    )

    registrar_log(
        db,
        usuario_id=current_user.id,
        accion="Configuración",
        tabla_afectada="configuracion_sistema",
        detalle=f"Costo de domicilio cambiado de {anterior} a {int(costo)}",
    )

    return {
        "costo_domicilio": costo,
        "configurado": True,
        "mensaje": f"El domicilio quedo en ${int(costo):,}".replace(",", "."),
    }
# ============================================================================
# ACTUALIZACION OBLIGATORIA DE LA APP (Android)
# ============================================================================
# Como el frontend ahora se carga desde Render (ver capacitor.config), un
# cambio de pantallas normal no necesita esto: le llega solo a todo el mundo.
# Esto es solo para el caso donde SI hace falta una version nueva del .apk
# (por ejemplo, un plugin nativo nuevo) y se quiere obligar a la gente a que
# actualice desde Play Store en vez de seguir usando una version vieja.

@router.get(
    "/configuracion/actualizacion",
    summary="Obtener el estado de actualizacion obligatoria",
    description="Publico: lo consulta la app en cada apertura para saber si "
                "debe forzar al usuario a actualizar desde Play Store.",
)
async def obtener_actualizacion(db: Session = Depends(get_db)):
    version_minima = _obtener_valor(db, CLAVE_VERSION_MINIMA, "0")
    obligatoria = _obtener_valor(db, CLAVE_ACTUALIZACION_OBLIGATORIA, "false")
    mensaje = _obtener_valor(
        db, CLAVE_MENSAJE_ACTUALIZACION,
        "Hay una actualizacion importante disponible. Actualiza para seguir usando Zippy.",
    )

    try:
        version_minima_int = int(version_minima)
    except ValueError:
        version_minima_int = 0

    return {
        "version_minima": version_minima_int,
        "obligatoria": obligatoria.lower() == "true",
        "mensaje": mensaje,
    }


@router.put(
    "/configuracion/actualizacion",
    summary="Configurar la actualizacion obligatoria",
    description="Solo super administradores. Define desde que versionCode de "
                "Android se debe forzar la actualizacion.",
)
async def actualizar_actualizacion(
    datos: dict,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not getattr(current_user, "es_super_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un super administrador puede configurar la actualizacion obligatoria",
        )

    try:
        version_minima = int(datos.get("version_minima", 0))
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="version_minima debe ser un numero entero (el versionCode de Android)",
        )
    if version_minima < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="version_minima no puede ser negativo",
        )

    obligatoria = bool(datos.get("obligatoria", False))
    mensaje = str(datos.get("mensaje") or "").strip() or (
        "Hay una actualizacion importante disponible. Actualiza para seguir usando Zippy."
    )

    _guardar_valor(db, CLAVE_VERSION_MINIMA, str(version_minima), "versionCode minimo de Android requerido")
    _guardar_valor(db, CLAVE_ACTUALIZACION_OBLIGATORIA, "true" if obligatoria else "false", "Si se debe forzar la actualizacion")
    _guardar_valor(db, CLAVE_MENSAJE_ACTUALIZACION, mensaje, "Mensaje que ve el usuario cuando debe actualizar")

    registrar_log(
        db,
        usuario_id=current_user.id,
        accion="Configuración",
        tabla_afectada="configuracion_sistema",
        detalle=f"Actualizacion obligatoria configurada: version_minima={version_minima}, obligatoria={obligatoria}",
    )

    return {
        "version_minima": version_minima,
        "obligatoria": obligatoria,
        "mensaje": mensaje,
    }


# ============================================================================
# COSTO DEL MANDADO
# ============================================================================

@router.get(
    "/configuracion/mandado",
    summary="Obtener el costo del mandado",
    description="Devuelve la tarifa fija que cobra ZIPPYGO por un mandado, aparte "
                "de lo que valga la compra. La consulta el cliente antes de pedir "
                "y el repartidor para saber cuanto cobrar.",
)
async def obtener_costo_mandado(db: Session = Depends(get_db)):
    valor = _obtener_valor(db, CLAVE_MANDADO, "")
    if not valor:
        return {"costo_mandado": float(MANDADO_POR_DEFECTO), "configurado": False}
    try:
        return {"costo_mandado": float(valor), "configurado": True}
    except ValueError:
        # Alguien guardo basura: no se rompe el pedido por eso.
        return {"costo_mandado": float(MANDADO_POR_DEFECTO), "configurado": False}


@router.put(
    "/configuracion/mandado",
    summary="Actualizar el costo del mandado",
    description="Solo administradores.",
)
async def actualizar_costo_mandado(
    datos: dict,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _es_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un administrador puede cambiar el costo del mandado",
        )

    crudo = datos.get("costo_mandado", datos.get("valor"))
    try:
        costo = float(str(crudo).replace(".", "").replace(",", "."))
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El costo debe ser un numero",
        )

    if not MANDADO_MINIMO <= costo <= MANDADO_MAXIMO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El costo del mandado debe estar entre {MANDADO_MINIMO} y {MANDADO_MAXIMO}",
        )

    _guardar_valor(db, CLAVE_MANDADO, str(int(costo)), "Tarifa fija por mandado")
    registrar_log(
        db,
        usuario_id=current_user.id,
        accion="Configuración",
        tabla_afectada="configuracion_sistema",
        detalle=f"Costo del mandado cambiado a {int(costo)}",
    )
    db.commit()
    return {"costo_mandado": costo, "configurado": True}
