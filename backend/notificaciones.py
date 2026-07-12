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


def _plantilla_html_codigo(nombre: str, codigo: str, minutos: int) -> str:
    """Plantilla HTML del correo de verificación con el estilo de marca de Zippy."""
    return f"""\
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; background-color:#1a1625; font-family:'Segoe UI', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1625; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px; background:linear-gradient(180deg,#241b35 0%,#1a1625 100%); border-radius:16px; overflow:hidden; border:1px solid #3a2f52;">
          <tr>
            <td style="padding:32px 32px 8px 32px; text-align:center;">
              <div style="font-size:28px; font-weight:800; letter-spacing:0.5px;">
                <span style="color:#ff8c2b;">Zip</span><span style="color:#ffffff;">py</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 0 32px; text-align:center;">
              <div style="font-size:40px; line-height:1;">📬</div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0 32px; text-align:center;">
              <h1 style="color:#ffffff; font-size:20px; margin:0 0 8px 0;">Verifica tu cuenta</h1>
              <p style="color:#b8aecb; font-size:14px; margin:0;">Hola {nombre}, usa este código para confirmar tu correo:</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background-color:#2a2140; border:1px solid #ff8c2b; border-radius:12px; padding:18px 0;">
                    <span style="color:#ffffff; font-size:34px; font-weight:700; letter-spacing:10px;">{codigo}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px 32px; text-align:center;">
              <p style="color:#8a7fa3; font-size:13px; margin:0 0 4px 0;">Este código vence en {minutos} minutos.</p>
              <p style="color:#8a7fa3; font-size:13px; margin:0;">Si no creaste esta cuenta, ignora este mensaje.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px; border-top:1px solid #3a2f52; text-align:center;">
              <p style="color:#645a7a; font-size:12px; margin:0;">Zippy · Garzón, Huila</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def enviar_codigo_email(destinatario: str, nombre: str, codigo: str) -> None:
    """Envía el código de verificación por correo vía la API HTTP de Brevo.
    (No usamos SMTP porque Render bloquea los puertos SMTP salientes en el plan free).
    Lanza una excepción si no está configurado o falla el envío."""
    if not settings.BREVO_API_KEY or not settings.SMTP_REMITENTE:
        raise RuntimeError("Brevo no está configurado (BREVO_API_KEY / BREVO_REMITENTE)")

    cuerpo_texto = (
        f"Hola {nombre},\n\n"
        f"Tu código de verificación de Zippy es: {codigo}\n\n"
        f"Vence en {settings.CODIGO_VERIFICACION_MINUTOS} minutos. "
        f"Si no creaste esta cuenta, ignora este mensaje.\n"
    )
    cuerpo_html = _plantilla_html_codigo(nombre, codigo, settings.CODIGO_VERIFICACION_MINUTOS)

    payload = json.dumps({
        "sender": {"email": settings.SMTP_REMITENTE, "name": settings.SMTP_REMITENTE_NOMBRE},
        "to": [{"email": destinatario, "name": nombre}],
        "subject": "Tu código de verificación de Zippy",
        "textContent": cuerpo_texto,
        "htmlContent": cuerpo_html,
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