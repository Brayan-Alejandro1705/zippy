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
from sqlalchemy import func
from sqlalchemy.orm import Session

from config import settings
from models import Usuario, Notificacion

# Como se llama cada perfil en el titulo del aviso cuando el celular tiene
# varias cuentas guardadas (ver notificar_usuario).
_NOMBRE_ROL = {
    "admin": "Súper admin",
    "vendedor": "Negocio",
    "domiciliario": "Repartidor",
    "cliente": "Cliente",
}

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


# Firebase responde esto cuando el celular desinstalo la app o el token ya no
# sirve: no vale la pena seguir intentando (ver notificar_usuario).
TOKEN_INVALIDO = "token_invalido"


def _enviar_fcm(token: str, titulo: str, cuerpo: str, data: dict = None):
    """Manda un push a un solo token. Devuelve True, False o TOKEN_INVALIDO;
    nunca lanza excepción."""
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
            # iPhone: sin este bloque la notificacion llega muda y sin
            # prioridad alta, que es lo que la hace sonar de una.
            apns=messaging.APNSConfig(
                headers={"apns-priority": "10"},
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(sound="default"),
                ),
            ),
        )
        messaging.send(mensaje, app=app)
        return True
    except messaging.UnregisteredError:
        print(f"[push] token {token[:12]}... ya no existe (desinstalaron la app)")
        return TOKEN_INVALIDO
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
    _enviados: set = None,
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

    token = usuario.fcm_token
    if not token:
        return

    # Un mismo celular puede tener guardadas varias cuentas (cliente, negocio,
    # super admin...) y todas comparten el token de ese celular, para que los
    # avisos suenen aunque la persona este en otro perfil. En un aviso a
    # varios usuarios a la vez, ese celular solo debe sonar una vez.
    if _enviados is not None:
        if token in _enviados:
            return
        _enviados.add(token)

    rol = str(getattr(usuario.tipo_usuario, "value", usuario.tipo_usuario) or "").lower()

    # Si el celular tiene mas de una cuenta, el titulo dice para cual es:
    # "Súper admin · Pedido por validar". Con una sola cuenta no hace falta.
    titulo_push = titulo
    try:
        cuentas_en_celular = db.query(func.count(Usuario.id)).filter(
            Usuario.fcm_token == token
        ).scalar() or 0
        if cuentas_en_celular > 1 and rol in _NOMBRE_ROL:
            titulo_push = f"{_NOMBRE_ROL[rol]} · {titulo}"
    except Exception as e:
        print(f"[push] no se pudo contar las cuentas del celular: {e}")

    resultado = _enviar_fcm(
        token,
        titulo_push,
        mensaje,
        # usuario_id le dice a la app a que cuenta cambiarse al tocar el aviso
        data={
            "tipo": tipo,
            "relacionado_id": str(relacionado_id or ""),
            "usuario_id": str(usuario.id),
            "rol": rol,
        },
    )

    # Oct 2026: si el celular ya no existe, se le quita el token a todas las
    # cuentas que lo tenian, para no seguir mandando avisos al vacio. Cuando
    # la persona vuelva a instalar la app, se registra solo otra vez.
    if resultado == TOKEN_INVALIDO:
        try:
            db.query(Usuario).filter(Usuario.fcm_token == token).update(
                {Usuario.fcm_token: None}, synchronize_session=False
            )
        except Exception as e:
            print(f"[push] no se pudo borrar el token viejo: {e}")


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
    enviados = set()
    for usuario in usuarios:
        notificar_usuario(db, usuario, tipo, titulo, mensaje, relacionado_tabla, relacionado_id,
                          _enviados=enviados)