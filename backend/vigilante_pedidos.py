# ============================================================================
# vigilante_pedidos.py - Avisa al dueño cuando un negocio no acepta un pedido
#
# Un pedido que el negocio no ve es un cliente con hambre mirando una pantalla
# que no cambia. El panel de soporte ya lo marcaba (ver /ordenes/validacion/
# atascados), pero solo si alguien entraba a mirarlo. Esto lo revisa solo cada
# dos minutos y le escribe al dueño por WhatsApp, con el correo de respaldo.
#
# Funciona porque el servidor de Render es de pago y no se duerme. En un plan
# gratis el bucle se detendria cada vez que Render apagara el servidor.
# ============================================================================

import asyncio
import json
import urllib.parse
import urllib.request
from datetime import datetime, timedelta

from config import SessionLocal, settings
from models import EstadoUsuario, Orden, Usuario
from push import notificar_usuarios

# Decision del dueño (oct 2026): a los 5 minutos ya quiere enterarse. Va igual
# que MINUTOS_SIN_CONFIRMAR del panel de soporte para que las dos cuentas
# coincidan. Al cliente se le sigue mostrando su aviso a los 10.
MINUTOS_PARA_AVISAR = 5
SEGUNDOS_ENTRE_REVISIONES = 120
# Pedidos mas viejos que esto no se avisan: son de pruebas o de dias atras, y
# al prender esto por primera vez llegaria una avalancha de avisos viejos.
HORAS_MAXIMO = 12
# Oct 2026: el primer pedido de un cliente no le llega al negocio hasta que el
# super admin lo valida. Si a los 10 minutos sigue esperando, se le recuerda
# con una notificacion al celular (una sola vez por pedido).
MINUTOS_RECORDAR_VALIDAR = 10

# Oct 2026 (pedido del dueño): un pedido que se queda quieto suena cada 75
# segundos a quien tiene que moverlo, maximo 8 veces (10 minutos). Despues ya
# no se insiste mas: si suena sin parar terminan apagando las notificaciones
# de la app. Para entonces el super admin ya tiene su propio aviso.
SEGUNDOS_RECORDATORIO = 75
MAX_RECORDATORIOS = 8
SEGUNDOS_VUELTA_RAPIDA = 15
# Cuantos recordatorios lleva cada pedido: {(orden_id, motivo): cuantos}.
# Vive en memoria: si el servidor se reinicia, se retoma por el tiempo que
# lleva el pedido (no se repiten de golpe los que ya sonaron).
_recordatorios = {}
_admin_sin_repartidor = set()


def _hora_colombia(momento: datetime) -> str:
    return (momento - timedelta(hours=5)).strftime("%I:%M %p").lstrip("0")


def _mensaje(pedidos: list) -> str:
    ahora = datetime.utcnow()
    lineas = ["*ZIPPYGO* - pedidos sin aceptar"]
    for o in pedidos:
        minutos = int((ahora - o["desde"]).total_seconds() // 60)
        plata = f"{o['total']:,.0f}".replace(",", ".")  # 44.000, como se escribe aqui
        lineas.append(
            f"- {o['negocio']}: pedido #{o['id'][:8]} por ${plata}, "
            f"lleva {minutos} min sin aceptar (pedido a las {_hora_colombia(o['desde'])})"
        )
    lineas.append("Llama al negocio o cancela el pedido desde el panel.")
    return "\n".join(lineas)


def _enviar_whatsapp(texto: str) -> bool:
    if not settings.CALLMEBOT_TELEFONO or not settings.CALLMEBOT_APIKEY:
        return False
    url = "https://api.callmebot.com/whatsapp.php?" + urllib.parse.urlencode({
        "phone": settings.CALLMEBOT_TELEFONO,
        "text": texto,
        "apikey": settings.CALLMEBOT_APIKEY,
    })
    try:
        with urllib.request.urlopen(url, timeout=20) as resp:
            cuerpo = resp.read().decode("utf-8", "ignore")
        # CallMeBot responde 200 incluso con la clave mala, pero lo dice en el texto
        if "ERROR" in cuerpo.upper() and "QUEUED" not in cuerpo.upper():
            print(f"[vigilante] CallMeBot rechazo el mensaje: {cuerpo[:200]}")
            return False
        return True
    except Exception as e:
        print(f"[vigilante] no se pudo mandar el WhatsApp: {e}")
        return False


def _enviar_correo(texto: str) -> bool:
    destino = settings.EMAIL_ALERTAS or settings.SMTP_REMITENTE
    if not settings.BREVO_API_KEY or not settings.SMTP_REMITENTE or not destino:
        return False
    payload = json.dumps({
        "sender": {"email": settings.SMTP_REMITENTE, "name": settings.SMTP_REMITENTE_NOMBRE},
        "to": [{"email": destino}],
        "subject": "[ZIPPYGO] Hay pedidos que el negocio no ha aceptado",
        "textContent": texto.replace("*", ""),
    }).encode("utf-8")
    req = urllib.request.Request("https://api.brevo.com/v3/smtp/email", data=payload, method="POST")
    req.add_header("accept", "application/json")
    req.add_header("api-key", settings.BREVO_API_KEY)
    req.add_header("content-type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            resp.read()
        return True
    except Exception as e:
        print(f"[vigilante] no se pudo mandar el correo: {e}")
        return False


def _admins(db):
    return db.query(Usuario).filter(
        Usuario.tipo_usuario == "admin",
        Usuario.estado == EstadoUsuario.ACTIVO,
    ).all()


def _nombre_cliente(o) -> str:
    c = getattr(o, "cliente", None)
    return (c.nombre if c and c.nombre else "un cliente")


def recordar_sin_validar() -> int:
    """Avisa al super admin de los primeros pedidos que siguen sin validar."""
    ahora = datetime.utcnow()
    db = SessionLocal()
    try:
        candidatos = db.query(Orden).filter(
            Orden.estado == "pendiente",
            Orden.requiere_validacion == True,  # noqa: E712
            Orden.fecha_validacion.is_(None),
            Orden.alerta_sin_validar.is_(None),
            Orden.fecha_creacion < ahora - timedelta(minutes=MINUTOS_RECORDAR_VALIDAR),
            Orden.fecha_creacion >= ahora - timedelta(hours=HORAS_MAXIMO),
        ).all()
        if not candidatos:
            return 0

        admins = _admins(db)
        avisados = 0
        for o in candidatos:
            # Se aparta primero, como en revisar_una_vez, para no avisar dos veces
            apartado = db.query(Orden).filter(
                Orden.id == o.id, Orden.alerta_sin_validar.is_(None)
            ).update({Orden.alerta_sin_validar: ahora}, synchronize_session=False)
            if not apartado:
                continue
            minutos = int((ahora - o.fecha_creacion).total_seconds() // 60)
            negocio = o.negocio.nombre_negocio if o.negocio else "el negocio"
            notificar_usuarios(
                db, admins,
                tipo="recordatorio_validar",
                titulo="Sigue sin validar",
                mensaje=(f"El pedido de {_nombre_cliente(o)} en {negocio} lleva {minutos} min esperando. "
                         "El negocio no lo recibe hasta que lo valides."),
                relacionado_tabla="ordenes",
                relacionado_id=o.id,
            )
            avisados += 1
        db.commit()
        return avisados
    except Exception as e:
        db.rollback()
        print(f"[vigilante] fallo el recordatorio de validacion: {e}")
        return 0
    finally:
        db.close()


def _plata(valor) -> str:
    return f"{float(valor or 0):,.0f}".replace(",", ".")


def _toca_recordar(clave, desde, ahora) -> int:
    """Devuelve el numero de recordatorio que toca mandar ahora (1..8), o 0."""
    if not desde:
        return 0
    numero = int((ahora - desde).total_seconds() // SEGUNDOS_RECORDATORIO)
    if numero < 1 or numero > MAX_RECORDATORIOS:
        return 0
    if _recordatorios.get(clave, 0) >= numero:
        return 0
    _recordatorios[clave] = numero
    return numero


def recordatorios() -> int:
    """Recordatorios cada 75 s: al negocio que no ha aceptado, a los
    repartidores cuando nadie toma un pedido listo, y al repartidor que lo
    tomo y no ha pasado a recogerlo."""
    ahora = datetime.utcnow()
    db = SessionLocal()
    mandados = 0
    try:
        recientes = ahora - timedelta(hours=HORAS_MAXIMO)
        ordenes = db.query(Orden).filter(
            Orden.estado.in_(["pendiente", "lista_para_retirar"]),
            Orden.fecha_creacion >= recientes,
        ).all()
        vivos = set()
        repartidores = None
        for o in ordenes:
            estado = getattr(o.estado, "value", o.estado)
            negocio = o.negocio.nombre_negocio if o.negocio else "la tienda"
            cliente = _nombre_cliente(o)

            if estado == "pendiente":
                # El primer pedido espera a soporte: el negocio todavia no lo ve
                if o.requiere_validacion and o.fecha_validacion is None:
                    continue
                desde = o.fecha_validacion or o.fecha_creacion
                clave = (str(o.id), "aceptar"); vivos.add(clave)
                if _toca_recordar(clave, desde, ahora) and o.negocio and o.negocio.vendedor:
                    minutos = max(1, int((ahora - desde).total_seconds() // 60))
                    notificar_usuarios(
                        db, [o.negocio.vendedor], guardar=False,
                        tipo="recordatorio_aceptar",
                        titulo="Recordatorio: tienes un pedido pendiente",
                        mensaje=f"{cliente} pidió ${_plata(o.total)} hace {minutos} min. Acéptalo para que el cliente sepa que ya va.",
                        relacionado_tabla="ordenes", relacionado_id=o.id,
                    )
                    mandados += 1

            elif estado == "lista_para_retirar" and o.domiciliario_id is None:
                desde = o.fecha_ultima_actualizacion or o.fecha_creacion
                clave = (str(o.id), "tomar"); vivos.add(clave)
                minutos = max(1, int((ahora - desde).total_seconds() // 60))
                if _toca_recordar(clave, desde, ahora):
                    if repartidores is None:
                        repartidores = db.query(Usuario).filter(
                            Usuario.tipo_usuario == "domiciliario",
                            Usuario.estado == EstadoUsuario.ACTIVO,
                            Usuario.fcm_token.isnot(None),
                        ).all()
                    notificar_usuarios(
                        db, repartidores, guardar=False,
                        tipo="recordatorio_tomar",
                        titulo="Recordatorio: pedido sin repartidor",
                        mensaje=f"Hay un pedido listo para recoger en {negocio} hace {minutos} min. Tómalo antes de que se enfríe.",
                        relacionado_tabla="ordenes", relacionado_id=o.id,
                    )
                    mandados += 1
                # Ya sonaron los 8 y nadie lo toma: un solo aviso al super admin
                limite = SEGUNDOS_RECORDATORIO * MAX_RECORDATORIOS
                if (ahora - desde).total_seconds() >= limite and str(o.id) not in _admin_sin_repartidor:
                    _admin_sin_repartidor.add(str(o.id))
                    notificar_usuarios(
                        db, _admins(db),
                        tipo="pedido_sin_repartidor",
                        titulo="Pedido sin repartidor",
                        mensaje=f"El pedido de {negocio} lleva {minutos} min listo y ningún repartidor lo ha tomado.",
                        relacionado_tabla="ordenes", relacionado_id=o.id,
                    )

            elif estado == "lista_para_retirar" and o.domiciliario:
                desde = o.fecha_ultima_actualizacion or o.fecha_creacion
                clave = (str(o.id), "recoger"); vivos.add(clave)
                if _toca_recordar(clave, desde, ahora):
                    minutos = max(1, int((ahora - desde).total_seconds() // 60))
                    notificar_usuarios(
                        db, [o.domiciliario], guardar=False,
                        tipo="recordatorio_recoger",
                        titulo="Recordatorio: pasa a recoger el pedido",
                        mensaje=f"{negocio} tiene listo el pedido de {cliente} hace {minutos} min.",
                        relacionado_tabla="ordenes", relacionado_id=o.id,
                    )
                    mandados += 1

        # Se olvidan los pedidos que ya se movieron, para no crecer sin fin
        for clave in list(_recordatorios):
            if clave not in vivos:
                _recordatorios.pop(clave, None)
        _admin_sin_repartidor.intersection_update({c[0] for c in vivos if c[1] == "tomar"})
        db.commit()
        return mandados
    except Exception as e:
        db.rollback()
        print(f"[vigilante] fallo los recordatorios: {e}")
        return mandados
    finally:
        db.close()


def revisar_una_vez() -> int:
    """Busca pedidos sin aceptar, los marca y avisa. Devuelve cuantos aviso."""
    ahora = datetime.utcnow()
    limite = ahora - timedelta(minutes=MINUTOS_PARA_AVISAR)
    db = SessionLocal()
    try:
        candidatos = db.query(Orden).filter(
            Orden.estado == "pendiente",
            Orden.alerta_sin_confirmar.is_(None),
            Orden.fecha_creacion >= ahora - timedelta(hours=HORAS_MAXIMO),
        ).all()

        pedidos = []
        for o in candidatos:
            # Los primeros pedidos esperan la validacion de soporte; el negocio
            # todavia no los ve, asi que no se le puede culpar de no aceptarlos.
            # Se cuenta desde que soporte los aprobo.
            if o.requiere_validacion and o.fecha_validacion is None:
                continue
            desde = o.fecha_validacion or o.fecha_creacion
            if desde > limite:
                continue

            # Se "aparta" el pedido antes de avisar: si algun dia corren dos
            # copias del servidor, solo una consigue marcarlo y no llegan dos
            # mensajes por el mismo pedido.
            apartado = db.query(Orden).filter(
                Orden.id == o.id, Orden.alerta_sin_confirmar.is_(None)
            ).update({Orden.alerta_sin_confirmar: ahora}, synchronize_session=False)
            if apartado:
                pedidos.append({
                    "id": str(o.id),
                    "negocio": o.negocio.nombre_negocio if o.negocio else "Un negocio",
                    "total": float(o.total or 0),
                    "desde": desde,
                })
                # Oct 2026: ademas del correo, le suena al super admin en el
                # celular, aunque este en otro perfil.
                minutos = int((ahora - desde).total_seconds() // 60)
                notificar_usuarios(
                    db, _admins(db),
                    tipo="negocio_sin_aceptar",
                    titulo="Negocio sin aceptar",
                    mensaje=(f"{pedidos[-1]['negocio']} lleva {minutos} min sin aceptar "
                             f"el pedido de {_nombre_cliente(o)}."),
                    relacionado_tabla="ordenes",
                    relacionado_id=o.id,
                )
        db.commit()

        if not pedidos:
            return 0

        # Un solo mensaje con todos los de esta vuelta, no uno por pedido
        texto = _mensaje(pedidos)
        if not _enviar_whatsapp(texto):
            if not _enviar_correo(texto):
                print(f"[vigilante] no hubo por donde avisar:\n{texto}")
        return len(pedidos)
    except Exception as e:
        db.rollback()
        print(f"[vigilante] fallo la revision: {e}")
        return 0
    finally:
        db.close()


async def vigilar_pedidos():
    """Bucle que corre mientras viva el servidor."""
    await asyncio.sleep(30)  # que el servidor termine de arrancar primero
    vuelta = 0
    while True:
        try:
            # En un hilo aparte: la consulta y los envios son bloqueantes y no
            # pueden frenar las respuestas al resto de la app.
            # Los recordatorios de 75 s necesitan revisar seguido (cada 15 s);
            # lo demas sigue cada 2 minutos.
            await asyncio.to_thread(recordatorios)
            if vuelta % (SEGUNDOS_ENTRE_REVISIONES // SEGUNDOS_VUELTA_RAPIDA) == 0:
                await asyncio.to_thread(revisar_una_vez)
                await asyncio.to_thread(recordar_sin_validar)
        except Exception as e:
            print(f"[vigilante] error inesperado: {e}")
        vuelta += 1
        await asyncio.sleep(SEGUNDOS_VUELTA_RAPIDA)
