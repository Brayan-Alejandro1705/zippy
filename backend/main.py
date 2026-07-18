# ============================================================================
# main.py - Punto de entrada de TOUTAIN API
# ============================================================================

import os
import sys
# Configurar la codificación de la terminal para soportar emojis en Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

from config import settings, test_db_connection, init_db

os.makedirs("uploads/productos", exist_ok=True)

# ============================================================================
# CREAR APLICACIÓN FASTAPI
# ============================================================================

app = FastAPI(
    title=settings.API_TITLE,
    description="Marketplace Garzón Huila - Un solo app para comprar, vender y crecer",
    version=settings.API_VERSION,
    docs_url="/docs",  # Swagger UI
    redoc_url="/redoc"  # ReDoc
)

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
        "docs": "/docs"
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

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Manejo global de excepciones"""
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

app.include_router(auth_router)
app.include_router(usuarios_router)
app.include_router(productos_router)
app.include_router(negocios_router)
app.include_router(ordenes_router)
app.include_router(carrito_router)
app.include_router(resenas_router)
app.include_router(admin_router)
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
