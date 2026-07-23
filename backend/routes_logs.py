# ============================================================================
# routes_logs.py - Logs de actividad del panel de administración
# ============================================================================

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from config import get_db
from models import LogSistema, Usuario
from routes_auth import get_current_user

router = APIRouter(prefix="/api/v1/logs", tags=["Logs"])


def _es_admin(usuario: Usuario) -> bool:
    tipo = usuario.tipo_usuario
    tipo = tipo.value if hasattr(tipo, "value") else str(tipo)
    return tipo.lower() == "admin"


@router.get(
    "/",
    summary="Listar logs de actividad",
    description="Historial de acciones realizadas dentro del panel de administración. Solo administradores.",
)
async def listar_logs(
    accion: Optional[str] = Query(None, description="Filtra por tipo de acción, ej. 'Suspensión'"),
    limit: int = Query(100, le=500),
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _es_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un administrador puede ver los logs de actividad",
        )

    query = db.query(LogSistema, Usuario).outerjoin(Usuario, LogSistema.usuario_id == Usuario.id)

    if accion and accion != "Todas":
        query = query.filter(LogSistema.accion == accion)

    filas = query.order_by(LogSistema.fecha_creacion.desc()).limit(limit).all()

    return [
        {
            "id": str(log.id),
            "fecha": log.fecha_creacion.isoformat() if log.fecha_creacion else None,
            "admin": f"{admin.nombre} {admin.apellido}" if admin else "—",
            "accion": log.accion,
            "detalle": (log.cambios_json or {}).get("detalle", "") if log.cambios_json else "",
        }
        for log, admin in filas
    ]
