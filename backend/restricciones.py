# ============================================================================
# restricciones.py - Productos restringidos (tabaco y alcohol)
#
# Tabaco: Apple (guia 1.4.3) no permite apps que faciliten la venta de
# cigarrillos, vapeadores ni productos con nicotina. Se bloquean al crear o
# editar un producto para que ningun vendedor pueda publicarlos.
#
# Alcohol: se permite, pero el cliente debe confirmar que es mayor de 18 anos
# antes de pedir (ley colombiana y politica de Apple/Google).
# ============================================================================

import re
import unicodedata

CATEGORIAS_ALCOHOL = {
    "cerveza", "aguardiente y ron", "whisky y otros licores", "vinos", "licores",
}

_TABACO = re.compile(
    r"\b(cigarr\w*|tabac\w*|vape\w*|vaper\w*|nicotin\w*|narguil\w*|hookah|"
    r"marlboro|pielroja|belmont|lucky strike|e-cig\w*|iqos|juul)\b"
)

_ALCOHOL = re.compile(
    r"\b(cervez\w*|aguardiente\w*|ron|rones|whisk\w*|vino|vinos|vodka|tequila|"
    r"ginebra|gin|licor|licores|brandy|champa\w*|sangria|mezcal|anisado)\b"
)


def _normalizar(texto) -> str:
    if not texto:
        return ""
    t = unicodedata.normalize("NFD", str(texto).lower())
    return "".join(c for c in t if unicodedata.category(c) != "Mn")


def es_tabaco(*textos) -> bool:
    return any(_TABACO.search(_normalizar(t)) for t in textos if t)


MENSAJE_TABACO = (
    "ZIPPYGO no permite vender cigarrillos, tabaco, vapeadores ni productos "
    "con nicotina. Quita esa referencia del nombre, la descripcion o la categoria."
)


def es_alcohol(producto, negocio=None) -> bool:
    if negocio is not None and _normalizar(getattr(negocio, "categoria", "")) == "licorera":
        return True
    if _normalizar(getattr(producto, "categoria", "")) in CATEGORIAS_ALCOHOL:
        return True
    return bool(_ALCOHOL.search(_normalizar(getattr(producto, "nombre", ""))))


MENSAJE_EDAD = (
    "Tu pedido tiene bebidas alcoholicas. Confirma que eres mayor de 18 anos "
    "para continuar."
)
