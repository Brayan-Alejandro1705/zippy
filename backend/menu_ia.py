# ============================================================================
# menu_ia.py - Lee la foto de un menú con Gemini y arma la lista de productos
# (oct 2026).
#
# El negocio le toma foto a su carta y aquí se le pide a Gemini que devuelva
# los productos con nombre, precio, descripción corta y categoría. NO se crea
# nada: el resultado es un borrador que el negocio revisa y corrige antes de
# publicar (VendorMenuFotoPage).
#
# Usa la API REST de Gemini con urllib, sin SDK, como storage_supabase.py.
# La clave vive en la variable de entorno GEMINI_API_KEY (Render).
# ============================================================================

import base64
import io
import json
import os
import urllib.error
import urllib.request

from PIL import Image, ImageOps

MODELO = os.getenv("GEMINI_MODELO", "gemini-2.5-flash")
URL = "https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent"

# Una foto de menú se lee bien a 1600 px; más grande solo gasta datos
LADO_MAXIMO = 1600
MAX_FOTOS = 4
# Recortes de los platos que salen en la carta: a este tamaño bastan para la
# tarjeta del producto y la respuesta no se vuelve pesada
LADO_RECORTE = 640


class MenuIAError(Exception):
    """Algo falló y hay que decírselo al negocio con este mensaje."""


def _clave() -> str:
    return (os.getenv("GEMINI_API_KEY") or "").strip()


def disponible() -> bool:
    return bool(_clave())


def _preparar(contenido: bytes):
    """Devuelve (imagen PIL ya girada y achicada, la misma en base64 para Gemini)."""
    try:
        img = Image.open(io.BytesIO(contenido))
        img.load()
    except Exception:
        raise MenuIAError("Una de las fotos no es una imagen válida")
    img = ImageOps.exif_transpose(img).convert("RGB")
    img.thumbnail((LADO_MAXIMO, LADO_MAXIMO), Image.LANCZOS)
    salida = io.BytesIO()
    img.save(salida, "JPEG", quality=85)
    return img, base64.b64encode(salida.getvalue()).decode()


def _recortar(img, caja):
    """Recorta la foto de un plato. caja = [ymin, xmin, ymax, xmax] de 0 a 1000,
    como las da Gemini. Devuelve un data URL JPEG o None si la caja no sirve."""
    try:
        y0, x0, y1, x1 = [max(0, min(1000, int(v))) for v in caja]
    except (TypeError, ValueError):
        return None
    if y1 <= y0 or x1 <= x0:
        return None
    alto, ancho = (y1 - y0) / 1000, (x1 - x0) / 1000
    # Muy chiquita (un ícono o una letra), casi toda la página (no es la foto
    # de un plato) o demasiado alargada: mejor sin foto que con una mala
    if alto < 0.05 or ancho < 0.05 or alto * ancho > 0.5:
        return None
    w, h = img.size
    proporcion = (ancho * w) / (alto * h)
    if proporcion < 0.4 or proporcion > 2.5:
        return None
    # Un poquito de margen: Gemini a veces corta el borde del plato
    m = 0.02
    caja_px = (
        int(max(0, x0 / 1000 - m) * w), int(max(0, y0 / 1000 - m) * h),
        int(min(1, x1 / 1000 + m) * w), int(min(1, y1 / 1000 + m) * h),
    )
    recorte = img.crop(caja_px)
    recorte.thumbnail((LADO_RECORTE, LADO_RECORTE), Image.LANCZOS)
    salida = io.BytesIO()
    recorte.save(salida, "JPEG", quality=82)
    return "data:image/jpeg;base64," + base64.b64encode(salida.getvalue()).decode()


_ESQUEMA = {
    "type": "OBJECT",
    "properties": {
        "productos": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "nombre": {"type": "STRING"},
                    "precio": {"type": "INTEGER"},
                    "descripcion": {"type": "STRING"},
                    "categoria": {"type": "STRING"},
                    "seguro": {"type": "BOOLEAN"},
                    # Si la carta trae la foto del plato: en qué página y dónde
                    "pagina": {"type": "INTEGER"},
                    "foto": {"type": "ARRAY", "items": {"type": "INTEGER"}},
                },
                "required": ["nombre", "precio", "categoria", "seguro"],
            },
        }
    },
    "required": ["productos"],
}


def _instrucciones(categorias: list) -> str:
    lista = ", ".join(categorias) if categorias else "General"
    return (
        "Eres un asistente que pasa a una lista los productos del menú o la lista de precios "
        "de un negocio de Garzón, Huila (Colombia). Lee TODAS las fotos.\n"
        "Reglas:\n"
        "- Un producto por cada cosa que se vende con su precio. Si un producto tiene tamaños "
        "o versiones con precio distinto (sencilla/doble, personal/familiar), cada una es un producto aparte "
        "con un nombre claro, por ejemplo 'Pizza hawaiana personal'.\n"
        "- Nombre completo y entendible: si el producto está debajo de un título como 'HAMBURGUESAS' "
        "y solo dice 'Sencilla', el nombre es 'Hamburguesa sencilla'. Primera letra en mayúscula, el resto normal.\n"
        "- precio: en pesos colombianos, número entero sin puntos (12.000 o 12 mil = 12000). "
        "Si en el menú dice '12' en una carta de comidas, casi seguro son 12000.\n"
        "- descripcion: corta (máximo 15 palabras) solo si el menú dice qué trae; si no, deja vacío.\n"
        f"- categoria: escoge EXACTAMENTE una de esta lista: {lista}.\n"
        "- seguro: false si no se leía bien el nombre o el precio (borroso, tapado, escrito raro); true si estás seguro.\n"
        "- foto: SOLO si en la carta hay una fotografía o imagen de ESE producto, da su recuadro como "
        "[ymin, xmin, ymax, xmax] con valores de 0 a 1000 sobre esa página, y en pagina el número de la foto "
        "(la primera es 1). Si el producto no tiene su propia imagen, deja foto vacía. Nunca le pongas a un "
        "producto la imagen de otro, ni un logo, ni un fondo decorativo.\n"
        "- No inventes productos ni precios. No incluyas títulos, horarios, teléfonos, direcciones ni promociones sin precio.\n"
        "- Si en las fotos no hay ningún menú o lista de precios, devuelve la lista vacía."
    )


def leer_menu(fotos: list, categorias: list) -> list:
    """fotos: lista de bytes. Devuelve [{nombre, precio, descripcion, categoria, seguro}]."""
    clave = _clave()
    if not clave:
        raise MenuIAError("La lectura de menús todavía no está activada")
    if not fotos:
        raise MenuIAError("Toma al menos una foto del menú")

    partes = [{"text": _instrucciones(categorias)}]
    paginas = []
    for contenido in fotos[:MAX_FOTOS]:
        img, datos = _preparar(contenido)
        paginas.append(img)
        partes.append({"inline_data": {"mime_type": "image/jpeg", "data": datos}})

    cuerpo = {
        "contents": [{"role": "user", "parts": partes}],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
            "responseSchema": _ESQUEMA,
            # Leer un menú no necesita "pensar": sale más rápido y más barato
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    req = urllib.request.Request(
        URL.format(modelo=MODELO),
        data=json.dumps(cuerpo).encode(),
        method="POST",
        headers={"Content-Type": "application/json", "x-goog-api-key": clave},
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            respuesta = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        detalle = e.read().decode("utf-8", errors="replace")[:300]
        print(f"[menu_ia] Gemini respondió {e.code}: {detalle}")
        if e.code == 429:
            raise MenuIAError("Hay muchos menús leyéndose en este momento. Intenta de nuevo en unos minutos.")
        raise MenuIAError("No pudimos leer el menú ahora. Intenta de nuevo en un rato.")
    except Exception as e:
        print(f"[menu_ia] no se pudo hablar con Gemini: {e}")
        raise MenuIAError("No pudimos leer el menú ahora. Revisa tu señal e intenta de nuevo.")

    try:
        texto = respuesta["candidates"][0]["content"]["parts"][0]["text"]
        crudos = json.loads(texto).get("productos", [])
    except Exception:
        print(f"[menu_ia] respuesta rara de Gemini: {str(respuesta)[:300]}")
        raise MenuIAError("No pudimos entender el menú. Prueba con una foto más clara y de frente.")

    validas = set(categorias or [])
    productos = []
    vistos = set()
    for p in crudos:
        nombre = str(p.get("nombre") or "").strip()[:255]
        try:
            precio = int(p.get("precio") or 0)
        except (TypeError, ValueError):
            precio = 0
        if not nombre:
            continue
        clave_dup = (nombre.lower(), precio)
        if clave_dup in vistos:
            continue
        vistos.add(clave_dup)
        categoria = str(p.get("categoria") or "").strip()
        if validas and categoria not in validas:
            categoria = categorias[0]
        seguro = bool(p.get("seguro", True))
        # Precios que no tienen sentido en pesos: se dejan pero marcados para revisar
        if precio < 100:
            seguro = False
        foto = None
        caja = p.get("foto")
        if isinstance(caja, list) and len(caja) == 4:
            try:
                n = int(p.get("pagina") or 1)
            except (TypeError, ValueError):
                n = 1
            if 1 <= n <= len(paginas):
                foto = _recortar(paginas[n - 1], caja)
        productos.append({
            "foto": foto,
            "nombre": nombre,
            "precio": precio,
            "descripcion": str(p.get("descripcion") or "").strip()[:300],
            "categoria": categoria,
            "seguro": seguro,
        })
    return productos
