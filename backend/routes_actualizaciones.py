# ============================================================================
# routes_actualizaciones.py - Servidor propio de actualizaciones para el iPhone
# ============================================================================
#
# Para que es esto:
#
# En Android la app carga las pantallas desde Render, asi que cualquier cambio
# llega al celular con solo publicar. En iPhone no se puede: Apple no permite
# que una app cargue toda su interfaz desde una web, asi que el frontend va
# empaquetado dentro de la app. Resultado: cambiar un boton costaba una version
# nueva y la cola de revision de Apple.
#
# El plugin de actualizaciones (@capgo/capacitor-updater) resuelve eso, y es de
# codigo abierto: se le puede decir que pregunte por actualizaciones a NUESTRO
# servidor en vez de al servicio de pago. Eso es este archivo. Apple lo permite
# porque solo viajan HTML, CSS y JavaScript; cualquier cosa nativa sigue
# necesitando version nueva y revision.
#
# Como funciona, de principio a fin:
#
#   1. GitHub compila el frontend, lo comprime y lo manda a /publicar con una
#      llave secreta. El servidor lo guarda en Supabase y anota la version.
#   2. El iPhone, al abrir la app, llama a /check diciendo que version tiene.
#   3. Si hay una distinta, le responde donde bajarla y su SHA-256.
#   4. La app la baja, verifica el checksum y la aplica la proxima vez que abra.
#   5. Si esa version quedo rota, nunca alcanza a avisar que arranco bien y el
#      plugin se devuelve solo a la anterior (ver src/utils/actualizaciones.js).
#
# Lo que NO hace, a proposito: no guarda nada del aparato que pregunta. El
# plugin manda un device_id, y aqui se ignora. No hace falta para decidir si
# hay actualizacion, y lo que no se guarda no se puede perder ni filtrar.

import hashlib
import re
import uuid as uuid_lib
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Request, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import get_db, settings
from models import BundleApp, Usuario
from routes_auth import get_current_user
import storage_supabase

router = APIRouter(prefix="/api/v1/actualizaciones", tags=["Actualizaciones"])

# Tope de tamano del paquete. El frontend comprimido pesa unos 2 MB; 60 MB deja
# muchisimo margen y a la vez evita que un error suba un archivo gigante.
MAX_BYTES = 60 * 1024 * 1024

_VERSION_VALIDA = re.compile(r"^\d+\.\d+\.\d+$")


# ============================================================================
# LO QUE PREGUNTA EL CELULAR
# ============================================================================

class ConsultaActualizacion(BaseModel):
    """Lo que manda el plugin. Todo opcional porque puede cambiar entre
    versiones del plugin y no queremos que una llave nueva tumbe la consulta."""
    version_name: Optional[str] = None     # la version que tiene ahora mismo
    version_build: Optional[str] = None
    version_os: Optional[str] = None
    platform: Optional[str] = None         # ios / android
    app_id: Optional[str] = None
    plugin_version: Optional[str] = None
    is_emulator: Optional[bool] = None
    is_prod: Optional[bool] = None
    custom_id: Optional[str] = None
    device_id: Optional[str] = None        # se ignora a proposito


def _ultimo_bundle(db: Session, plataforma: str) -> Optional[BundleApp]:
    return (
        db.query(BundleApp)
        .filter(BundleApp.plataforma == plataforma, BundleApp.activo == True)  # noqa: E712
        .order_by(BundleApp.fecha_creacion.desc())
        .first()
    )


@router.post("/check", summary="El celular pregunta si hay frontend nuevo")
async def consultar_actualizacion(datos: ConsultaActualizacion, db: Session = Depends(get_db)):
    """Responde con el paquete nuevo, o con un mensaje si no hay nada que bajar.

    La comparacion es por DIFERENCIA y no por "mayor que", y es a proposito:
    asi, si un paquete sale malo, basta con desactivarlo para que el servidor
    vuelva a ofrecer el anterior y los celulares se devuelvan solos. Con una
    comparacion de "solo si es mas nuevo", un paquete malo se quedaria puesto
    hasta publicar otro encima, que es justo lo que uno no quiere cuando algo
    ya esta fallando en los celulares de la gente.
    """
    plataforma = (datos.platform or "ios").lower()
    bundle = _ultimo_bundle(db, plataforma)

    if not bundle:
        return {"message": "No hay actualizaciones publicadas"}

    # El celular que corre el frontend de fabrica manda la version nativa
    # (ej. "1.2"); el que ya tiene un paquete manda la del paquete ("1.2.14").
    actual = (datos.version_name or "").strip()
    if actual and actual == bundle.version:
        return {"message": "Ya tienes la ultima version", "version": bundle.version}

    return {
        "version": bundle.version,
        "url": bundle.url,
        "checksum": bundle.checksum,
    }


@router.post("/stats", summary="El celular reporta como le fue")
async def recibir_estadisticas(request: Request):
    """El plugin manda aqui si instalo o fallo una actualizacion.

    Se responde 200 y ya. Si esto devolviera un error, el plugin lo registraria
    como fallo de red en cada arranque y ensuciaria los registros sin motivo.
    """
    # No se lee el cuerpo: el plugin a veces lo manda en un formato que FastAPI
    # rechazaba con 422. Da igual lo que traiga, siempre se responde ok.
    return {"status": "ok"}


# ============================================================================
# PUBLICAR UN PAQUETE (lo llama GitHub)
# ============================================================================

def _verificar_llave(llave: Optional[str]):
    """Sin llave configurada en el servidor, nadie publica.

    Esto importa: si se dejara pasar cuando la variable esta vacia, cualquiera
    en internet podria subirle un frontend a la app de todos los clientes.
    Mejor que no funcione a que quede abierto.
    """
    if not settings.ACTUALIZACIONES_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Publicacion deshabilitada: falta ACTUALIZACIONES_TOKEN en el servidor",
        )
    if not llave or llave != settings.ACTUALIZACIONES_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Llave de publicacion incorrecta",
        )


@router.post("/publicar", summary="Publicar un frontend nuevo para el iPhone")
async def publicar_bundle(
    archivo: UploadFile = File(..., description="El frontend comprimido en .zip"),
    version: str = Form(..., description="Version del paquete, formato x.y.z"),
    plataforma: str = Form("ios"),
    notas: Optional[str] = Form(None),
    x_actualizaciones_token: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Guarda el paquete en Supabase y lo deja como el ultimo disponible."""
    _verificar_llave(x_actualizaciones_token)

    if not _VERSION_VALIDA.match(version or ""):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La version debe ser x.y.z (llego '{version}')",
        )

    contenido = await archivo.read()
    if not contenido:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El archivo llego vacio")
    if len(contenido) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El paquete pesa {len(contenido)} bytes y el tope son {MAX_BYTES}",
        )
    # Un zip empieza por 'PK'. Si no, algo se mando mal y es mejor saberlo aqui
    # que cuando doscientos celulares no puedan descomprimirlo.
    if contenido[:2] != b"PK":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo no parece un .zip",
        )

    if db.query(BundleApp).filter(
        BundleApp.plataforma == plataforma, BundleApp.version == version
    ).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La version {version} ya esta publicada para {plataforma}",
        )

    checksum = hashlib.sha256(contenido).hexdigest()
    ruta = f"{plataforma}/{version}-{uuid_lib.uuid4().hex[:8]}.zip"

    try:
        url = storage_supabase.subir_archivo(
            contenido, ruta, "application/zip", bucket=settings.SUPABASE_BUCKET_BUNDLES
        )
    except storage_supabase.SupabaseStorageError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    bundle = BundleApp(
        plataforma=plataforma,
        version=version,
        url=url,
        checksum=checksum,
        tamano_bytes=len(contenido),
        activo=True,
        notas=notas,
        fecha_creacion=datetime.utcnow(),
    )
    db.add(bundle)
    db.commit()
    db.refresh(bundle)

    return {
        "mensaje": f"Paquete {version} publicado para {plataforma}",
        "version": bundle.version,
        "checksum": bundle.checksum,
        "tamano_bytes": bundle.tamano_bytes,
        "url": bundle.url,
    }


# ============================================================================
# VER Y DESHACER (admin)
# ============================================================================

def _solo_admin(usuario: Usuario):
    tipo = getattr(usuario.tipo_usuario, "value", usuario.tipo_usuario)
    if str(tipo).lower() != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Solo un administrador puede hacer esto")


@router.get("/", summary="Paquetes publicados")
async def listar_bundles(
    plataforma: str = "ios",
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _solo_admin(current_user)
    bundles = (
        db.query(BundleApp)
        .filter(BundleApp.plataforma == plataforma)
        .order_by(BundleApp.fecha_creacion.desc())
        .limit(30)
        .all()
    )
    ultimo = _ultimo_bundle(db, plataforma)
    return [
        {
            "id": str(b.id),
            "version": b.version,
            "activo": b.activo,
            # El que se les esta entregando a los celulares ahora mismo
            "en_uso": bool(ultimo and ultimo.id == b.id),
            "tamano_bytes": b.tamano_bytes,
            "notas": b.notas,
            "fecha": b.fecha_creacion.isoformat() if b.fecha_creacion else None,
        }
        for b in bundles
    ]


@router.post("/{bundle_id}/desactivar", summary="Deshacer una actualizacion")
async def desactivar_bundle(
    bundle_id: uuid_lib.UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Saca un paquete de circulacion: el servidor vuelve a ofrecer el anterior.

    Los celulares que ya lo tenian se devuelven solos la proxima vez que
    pregunten, porque /check compara por diferencia y no por "mas nuevo".
    """
    _solo_admin(current_user)

    bundle = db.query(BundleApp).filter(BundleApp.id == bundle_id).first()
    if not bundle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paquete no encontrado")

    bundle.activo = False
    db.commit()

    nuevo = _ultimo_bundle(db, bundle.plataforma)
    return {
        "mensaje": f"Paquete {bundle.version} desactivado",
        "ahora_se_entrega": nuevo.version if nuevo else "ninguno (el frontend de fabrica)",
    }
