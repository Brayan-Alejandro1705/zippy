# ============================================================================
# routes_admin.py - Rutas de administración (estadísticas y configuración)
# ============================================================================

import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from config import get_db
from models import Usuario, ConfiguracionSistema
from routes_auth import get_current_user
from logs_utils import registrar_log

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])

# Claves con las que se guardan los valores en configuracion_sistema
CLAVE_WHATSAPP = "whatsapp_soporte"
CLAVE_DOMICILIO = "costo_domicilio"
CLAVE_VERSION_MINIMA = "version_minima_android"
CLAVE_ACTUALIZACION_OBLIGATORIA = "actualizacion_obligatoria"
CLAVE_MENSAJE_ACTUALIZACION = "mensaje_actualizacion_app"

# Topes de cordura: un domicilio de cero seria gratis por error, y uno de
# cien mil casi seguro es un dedazo (un cero de mas).
DOMICILIO_MINIMO = 0
DOMICILIO_MAXIMO = 50000


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
async def estadisticas_admin(db: Session = Depends(get_db)):
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
