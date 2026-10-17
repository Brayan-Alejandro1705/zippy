# ============================================================================
# imagenes.py - Comprime las fotos antes de guardarlas (oct 2026).
#
# Antes las fotos se guardaban tal cual las subia el negocio: habia de 2-3 MB
# (2400 px, PNG). La pantalla de un celular mide unos 1080 px, asi que el
# cliente bajaba megas de datos que nunca se veian, y el plan gratis de
# Supabase (5 GB de descarga al mes) se iba a acabar rapido.
#
# Ahora cada foto se guarda en dos tamaños, en WebP:
#   - grande (-g.webp): hasta 1200 px. Se ve al abrir el producto.
#   - mini   (-m.webp): hasta 480 px. Es la de las listas y la tienda.
# El frontend saca la URL de la mini cambiando "-g.webp" por "-m.webp"
# (ver frontend/src/utils/media.js).
# ============================================================================
import io

from PIL import Image, ImageOps

LADO_GRANDE = 1200
LADO_MINI = 480
CALIDAD_GRANDE = 80
CALIDAD_MINI = 75
# Un año: los nombres son unicos y una foto guardada nunca cambia
CACHE = "max-age=31536000"


class ImagenInvalida(Exception):
    pass


def _a_webp(img: Image.Image, lado: int, calidad: int) -> bytes:
    copia = img.copy()
    copia.thumbnail((lado, lado), Image.LANCZOS)   # nunca agranda, solo achica
    salida = io.BytesIO()
    copia.save(salida, "WEBP", quality=calidad, method=6)
    return salida.getvalue()


def procesar(contenido: bytes) -> tuple:
    """Devuelve (grande, mini) en bytes WebP. Lanza ImagenInvalida si no es
    una imagen que se pueda abrir."""
    try:
        img = Image.open(io.BytesIO(contenido))
        img.load()
    except Exception as e:
        raise ImagenInvalida(f"No se pudo leer la imagen: {e}")

    # Las fotos del celular traen la orientacion aparte (EXIF): sin esto
    # algunas quedarian acostadas.
    img = ImageOps.exif_transpose(img)

    # WebP guarda transparencia (logos en PNG), asi que se respeta si la hay
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        img = img.convert("RGBA")
    else:
        img = img.convert("RGB")

    return _a_webp(img, LADO_GRANDE, CALIDAD_GRANDE), _a_webp(img, LADO_MINI, CALIDAD_MINI)
