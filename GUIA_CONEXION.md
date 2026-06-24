# 🚀 TOUTAIN - Guía de Conexión Backend + Frontend

## 📋 Requisitos

- **PostgreSQL 12+** funcionando localmente
- **Python 3.8+** instalado
- **Node.js 16+** instalado
- **npm** instalado

## 🔧 Pasos de Configuración

### 1️⃣ Backend - FastAPI (Puerto 8000)

#### Instalar dependencias
```bash
cd C:\Users\aleja\zippy\backend
pip install -r requirements.txt
```

#### Crear/Verificar .env
El archivo `.env` ya existe con:
```
DATABASE_URL=postgresql://postgres:alejo@localhost:5432/toutain
SECRET_KEY=tu_clave_secreta_muy_larga_y_complicada_aqui_2024
PORT=8000
CORS_ORIGINS incluye localhost:3002
```

#### Crear base de datos (si no existe)
```bash
# En PostgreSQL:
CREATE DATABASE toutain;
```

#### Iniciar Backend
```bash
cd C:\Users\aleja\zippy\backend
python main.py
```

✅ Backend debería estar en: `http://localhost:8000`
📚 Docs: `http://localhost:8000/docs`

---

### 2️⃣ Frontend - React (Puerto 3002)

#### Instalar dependencias
```bash
cd C:\Users\aleja\zippy\frontend
npm install
```

#### Verificar .env.local
```
REACT_APP_API_URL=http://localhost:8000/api/v1
```

#### Iniciar Frontend
```bash
npm start
```

✅ Frontend debería estar en: `http://localhost:3002`

---

## ▶️ FORMA RÁPIDA: Iniciar TODO

**Opción 1: Usar script start.bat (recomendado)**
```bash
cd C:\Users\aleja\zippy
double-click start.bat
```

**Opción 2: Manual en terminales separadas**

Terminal 1 - Backend:
```bash
cd C:\Users\aleja\zippy\backend && python main.py
```

Terminal 2 - Frontend:
```bash
cd C:\Users\aleja\zippy\frontend && npm start
```

---

## ✅ Verificar que Todo Funciona

1. **Backend está vivo?**
   - Visita: http://localhost:8000/health
   - Deberías ver: `{"status":"healthy",...}`

2. **Frontend está conectado?**
   - Visita: http://localhost:3002
   - Abre DevTools (F12) → Console
   - No debe haber errores de CORS

3. **¿Conectar API desde Frontend?**
   - En una página React, importa: `import api from './config/api'`
   - Usa: `api.get('/auth/login')` etc.

---

## 🔍 Troubleshooting

| Error | Solución |
|-------|----------|
| `CORS error` | Verifica que CORS_ORIGINS en `.env` incluya `http://localhost:3002` |
| `Connection refused (DB)` | PostgreSQL no está corriendo. Inicia el servicio. |
| `Module not found (Python)` | Ejecuta: `pip install -r requirements.txt` |
| `npm: command not found` | Instala Node.js desde nodejs.org |
| `Port 8000 already in use` | Cambiar PORT en `.env` |

---

## 📚 Archivos Importantes

```
zippy/
├── backend/
│   ├── .env ← Configuración (credenciales, puertos)
│   ├── config.py ← Conexión a BD
│   ├── main.py ← Servidor FastAPI
│   ├── routes_auth.py ← Autenticación
│   ├── routes_productos.py ← Productos
│   ├── routes_negocios.py ← Negocios
│   ├── routes_ordenes.py ← Órdenes
│   ├── routes_carrito.py ← Carrito
│   └── models.py ← Modelos de BD
│
├── frontend/
│   ├── .env.local ← URL de API
│   ├── package.json ← Dependencias
│   ├── src/
│   │   ├── config/api.js ← Configuración de axios
│   │   ├── pages/ ← Páginas principales
│   │   ├── components/ ← Componentes reutilizables
│   │   └── context/ ← Context API para estado global
│
└── start.bat ← Script para iniciar TODO

```

---

## 🎯 Flujo de Comunicación

```
React Frontend (3002)
        ↓ (HTTP Request)
        ↓ (axios - config/api.js)
        ↓
FastAPI Backend (8000)
        ↓ (Query/CORS check)
        ↓
PostgreSQL Database
        ↓ (Response)
        ↓
FastAPI Backend (8000)
        ↓ (JSON Response)
        ↓
React Frontend (3002)
```

---

## 🚀 Próximos Pasos

1. Verificar que ambos servidores estén corriendo
2. Abrir http://localhost:3002 en el navegador
3. Ir a DevTools (F12) y revisar la consola
4. Hacer un login para probar la conexión

¡Todo debería funcionar! 🎉
