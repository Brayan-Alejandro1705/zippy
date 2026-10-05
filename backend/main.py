# ============================================================================
# main.py - Punto de entrada de TOUTAIN API
# ============================================================================

import os
import sys
import threading
import traceback
from datetime import datetime, timedelta
# Configurar la codificación de la terminal para soportar emojis en Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from rate_limit import limiter

from config import settings, test_db_connection, init_db
from notificaciones import enviar_alerta_error_email

os.makedirs("uploads/productos", exist_ok=True)

# ============================================================================
# CREAR APLICACIÓN FASTAPI
# ============================================================================

# En local (DEBUG) la documentacion queda abierta, que es cuando sirve. En
# produccion queda cerrada salvo que se pida a proposito con DOCS_PUBLICAS:
# esa pagina no filtra datos, pero le muestra a cualquiera el mapa completo de
# la API, y eso le ahorra trabajo a quien ande buscando por donde entrar.
_mostrar_docs = settings.DEBUG or settings.DOCS_PUBLICAS

app = FastAPI(
    title=settings.API_TITLE,
    description="Marketplace Garzón Huila - Un solo app para comprar, vender y crecer",
    version=settings.API_VERSION,
    docs_url="/docs" if _mostrar_docs else None,
    redoc_url="/redoc" if _mostrar_docs else None,
    # Sin esto, cerrar /docs no serviria de nada: el mapa completo se baja
    # igual pidiendo /openapi.json.
    openapi_url="/openapi.json" if _mostrar_docs else None,
)

# ============================================================================
# MIDDLEWARE: RATE LIMITING (protege login/registro de fuerza bruta y abuso)
# ============================================================================

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ============================================================================
# MIDDLEWARE: CORS (Permitir requests desde frontend)
# ============================================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# MIDDLEWARE: HEADERS DE SEGURIDAD
# ============================================================================
# No usamos una CSP estricta porque romperia el Swagger UI (/docs, /redoc)
# que carga JS/CSS desde CDNs externos. El resto de headers si se aplican
# siempre.

@app.middleware("http")
async def agregar_headers_seguridad(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(self), camera=(), microphone=()"
    # HSTS: solo tiene sentido cuando la conexion ya es HTTPS (Render la
    # sirve por HTTPS, pero en local/dev es HTTP y el header se ignora).
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response

# ============================================================================
# ARCHIVOS ESTÁTICOS (imágenes subidas)
# ============================================================================

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ============================================================================
# EVENTOS DE STARTUP Y SHUTDOWN
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Se ejecuta al iniciar la aplicación"""
    print("🚀 Iniciando TOUTAIN API...")
    
    # Probar conexión a BD
    if not test_db_connection():
        print("❌ No se pudo conectar a la base de datos")
        exit(1)
    
    # Inicializar BD (crear tablas si no existen)
    try:
        init_db()
    except Exception as e:
        print(f"⚠️ Advertencia al inicializar BD: {e}")
    
    print("✅ TOUTAIN API está lista")

@app.on_event("shutdown")
async def shutdown_event():
    """Se ejecuta al apagar la aplicación"""
    print("🛑 TOUTAIN API se está cerrando...")

# ============================================================================
# RUTAS BASE
# ============================================================================

@app.get("/", tags=["Health"])
async def root():
    """Endpoint raíz - Health check"""
    return {
        "message": "Bienvenido a TOUTAIN API",
        "status": "online",
        "version": settings.API_VERSION,
        "docs": "/docs" if _mostrar_docs else "cerrada en produccion",
    }

@app.get("/health", tags=["Health"])
async def health_check():
    """Health check del servidor"""
    return {
        "status": "healthy",
        "service": "TOUTAIN API",
        "version": settings.API_VERSION
    }

@app.get("/api/v1", tags=["Info"])
async def api_info():
    """Información de la API"""
    return {
        "name": settings.API_TITLE,
        "version": settings.API_VERSION,
        "description": "Marketplace Garzón Huila",
        "endpoints": {
            "docs": "/docs",
            "redoc": "/redoc",
            "health": "/health"
        }
    }

# ============================================================================
# MANEJO DE ERRORES GLOBAL
# ============================================================================

# Antes este manejador devolvia el 500 y no dejaba rastro de nada: si el
# servidor fallaba un viernes a las 8 de la noche, uno se enteraba porque un
# cliente escribia. Ahora el error queda en el registro de Render con su
# traza completa y llega un correo.
#
# Con tope, y esto importa: un fallo en una pantalla que el cliente recarga
# cada 30 segundos manda cien correos en una hora y uno deja de leerlos. Se
# manda UNO cada 15 minutos por tipo de error (el tipo y el archivo:linea
# donde revento), que es justo lo que hace falta para saber que esta pasando.
#
# La memoria del tope vive en el proceso: si Render reinicia, vuelve a cero.
# Es suficiente para lo que tiene que lograr y no necesita base de datos.

MINUTOS_ENTRE_AVISOS = 15
_ultimo_aviso: dict = {}


def _firma_error(exc: Exception) -> str:
    """Identifica el error por su tipo y el lugar exacto donde revento."""
    tb = exc.__traceback__
    ultimo = None
    while tb is not None:
        ultimo = tb
        tb = tb.tb_next
    if ultimo is None:
        return type(exc).__name__
    marco = ultimo.tb_frame
    archivo = os.path.basename(marco.f_code.co_filename)
    return f"{type(exc).__name__}@{archivo}:{ultimo.tb_lineno}"


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Responde 500 al cliente, deja la traza en el registro y avisa por correo."""

    # 1. La traza al registro del servidor. Esto nunca puede fallar en silencio.
    firma = type(exc).__name__
    traza = ""
    try:
        firma = _firma_error(exc)
        traza = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
        print(f"[ERROR 500] {request.method} {request.url.path} -> {firma}\n{traza}", flush=True)
    except Exception as e:
        print(f"[ERROR 500] no se pudo formatear la traza: {e}", flush=True)

    # 2. El correo, con tope y en un hilo aparte para no demorar la respuesta
    #    (el envio puede tardar segundos y el cliente no tiene por que esperar).
    try:
        ahora = datetime.utcnow()
        anterior = _ultimo_aviso.get(firma)
        if anterior is None or (ahora - anterior) > timedelta(minutes=MINUTOS_ENTRE_AVISOS):
            _ultimo_aviso[firma] = ahora
            asunto = f"Error en {request.method} {request.url.path}"
            detalle = (
                f"Cuando: {ahora.isoformat()} UTC\n"
                f"Ruta: {request.method} {request.url.path}\n"
                f"Error: {firma}\n\n"
                f"{traza or str(exc)}"
            )
            threading.Thread(
                target=enviar_alerta_error_email,
                args=(asunto, detalle),
                daemon=True,
            ).start()
    except Exception as e:
        print(f"[ERROR 500] no se pudo enviar el aviso: {e}", flush=True)

    # 3. Al cliente, siempre lo mismo: nada de tripas del servidor en producción.
    return JSONResponse(
        status_code=500,
        content={
            "error": "Error interno del servidor",
            "detail": str(exc) if settings.DEBUG else "Error desconocido"
        }
    )

# ============================================================================
# INCLUSIÓN DE ROUTERS
# ============================================================================

# ============================================================================
# INCLUSIÓN DE ROUTERS
# ============================================================================

from routes_auth import router as auth_router
from routes_productos import router as productos_router
from routes_negocios import router as negocios_router
from routes_ordenes import router as ordenes_router
from routes_carrito import router as carrito_router
from routes_usuarios import router as usuarios_router
from routes_resenas import router as resenas_router
from routes_admin import router as admin_router
from routes_cliente import router as cliente_router
from routes_pedidos_especiales import router as pedidos_especiales_router
from routes_logs import router as logs_router
from routes_actualizaciones import router as actualizaciones_router

app.include_router(auth_router)
app.include_router(usuarios_router)
app.include_router(productos_router)
app.include_router(negocios_router)
app.include_router(ordenes_router)
app.include_router(carrito_router)
app.include_router(resenas_router)
app.include_router(admin_router)
app.include_router(cliente_router)
app.include_router(pedidos_especiales_router)
app.include_router(logs_router)
# Actualizaciones del frontend para el iPhone, servidas desde aqui mismo
app.include_router(actualizaciones_router)
# ============================================================================
# MAIN - Ejecutar servidor
# ============================================================================

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,  # Auto-reload en desarrollo
        log_level="info"
    )
