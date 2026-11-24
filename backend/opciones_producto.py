# ============================================================================
# opciones_producto.py - Tamaños y "con o sin licor" (nov 2026)
#
# Solo para negocios de la categoría "Granizados": en vez de tener el mismo
# sabor repetido cuatro veces (10 oz, 20 oz, con licor, sin licor), es un solo
# producto con opciones. Producto.opciones (JSON):
#   {"tamanos": [{"nombre": "10 oz", "precio": 10000}, {"nombre": "20 oz", "precio": 15000}],
#    "con_licor": true,          # el producto lleva licor (pide mayoría de edad)
#    "sin_licor": 1000}          # se puede pedir sin licor y cuesta 1.000 menos (null = no)
# El cliente manda en cada item: {"tamano": "20 oz", "sin_licor": false}.
# El precio lo calcula SIEMPRE el servidor con lo guardado en el producto.
# ============================================================================

import unicodedata
from decimal import Decimal

from fastapi import HTTPException

CATEGORIA = "granizados"
MAX_TAMANOS = 4


def _norm(texto) -> str:
    t = unicodedata.normalize("NFD", str(texto or "").strip().lower())
    return "".join(c for c in t if unicodedata.category(c) != "Mn")


def es_granizados(negocio) -> bool:
    return negocio is not None and _norm(getattr(negocio, "categoria", "")) == CATEGORIA


def limpiar(opciones) -> dict:
    """Valida lo que manda el negocio. Devuelve None si no hay tamaños."""
    if not opciones or not isinstance(opciones, dict):
        return None
    tamanos = []
    for t in (opciones.get("tamanos") or [])[:MAX_TAMANOS]:
        nombre = str((t or {}).get("nombre") or "").strip()[:20]
        try:
            precio = int(float((t or {}).get("precio") or 0))
        except (TypeError, ValueError):
            precio = 0
        if not nombre:
            continue
        if precio < 500:
            raise HTTPException(status_code=400, detail=f"Escribe el precio del tamaño {nombre}")
        tamanos.append({"nombre": nombre, "precio": precio})
    if not tamanos:
        return None
    sin_licor = opciones.get("sin_licor")
    try:
        sin_licor = None if sin_licor in (None, "", False) else max(0, int(float(sin_licor)))
    except (TypeError, ValueError):
        sin_licor = None
    con_licor = bool(opciones.get("con_licor")) or sin_licor is not None
    return {"tamanos": tamanos, "con_licor": con_licor, "sin_licor": sin_licor if con_licor else None}


def precio_minimo(opciones) -> int:
    return min(t["precio"] for t in opciones["tamanos"])


def aplicar(producto, elegidas) -> tuple:
    """(precio_base, copia_para_guardar, lleva_licor) de un item del pedido."""
    op = getattr(producto, "opciones", None) or {}
    tamanos = op.get("tamanos") or []
    if not tamanos:
        return producto.precio, None, None
    elegidas = elegidas or {}
    nombre = str(elegidas.get("tamano") or "").strip()
    tamano = next((t for t in tamanos if t["nombre"] == nombre), None) or tamanos[0]
    precio = Decimal(tamano["precio"])
    copia = {"tamano": tamano["nombre"]}
    licor = None
    if op.get("con_licor"):
        sin = bool(elegidas.get("sin_licor")) and op.get("sin_licor") is not None
        if sin:
            precio -= Decimal(op["sin_licor"])
        copia["licor"] = "Sin licor" if sin else "Con licor"
        licor = not sin
    return max(precio, Decimal(0)), copia, licor
