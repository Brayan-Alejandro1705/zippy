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


def subir_archivo(contenido: bytes, ruta_archivo: str, content_type: str, bucket: str = None,
                  cache: str = None) -> str:
    """
    Sube 'contenido' (bytes) al bucket indicado, en la ruta 'ruta_archivo'
    (ej. 'abc123.jpg'). Devuelve la URL publica del archivo.

    Si no se indica bucket, usa el de productos (como siempre). El parametro
    se agrego para guardar tambien los paquetes de actualizacion del iPhone
    en su propio bucket, sin mezclarlos con las fotos.

    Requiere que el bucket exista y este marcado como publico en Supabase.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise SupabaseStorageError(
            "Supabase Storage no esta configurado (falta SUPABASE_URL o "
            "SUPABASE_SERVICE_KEY en las variables de entorno)."
        )

    base = settings.SUPABASE_URL.rstrip("/")
    bucket = bucket or settings.SUPABASE_BUCKET_PRODUCTOS
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
            # Oct 2026: las fotos tienen nombre unico (uuid) y nunca cambian,
            # asi que el celular puede guardarlas un año. Sin esto Supabase
            # respondia "no-cache" y el celular las volvia a pedir cada vez.
            **({"cache-control": cache} if cache else {}),
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as resp:
            if resp.status not in (200, 201):
                raise SupabaseStorageError(
                    f"Supabase Storage respondio {resp.status} al subir el archivo."
                )
    except urllib.error.HTTPError as e:
        detalle = e.read().decode("utf-8", errors="replace")
        raise SupabaseStorageError(
            f"Error subiendo archivo a Supabase Storage ({e.code}): {detalle}"
        )
    except urllib.error.URLError as e:
        raise SupabaseStorageError(f"No se pudo conectar a Supabase Storage: {e.reason}")

    return f"{base}/storage/v1/object/public/{bucket}/{ruta_archivo}"

# ============================================================================
# Documentos privados (oct 2026): cédula, licencia, SOAT... de los conductores.
#
# Esos NO pueden ir a un bucket público como las fotos de productos: cualquiera
# con el enlace los vería. Van a un bucket privado y solo el súper admin los ve,
# con un enlace firmado que vence a los pocos minutos.
# ============================================================================

def _cabeceras(content_type: str = "application/json") -> dict:
    return {
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "Content-Type": content_type,
    }


def _crear_bucket_privado(bucket: str) -> None:
    import json
    base = settings.SUPABASE_URL.rstrip("/")
    req = urllib.request.Request(
        f"{base}/storage/v1/bucket", method="POST", headers=_cabeceras(),
        data=json.dumps({"id": bucket, "name": bucket, "public": False}).encode(),
    )
    try:
        with urllib.request.urlopen(req, timeout=20):
            pass
    except urllib.error.HTTPError as e:
        detalle = e.read().decode("utf-8", errors="replace")
        if "already exists" not in detalle.lower() and e.code != 409:
            raise SupabaseStorageError(f"No se pudo crear el bucket privado ({e.code}): {detalle}")


def subir_privado(contenido: bytes, ruta_archivo: str, content_type: str, bucket: str) -> str:
    """Sube a un bucket PRIVADO (lo crea la primera vez). Devuelve la ruta
    dentro del bucket, no una URL: para verlo hay que pedir url_firmada()."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise SupabaseStorageError("Supabase Storage no esta configurado.")
    base = settings.SUPABASE_URL.rstrip("/")
    for intento in (1, 2):
        req = urllib.request.Request(
            f"{base}/storage/v1/object/{bucket}/{ruta_archivo}", data=contenido, method="POST",
            headers={**_cabeceras(content_type), "x-upsert": "true"},
        )
        try:
            with urllib.request.urlopen(req, timeout=30):
                return ruta_archivo
        except urllib.error.HTTPError as e:
            detalle = e.read().decode("utf-8", errors="replace")
            if intento == 1 and ("bucket" in detalle.lower() and "not found" in detalle.lower()):
                _crear_bucket_privado(bucket)
                continue
            raise SupabaseStorageError(f"Error subiendo documento ({e.code}): {detalle}")
        except urllib.error.URLError as e:
            raise SupabaseStorageError(f"No se pudo conectar a Supabase Storage: {e.reason}")
    raise SupabaseStorageError("No se pudo subir el documento")


def url_firmada(bucket: str, ruta_archivo: str, segundos: int = 900) -> str:
    """Enlace temporal para ver un archivo de un bucket privado."""
    import json
    base = settings.SUPABASE_URL.rstrip("/")
    req = urllib.request.Request(
        f"{base}/storage/v1/object/sign/{bucket}/{ruta_archivo}", method="POST", headers=_cabeceras(),
        data=json.dumps({"expiresIn": segundos}).encode(),
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            datos = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise SupabaseStorageError(f"No se pudo firmar el enlace ({e.code})")
    firmada = datos.get("signedURL") or datos.get("signedUrl") or ""
    if firmada.startswith("http"):
        return firmada
    return f"{base}/storage/v1{firmada}"
