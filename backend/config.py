# ============================================================================
# config.py - Configuración de TOUTAIN Backend
# ============================================================================

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Cargar variables de entorno
load_dotenv()

# ============================================================================
# CONFIGURACIÓN DE BASE DE DATOS
# ============================================================================

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./toutain.db"
)

# Crear engine de SQLAlchemy
engine = create_engine(
    DATABASE_URL,
    echo=False,  # Cambiar a True para ver queries SQL
    pool_pre_ping=True,  # Verifica conexión antes de usar
    pool_size=10,  # Máximo de conexiones en el pool
    max_overflow=20  # Conexiones adicionales cuando el pool está lleno
)

# Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base para los modelos
Base = declarative_base()

# ============================================================================
# CONFIGURACIÓN DE LA API
# ============================================================================

class Settings:
    # API
    API_TITLE = os.getenv("API_TITLE", "ZIPPY API")
    API_VERSION = os.getenv("API_VERSION", "1.0.0")
    # Por defecto False: en producción DEBUG expone el texto de las excepciones
    # al cliente. En local se activa poniendo DEBUG=True en backend/.env
    DEBUG = os.getenv("DEBUG", "False") == "True"
    
    # Servidor
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", 8000))
    
    # JWT
    # Sin valor por defecto a propósito: ver la validación al final del archivo
    SECRET_KEY = os.getenv("SECRET_KEY", "")
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 60
    REFRESH_TOKEN_EXPIRE_DAYS = 30
    
    # CORS
    CORS_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3002",
        "http://127.0.0.1:3003",
        # ── Capacitor (APK Android/iOS) ──
        "http://localhost",
        "https://localhost",
        "capacitor://localhost",
    ]
    # Configuración de negocio
    COMISION_TOUTAIN = float(os.getenv("COMISION_TOUTAIN", 5))  # Porcentaje
    IMPUESTO_IVA = float(os.getenv("IMPUESTO_IVA", 19))  # Porcentaje
    COSTO_DOMICILIO_BASE = float(os.getenv("COSTO_DOMICILIO_BASE", 5000))  # COP
    COSTO_DOMICILIO_KM = float(os.getenv("COSTO_DOMICILIO_KM", 1000))  # COP por km
    
    # Email vía API HTTP de Brevo (Render bloquea SMTP saliente en el plan free,
    # por eso usamos la API REST de Brevo por HTTPS en vez de smtplib)
    BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
    SMTP_REMITENTE = os.getenv("BREVO_REMITENTE", "")
    SMTP_REMITENTE_NOMBRE = os.getenv("BREVO_REMITENTE_NOMBRE", "Zippy")

    # (Variables SMTP viejas, ya no se usan para email pero se dejan por si acaso)
    SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp-relay.brevo.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
    SMTP_USER = os.getenv("BREVO_SMTP_USER", os.getenv("SMTP_USER", ""))
    SMTP_PASSWORD = os.getenv("BREVO_SMTP_KEY", os.getenv("SMTP_PASSWORD", ""))

    # SMS - Twilio (opcional)
    TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "")

    # Verificación de cuenta
    CODIGO_VERIFICACION_MINUTOS = int(os.getenv("CODIGO_VERIFICACION_MINUTOS", 15))

# Instancia global de settings
settings = Settings()

# ============================================================================
# VALIDACIÓN DE ARRANQUE
# ============================================================================
# El servidor NO arranca sin SECRET_KEY. Antes había un valor por defecto
# ("cambiar-esto-en-produccion") que quedó publicado en el repositorio: con esa
# clave cualquiera podía firmar un token válido y entrar como administrador.
# Fallar al arrancar es preferible a quedar abierto sin que nadie se entere.

if len(settings.SECRET_KEY) < 32:
    raise RuntimeError(
        "SECRET_KEY no está configurada o es demasiado corta (mínimo 32 caracteres). "
        "Genera una con:  python -c \"import secrets; print(secrets.token_urlsafe(48))\"  "
        "y agrégala como variable de entorno en Render y en tu backend/.env local."
    )

# ============================================================================
# FUNCIÓN PARA OBTENER SESIÓN DE BASE DE DATOS
# ============================================================================

def get_db():
    """
    Dependency para obtener sesión de BD en endpoints de FastAPI
    Uso: async def mi_endpoint(db: Session = Depends(get_db)):
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ============================================================================
# FUNCIÓN DE INICIALIZACIÓN DE BASE DE DATOS
# ============================================================================

def init_db():
    """Crea todas las tablas en la BD (si no existen)"""
    Base.metadata.create_all(bind=engine)
    print("✅ Base de datos inicializada correctamente")

# ============================================================================
# FUNCIÓN DE CONEXIÓN A BD
# ============================================================================

def test_db_connection():
    """Prueba la conexión a PostgreSQL"""
    try:
        from sqlalchemy import text
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            print("✅ Conexión a PostgreSQL exitosa")
            return True
    except Exception as e:
        print(f"❌ Error conectando a PostgreSQL: {e}")
        return False