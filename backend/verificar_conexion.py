import requests
import sys
from urllib.parse import urljoin

print("=" * 60)
print("🔍 VERIFICANDO CONEXIÓN TOUTAIN (Backend + Frontend)")
print("=" * 60)

# Verificar Backend
print("\n1️⃣ Verificando Backend en http://localhost:8000...")
try:
    response = requests.get("http://localhost:8000/health", timeout=3)
    if response.status_code == 200:
        print("   ✅ Backend está ACTIVO")
        print(f"   📊 Respuesta: {response.json()}")
    else:
        print(f"   ❌ Backend respondió con código: {response.status_code}")
except requests.exceptions.ConnectionError:
    print("   ❌ Backend NO RESPONDE - ¿Está en ejecución?")
    print("   💡 Ejecuta: cd backend && python main.py")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Verificar API Info
print("\n2️⃣ Verificando Info de API...")
try:
    response = requests.get("http://localhost:8000/api/v1", timeout=3)
    if response.status_code == 200:
        print("   ✅ API está ACTIVO")
        info = response.json()
        print(f"   📌 Versión: {info.get('version')}")
        print(f"   📌 Nombre: {info.get('name')}")
    else:
        print(f"   ❌ API respondió con código: {response.status_code}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Verificar CORS
print("\n3️⃣ Verificando CORS...")
try:
    headers = {
        'Origin': 'http://localhost:3002',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type'
    }
    response = requests.options("http://localhost:8000/api/v1", headers=headers, timeout=3)
    cors_header = response.headers.get('Access-Control-Allow-Origin')
    if cors_header:
        print(f"   ✅ CORS habilitado para: {cors_header}")
    else:
        print("   ❌ CORS no está configurado")
except Exception as e:
    print(f"   ❌ Error verificando CORS: {e}")

# Verificar Docs
print("\n4️⃣ Verificando Documentación API...")
try:
    response = requests.get("http://localhost:8000/docs", timeout=3)
    if response.status_code == 200:
        print("   ✅ Documentación disponible en: http://localhost:8000/docs")
    else:
        print("   ❌ No se puede acceder a la documentación")
except Exception as e:
    print(f"   ❌ Error: {e}")

print("\n" + "=" * 60)
print("📝 RESUMEN")
print("=" * 60)
print("✅ Si todo muestra verde, backend y frontend están conectados")
print("❌ Si hay rojo, revisa la GUIA_CONEXION.md")
print("\n💡 Próximos pasos:")
print("   1. Inicia el Backend: python main.py (en ./backend)")
print("   2. Inicia el Frontend: npm start (en ./frontend)")
print("   3. Vuelve a ejecutar este script")
print("   4. Visita: http://localhost:3002")
print("=" * 60)
