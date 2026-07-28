# ============================================================================
# storage_supabase.py — Sube archivos a Supabase Storage (bucket público).
#
# Reemplaza el guardado en disco local de routes_productos.py: el disco de
# Render (plan free) se borra en cada redeploy o reinicio del servicio, asi
# que las imagenes de producto "desaparecian" con cada push a main. Supabase
# Storage vive en un proyecto aparte y persiste sin importar el backend.
#
# Usa solo la libreria estandar (urllib) a proposito: agregar el SDK oficial
# de supabase-py trae dependencias nuevas para instalar, y ya tuvimos
# suficiente dolor de cabeza con paquetes que compilan C/Rust en Windows.
# ============================================================================

import urllib.request
import urllib.error

from config import settings


class SupabaseStorageError(Exception):
    pass


def subir_archivo(contenido: bytes, ruta_archivo: str, content_type: str) -> str:
    """
    Sube 'contenido' (bytes) al bucket configurado, en la ruta 'ruta_archivo'
    (ej. 'abc123.jpg'). Devuelve la URL publica del archivo.

    Requiere que el bucket exista y este marcado como publico en Supabase.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise SupabaseStorageError(
            "Supabase Storage no esta configurado (falta SUPABASE_URL o "
            "SUPABASE_SERVICE_KEY en las variables de entorno)."
        )

    base = settings.SUPABASE_URL.rstrip("/")
    bucket = settings.SUPABASE_BUCKET_PRODUCTOS
    upload_url = f"{base}/storage/v1/object/{bucket}/{ruta_archivo}"

    request = urllib.request.Request(
        upload_url,
        data=contenido,
        method="POST",
        headers={
            "apikey": settings.SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
            "Content-Type": content_type,
            # Si ya existiera un archivo con el mismo nombre (no deberia,
            # usamos uuid4), lo sobreescribe en vez de fallar.
            "x-upsert": "true",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as resp:
            if resp.status not in (200, 201):
                raise SupabaseStorageError(
                    f"Supabase Storage respondio {resp.status} al subir la imagen."
                )
    except urllib.error.HTTPError as e:
        detalle = e.read().decode("utf-8", errors="replace")
        raise SupabaseStorageError(
            f"Error subiendo imagen a Supabase Storage ({e.code}): {detalle}"
        )
    except urllib.error.URLError as e:
        raise SupabaseStorageError(f"No se pudo conectar a Supabase Storage: {e.reason}")

    return f"{base}/storage/v1/object/public/{bucket}/{ruta_archivo}"