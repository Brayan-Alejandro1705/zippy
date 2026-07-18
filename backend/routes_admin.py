# ============================================================================
# routes_admin.py - Rutas de administración (estadísticas del panel)
# ============================================================================

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from config import get_db
from models import Usuario

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])


@router.get(
    "/estadisticas/",
    summary="Estadísticas del panel de administración",
    description="Devuelve los contadores que muestra la pantalla de Inicio (Dashboard)."
)
async def estadisticas_admin(db: Session = Depends(get_db)):
    """
    Contadores para el Dashboard:
    - total_usuarios: todos los usuarios registrados
    - vendedores_activos: vendedores con estado 'activo'
    - vendedores_suspendidos: vendedores con estado 'suspendido' o 'inactivo'
    """

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