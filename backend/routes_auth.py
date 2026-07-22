# ============================================================================
# routes/auth.py - Rutas de Autenticación
# ============================================================================

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import bcrypt
from jose import JWTError, jwt
from config import get_db, settings
from models import Usuario, Negocio
from schemas import (
    UsuarioCreate, UsuarioResponse, LoginRequest,
    LoginResponse, MensajeResponse,TokenRefresh
)
from notificaciones import generar_codigo, enviar_codigo

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
        email: str = payload.get("sub")
        
        if email is None:
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
    
    user = db.query(Usuario).filter(Usuario.email == email).first()
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado",
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
async def registro(usuario: UsuarioCreate, db: Session = Depends(get_db)):
    """
    Registra un nuevo usuario en TOUTAIN
    
    - **email**: Email único del usuario
    - **nombre**: Nombre del usuario
    - **apellido**: Apellido del usuario
    - **tipo_usuario**: cliente, vendedor, domiciliario o admin
    - **password**: Contraseña (mín 8 caracteres, 1 mayúscula, 1 número)
    """
    
    # Verificar si el usuario ya existe
    usuario_existente = db.query(Usuario).filter(
        Usuario.email == usuario.email
    ).first()

    if usuario_existente:
        if usuario_existente.es_verificado:
            # Cuenta real y confirmada: no se puede reusar el correo
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El email ya está registrado"
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

    
    # Validar tipo de usuario
    tipos_validos = ["cliente", "vendedor", "domiciliario", "admin"]
    if usuario.tipo_usuario not in tipos_validos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de usuario inválido. Válidos: {tipos_validos}"
        )
    
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
async def login(credenciales: LoginRequest, db: Session = Depends(get_db)):
    """
    Inicia sesión y retorna JWT tokens
    
    - **email**: Email del usuario
    - **password**: Contraseña del usuario
    """
    
    # Buscar usuario
    usuario = db.query(Usuario).filter(
        Usuario.email == credenciales.email
    ).first()
    
    if not usuario or not verify_password(credenciales.password, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos"
        )

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
    
    # Crear tokens
    access_token = create_access_token(data={"sub": usuario.email})
    refresh_token = create_refresh_token(data={"sub": usuario.email})
    
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
async def verificar_codigo(datos: dict, db: Session = Depends(get_db)):
    email = (datos.get("email") or "").strip()
    codigo = (datos.get("codigo") or "").strip()

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

    access_token = create_access_token(data={"sub": usuario.email})
    refresh_token = create_refresh_token(data={"sub": usuario.email})

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
async def reenviar_codigo(datos: dict, db: Session = Depends(get_db)):
    email = (datos.get("email") or "").strip()

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
        email: str = payload.get("sub")
        
        if email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido"
            )
    
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado"
        )
    
    usuario = db.query(Usuario).filter(Usuario.email == email).first()
    
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado"
        )
    
    # Crear nuevo access token
    new_access_token = create_access_token(data={"sub": usuario.email})
    
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