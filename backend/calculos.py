"""
calculos.py - El dinero se calcula en UN solo lugar.

Antes habia dos funciones distintas sumando totales: una en routes_ordenes.py
y otra en routes_carrito.py. La del carrito no incluia el domicilio, asi que
el cliente veia un total en el carrito y otro al pagar.

Cuando la misma cuenta vive en dos archivos, tarde o temprano se separan:
alguien arregla uno y olvida el otro. Por eso todo lo que sume plata pasa por
aqui.
"""

import json
import math
from decimal import Decimal

from sqlalchemy.orm import Session

from config import settings
from models import ConfiguracionSistema

# Clave en configuracion_sistema, la misma que usa el panel de administracion.
CLAVE_DOMICILIO = "costo_domicilio"

# Oct 2026: domicilio por zonas (anillos alrededor del centro de Garzon).
# Se guarda como JSON en configuracion_sistema:
#   {"activo": true, "centro": {"lat": .., "lng": ..},
#    "zonas": [{"nombre": "Garzón", "hasta_km": 1.6, "precio": 4000}, ...]}
# Las zonas van de la mas cercana a la mas lejana. Mas alla de la ultima, no
# se entrega. Con "activo" en false se sigue cobrando el precio unico.
CLAVE_ZONAS = "zonas_domicilio"
# Parque principal de Garzon (el mismo punto que usa el mapa de la app)
CENTRO_GARZON = {"lat": 2.1974, "lng": -75.6246}
MAX_ZONAS = 8


def costo_domicilio(db: Session) -> Decimal:
    """Costo del domicilio, tal como lo dejo el administrador.

    Vive en la base de datos para que se pueda cambiar desde el panel sin
    tocar codigo. Si aun no lo han configurado, o si quedo guardado algo
    invalido, se usa el respaldo de config.py: una venta nunca debe fallar
    por un dato mal escrito en una tabla de configuracion.
    """
    try:
        fila = db.query(ConfiguracionSistema).filter(
            ConfiguracionSistema.clave == CLAVE_DOMICILIO
        ).first()
        if fila and fila.valor:
            return Decimal(str(fila.valor))
    except Exception:
        pass

    return Decimal(str(settings.COSTO_DOMICILIO_BASE))


def distancia_km(lat1, lng1, lat2, lng2) -> float:
    """Distancia en linea recta entre dos puntos (formula del haversine)."""
    r = 6371.0
    p1, p2 = math.radians(float(lat1)), math.radians(float(lat2))
    dp = p2 - p1
    dl = math.radians(float(lng2) - float(lng1))
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def validar_zonas(datos: dict) -> dict:
    """Revisa y limpia la configuracion de zonas. Lanza ValueError con un
    mensaje para el administrador si algo no tiene sentido."""
    if not isinstance(datos, dict):
        raise ValueError("Configuración de zonas inválida")

    centro = datos.get("centro") or CENTRO_GARZON
    try:
        lat, lng = float(centro["lat"]), float(centro["lng"])
    except (KeyError, TypeError, ValueError):
        raise ValueError("El centro de las zonas no es válido")
    # Colombia, con margen: un centro fuera de esto es un dedazo
    if not (-5 <= lat <= 14 and -82 <= lng <= -66):
        raise ValueError("El centro tiene que quedar en Colombia")

    zonas = []
    anterior = 0.0
    for i, z in enumerate(datos.get("zonas") or []):
        try:
            hasta = round(float(str(z.get("hasta_km")).replace(",", ".")), 2)
            precio = int(round(float(str(z.get("precio")).replace(".", "").replace(",", "."))))
        except (TypeError, ValueError, AttributeError):
            raise ValueError(f"Revisa los números de la zona {i + 1}")
        nombre = str(z.get("nombre") or f"Zona {i + 1}").strip()[:30] or f"Zona {i + 1}"
        if not 0.1 <= hasta <= 60:
            raise ValueError(f"La zona {i + 1} debe llegar entre 0,1 y 60 km")
        if hasta <= anterior:
            raise ValueError(f"La zona {i + 1} tiene que llegar más lejos que la anterior ({anterior:g} km)")
        if not 0 <= precio <= 100000:
            raise ValueError(f"El precio de la zona {i + 1} debe estar entre $0 y $100.000")
        zonas.append({"nombre": nombre, "hasta_km": hasta, "precio": precio})
        anterior = hasta

    if len(zonas) > MAX_ZONAS:
        raise ValueError(f"Máximo {MAX_ZONAS} zonas")
    activo = bool(datos.get("activo"))
    if activo and not zonas:
        raise ValueError("Agrega al menos una zona para cobrar por zonas")

    return {"activo": activo, "centro": {"lat": lat, "lng": lng}, "zonas": zonas}


def leer_zonas(db: Session) -> dict:
    """Configuracion de zonas guardada. Si no hay, o quedo danada, se
    devuelve apagada: una venta nunca debe fallar por un dato mal guardado."""
    try:
        fila = db.query(ConfiguracionSistema).filter(
            ConfiguracionSistema.clave == CLAVE_ZONAS
        ).first()
        if fila and fila.valor:
            return validar_zonas(json.loads(fila.valor))
    except Exception:
        pass
    return {"activo": False, "centro": dict(CENTRO_GARZON), "zonas": []}


def cotizar_domicilio(db: Session, lat=None, lng=None) -> dict:
    """Cuanto cuesta el domicilio a un punto.

    Devuelve siempre un dict con:
      costo       Decimal o None (None si no se puede entregar alli)
      por_zonas   si se esta cobrando por zonas
      zona, km    nombre de la zona y distancia al centro (si aplica)
      sin_punto   la direccion no tiene punto en el mapa (con zonas no se sabe el precio)
      fuera       queda mas lejos que la ultima zona
      max_km      hasta donde se entrega
    """
    cfg = leer_zonas(db)
    if not cfg["activo"] or not cfg["zonas"]:
        return {"costo": costo_domicilio(db), "por_zonas": False, "zona": None, "km": None,
                "sin_punto": False, "fuera": False, "max_km": None}

    max_km = cfg["zonas"][-1]["hasta_km"]
    base = {"por_zonas": True, "max_km": max_km}
    if lat is None or lng is None:
        return {**base, "costo": None, "zona": None, "km": None, "sin_punto": True, "fuera": False}

    km = round(distancia_km(cfg["centro"]["lat"], cfg["centro"]["lng"], lat, lng), 1)
    for z in cfg["zonas"]:
        if km <= z["hasta_km"]:
            return {**base, "costo": Decimal(z["precio"]), "zona": z["nombre"], "km": km,
                    "sin_punto": False, "fuera": False}
    return {**base, "costo": None, "zona": None, "km": km, "sin_punto": False, "fuera": True}


def domicilio_minimo(db: Session) -> Decimal:
    """Lo menos que puede costar un domicilio: el precio unico, o el de la
    primera zona. Es lo que muestra el carrito antes de saber la direccion."""
    cfg = leer_zonas(db)
    if cfg["activo"] and cfg["zonas"]:
        return Decimal(min(z["precio"] for z in cfg["zonas"]))
    return costo_domicilio(db)


def desglose(subtotal: Decimal, db: Session, con_domicilio: bool = True) -> dict:
    """Calcula impuesto, domicilio y total a partir del subtotal.

    con_domicilio=False sirve para mostrar un subtotal sin envio, por ejemplo
    si algun dia se agrega la opcion de recoger en el local.
    """
    subtotal = Decimal(str(subtotal))
    impuesto = subtotal * (Decimal(str(settings.IMPUESTO_IVA)) / 100)
    # El carrito no sabe todavia a donde va el pedido: con zonas muestra el
    # minimo; el precio real lo pone la orden con el punto del cliente.
    domicilio = domicilio_minimo(db) if con_domicilio else Decimal(0)

    return {
        "subtotal": subtotal,
        "impuesto": impuesto,
        "costo_domicilio": domicilio,
        "total": subtotal + impuesto + domicilio,
    }
