# ============================================================================
# routes/auth.py - Rutas de Autenticación
# ============================================================================

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import bcrypt
from jose import JWTError, jwt
from config import get_db, settings
from models import (
    Usuario, Negocio, EstadoUsuario, EstadoNegocio,
    Direccion, Favorito, Notificacion,
)
import uuid as uuid_lib
from schemas import (
    UsuarioCreate, UsuarioResponse, LoginRequest,
    LoginResponse, MensajeResponse, TokenRefresh, EliminarCuentaRequest

)
from notificaciones import generar_codigo, enviar_codigo
from rate_limit import limiter

router = APIRouter(prefix="/api/v1/auth", tags=["Autenticación"])

# ============================================================================
# CONFIGURACIÓN DE SEGURIDAD
# ============================================================================

# bcrypt se usa directamente (passlib no es compatible con bcrypt v4+)

# ============================================================================
# FUNCIONES AUXILIARES
# ============================================================================

def hash_password(password: str) -> str:
    """Encripta una contraseña"""
    password_bytes = password[:72].encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica que la contraseña sea correcta"""
    try:
        return bcrypt.checkpw(
            plain_password[:72].encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """Crea un JWT access token"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.SECRET_KEY, 
        algorithm=settings.ALGORITHM
    )
    
    return encoded_jwt

def create_refresh_token(data: dict) -> str:
    """Crea un JWT refresh token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.SECRET_KEY, 
        algorithm=settings.ALGORITHM
    )
    
    return encoded_jwt

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

reusable_oauth2 = HTTPBearer(auto_error=False)

def get_current_user(
    token_auth: HTTPAuthorizationCredentials = Depends(reusable_oauth2),
    db: Session = Depends(get_db)
) -> Usuario:
    """
    Obtiene el usuario actual desde el JWT token
    Usa como dependency en endpoints protegidos
    """
    if not token_auth:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token no proporcionado",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    token = token_auth.credentials
    try:
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido",
                headers={"WWW-Authenticate": "Bearer"}
            )
    
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado o inválido",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # El 'sub' del token es el id del usuario (no el email): un mismo email
    # puede pertenecer a varias cuentas (una por rol), asi que el id es lo
    # unico que identifica exactamente la cuenta con la que se inicio sesion.
    try:
        user = db.query(Usuario).filter(Usuario.id == user_id).first()
    except Exception:
        user = None
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Una cuenta eliminada conserva su fila (las ordenes la referencian), pero
    # ya no puede usarse. Sin esto, un token emitido antes del borrado seguiria
    # funcionando hasta expirar.
    if user.estado == EstadoUsuario.ELIMINADO:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Esta cuenta fue eliminada",
            headers={"WWW-Authenticate": "Bearer"}
        )

    return user

# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post(
    "/registro",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar nuevo usuario",
    description="Crea una nueva cuenta de usuario"
)
@limiter.limit("5/hour")
async def registro(request: Request, usuario: UsuarioCreate, db: Session = Depends(get_db)):
    """
    Registra un nuevo usuario en TOUTAIN
    
    - **email**: Email único del usuario
    - **nombre**: Nombre del usuario
    - **apellido**: Apellido del usuario
    - **tipo_usuario**: cliente, vendedor, domiciliario o admin
    - **password**: Contraseña (mín 8 caracteres, 1 mayúscula, 1 número)
    """
    
    # Validar tipo de usuario ANTES de buscar duplicados: la busqueda de
    # duplicados depende del tipo, asi que no puede ir despues.
    # "domiciliario" ya no es un tipo auto-registrable: solo un super
    # admin puede crear cuentas de repartidor (ver /api/v1/usuarios/repartidor/).
    tipos_validos = ["cliente", "vendedor", "admin"]
    if usuario.tipo_usuario not in tipos_validos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de usuario inválido. Válidos: {tipos_validos}"
        )

    # Un correo puede repetirse mientras el ROL sea distinto. Antes esto
    # filtraba solo por email, asi que un cliente ya verificado nunca podia
    # registrarse tambien como vendedor: le salia "El email ya esta registrado".
    # Eso mataba el multi-cuenta en la puerta de entrada.
    usuario_existente = db.query(Usuario).filter(
        Usuario.email == usuario.email,
        Usuario.tipo_usuario == usuario.tipo_usuario
    ).first()

    if usuario_existente:
        if usuario_existente.es_verificado:
            # Ya tiene una cuenta de ESTE rol con ese correo
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya tienes una cuenta de este tipo con ese correo"
            )

        # Cuenta nunca verificada: solo se libera el correo si el código ya expiró.
        # Así evitamos que un correo quede "atrapado" para siempre si la persona
        # nunca recibió o nunca puso el código, pero también evitamos que se pueda
        # reiniciar el registro a cada rato mientras el código sigue vigente.
        codigo_expirado = (
            usuario_existente.codigo_verificacion_expira is None
            or usuario_existente.codigo_verificacion_expira < datetime.utcnow()
        )
        if not codigo_expirado:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existe un registro pendiente de verificación con este correo. "
                       "Revisa tu correo o espera unos minutos a que expire el código para volver a intentar."
            )

        # Código expirado: borrar el registro anterior (y su negocio, si tenía) para permitir reintentar
        db.query(Negocio).filter(Negocio.vendedor_id == usuario_existente.id).delete()
        db.delete(usuario_existente)
        db.commit()

    
    codigo = generar_codigo()

    # Crear nuevo usuario (sin verificar hasta que confirme el código)
    nuevo_usuario = Usuario(
        email=usuario.email,
        nombre=usuario.nombre,
        apellido=usuario.apellido,
        telefono=usuario.telefono,
        tipo_usuario=usuario.tipo_usuario,
        password_hash=hash_password(usuario.password),
        estado="activo",
        es_verificado=False,
        codigo_verificacion=codigo,
        codigo_verificacion_expira=datetime.utcnow() + timedelta(minutes=settings.CODIGO_VERIFICACION_MINUTOS),
        metodo_verificacion=usuario.metodo_verificacion,
        vehiculo=(usuario.vehiculo or None) if usuario.tipo_usuario == "domiciliario" else None,
        placa=(usuario.placa or "").upper().replace(" ", "")[:10] or None if usuario.tipo_usuario == "domiciliario" else None,
        fecha_creacion=datetime.utcnow()
    )

    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)

    # Crear negocio si es vendedor
    if nuevo_usuario.tipo_usuario == "vendedor":
        nuevo_negocio = Negocio(
            vendedor_id=nuevo_usuario.id,
            nombre_negocio=usuario.nombre_negocio or f"Negocio de {nuevo_usuario.nombre}",
            categoria=usuario.categoria_negocio or "General",
            ciudad=usuario.ciudad,
            es_servicio=usuario.es_servicio or False,
            estado="activo",
            fecha_creacion=datetime.utcnow()
        )
        db.add(nuevo_negocio)
        db.commit()

    envio_ok = True
    try:
        enviar_codigo(usuario.metodo_verificacion, nuevo_usuario.email, nuevo_usuario.telefono, nuevo_usuario.nombre, codigo)
    except Exception as e:
        envio_ok = False
        print(f"⚠️ No se pudo enviar el código de verificación a {nuevo_usuario.email}: {e}")

    return {
        "mensaje": "Cuenta creada. Revisa tu " + ("SMS" if usuario.metodo_verificacion == "sms" else "correo") + " para verificarla."
                   if envio_ok else
                   "Cuenta creada, pero no se pudo enviar el código de verificación. Usa 'reenviar código' para intentar de nuevo.",
        "requiere_verificacion": True,
        "envio_ok": envio_ok,
        "metodo_verificacion": usuario.metodo_verificacion,
        "usuario": {
            "id": str(nuevo_usuario.id),
            "email": nuevo_usuario.email,
            "nombre": nuevo_usuario.nombre,
            "apellido": nuevo_usuario.apellido,
            "tipo_usuario": nuevo_usuario.tipo_usuario,
            "es_verificado": nuevo_usuario.es_verificado
        }
    }

@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Iniciar sesión",
    description="Inicia sesión con email y contraseña"
)
@limiter.limit("8/minute")
async def login(request: Request, credenciales: LoginRequest, db: Session = Depends(get_db)):
    """
    Inicia sesión y retorna JWT tokens
    
    - **email**: Email del usuario
    - **password**: Contraseña del usuario
    """
    
    # Un mismo correo puede tener varias cuentas (una por rol). Se prueba la
    # contrasena contra todas y se recogen TODAS las que coinciden, no la
    # primera: si la persona usa la misma clave para su cuenta de cliente y la
    # de vendedor (lo normal), quedarse con la primera entraba a un rol u otro
    # al azar, porque Postgres no garantiza el orden de un SELECT sin ORDER BY.
    candidatos = db.query(Usuario).filter(
        Usuario.email == credenciales.email,
        Usuario.estado != EstadoUsuario.ELIMINADO
    ).all()
    coincidencias = [u for u in candidatos if verify_password(credenciales.password, u.password_hash)]

    # Si el front ya sabe a que rol quiere entrar, se filtra por el
    if credenciales.tipo_usuario:
        coincidencias = [u for u in coincidencias if u.tipo_usuario == credenciales.tipo_usuario]

    if not coincidencias:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos"
        )

    # Varias cuentas con ese correo y esa clave: no se adivina, se le pregunta.
    if len(coincidencias) > 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "MULTIPLE_CUENTAS",
                "mensaje": "Este correo tiene varias cuentas. Elige con cuál quieres entrar.",
                "cuentas": [
                    {"tipo_usuario": u.tipo_usuario, "nombre": u.nombre}
                    for u in coincidencias
                ],
            }
        )

    usuario = coincidencias[0]

    if not usuario.es_verificado:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "CUENTA_NO_VERIFICADA",
                "mensaje": "Debes verificar tu cuenta antes de iniciar sesión",
                "metodo_verificacion": usuario.metodo_verificacion or "email",
            }
        )

    # Verificar que el usuario esté activo
    if usuario.estado != "activo":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Usuario {usuario.estado}"
        )
    
    # Crear tokens. Se usa el id (no el email) como 'sub' porque el email
    # puede pertenecer a varias cuentas -- el id identifica exactamente cual.
    access_token = create_access_token(data={"sub": str(usuario.id)})
    refresh_token = create_refresh_token(data={"sub": str(usuario.id)})
    
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        usuario=UsuarioResponse.from_orm(usuario),
        token_type="bearer"
    )

@router.post(
    "/verificar-codigo",
    response_model=LoginResponse,
    summary="Verificar cuenta con el código enviado",
    description="Confirma el código de verificación (email o SMS) y activa la sesión"
)
@limiter.limit("5/minute")
async def verificar_codigo(request: Request, datos: dict, db: Session = Depends(get_db)):
    email = (datos.get("email") or "").strip()
    codigo = (datos.get("codigo") or "").strip()
    tipo_usuario = (datos.get("tipo_usuario") or "").strip()

    # Un mismo correo puede tener varias cuentas (una por rol), asi que filtrar
    # solo por email no basta -- eso hacia que a veces se verificara y devolviera
    # una cuenta distinta (ej. la de cliente en vez de la de vendedor recien
    # creada). Se prioriza la cuenta sin verificar que coincida con el rol
    # indicado, y si no se indica rol, la mas reciente sin verificar.
    query = db.query(Usuario).filter(Usuario.email == email, Usuario.es_verificado == False)
    if tipo_usuario:
        query = query.filter(Usuario.tipo_usuario == tipo_usuario)
    usuario = query.order_by(Usuario.fecha_creacion.desc()).first()
    # El fallback solo aplica cuando NO se indico rol. Si el front dijo
    # "vendedor" y no hay vendedor pendiente, caer a cualquier cuenta del correo
    # significaba verificar o reenviarle el codigo a la cuenta equivocada.
    if not usuario and not tipo_usuario:
        usuario = db.query(Usuario).filter(Usuario.email == email).first()
    if not usuario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    if usuario.es_verificado:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esta cuenta ya está verificada")

    if not usuario.codigo_verificacion or not codigo or usuario.codigo_verificacion != codigo:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código incorrecto")

    if not usuario.codigo_verificacion_expira or usuario.codigo_verificacion_expira < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El código venció, solicita uno nuevo")

    usuario.es_verificado = True
    usuario.codigo_verificacion = None
    usuario.codigo_verificacion_expira = None
    db.commit()
    db.refresh(usuario)

    access_token = create_access_token(data={"sub": str(usuario.id)})
    refresh_token = create_refresh_token(data={"sub": str(usuario.id)})

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        usuario=UsuarioResponse.from_orm(usuario),
        token_type="bearer"
    )

@router.post(
    "/reenviar-codigo",
    response_model=MensajeResponse,
    summary="Reenviar código de verificación",
    description="Genera y reenvía un nuevo código de verificación por el mismo canal"
)
@limiter.limit("3/minute")
async def reenviar_codigo(request: Request, datos: dict, db: Session = Depends(get_db)):
    email = (datos.get("email") or "").strip()
    tipo_usuario = (datos.get("tipo_usuario") or "").strip()

    query = db.query(Usuario).filter(Usuario.email == email, Usuario.es_verificado == False)
    if tipo_usuario:
        query = query.filter(Usuario.tipo_usuario == tipo_usuario)
    usuario = query.order_by(Usuario.fecha_creacion.desc()).first()
    # El fallback solo aplica cuando NO se indico rol. Si el front dijo
    # "vendedor" y no hay vendedor pendiente, caer a cualquier cuenta del correo
    # significaba verificar o reenviarle el codigo a la cuenta equivocada.
    if not usuario and not tipo_usuario:
        usuario = db.query(Usuario).filter(Usuario.email == email).first()
    if not usuario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    if usuario.es_verificado:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esta cuenta ya está verificada")

    metodo = datos.get("metodo_verificacion") or usuario.metodo_verificacion or "email"
    if metodo not in ("email", "sms"):
        metodo = "email"

    codigo = generar_codigo()
    usuario.codigo_verificacion = codigo
    usuario.codigo_verificacion_expira = datetime.utcnow() + timedelta(minutes=settings.CODIGO_VERIFICACION_MINUTOS)
    usuario.metodo_verificacion = metodo
    db.commit()

    try:
        enviar_codigo(metodo, usuario.email, usuario.telefono, usuario.nombre, codigo)
    except Exception as e:
        print(f"⚠️ No se pudo reenviar el código de verificación a {usuario.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No se pudo enviar el código. Intenta de nuevo en unos minutos."
        )

    return MensajeResponse(mensaje=f"Código reenviado por {'SMS' if metodo == 'sms' else 'correo'}")

@router.post(
    "/olvide-password",
    response_model=MensajeResponse,
    summary="Solicitar restablecer contraseña",
    description="Envía un código de 6 dígitos (por el mismo canal de verificación) para restablecer la contraseña"
)
@limiter.limit("3/hour")
async def olvide_password(request: Request, datos: dict, db: Session = Depends(get_db)):
    email = (datos.get("email") or "").strip()
    tipo_usuario = (datos.get("tipo_usuario") or "").strip()

    # Igual que en verificar/reenviar código: si no se indica rol, se usa la
    # cuenta verificada más reciente con ese correo.
    query = db.query(Usuario).filter(Usuario.email == email, Usuario.es_verificado == True)
    if tipo_usuario:
        query = query.filter(Usuario.tipo_usuario == tipo_usuario)
    usuario = query.order_by(Usuario.fecha_creacion.desc()).first()
    if not usuario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No encontramos una cuenta verificada con ese correo")

    metodo = datos.get("metodo_verificacion") or usuario.metodo_verificacion or "email"
    if metodo not in ("email", "sms"):
        metodo = "email"

    # Se reutilizan las mismas columnas del código de verificación: en una
    # cuenta ya verificada quedan libres, así que no hace falta una tabla ni
    # columnas nuevas para esto.
    codigo = generar_codigo()
    usuario.codigo_verificacion = codigo
    usuario.codigo_verificacion_expira = datetime.utcnow() + timedelta(minutes=settings.CODIGO_VERIFICACION_MINUTOS)
    db.commit()

    try:
        enviar_codigo(metodo, usuario.email, usuario.telefono, usuario.nombre, codigo)
    except Exception as e:
        print(f"⚠️ No se pudo enviar el código de restablecimiento a {usuario.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No se pudo enviar el código. Intenta de nuevo en unos minutos."
        )

    return MensajeResponse(mensaje=f"Código enviado por {'SMS' if metodo == 'sms' else 'correo'}")

@router.post(
    "/restablecer-password",
    response_model=MensajeResponse,
    summary="Restablecer contraseña con código",
    description="Confirma el código recibido y establece una nueva contraseña"
)
@limiter.limit("5/hour")
async def restablecer_password(request: Request, datos: dict, db: Session = Depends(get_db)):
    email = (datos.get("email") or "").strip()
    tipo_usuario = (datos.get("tipo_usuario") or "").strip()
    codigo = (datos.get("codigo") or "").strip()
    nueva_password = datos.get("nueva_password") or ""

    query = db.query(Usuario).filter(Usuario.email == email, Usuario.es_verificado == True)
    if tipo_usuario:
        query = query.filter(Usuario.tipo_usuario == tipo_usuario)
    usuario = query.order_by(Usuario.fecha_creacion.desc()).first()
    if not usuario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    if not usuario.codigo_verificacion or not codigo or usuario.codigo_verificacion != codigo:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código incorrecto")

    if not usuario.codigo_verificacion_expira or usuario.codigo_verificacion_expira < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El código venció, solicita uno nuevo")

    if len(nueva_password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La contraseña debe tener al menos 8 caracteres")
    if not any(c.isupper() for c in nueva_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La contraseña debe incluir al menos una mayúscula")
    if not any(c.isdigit() for c in nueva_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La contraseña debe incluir al menos un número")

    usuario.password_hash = hash_password(nueva_password)
    usuario.codigo_verificacion = None
    usuario.codigo_verificacion_expira = None
    db.commit()

    return MensajeResponse(mensaje="Contraseña actualizada correctamente")

@router.post(
    "/refresh",
    response_model=dict,
    summary="Refrescar token",
    description="Obtiene un nuevo access token usando el refresh token"
)
async def refresh_token(datos: TokenRefresh, db: Session = Depends(get_db)):
    refresh_token = datos.refresh_token
    """
    Refrescar el access token usando el refresh token
    
    - **refresh_token**: Token de refresco
    """
    
    try:
        payload = jwt.decode(
            refresh_token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido"
            )
    
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado"
        )
    
    usuario = db.query(Usuario).filter(Usuario.id == user_id).first()
    
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado"
        )
    
    # Crear nuevo access token
    new_access_token = create_access_token(data={"sub": str(usuario.id)})
    
    return {
        "access_token": new_access_token,
        "token_type": "bearer"
    }

@router.get(
    "/me",
    response_model=UsuarioResponse,
    summary="Obtener datos del usuario actual",
    description="Retorna la información del usuario autenticado"
)
async def me(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtiene los datos del usuario actual autenticado
    Requiere: Authorization: Bearer {token}
    """
    return UsuarioResponse.from_orm(current_user)

@router.post(
    "/logout",
    response_model=MensajeResponse,
    summary="Cerrar sesión",
    description="Cierra la sesión del usuario"
)
async def logout(current_user: Usuario = Depends(get_current_user)):
    """
    Cierra la sesión (en implementación real invalidaría el token)
    Requiere: Authorization: Bearer {token}
    """
    return MensajeResponse(mensaje="Sesión cerrada exitosamente")

# ============================================================================
# ENDPOINT PARA TESTING
# ============================================================================

@router.get(
    "/test",
    response_model=MensajeResponse,
    summary="Test de API",
    description="Endpoint para verificar que la API está funcionando"
)
async def test():
    """Test endpoint - Verifica que la API está online"""
    return MensajeResponse(mensaje="✅ TOUTAIN Auth API está funcionando")

# ============================================================================
# ELIMINACION DE CUENTA
#
# Google Play exige que toda app que permita crear cuentas ofrezca una via
# para eliminarlas, dentro y fuera de la app.
#
# No se borra la fila: las ordenes, transacciones y facturas la referencian y
# la ley obliga a conservar ese soporte contable. Lo que se hace es anonimizar
# los datos personales y marcar la cuenta como ELIMINADO, que es exactamente
# lo que declara la politica publicada ("se conservan disociados de la cuenta").
# ============================================================================

@router.post(
    "/eliminar-cuenta",
    response_model=MensajeResponse,
    summary="Eliminar la cuenta del usuario autenticado",
    description="Anonimiza los datos personales y desactiva la cuenta. Es irreversible."
)
async def eliminar_cuenta(
    datos: EliminarCuentaRequest,
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Se pide la contrasena para que un telefono desbloqueado ajeno no pueda
    # borrar la cuenta con dos toques.
    if not verify_password(datos.password, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña incorrecta"
        )

    if usuario.es_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Las cuentas de administración no pueden eliminarse desde la app"
        )

    marca = datetime.utcnow()
    # El email se reemplaza por uno irrepetible para liberar la pareja
    # (email, tipo_usuario) y que la persona pueda volver a registrarse.
    anonimo = f"eliminado+{usuario.id}@zippygo.invalid"

    usuario.email = anonimo
    usuario.nombre = "Cuenta"
    usuario.apellido = "eliminada"
    usuario.telefono = None
    usuario.documento = None
    usuario.foto_perfil = None
    usuario.latitud = None
    usuario.longitud = None
    usuario.vehiculo = None
    usuario.placa = None
    usuario.codigo_verificacion = None
    usuario.codigo_verificacion_expira = None
    # Contrasena imposible de acertar: deja la fila inutilizable para login.
    usuario.password_hash = hash_password(uuid_lib.uuid4().hex + uuid_lib.uuid4().hex)
    usuario.estado = EstadoUsuario.ELIMINADO
    usuario.es_verificado = False
    usuario.fecha_eliminacion = marca

    # Si era vendedor, su negocio deja de estar visible en la tienda.
    negocio = db.query(Negocio).filter(Negocio.vendedor_id == usuario.id).first()
    if negocio:
        negocio.estado = EstadoNegocio.INACTIVO

    # Datos accesorios que no son soporte contable: se borran de verdad.
    # Ojo: Favorito referencia al usuario por cliente_id, no por usuario_id.
    db.query(Direccion).filter(Direccion.usuario_id == usuario.id).delete(synchronize_session=False)
    db.query(Notificacion).filter(Notificacion.usuario_id == usuario.id).delete(synchronize_session=False)
    db.query(Favorito).filter(Favorito.cliente_id == usuario.id).delete(synchronize_session=False)

    db.commit()

    return MensajeResponse(
        mensaje="Tu cuenta fue eliminada. Los registros de pedidos se conservan por obligación legal, sin tus datos personales."
    )