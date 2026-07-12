# ============================================================================
# notificaciones.py - Envío de códigos de verificación (email / SMS)
# ============================================================================

import random
import json
import base64
import urllib.request
import urllib.error
import urllib.parse

from config import settings


def generar_codigo() -> str:
    """Código numérico de 6 dígitos"""
    return f"{random.randint(0, 999999):06d}"


def enviar_codigo_email(destinatario: str, nombre: str, codigo: str) -> None:
    """Envía el código de verificación por correo vía la API HTTP de Brevo.
    (No usamos SMTP porque Render bloquea los puertos SMTP salientes en el plan free).
    Lanza una excepción si no está configurado o falla el envío."""
    if not settings.BREVO_API_KEY or not settings.SMTP_REMITENTE:
        raise RuntimeError("Brevo no está configurado (BREVO_API_KEY / BREVO_REMITENTE)")

    cuerpo = (
        f"Hola {nombre},\n\n"
        f"Tu código de verificación de Zippy es: {codigo}\n\n"
        f"Vence en {settings.CODIGO_VERIFICACION_MINUTOS} minutos. "
        f"Si no creaste esta cuenta, ignora este mensaje.\n"
    )

    payload = json.dumps({
        "sender": {"email": settings.SMTP_REMITENTE, "name": settings.SMTP_REMITENTE_NOMBRE},
        "to": [{"email": destinatario, "name": nombre}],
        "subject": "Tu código de verificación de Zippy",
        "textContent": cuerpo,
    }).encode("utf-8")

    request = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=payload,
        method="POST",
    )
    request.add_header("accept", "application/json")
    request.add_header("api-key", settings.BREVO_API_KEY)
    request.add_header("content-type", "application/json")

    try:
        with urllib.request.urlopen(request, timeout=15) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        detalle = e.read().decode(errors="ignore")
        raise RuntimeError(f"Brevo respondió {e.code}: {detalle}") from e


def enviar_codigo_sms(telefono: str, codigo: str) -> None:
    """Envía el código de verificación por SMS vía la API REST de Twilio.
    Lanza una excepción si no está configurado o falla el envío."""
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN or not settings.TWILIO_FROM_NUMBER:
        raise RuntimeError("Twilio no está configurado (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER)")

    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
    cuerpo = f"Tu código de verificación de Zippy es: {codigo} (vence en {settings.CODIGO_VERIFICACION_MINUTOS} min)"

    data = urllib.parse.urlencode({
        "To": telefono,
        "From": settings.TWILIO_FROM_NUMBER,
        "Body": cuerpo,
    }).encode("utf-8")

    auth = base64.b64encode(f"{settings.TWILIO_ACCOUNT_SID}:{settings.TWILIO_AUTH_TOKEN}".encode()).decode()
    request = urllib.request.Request(url, data=data, method="POST")
    request.add_header("Authorization", f"Basic {auth}")
    request.add_header("Content-Type", "application/x-www-form-urlencoded")

    try:
        with urllib.request.urlopen(request, timeout=15) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        detalle = e.read().decode(errors="ignore")
        raise RuntimeError(f"Twilio respondió {e.code}: {detalle}") from e


def enviar_codigo(metodo: str, destinatario_email: str, telefono: str, nombre: str, codigo: str) -> None:
    if metodo == "sms":
        if not telefono:
            raise ValueError("Se requiere teléfono para verificación por SMS")
        enviar_codigo_sms(telefono, codigo)
    else:
        enviar_codigo_email(destinatario_email, nombre, codigo)