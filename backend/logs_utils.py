# ============================================================================
# logs_utils.py - Helper para registrar acciones de administración
# ============================================================================

from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from models import LogSistema


def registrar_log(
    db: Session,
    usuario_id: UUID,
    accion: str,
    tabla_afectada: Optional[str] = None,
    registro_id: Optional[UUID] = None,
    detalle: Optional[str] = None,
) -> None:
    """Escribe una fila en logs_sistema. No lanza si falla: un log nunca debe tumbar la acción que registra."""
    try:
        log = LogSistema(
            usuario_id=usuario_id,
            accion=accion,
            tabla_afectada=tabla_afectada,
            registro_id=registro_id,
            cambios_json={"detalle": detalle} if detalle else None,
        )
        db.add(log)
        db.commit()
    except Exception:
        db.rollback()
