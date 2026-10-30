# ============================================================================
# routes_viajes.py - Viajes en moto y en carro (oct 2026)
#
# ZIPPYGO solo CONECTA al pasajero con un conductor independiente:
#   - El conductor no es empleado de ZIPPYGO. Lo registra un súper admin
#     después de revisar sus documentos (licencia, SOAT, tecnomecánica).
#   - ZIPPYGO no fija la tarifa ni cobra el viaje: el conductor pone el precio
#     al aceptar y el pasajero se lo paga directo a él.
#   - El conductor paga una mensualidad por aparecer en la app (pagado_hasta).
#
# Hay dos tipos de viaje, MOTO y CARRO, y cada uno se enciende por aparte en
# Súper admin -> Viajes. Los dos arrancan APAGADOS. Cada conductor es de un
# solo tipo y solo recibe viajes de ese tipo.
#
# Estados del viaje:
#   buscando -> aceptado -> llego -> en_viaje -> terminado
#   (y cancelado desde buscando, aceptado o llego)
# ============================================================================

from datetime import datetime, timedelta, date
from typing import Optional
from uuid import UUID

import uuid

from fastapi import APIRouter, Depends, HTTPException, status, Request, Form, File, UploadFile
from sqlalchemy.orm import Session

from config import get_db
from models import Usuario, EstadoUsuario, ConfiguracionSistema, ConductorMoto, ViajeMoto
from routes_auth import get_current_user, hash_password, create_access_token, create_refresh_token
from schemas import UsuarioResponse
from validators import validar_correo
from storage_supabase import subir_privado, url_firmada, SupabaseStorageError
from rate_limit import limiter
import imagenes
from push import notificar_usuario, notificar_usuarios
from calculos import distancia_km
from logs_utils import registrar_log

router = APIRouter(prefix="/api/v1/viajes", tags=["Viajes en moto"])

TIPOS = ("moto", "carro")
CLAVE_ACTIVO = {"moto": "viajes_moto_activo", "carro": "viajes_carro_activo"}
NOMBRE = {"moto": "moto", "carro": "carro"}

# Estados en los que el viaje sigue vivo
ACTIVOS = ("buscando", "aceptado", "llego", "en_viaje")

# Si en este tiempo ningún conductor lo toma, la búsqueda se cierra sola
MINUTOS_BUSQUEDA = 10

# Un conductor que se puso "en línea" y se olvidó de apagarlo deja de
# contar después de este tiempo sin abrir la app.
HORAS_EN_LINEA = 12

PRECIO_MINIMO = 2000
PRECIO_MAXIMO = 100000

# Colombia va cinco horas atrás de la hora universal y no cambia en el año
HORAS_COLOMBIA = 5


# ============================================================================
# AYUDAS
# ============================================================================

def _tipo(usuario: Usuario) -> str:
    t = usuario.tipo_usuario
    return (t.value if hasattr(t, "value") else str(t)).lower()


def _estado_usuario(usuario: Usuario) -> str:
    e = usuario.estado
    return (e.value if hasattr(e, "value") else str(e)).lower()


def _hoy_colombia() -> date:
    return (datetime.utcnow() - timedelta(hours=HORAS_COLOMBIA)).date()


def _inicio_hoy_utc() -> datetime:
    """Medianoche de hoy en Colombia, expresada en hora universal."""
    hoy = _hoy_colombia()
    return datetime(hoy.year, hoy.month, hoy.day) + timedelta(hours=HORAS_COLOMBIA)


def _fecha_txt(d: Optional[date]) -> str:
    return d.strftime("%d/%m/%Y") if d else ""


def _tipo_de(valor) -> str:
    t = str(valor or "moto").lower()
    return t if t in TIPOS else "moto"


def _servicio_activo(db: Session, tipo: str = None) -> bool:
    """Si ese tipo está encendido. Sin tipo: si al menos uno lo está."""
    tipos = (tipo,) if tipo else TIPOS
    for t in tipos:
        fila = db.query(ConfiguracionSistema).filter(ConfiguracionSistema.clave == CLAVE_ACTIVO[t]).first()
        if fila and str(fila.valor).lower() == "true":
            return True
    return False


def _perfil(db: Session, usuario_id) -> Optional[ConductorMoto]:
    return db.query(ConductorMoto).filter(ConductorMoto.usuario_id == usuario_id).first()


def _problemas(perfil: Optional[ConductorMoto], usuario: Usuario) -> list:
    """Lo que le impide al conductor recibir viajes. Vacío = puede trabajar."""
    if not perfil:
        return ["Falta registrar los datos del vehículo"]
    # Inscrito desde la app y todavía sin revisar: eso es lo único que se le dice
    if perfil.estado_inscripcion == "pendiente":
        return ["Tu inscripción está en revisión. Te avisamos apenas la aprueben."]
    if perfil.estado_inscripcion == "rechazado":
        return [f"Tu inscripción no fue aprobada: {perfil.motivo_rechazo or 'escríbenos para saber por qué'}"]
    hoy = _hoy_colombia()
    problemas = []
    if _estado_usuario(usuario) != "activo":
        problemas.append("La cuenta está suspendida")
    # (nombre, fecha, obligatorio, es femenino) para que los textos queden bien escritos
    documentos = [
        ("Licencia", perfil.licencia_vence, True, True),
        ("SOAT", perfil.soat_vence, True, False),
        ("Tecnomecánica", perfil.tecnomecanica_vence, False, True),
    ]
    # Solo si es taxi y la anotó: entonces cuenta que no esté vencida
    if perfil.tarjeta_operacion_vence:
        documentos.append(("Tarjeta de operación", perfil.tarjeta_operacion_vence, False, True))
    for nombre, vence, obligatorio, femenino in documentos:
        if vence is None:
            if obligatorio:
                problemas.append(f"Falta la fecha de vencimiento {'de la' if femenino else 'del'} {nombre if nombre == 'SOAT' else nombre.lower()}")
        elif vence < hoy:
            problemas.append(f"{nombre} {'vencida' if femenino else 'vencido'} el {_fecha_txt(vence)}")
    # Mensualidad: mientras el súper admin no le ponga fecha, todavía no se le
    # cobra y puede trabajar. Si ya tiene fecha y se pasó, queda bloqueado.
    if perfil.pagado_hasta is not None and perfil.pagado_hasta < hoy:
        problemas.append(f"Mensualidad vencida el {_fecha_txt(perfil.pagado_hasta)}")
    return problemas


def _en_linea_de_verdad(perfil: ConductorMoto) -> bool:
    if not perfil or not perfil.en_linea:
        return False
    if not perfil.ultima_conexion:
        return False
    return datetime.utcnow() - perfil.ultima_conexion < timedelta(hours=HORAS_EN_LINEA)


def _conductores_disponibles(db: Session, tipo: str) -> list:
    """Conductores de ese tipo en línea, activos y con todo al día."""
    filas = db.query(Usuario, ConductorMoto).join(
        ConductorMoto, ConductorMoto.usuario_id == Usuario.id
    ).filter(
        Usuario.tipo_usuario == "conductor",
        Usuario.estado == EstadoUsuario.ACTIVO,
        ConductorMoto.en_linea == True,  # noqa: E712
        ConductorMoto.tipo_vehiculo == tipo,
    ).all()
    return [u for u, p in filas if _en_linea_de_verdad(p) and not _problemas(p, u)]


def _expirar_busquedas(db: Session) -> None:
    """Cierra los viajes que nadie tomó a tiempo y le avisa al pasajero."""
    limite = datetime.utcnow() - timedelta(minutes=MINUTOS_BUSQUEDA)
    vencidos = db.query(ViajeMoto).filter(
        ViajeMoto.estado == "buscando",
        ViajeMoto.fecha_creacion < limite,
    ).all()
    if not vencidos:
        return
    for v in vencidos:
        v.estado = "cancelado"
        v.cancelado_por = "sistema"
        v.motivo_cancelacion = "Ningún conductor lo tomó a tiempo"
        v.fecha_cancelacion = datetime.utcnow()
        pasajero = db.query(Usuario).filter(Usuario.id == v.pasajero_id).first()
        if pasajero:
            try:
                notificar_usuario(
                    db, pasajero, tipo="viaje_sin_conductor",
                    titulo="No encontramos conductor",
                    mensaje="Ningún conductor tomó tu viaje. Puedes intentarlo de nuevo en unos minutos.",
                    relacionado_tabla="viajes_moto", relacionado_id=v.id,
                )
            except Exception as e:
                print(f"[viajes] aviso sin conductor falló: {e}")
    db.commit()


def _nombre(u: Optional[Usuario]) -> str:
    if not u:
        return ""
    return f"{u.nombre or ''} {u.apellido or ''}".strip()


def _corto(viaje_id) -> str:
    return "#VM" + str(viaje_id).replace("-", "")[-4:].upper()


def _f(x):
    return float(x) if x is not None else None


def _iso(d):
    return d.isoformat() if d else None


def _a_dict(v: ViajeMoto, db: Session, para: str) -> dict:
    """para = 'pasajero' | 'conductor' | 'admin': cada uno ve lo que necesita."""
    datos = {
        "id": str(v.id),
        "corto": _corto(v.id),
        "estado": v.estado,
        "tipo_vehiculo": _tipo_de(v.tipo_vehiculo),
        "origen": v.origen,
        "origen_lat": _f(v.origen_lat),
        "origen_lng": _f(v.origen_lng),
        "destino": v.destino,
        "destino_lat": _f(v.destino_lat),
        "destino_lng": _f(v.destino_lng),
        "referencia": v.referencia or "",
        "precio": _f(v.precio),
        "distancia_km": _f(v.distancia_km),
        "calificacion": v.calificacion,
        "cancelado_por": v.cancelado_por,
        "motivo_cancelacion": v.motivo_cancelacion,
        "fecha_creacion": _iso(v.fecha_creacion),
        "fecha_aceptacion": _iso(v.fecha_aceptacion),
        "fecha_llegada": _iso(v.fecha_llegada),
        "fecha_inicio": _iso(v.fecha_inicio),
        "fecha_fin": _iso(v.fecha_fin),
    }

    if para in ("pasajero", "admin") and v.conductor_id:
        c = db.query(Usuario).filter(Usuario.id == v.conductor_id).first()
        p = _perfil(db, v.conductor_id)
        datos["conductor"] = {
            "id": str(c.id) if c else None,
            "nombre": _nombre(c),
            "telefono": c.telefono if c else "",
            "foto": c.foto_perfil if c else None,
            "placa": p.placa if p else "",
            "moto": p.moto if p else "",
            "foto_moto": p.foto_moto if p else None,
            "tipo_vehiculo": _tipo_de(p.tipo_vehiculo) if p else "moto",
            "empresa": (p.empresa or "") if p else "",
            "numero_interno": (p.numero_interno or "") if p else "",
            "calificacion": _f(c.calificacion_promedio) if c else None,
            "total_calificaciones": (c.total_calificaciones or 0) if c else 0,
        }

    if para in ("conductor", "admin"):
        pa = db.query(Usuario).filter(Usuario.id == v.pasajero_id).first()
        datos["pasajero"] = {
            "nombre": _nombre(pa) or "Pasajero",
            "telefono": v.telefono or (pa.telefono if pa else ""),
        }

    return datos


def _requiere_conductor(usuario: Usuario):
    if _tipo(usuario) != "conductor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo para conductores")


def _requiere_super_admin(usuario: Usuario):
    if not getattr(usuario, "es_super_admin", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo un súper admin puede hacer esto")


def _num(valor, campo: str, obligatorio=True):
    if valor in (None, ""):
        if obligatorio:
            raise HTTPException(status_code=400, detail=f"Falta {campo}")
        return None
    try:
        return float(valor)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"{campo} no es válido")


def _fecha(valor, campo: str) -> Optional[date]:
    if valor in (None, ""):
        return None
    try:
        return datetime.strptime(str(valor)[:10], "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail=f"La fecha de {campo} no es válida")


def _sumar_mes(d: date) -> date:
    """El mismo día del mes siguiente (31 de enero -> 28/29 de febrero)."""
    anio, mes = (d.year + 1, 1) if d.month == 12 else (d.year, d.month + 1)
    for dia in (d.day, 30, 29, 28):
        try:
            return date(anio, mes, dia)
        except ValueError:
            continue
    return date(anio, mes, 28)


def _viaje_del(db: Session, viaje_id: UUID, bloquear=False) -> ViajeMoto:
    q = db.query(ViajeMoto).filter(ViajeMoto.id == viaje_id)
    if bloquear:
        q = q.with_for_update()
    v = q.first()
    if not v:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    return v


def _avisar(db: Session, usuario_id, tipo: str, titulo: str, mensaje: str, viaje: ViajeMoto):
    """Push al otro lado del viaje. Si falla, se pierde el aviso, no el viaje."""
    try:
        u = db.query(Usuario).filter(Usuario.id == usuario_id).first()
        if u:
            notificar_usuario(db, u, tipo=tipo, titulo=titulo, mensaje=mensaje,
                              relacionado_tabla="viajes_moto", relacionado_id=viaje.id)
            db.commit()
    except Exception as e:
        db.rollback()
        print(f"[viajes] no se pudo avisar ({tipo}): {e}")


# ============================================================================
# PASAJERO (cualquier cliente)
# ============================================================================

@router.get("/servicio/", summary="¿Qué tipos de viaje están encendidos y cuántos conductores hay?")
async def estado_servicio(db: Session = Depends(get_db)):
    tipos = {}
    for t in TIPOS:
        encendido = _servicio_activo(db, t)
        tipos[t] = {
            "activo": encendido,
            "conductores_en_linea": len(_conductores_disponibles(db, t)) if encendido else 0,
        }
    return {
        "activo": any(x["activo"] for x in tipos.values()),
        "conductores_en_linea": sum(x["conductores_en_linea"] for x in tipos.values()),
        "tipos": tipos,
    }


@router.post("/", status_code=status.HTTP_201_CREATED, summary="Pedir una moto")
async def pedir_viaje(
    datos: dict,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tipo = _tipo_de(datos.get("tipo_vehiculo"))
    if _tipo(current_user) != "cliente":
        raise HTTPException(status_code=403, detail="Para pedir un viaje entra con tu cuenta de cliente")
    if not _servicio_activo(db, tipo):
        raise HTTPException(status_code=409, detail=f"El servicio de {NOMBRE[tipo]} todavía no está disponible")
    if not datos.get("acepta_condiciones"):
        raise HTTPException(status_code=400, detail="Debes aceptar las condiciones del servicio")

    _expirar_busquedas(db)
    ya = db.query(ViajeMoto).filter(
        ViajeMoto.pasajero_id == current_user.id, ViajeMoto.estado.in_(ACTIVOS)
    ).first()
    if ya:
        raise HTTPException(status_code=409, detail="Ya tienes un viaje en curso")

    origen = (datos.get("origen") or "").strip()
    destino = (datos.get("destino") or "").strip()
    if not origen:
        raise HTTPException(status_code=400, detail="Escribe dónde te recogen")
    if not destino:
        raise HTTPException(status_code=400, detail="Escribe a dónde vas")

    o_lat = _num(datos.get("origen_lat"), "el punto de recogida")
    o_lng = _num(datos.get("origen_lng"), "el punto de recogida")
    d_lat = _num(datos.get("destino_lat"), "el destino", obligatorio=False)
    d_lng = _num(datos.get("destino_lng"), "el destino", obligatorio=False)

    conductores = _conductores_disponibles(db, tipo)
    if not conductores:
        raise HTTPException(status_code=409, detail=f"No hay conductores de {NOMBRE[tipo]} en línea en este momento. Intenta en unos minutos.")

    km = None
    if d_lat is not None and d_lng is not None:
        km = round(distancia_km(o_lat, o_lng, d_lat, d_lng), 2)

    viaje = ViajeMoto(
        pasajero_id=current_user.id,
        estado="buscando",
        tipo_vehiculo=tipo,
        origen=origen[:300],
        origen_lat=o_lat,
        origen_lng=o_lng,
        destino=destino[:300],
        destino_lat=d_lat,
        destino_lng=d_lng,
        referencia=(datos.get("referencia") or "").strip()[:500] or None,
        telefono=(datos.get("telefono") or current_user.telefono or "").strip()[:30] or None,
        distancia_km=km,
    )
    db.add(viaje)
    db.commit()
    db.refresh(viaje)

    try:
        notificar_usuarios(
            db, conductores,
            tipo="viaje_nuevo",
            titulo=f"Viaje nuevo en {NOMBRE[tipo]}",
            mensaje=f"De {origen[:60]} a {destino[:60]}" + (f" ({km:.1f} km)" if km else ""),
            relacionado_tabla="viajes_moto",
            relacionado_id=viaje.id,
            guardar=False,
        )
    except Exception as e:
        print(f"[viajes] no se pudo avisar a los conductores: {e}")

    return _a_dict(viaje, db, "pasajero")


@router.get("/mio/", summary="El viaje en curso del pasajero")
async def mi_viaje(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _expirar_busquedas(db)
    v = db.query(ViajeMoto).filter(
        ViajeMoto.pasajero_id == current_user.id, ViajeMoto.estado.in_(ACTIVOS)
    ).order_by(ViajeMoto.fecha_creacion.desc()).first()

    if not v:
        # Recién terminado y sin calificar: se le muestra para que califique
        v = db.query(ViajeMoto).filter(
            ViajeMoto.pasajero_id == current_user.id,
            ViajeMoto.estado == "terminado",
            ViajeMoto.calificacion.is_(None),
            ViajeMoto.fecha_fin > datetime.utcnow() - timedelta(hours=2),
        ).order_by(ViajeMoto.fecha_fin.desc()).first()

    if not v:
        # O cancelado hace muy poco, para que sepa qué pasó
        v = db.query(ViajeMoto).filter(
            ViajeMoto.pasajero_id == current_user.id,
            ViajeMoto.estado == "cancelado",
            ViajeMoto.cancelado_por != "pasajero",
            ViajeMoto.fecha_cancelacion > datetime.utcnow() - timedelta(minutes=10),
        ).order_by(ViajeMoto.fecha_cancelacion.desc()).first()

    return {"viaje": _a_dict(v, db, "pasajero") if v else None}


@router.get("/historial/", summary="Viajes anteriores del pasajero")
async def historial(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    viajes = db.query(ViajeMoto).filter(
        ViajeMoto.pasajero_id == current_user.id
    ).order_by(ViajeMoto.fecha_creacion.desc()).limit(20).all()
    return [_a_dict(v, db, "pasajero") for v in viajes]


@router.post("/{viaje_id}/cancelar/", summary="Cancelar el viaje (pasajero)")
async def cancelar_pasajero(
    viaje_id: UUID,
    datos: dict = None,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    v = _viaje_del(db, viaje_id, bloquear=True)
    if v.pasajero_id != current_user.id:
        raise HTTPException(status_code=403, detail="Este viaje no es tuyo")
    if v.estado not in ("buscando", "aceptado", "llego"):
        raise HTTPException(status_code=409, detail="Este viaje ya no se puede cancelar")

    conductor_id = v.conductor_id
    v.estado = "cancelado"
    v.cancelado_por = "pasajero"
    v.motivo_cancelacion = ((datos or {}).get("motivo") or "").strip()[:200] or None
    v.fecha_cancelacion = datetime.utcnow()
    db.commit()

    if conductor_id:
        _avisar(db, conductor_id, "viaje_cancelado", "Viaje cancelado",
                f"El pasajero canceló el viaje desde {v.origen[:60]}.", v)
    return _a_dict(v, db, "pasajero")


@router.post("/{viaje_id}/calificar/", summary="Calificar al conductor")
async def calificar(
    viaje_id: UUID,
    datos: dict,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    v = _viaje_del(db, viaje_id)
    if v.pasajero_id != current_user.id:
        raise HTTPException(status_code=403, detail="Este viaje no es tuyo")
    if v.estado != "terminado":
        raise HTTPException(status_code=409, detail="Solo se califican viajes terminados")
    if v.calificacion is not None:
        raise HTTPException(status_code=409, detail="Ya calificaste este viaje")
    try:
        nota = int(datos.get("calificacion"))
    except (TypeError, ValueError):
        nota = 0
    if not 1 <= nota <= 5:
        raise HTTPException(status_code=400, detail="La calificación va de 1 a 5")

    v.calificacion = nota
    c = db.query(Usuario).filter(Usuario.id == v.conductor_id).first()
    if c:
        total = c.total_calificaciones or 0
        promedio = float(c.calificacion_promedio or 0)
        c.total_calificaciones = total + 1
        c.calificacion_promedio = round((promedio * total + nota) / (total + 1), 2)
    db.commit()
    return {"ok": True, "calificacion": nota}


# ============================================================================
# CONDUCTOR
# ============================================================================

@router.get("/conductor/estado/", summary="Todo lo que ve el conductor al abrir la app")
async def estado_conductor(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _requiere_conductor(current_user)
    _expirar_busquedas(db)
    p = _perfil(db, current_user.id)
    problemas = _problemas(p, current_user)

    if p:
        p.ultima_conexion = datetime.utcnow()
        # Si algo se venció, se le apaga solo: no puede quedar recibiendo viajes
        if problemas and p.en_linea:
            p.en_linea = False
        db.commit()

    actual = db.query(ViajeMoto).filter(
        ViajeMoto.conductor_id == current_user.id,
        ViajeMoto.estado.in_(("aceptado", "llego", "en_viaje")),
    ).first()

    hoy = db.query(ViajeMoto).filter(
        ViajeMoto.conductor_id == current_user.id,
        ViajeMoto.estado == "terminado",
        ViajeMoto.fecha_fin >= _inicio_hoy_utc(),
    ).all()

    tipo = _tipo_de(p.tipo_vehiculo) if p else "moto"
    return {
        "servicio_activo": _servicio_activo(db, tipo),
        "tipo_vehiculo": tipo,
        "en_linea": _en_linea_de_verdad(p),
        "puede_trabajar": not problemas,
        "estado_inscripcion": p.estado_inscripcion if p else "aprobado",
        "problemas": problemas,
        "perfil": {
            "placa": p.placa if p else "",
            "moto": p.moto if p else "",
            "empresa": (p.empresa or "") if p else "",
            "numero_interno": (p.numero_interno or "") if p else "",
            "tarjeta_operacion_vence": _iso(p.tarjeta_operacion_vence) if p else None,
            "licencia_vence": _iso(p.licencia_vence) if p else None,
            "soat_vence": _iso(p.soat_vence) if p else None,
            "tecnomecanica_vence": _iso(p.tecnomecanica_vence) if p else None,
            "pagado_hasta": _iso(p.pagado_hasta) if p else None,
        },
        "calificacion": _f(current_user.calificacion_promedio),
        "total_calificaciones": current_user.total_calificaciones or 0,
        "viaje_actual": _a_dict(actual, db, "conductor") if actual else None,
        "viajes_hoy": len(hoy),
        # Es plata del conductor, no de ZIPPYGO: se la pagaron a él
        "cobrado_hoy": sum(float(v.precio or 0) for v in hoy),
    }


@router.post("/conductor/en-linea/", summary="Ponerse en línea o desconectarse")
async def cambiar_en_linea(
    datos: dict,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _requiere_conductor(current_user)
    p = _perfil(db, current_user.id)
    quiere = bool(datos.get("en_linea"))
    if quiere:
        problemas = _problemas(p, current_user)
        if problemas:
            raise HTTPException(status_code=409, detail="No puedes ponerte en línea: " + "; ".join(problemas))
        tipo = _tipo_de(p.tipo_vehiculo) if p else "moto"
        if not _servicio_activo(db, tipo):
            raise HTTPException(status_code=409, detail=f"El servicio de {NOMBRE[tipo]} todavía no está encendido")
    if p:
        p.en_linea = quiere
        p.ultima_conexion = datetime.utcnow()
        db.commit()
    return {"en_linea": quiere}


@router.get("/disponibles/", summary="Viajes esperando conductor")
async def disponibles(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _requiere_conductor(current_user)
    _expirar_busquedas(db)
    p = _perfil(db, current_user.id)
    if _problemas(p, current_user):
        return []
    viajes = db.query(ViajeMoto).filter(
        ViajeMoto.estado == "buscando",
        ViajeMoto.tipo_vehiculo == _tipo_de(p.tipo_vehiculo),
    ).order_by(ViajeMoto.fecha_creacion.asc()).all()
    salida = []
    for v in viajes:
        d = _a_dict(v, db, "conductor")
        # El teléfono del pasajero solo se ve después de aceptar
        d["pasajero"] = {"nombre": (d["pasajero"]["nombre"] or "Pasajero").split(" ")[0]}
        if lat is not None and lng is not None and v.origen_lat is not None:
            d["a_km"] = round(distancia_km(lat, lng, float(v.origen_lat), float(v.origen_lng)), 1)
        salida.append(d)
    if lat is not None:
        salida.sort(key=lambda d: d.get("a_km", 999))
    return salida


@router.post("/{viaje_id}/aceptar/", summary="El conductor toma el viaje y dice cuánto cobra")
async def aceptar(
    viaje_id: UUID,
    datos: dict,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _requiere_conductor(current_user)
    p = _perfil(db, current_user.id)
    problemas = _problemas(p, current_user)
    if problemas:
        raise HTTPException(status_code=409, detail="No puedes tomar viajes: " + "; ".join(problemas))

    try:
        precio = float(str(datos.get("precio", "")).replace(".", "").replace(",", ""))
    except ValueError:
        precio = 0
    if not PRECIO_MINIMO <= precio <= PRECIO_MAXIMO:
        raise HTTPException(status_code=400, detail=f"El precio debe estar entre ${PRECIO_MINIMO:,} y ${PRECIO_MAXIMO:,}".replace(",", "."))

    otro = db.query(ViajeMoto).filter(
        ViajeMoto.conductor_id == current_user.id,
        ViajeMoto.estado.in_(("aceptado", "llego", "en_viaje")),
    ).first()
    if otro:
        raise HTTPException(status_code=409, detail="Termina primero el viaje que tienes en curso")

    v = _viaje_del(db, viaje_id, bloquear=True)
    if v.estado != "buscando":
        raise HTTPException(status_code=409, detail="Otro conductor ya tomó este viaje o el pasajero lo canceló")
    if _tipo_de(v.tipo_vehiculo) != _tipo_de(p.tipo_vehiculo):
        raise HTTPException(status_code=409, detail=f"Este viaje es para {NOMBRE[_tipo_de(v.tipo_vehiculo)]}")

    v.conductor_id = current_user.id
    v.precio = precio
    v.estado = "aceptado"
    v.fecha_aceptacion = datetime.utcnow()
    db.commit()

    placa = f" (placa {p.placa})" if p and p.placa else ""
    _avisar(db, v.pasajero_id, "viaje_aceptado", f"Tu {NOMBRE[_tipo_de(v.tipo_vehiculo)]} va en camino",
            f"{current_user.nombre}{placa} va por ti. El viaje cuesta ${int(precio):,}".replace(",", ".") + ", se lo pagas a él.", v)
    return _a_dict(v, db, "conductor")


def _avanzar(db: Session, viaje_id: UUID, usuario: Usuario, desde: tuple, hacia: str, campo_fecha: str) -> ViajeMoto:
    _requiere_conductor(usuario)
    v = _viaje_del(db, viaje_id, bloquear=True)
    if v.conductor_id != usuario.id:
        raise HTTPException(status_code=403, detail="Este viaje no es tuyo")
    if v.estado not in desde:
        raise HTTPException(status_code=409, detail="El viaje ya cambió de estado. Actualiza la pantalla.")
    v.estado = hacia
    setattr(v, campo_fecha, datetime.utcnow())
    db.commit()
    return v


@router.post("/{viaje_id}/llegue/", summary="El conductor llegó al punto de recogida")
async def llegue(viaje_id: UUID, current_user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    v = _avanzar(db, viaje_id, current_user, ("aceptado",), "llego", "fecha_llegada")
    _avisar(db, v.pasajero_id, "viaje_llego", f"Tu {NOMBRE[_tipo_de(v.tipo_vehiculo)]} llegó",
            f"{current_user.nombre} te está esperando en {v.origen[:60]}.", v)
    return _a_dict(v, db, "conductor")


@router.post("/{viaje_id}/iniciar/", summary="El pasajero se subió")
async def iniciar(viaje_id: UUID, current_user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    v = _avanzar(db, viaje_id, current_user, ("aceptado", "llego"), "en_viaje", "fecha_inicio")
    return _a_dict(v, db, "conductor")


@router.post("/{viaje_id}/terminar/", summary="Llegaron al destino")
async def terminar(viaje_id: UUID, current_user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    v = _avanzar(db, viaje_id, current_user, ("en_viaje",), "terminado", "fecha_fin")
    _avisar(db, v.pasajero_id, "viaje_terminado", "Llegaste a tu destino",
            "¿Cómo te fue? Califica a tu conductor.", v)
    return _a_dict(v, db, "conductor")


@router.post("/{viaje_id}/soltar/", summary="El conductor suelta el viaje (vuelve a buscar otro conductor)")
async def soltar(
    viaje_id: UUID,
    datos: dict = None,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _requiere_conductor(current_user)
    v = _viaje_del(db, viaje_id, bloquear=True)
    if v.conductor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Este viaje no es tuyo")
    if v.estado not in ("aceptado", "llego"):
        raise HTTPException(status_code=409, detail="Este viaje ya no se puede soltar")

    motivo = ((datos or {}).get("motivo") or "").strip()[:200]
    if motivo == "no_aparecio":
        # El pasajero no salió: el viaje se cierra, no se vuelve a buscar
        v.estado = "cancelado"
        v.cancelado_por = "conductor"
        v.motivo_cancelacion = "El pasajero no apareció"
        v.fecha_cancelacion = datetime.utcnow()
        db.commit()
        _avisar(db, v.pasajero_id, "viaje_cancelado", "Viaje cancelado",
                "El conductor llegó y no te encontró, así que canceló el viaje.", v)
    else:
        # Cualquier otro motivo: el viaje vuelve a la lista para otro conductor
        v.estado = "buscando"
        v.conductor_id = None
        v.precio = None
        v.fecha_aceptacion = None
        v.fecha_llegada = None
        v.fecha_creacion = datetime.utcnow()
        db.commit()
        _avisar(db, v.pasajero_id, "viaje_buscando", "Buscando otro conductor",
                "El conductor no pudo ir. Ya estamos buscando otro.", v)
        try:
            notificar_usuarios(
                db, [c for c in _conductores_disponibles(db, _tipo_de(v.tipo_vehiculo)) if c.id != current_user.id],
                tipo="viaje_nuevo", titulo=f"Viaje nuevo en {NOMBRE[_tipo_de(v.tipo_vehiculo)]}",
                mensaje=f"De {v.origen[:60]} a {v.destino[:60]}",
                relacionado_tabla="viajes_moto", relacionado_id=v.id, guardar=False,
            )
        except Exception as e:
            print(f"[viajes] no se pudo volver a avisar: {e}")
    return {"ok": True}


# ============================================================================
# SÚPER ADMIN
# ============================================================================

def _conductor_admin(u: Usuario, p: Optional[ConductorMoto], db: Session) -> dict:
    total = db.query(ViajeMoto).filter(
        ViajeMoto.conductor_id == u.id, ViajeMoto.estado == "terminado"
    ).count()
    return {
        "id": str(u.id),
        "nombre": u.nombre,
        "apellido": u.apellido or "",
        "email": u.email,
        "telefono": u.telefono or "",
        "documento": u.documento or "",
        "estado": _estado_usuario(u),
        "tipo_vehiculo": _tipo_de(p.tipo_vehiculo) if p else "moto",
        "placa": p.placa if p else "",
        "moto": p.moto if p else "",
        "empresa": (p.empresa or "") if p else "",
        "numero_interno": (p.numero_interno or "") if p else "",
        "tarjeta_operacion_vence": _iso(p.tarjeta_operacion_vence) if p else None,
        "licencia_vence": _iso(p.licencia_vence) if p else None,
        "soat_vence": _iso(p.soat_vence) if p else None,
        "tecnomecanica_vence": _iso(p.tecnomecanica_vence) if p else None,
        "pagado_hasta": _iso(p.pagado_hasta) if p else None,
        "notas_admin": (p.notas_admin or "") if p else "",
        "en_linea": _en_linea_de_verdad(p),
        "problemas": _problemas(p, u),
        "calificacion": _f(u.calificacion_promedio),
        "total_calificaciones": u.total_calificaciones or 0,
        "viajes": total,
        "estado_inscripcion": p.estado_inscripcion if p else "aprobado",
        "motivo_rechazo": (p.motivo_rechazo or "") if p else "",
        "fecha_inscripcion": _iso(p.fecha_inscripcion) if p else None,
        # Se inscribió pero no ha puesto el código que le llegó al correo
        "correo_verificado": bool(u.es_verificado),
    }


@router.get("/admin/resumen/", summary="Conductores, viajes y si el servicio está encendido")
async def admin_resumen(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _requiere_super_admin(current_user)
    _expirar_busquedas(db)
    filas = db.query(Usuario, ConductorMoto).outerjoin(
        ConductorMoto, ConductorMoto.usuario_id == Usuario.id
    ).filter(
        Usuario.tipo_usuario == "conductor",
        Usuario.estado != EstadoUsuario.ELIMINADO,
    ).order_by(Usuario.fecha_creacion.desc()).all()

    viajes = db.query(ViajeMoto).order_by(ViajeMoto.fecha_creacion.desc()).limit(50).all()
    hoy = db.query(ViajeMoto).filter(ViajeMoto.fecha_creacion >= _inicio_hoy_utc()).all()

    return {
        "activo": _servicio_activo(db),
        "servicios": {t: _servicio_activo(db, t) for t in TIPOS},
        "conductores": [_conductor_admin(u, p, db) for u, p in filas],
        "viajes": [_a_dict(v, db, "admin") for v in viajes],
        "hoy": {
            "pedidos": len(hoy),
            "terminados": sum(1 for v in hoy if v.estado == "terminado"),
            "cancelados": sum(1 for v in hoy if v.estado == "cancelado"),
        },
    }


@router.put("/admin/servicio/", summary="Encender o apagar los viajes en moto o en carro")
async def admin_servicio(
    datos: dict,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _requiere_super_admin(current_user)
    tipo = _tipo_de(datos.get("tipo_vehiculo"))
    activo = bool(datos.get("activo"))
    clave = CLAVE_ACTIVO[tipo]
    fila = db.query(ConfiguracionSistema).filter(ConfiguracionSistema.clave == clave).first()
    if not fila:
        fila = ConfiguracionSistema(clave=clave, descripcion=f"Viajes en {NOMBRE[tipo]} encendidos", tipo_dato="bool")
        db.add(fila)
    fila.valor = "true" if activo else "false"
    if not activo:
        # Apagado = ningún conductor de ese tipo queda recibiendo viajes
        db.query(ConductorMoto).filter(ConductorMoto.tipo_vehiculo == tipo).update({ConductorMoto.en_linea: False})
    registrar_log(db, usuario_id=current_user.id, accion="Configuración",
                  tabla_afectada="configuracion_sistema",
                  detalle=f"Viajes en {NOMBRE[tipo]} {'encendidos' if activo else 'apagados'}")
    db.commit()
    return {"tipo_vehiculo": tipo, "activo": activo}


def _aplicar_perfil(p: ConductorMoto, datos: dict):
    if "tipo_vehiculo" in datos:
        p.tipo_vehiculo = _tipo_de(datos.get("tipo_vehiculo"))
    if "empresa" in datos:
        p.empresa = (datos.get("empresa") or "").strip()[:80] or None
    if "numero_interno" in datos:
        p.numero_interno = (datos.get("numero_interno") or "").strip()[:10] or None
    if "tarjeta_operacion_vence" in datos:
        p.tarjeta_operacion_vence = _fecha(datos.get("tarjeta_operacion_vence"), "la tarjeta de operación")
    if "placa" in datos:
        p.placa = (datos.get("placa") or "").upper().replace(" ", "")[:10] or None
    if "moto" in datos:
        p.moto = (datos.get("moto") or "").strip()[:80] or None
    if "licencia_vence" in datos:
        p.licencia_vence = _fecha(datos.get("licencia_vence"), "la licencia")
    if "soat_vence" in datos:
        p.soat_vence = _fecha(datos.get("soat_vence"), "el SOAT")
    if "tecnomecanica_vence" in datos:
        p.tecnomecanica_vence = _fecha(datos.get("tecnomecanica_vence"), "la tecnomecánica")
    if "pagado_hasta" in datos:
        p.pagado_hasta = _fecha(datos.get("pagado_hasta"), "la mensualidad")
    if "notas_admin" in datos:
        p.notas_admin = (datos.get("notas_admin") or "").strip() or None


@router.post("/admin/conductores/", status_code=201, summary="Registrar un conductor")
async def admin_crear_conductor(
    datos: dict,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _requiere_super_admin(current_user)
    for campo, texto in (("nombre", "el nombre"), ("email", "el correo"), ("telefono", "el teléfono"),
                         ("password", "la contraseña"), ("placa", "la placa")):
        if not str(datos.get(campo) or "").strip():
            raise HTTPException(status_code=400, detail=f"Falta {texto}")
    if len(str(datos["password"])) < 8:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres")
    email = str(datos["email"]).strip().lower()
    if db.query(Usuario).filter(Usuario.email == email, Usuario.tipo_usuario == "conductor").first():
        raise HTTPException(status_code=409, detail="Ya existe un conductor con ese correo")

    u = Usuario(
        email=email,
        nombre=str(datos["nombre"]).strip()[:150],
        apellido=str(datos.get("apellido") or "").strip()[:150],
        telefono=str(datos["telefono"]).strip()[:20],
        documento=str(datos.get("documento") or "").strip()[:50] or None,
        tipo_usuario="conductor",
        vehiculo=_tipo_de(datos.get("tipo_vehiculo")),
        placa=str(datos["placa"]).upper().replace(" ", "")[:10],
        password_hash=hash_password(str(datos["password"])),
        estado="activo",
        es_verificado=True,  # lo registra un súper admin después de ver sus papeles
        fecha_creacion=datetime.utcnow(),
    )
    db.add(u)
    db.flush()
    p = ConductorMoto(usuario_id=u.id, tipo_vehiculo="moto")
    _aplicar_perfil(p, datos)
    db.add(p)
    registrar_log(db, usuario_id=current_user.id, accion="Creación", tabla_afectada="usuarios",
                  registro_id=u.id, detalle=f"Conductor de {NOMBRE[_tipo_de(p.tipo_vehiculo)]} {u.nombre} ({u.email}) registrado")
    db.commit()
    return _conductor_admin(u, p, db)


@router.put("/admin/conductores/{usuario_id}/", summary="Actualizar documentos, mensualidad o estado")
async def admin_editar_conductor(
    usuario_id: UUID,
    datos: dict,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _requiere_super_admin(current_user)
    u = db.query(Usuario).filter(Usuario.id == usuario_id, Usuario.tipo_usuario == "conductor").first()
    if not u:
        raise HTTPException(status_code=404, detail="Conductor no encontrado")
    p = _perfil(db, u.id)
    if not p:
        p = ConductorMoto(usuario_id=u.id)
        db.add(p)

    _aplicar_perfil(p, datos)
    if datos.get("sumar_mes"):
        # Pagó un mes más: se cuenta desde que vence (o desde hoy si ya venció)
        base = max(p.pagado_hasta or _hoy_colombia(), _hoy_colombia())
        p.pagado_hasta = _sumar_mes(base)
    if "estado" in datos and datos["estado"] in ("activo", "suspendido"):
        u.estado = datos["estado"]
        if datos["estado"] != "activo":
            p.en_linea = False
    if "telefono" in datos and str(datos["telefono"]).strip():
        u.telefono = str(datos["telefono"]).strip()[:20]
    if p.placa:
        u.placa = p.placa

    if _problemas(p, u):
        p.en_linea = False
    registrar_log(db, usuario_id=current_user.id, accion="Edición", tabla_afectada="conductores_moto",
                  registro_id=u.id, detalle=f"Conductor {u.nombre} actualizado")
    db.commit()
    return _conductor_admin(u, p, db)



# ============================================================================
# INSCRIPCIÓN DEL CONDUCTOR DESDE LA APP (oct 2026)
#
# El conductor llena sus datos y sube fotos de sus papeles. La cuenta queda
# "pendiente": verifica su correo con el código de siempre, puede entrar, pero
# no recibe viajes hasta que un súper admin mire las fotos y lo apruebe.
#
# Las fotos van a un bucket PRIVADO: son documentos de identidad.
# ============================================================================

BUCKET_DOCUMENTOS = "documentos-conductores"
MAX_FOTO = 15 * 1024 * 1024
FOTOS = {
    "foto_cedula": "cédula",
    "foto_licencia": "licencia de conducción",
    "foto_soat": "SOAT",
    "foto_vehiculo": "vehículo con la placa visible",
    "foto_tarjeta_operacion": "tarjeta de operación",
}


async def _guardar_foto(archivo: UploadFile, usuario_id, campo: str) -> str:
    contenido = await archivo.read()
    if not contenido:
        raise HTTPException(status_code=400, detail=f"La foto de {FOTOS[campo]} está vacía")
    if len(contenido) > MAX_FOTO:
        raise HTTPException(status_code=400, detail=f"La foto de {FOTOS[campo]} pesa demasiado (máximo 15 MB)")
    try:
        webp = imagenes.documento(contenido)
    except imagenes.ImagenInvalida:
        raise HTTPException(status_code=400, detail=f"La foto de {FOTOS[campo]} no es una imagen válida")
    ruta = f"{usuario_id}/{campo}-{uuid.uuid4().hex[:10]}.webp"
    try:
        return subir_privado(webp, ruta, "image/webp", BUCKET_DOCUMENTOS)
    except SupabaseStorageError as e:
        print(f"[inscripcion] no se pudo subir {campo}: {e}")
        raise HTTPException(status_code=502, detail="No se pudieron guardar las fotos. Intenta de nuevo en unos minutos.")


@router.post("/inscripcion/", status_code=201, summary="Un conductor se inscribe solo desde la app")
@limiter.limit("20/hour")
async def inscribirse(
    request: Request,
    tipo_vehiculo: str = Form("moto"),
    nombre: str = Form(...),
    apellido: str = Form(""),
    documento: str = Form(...),
    telefono: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    placa: str = Form(...),
    vehiculo: str = Form(""),
    empresa: str = Form(""),
    numero_interno: str = Form(""),
    licencia_vence: str = Form(...),
    soat_vence: str = Form(...),
    tecnomecanica_vence: str = Form(""),
    tarjeta_operacion_vence: str = Form(""),
    acepta_condiciones: str = Form(""),
    foto_cedula: UploadFile = File(...),
    foto_licencia: UploadFile = File(...),
    foto_soat: UploadFile = File(...),
    foto_vehiculo: UploadFile = File(...),
    foto_tarjeta_operacion: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    tipo = _tipo_de(tipo_vehiculo)
    if acepta_condiciones.lower() not in ("true", "1", "si", "sí"):
        raise HTTPException(status_code=400, detail="Debes aceptar las condiciones y la autorización de datos")

    for valor, texto in ((nombre, "tu nombre"), (documento, "tu número de cédula"), (telefono, "tu celular"),
                         (email, "tu correo"), (placa, "la placa")):
        if not str(valor or "").strip():
            raise HTTPException(status_code=400, detail=f"Falta {texto}")

    r = validar_correo(email.strip())
    if not r["valido"]:
        raise HTTPException(status_code=400, detail=r["error"])
    email = r["correo"]

    if len(password) < 8 or not any(c.isupper() for c in password) or not any(c.isdigit() for c in password):
        raise HTTPException(status_code=400, detail="La contraseña debe tener mínimo 8 caracteres, una mayúscula y un número")

    lic = _fecha(licencia_vence, "la licencia")
    soat = _fecha(soat_vence, "el SOAT")
    tecno = _fecha(tecnomecanica_vence, "la tecnomecánica")
    tarjeta = _fecha(tarjeta_operacion_vence, "la tarjeta de operación")
    hoy = _hoy_colombia()
    if not lic or lic < hoy:
        raise HTTPException(status_code=400, detail="La licencia debe estar vigente")
    if not soat or soat < hoy:
        raise HTTPException(status_code=400, detail="El SOAT debe estar vigente")
    if tecno and tecno < hoy:
        raise HTTPException(status_code=400, detail="La tecnomecánica está vencida")
    if tarjeta and tarjeta < hoy:
        raise HTTPException(status_code=400, detail="La tarjeta de operación está vencida")

    # ¿Ya tiene cuenta de conductor con ese correo?
    if db.query(Usuario).filter(Usuario.email == email, Usuario.tipo_usuario == "conductor",
                                Usuario.estado != EstadoUsuario.ELIMINADO).first():
        raise HTTPException(status_code=400, detail="Ya hay una cuenta de conductor con ese correo. Inicia sesión o recupera tu contraseña.")

    u = Usuario(
        email=email,
        nombre=nombre.strip()[:150],
        apellido=apellido.strip()[:150],
        telefono=telefono.strip()[:20],
        documento=documento.strip()[:50],
        tipo_usuario="conductor",
        vehiculo=tipo,
        placa=placa.upper().replace(" ", "")[:10],
        password_hash=hash_password(password),
        estado="activo",
        # Entra de una vez, sin código de correo ni aprobación del súper admin
        es_verificado=True,
        metodo_verificacion="email",
        fecha_creacion=datetime.utcnow(),
    )
    db.add(u)
    db.flush()

    p = ConductorMoto(
        usuario_id=u.id,
        tipo_vehiculo=tipo,
        placa=u.placa,
        moto=vehiculo.strip()[:80] or None,
        # Si el carro es taxi puede anotar empresa, móvil y tarjeta de operación
        empresa=empresa.strip()[:80] or None if tipo == "carro" else None,
        numero_interno=numero_interno.strip()[:10] or None if tipo == "carro" else None,
        licencia_vence=lic,
        soat_vence=soat,
        tecnomecanica_vence=tecno,
        tarjeta_operacion_vence=tarjeta if tipo == "carro" else None,
        estado_inscripcion="aprobado",
        fecha_inscripcion=datetime.utcnow(),
    )
    p.foto_cedula = await _guardar_foto(foto_cedula, u.id, "foto_cedula")
    p.foto_licencia = await _guardar_foto(foto_licencia, u.id, "foto_licencia")
    p.foto_soat = await _guardar_foto(foto_soat, u.id, "foto_soat")
    p.foto_vehiculo = await _guardar_foto(foto_vehiculo, u.id, "foto_vehiculo")
    if tipo == "carro" and foto_tarjeta_operacion is not None and foto_tarjeta_operacion.filename:
        p.foto_tarjeta_operacion = await _guardar_foto(foto_tarjeta_operacion, u.id, "foto_tarjeta_operacion")
    db.add(p)
    db.commit()

    # Aviso a los súper admin (solo para que sepan; no tienen que aprobar nada)
    try:
        admins = db.query(Usuario).filter(Usuario.es_super_admin == True, Usuario.estado == EstadoUsuario.ACTIVO).all()  # noqa: E712
        notificar_usuarios(
            db, admins, tipo="conductor_inscrito",
            titulo=f"Nuevo conductor de {NOMBRE[tipo]}",
            mensaje=f"{u.nombre} se inscribió y ya puede recibir viajes. Sus papeles están en Moto y carro.",
            relacionado_tabla="usuarios", relacionado_id=u.id,
        )
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[inscripcion] no se pudo avisar a los súper admin: {e}")

    # Queda con la sesión iniciada, igual que al hacer login
    return {
        "access_token": create_access_token(data={"sub": str(u.id)}),
        "refresh_token": create_refresh_token(data={"sub": str(u.id)}),
        "token_type": "bearer",
        "usuario": UsuarioResponse.from_orm(u).model_dump(mode="json"),
    }


@router.get("/admin/conductores/{usuario_id}/documentos/", summary="Fotos de los papeles (enlaces que vencen en 15 min)")
async def admin_documentos(
    usuario_id: UUID,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _requiere_super_admin(current_user)
    p = _perfil(db, usuario_id)
    if not p:
        raise HTTPException(status_code=404, detail="Conductor no encontrado")
    salida = []
    for campo, texto in FOTOS.items():
        ruta = getattr(p, campo)
        if not ruta:
            continue
        try:
            salida.append({"campo": campo, "nombre": texto[:1].upper() + texto[1:], "url": url_firmada(BUCKET_DOCUMENTOS, ruta)})
        except SupabaseStorageError as e:
            print(f"[documentos] {e}")
            salida.append({"campo": campo, "nombre": texto[:1].upper() + texto[1:], "url": None})
    return salida
