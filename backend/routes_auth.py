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
    LoginResponse, MensajeResponse
)

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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El email ya está registrado"
        )
    
    # Validar tipo de usuario
    tipos_validos = ["cliente", "vendedor", "domiciliario", "admin"]
    if usuario.tipo_usuario not in tipos_validos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de usuario inválido. Válidos: {tipos_validos}"
        )
    
    # Crear nuevo usuario
    nuevo_usuario = Usuario(
        email=usuario.email,
        nombre=usuario.nombre,
        apellido=usuario.apellido,
        telefono=usuario.telefono,
        tipo_usuario=usuario.tipo_usuario,
        password_hash=hash_password(usuario.password),
        estado="activo",
        fecha_creacion=datetime.utcnow()
    )
    
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)
    
    # Crear negocio predeterminado si es vendedor
    if nuevo_usuario.tipo_usuario == "vendedor":
        nuevo_negocio = Negocio(
            vendedor_id=nuevo_usuario.id,
            nombre_negocio=f"Negocio de {nuevo_usuario.nombre}",
            descripcion="Descripción de mi negocio",
            categoria="General",
            estado="activo",
            fecha_creacion=datetime.utcnow()
        )
        db.add(nuevo_negocio)
        db.commit()
    
    # Crear tokens
    access_token = create_access_token(data={"sub": nuevo_usuario.email})
    refresh_token = create_refresh_token(data={"sub": nuevo_usuario.email})
    
    return {
        "mensaje": "Usuario registrado exitosamente",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
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
    "/refresh",
    response_model=dict,
    summary="Refrescar token",
    description="Obtiene un nuevo access token usando el refresh token"
)
async def refresh_token(refresh_token: str, db: Session = Depends(get_db)):
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
