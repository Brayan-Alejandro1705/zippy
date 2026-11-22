# ============================================================================
# reglas.py - Interruptores del súper admin que se leen en muchos lados (nov 2026)
#
# - invitaciones: "Invita a un amigo" (domicilio gratis para los dos).
# - exigir_datos_negocio: el negocio sin ubicación, horario o días sale
#   cerrado para los clientes hasta que los complete.
#
# Se guardan en configuracion_sistema y se cachean 60 s en memoria, porque
# se consultan al listar negocios (Negocio.cerrado_aviso) y eso pasa a cada rato.
# ============================================================================

import time

from config import SessionLocal
from models import ConfiguracionSistema

CLAVES = {
    "invitaciones": ("invitaciones_activo", False, "Invita a un amigo: domicilio gratis para los dos"),
    "exigir_datos_negocio": ("exigir_datos_negocio", False, "Negocio sin ubicación u horario sale cerrado"),
}
_cache = {"t": 0.0, "valores": None}
SEGUNDOS_CACHE = 60


def _leer(db=None) -> dict:
    cerrar = db is None
    db = db or SessionLocal()
    try:
        filas = {f.clave: f.valor for f in db.query(ConfiguracionSistema).filter(
            ConfiguracionSistema.clave.in_([c[0] for c in CLAVES.values()])).all()}
        return {k: (str(filas[c]).lower() in ("1", "true") if c in filas else defecto)
                for k, (c, defecto, _) in CLAVES.items()}
    finally:
        if cerrar:
            db.close()


def todas(db=None, fresco=False) -> dict:
    ahora = time.monotonic()
    if fresco or _cache["valores"] is None or ahora - _cache["t"] > SEGUNDOS_CACHE:
        try:
            _cache["valores"] = _leer(db)
            _cache["t"] = ahora
        except Exception as e:
            print(f"[reglas] no se pudieron leer: {e}")
            if _cache["valores"] is None:
                return {k: d for k, (_, d, _) in CLAVES.items()}
    return dict(_cache["valores"])


def activa(nombre: str, db=None) -> bool:
    return bool(todas(db).get(nombre))


def guardar(db, cambios: dict) -> dict:
    for nombre, valor in cambios.items():
        if nombre not in CLAVES:
            continue
        clave, _, descripcion = CLAVES[nombre]
        fila = db.query(ConfiguracionSistema).filter(ConfiguracionSistema.clave == clave).first()
        if not fila:
            fila = ConfiguracionSistema(clave=clave, descripcion=descripcion, tipo_dato="bool")
            db.add(fila)
        fila.valor = "1" if valor else "0"
    db.commit()
    return todas(db, fresco=True)
