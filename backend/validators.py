# ============================================================================
# validators.py - Validación de correo y teléfono para registro/perfil
# ============================================================================

import phonenumbers
from email_validator import validate_email, EmailNotValidError

DOMINIOS_DESECHABLES = {
    "yopmail.com", "mailinator.com", "guerrillamail.com",
    "tempmail.com", "10minutemail.com", "throwawaymail.com",
    "temp-mail.org", "getnada.com", "trashmail.com", "sharklasers.com",
}


def validar_correo(correo: str) -> dict:
    """Valida formato y descarta dominios de correo desechable.
    No hace check_deliverability (DNS en vivo) para no depender de
    la red en cada registro; el código de verificación ya confirma
    que el correo es alcanzable."""
    try:
        valid = validate_email(correo, check_deliverability=False)
        correo_norm = valid.normalized
        dominio = correo_norm.split("@")[-1].lower()
        if dominio in DOMINIOS_DESECHABLES:
            return {"valido": False, "error": "No se permiten correos temporales/desechables"}
        return {"valido": True, "correo": correo_norm}
    except EmailNotValidError:
        return {"valido": False, "error": "El correo electrónico no es válido"}


def validar_telefono(numero: str, region: str = "CO") -> dict:
    """Valida y normaliza un teléfono a formato E164 (+573001234567)."""
    try:
        parsed = phonenumbers.parse(numero, region)
        if not phonenumbers.is_valid_number(parsed):
            return {"valido": False, "error": "El número de teléfono no es válido"}
        formato = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
        return {"valido": True, "telefono": formato}
    except phonenumbers.NumberParseException:
        return {"valido": False, "error": "El número de teléfono no es válido"}
