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
from models import Orden

# Decision del dueño (oct 2026): a los 5 minutos ya quiere enterarse. Va igual
# que MINUTOS_SIN_CONFIRMAR del panel de soporte para que las dos cuentas
# coincidan. Al cliente se le sigue mostrando su aviso a los 10.
MINUTOS_PARA_AVISAR = 5
SEGUNDOS_ENTRE_REVISIONES = 120
# Pedidos mas viejos que esto no se avisan: son de pruebas o de dias atras, y
# al prender esto por primera vez llegaria una avalancha de avisos viejos.
HORAS_MAXIMO = 12


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
    while True:
        try:
            # En un hilo aparte: la consulta y los envios son bloqueantes y no
            # pueden frenar las respuestas al resto de la app.
            await asyncio.to_thread(revisar_una_vez)
        except Exception as e:
            print(f"[vigilante] error inesperado: {e}")
        await asyncio.sleep(SEGUNDOS_ENTRE_REVISIONES)
