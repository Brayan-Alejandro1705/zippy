# ============================================================================
# routes_admin.py - Rutas de administración (estadísticas y configuración)
# ============================================================================

import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from config import get_db
from models import Usuario, ConfiguracionSistema
from routes_auth import get_current_user

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])

# Clave con la que se guarda el número en la tabla configuracion_sistema
CLAVE_WHATSAPP = "whatsapp_soporte"


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

    return {
        "whatsapp": numero,
        "configurado": True,
        "mensaje": "Número de WhatsApp actualizado correctamente",
    }