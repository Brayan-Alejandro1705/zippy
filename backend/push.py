# ============================================================================
# push.py - Notificaciones push vía Firebase Cloud Messaging
# ============================================================================
"""
Envía notificaciones push a los dispositivos de los usuarios (vendedores y
domiciliarios) y deja un registro en la tabla `notificaciones` para que quede
un historial dentro de la app, incluso si el push falla o el dispositivo no
tiene token todavía.

Nunca lanza una excepción hacia quien lo llama: un fallo al enviar la
notificación no debe tumbar la creación de una orden ni ninguna otra acción
del usuario. Los errores solo se registran en consola.
"""

import json
import threading

import firebase_admin
from firebase_admin import credentials, messaging
from sqlalchemy.orm import Session

from config import settings
from models import Usuario, Notificacion

_firebase_app = None
_firebase_lock = threading.Lock()
_firebase_intentado = False


def _get_firebase_app():
    """Inicializa la app de Firebase una sola vez (perezoso, hilo-seguro)."""
    global _firebase_app, _firebase_intentado

    if _firebase_app is not None:
        return _firebase_app

    with _firebase_lock:
        if _firebase_app is not None:
            return _firebase_app
        if _firebase_intentado:
            # Ya se intentó antes y falló (credencial ausente o inválida);
            # no lo vuelve a intentar en cada llamada.
            return None
        _firebase_intentado = True

        if not settings.FIREBASE_SERVICE_ACCOUNT_JSON:
            print("[push] FIREBASE_SERVICE_ACCOUNT_JSON no configurado, se omiten los push")
            return None

        try:
            info = json.loads(settings.FIREBASE_SERVICE_ACCOUNT_JSON)
            cred = credentials.Certificate(info)
            _firebase_app = firebase_admin.initialize_app(cred)
            return _firebase_app
        except Exception as e:
            print(f"[push] no se pudo inicializar Firebase: {e}")
            return None


def _enviar_fcm(token: str, titulo: str, cuerpo: str, data: dict = None) -> bool:
    """Manda un push a un solo token. Devuelve True/False, nunca lanza excepción."""
    app = _get_firebase_app()
    if not app or not token:
        return False

    try:
        mensaje = messaging.Message(
            token=token,
            notification=messaging.Notification(title=titulo, body=cuerpo),
            data={k: str(v) for k, v in (data or {}).items()},
            android=messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(sound="default"),
            ),
        )
        messaging.send(mensaje, app=app)
        return True
    except Exception as e:
        print(f"[push] fallo enviando a token {token[:12]}...: {e}")
        return False


def notificar_usuario(
    db: Session,
    usuario: Usuario,
    tipo: str,
    titulo: str,
    mensaje: str,
    relacionado_tabla: str = None,
    relacionado_id=None,
) -> None:
    """
    Registra la notificación en la base de datos (historial dentro de la app)
    y, si el usuario tiene un token de push guardado, también se la manda al
    dispositivo. No confirma la transacción (db.commit()) — queda a cargo de
    quien llama, para que la notificación se guarde junto con el resto de
    cambios de la misma operación.
    """
    if usuario is None:
        return

    notificacion = Notificacion(
        usuario_id=usuario.id,
        tipo=tipo,
        titulo=titulo,
        mensaje=mensaje,
        relacionado_tabla=relacionado_tabla,
        relacionado_id=relacionado_id,
    )
    db.add(notificacion)

    if usuario.fcm_token:
        _enviar_fcm(
            usuario.fcm_token,
            titulo,
            mensaje,
            data={"tipo": tipo, "relacionado_id": str(relacionado_id or "")},
        )


def notificar_usuarios(
    db: Session,
    usuarios: list,
    tipo: str,
    titulo: str,
    mensaje: str,
    relacionado_tabla: str = None,
    relacionado_id=None,
) -> None:
    """Igual que notificar_usuario pero para una lista (ej: todos los domiciliarios disponibles)."""
    for usuario in usuarios:
        notificar_usuario(db, usuario, tipo, titulo, mensaje, relacionado_tabla, relacionado_id)