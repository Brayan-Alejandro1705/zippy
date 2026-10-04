# ============================================================================
# whatsapp.py - Mensajes por WhatsApp con la Cloud API de Meta
# ============================================================================
#
# Para que WhatsApp deje que un negocio ESCRIBA PRIMERO (fuera de las 24 horas
# siguientes a que el usuario escribio), no se puede mandar texto libre: solo
# una PLANTILLA que Meta reviso y aprobo antes. Por eso aqui no hay mensajes
# escritos a mano, sino el nombre de una plantilla y sus variables.
#
# Lo que hay que crear una sola vez en Meta (Administrador de WhatsApp ->
# Plantillas de mensaje), y debe quedar igualito a esto:
#
#   Nombre:    bienvenida_vendedor
#   Idioma:    es
#   Categoria: Utilidad
#   Cuerpo:    Hola {{1}}, bienvenido a ZIPPYGO. Tu negocio {{2}} ya quedo
#              creado. Para empezar a vender: publica tus productos y revisa
#              tu horario de atencion. Cualquier cosa nos escribes por aqui.
#
# Y en las variables de entorno del servidor:
#   WHATSAPP_TOKEN      token permanente de un System User (NO el de prueba,
#                       que vence a las 24 horas)
#   WHATSAPP_PHONE_ID   id del numero remitente (lo da Meta, son digitos; no
#                       es el numero de telefono)
#
# Mientras falte cualquiera de los dos, esto no manda nada y lo dice en el
# registro. Asi el codigo puede estar en produccion antes de que la cuenta de
# Meta este lista, sin romper nada.

import json
import re
import threading
import urllib.error
import urllib.request

from config import settings

# Colombia. Un numero guardado con 10 digitos necesita el 57 adelante para la
# Cloud API; si ya viene con indicativo se deja como esta.
INDICATIVO_COLOMBIA = "57"


def normalizar_numero(telefono: str):
    """Deja el numero como lo pide la Cloud API: solo digitos, con indicativo.

    Devuelve None si no parece un numero util, para no gastar una llamada a la
    API en un campo vacio o con cuatro digitos.
    """
    digitos = re.sub(r"\D", "", str(telefono or ""))
    if not digitos:
        return None
    if len(digitos) == 10:
        digitos = INDICATIVO_COLOMBIA + digitos
    # Un celular colombiano con indicativo son 12 digitos; se aceptan otros
    # paises, pero menos de 10 no es un telefono.
    if len(digitos) < 10 or len(digitos) > 15:
        return None
    return digitos


def esta_configurado() -> bool:
    return bool(settings.WHATSAPP_TOKEN and settings.WHATSAPP_PHONE_ID)


def enviar_plantilla(telefono: str, plantilla: str, variables=None, idioma: str = None) -> dict:
    """Manda una plantilla aprobada a un numero.

    No lanza excepciones: devuelve {"ok": bool, "detalle": str}. Esto se llama
    desde flujos que ya tuvieron exito (un vendedor que acaba de quedar
    creado), y que WhatsApp falle no puede deshacer ni ensuciar eso.
    """
    if not esta_configurado():
        return {"ok": False, "detalle": "WhatsApp sin configurar (falta WHATSAPP_TOKEN o WHATSAPP_PHONE_ID)"}

    numero = normalizar_numero(telefono)
    if not numero:
        return {"ok": False, "detalle": f"numero no valido: {telefono!r}"}

    parametros = [{"type": "text", "text": str(v)} for v in (variables or [])]
    cuerpo = {
        "messaging_product": "whatsapp",
        "to": numero,
        "type": "template",
        "template": {
            "name": plantilla,
            "language": {"code": idioma or settings.WHATSAPP_IDIOMA},
        },
    }
    if parametros:
        cuerpo["template"]["components"] = [{"type": "body", "parameters": parametros}]

    url = f"https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}/{settings.WHATSAPP_PHONE_ID}/messages"
    peticion = urllib.request.Request(url, data=json.dumps(cuerpo).encode("utf-8"), method="POST")
    peticion.add_header("Authorization", f"Bearer {settings.WHATSAPP_TOKEN}")
    peticion.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(peticion, timeout=15) as resp:
            respuesta = json.loads(resp.read().decode(errors="ignore") or "{}")
        enviados = respuesta.get("messages") or []
        id_mensaje = enviados[0].get("id") if enviados else None
        print(f"[whatsapp] plantilla '{plantilla}' enviada a {numero} (id {id_mensaje})", flush=True)
        return {"ok": True, "detalle": id_mensaje or "enviado"}
    except urllib.error.HTTPError as e:
        # Meta explica en el cuerpo por que no lo acepto (plantilla sin
        # aprobar, token vencido, numero no valido...). Se guarda tal cual:
        # adivinar aqui solo hace perder tiempo despues.
        detalle = e.read().decode(errors="ignore")
        print(f"[whatsapp] Meta respondio {e.code}: {detalle}", flush=True)
        return {"ok": False, "detalle": f"Meta respondio {e.code}: {detalle}"}
    except Exception as e:
        print(f"[whatsapp] no se pudo enviar: {e}", flush=True)
        return {"ok": False, "detalle": str(e)}


def bienvenida_vendedor(nombre: str, nombre_negocio: str, telefono: str) -> dict:
    """La bienvenida del vendedor, con sus dos variables en orden."""
    return enviar_plantilla(
        telefono,
        settings.WHATSAPP_PLANTILLA_BIENVENIDA,
        [nombre or "vendedor", nombre_negocio or "tu negocio"],
    )


def bienvenida_vendedor_en_hilo(nombre: str, nombre_negocio: str, telefono: str) -> None:
    """Igual que la anterior, pero sin hacer esperar al que se registro.

    La llamada a Meta puede tardar segundos y el vendedor no tiene por que
    quedarse mirando una pantalla cargando por un mensaje de cortesia.
    Se mandan copias de los datos (texto, no objetos de la base) porque la
    sesion de SQLAlchemy no se puede usar desde otro hilo.
    """
    threading.Thread(
        target=bienvenida_vendedor,
        args=(str(nombre or ""), str(nombre_negocio or ""), str(telefono or "")),
        daemon=True,
    ).start()
