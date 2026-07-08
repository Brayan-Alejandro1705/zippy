# ============================================================================
# routes_usuarios.py - Rutas de Gestión de Usuarios (Admin)
# ============================================================================

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import bcrypt

from config import get_db, settings
from models import Usuario, Negocio
from schemas import UsuarioCreate, UsuarioResponse, UsuarioUpdate, MensajeResponse
from routes_auth import hash_password, verify_password, get_current_user

router = APIRouter(prefix="/api/v1/usuarios", tags=["Usuarios"])

# ============================================================================
# ENDPOINTS: MI PERFIL (usuario autenticado)
# ============================================================================

@router.put(
    "/me/",
    response_model=UsuarioResponse,
    summary="Actualizar mi perfil",
    description="Permite al usuario autenticado actualizar sus propios datos. Los domiciliarios la usan también para reportar su ubicación en tiempo real (latitud/longitud)."
)
async def actualizar_mi_perfil(
    datos: UsuarioUpdate,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    usuario = db.query(Usuario).filter(Usuario.id == current_user.id).first()

    for campo, valor in datos.dict(exclude_unset=True).items():
        setattr(usuario, campo, valor)

    db.commit()
    db.refresh(usuario)
    return usuario

@router.post(
    "/me/password/",
    response_model=MensajeResponse,
    summary="Cambiar mi contraseña",
    description="Cambia la contraseña del usuario autenticado, verificando la contraseña actual"
)
async def cambiar_mi_password(
    datos: dict,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    password_actual = datos.get("password_actual") or ""
    password_nueva = datos.get("password_nueva") or ""

    if not verify_password(password_actual, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La contraseña actual es incorrecta")

    if len(password_nueva) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La nueva contraseña debe tener al menos 8 caracteres")

    usuario = db.query(Usuario).filter(Usuario.id == current_user.id).first()
    usuario.password_hash = hash_password(password_nueva)
    db.commit()

    return MensajeResponse(mensaje="Contraseña actualizada correctamente")

# ============================================================================
# ENDPOINTS: CREAR VENDEDOR (desde admin)
# ============================================================================

@router.post(
    "/vendedor/",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    summary="Crear nuevo vendedor (Admin)",
    description="Crea un nuevo usuario tipo vendedor y su negocio asociado"
)
async def crear_vendedor(datos: dict, db: Session = Depends(get_db)):
    """
    Crea un nuevo vendedor desde el panel de administración
    
    Body:
    - **nombre**: Nombre del vendedor
    - **email**: Email único
    - **telefono**: Teléfono de contacto
    - **documento**: Número de identificación
    - **nombre_negocio**: Nombre del negocio
    - **ciudad**: Ciudad donde opera
    - **direccion**: Dirección del negocio
    - **rol**: Rol a asignar (debe ser 'vendedor')
    - **descripcion**: Descripción del negocio (opcional)
    - **password**: Contraseña temporal
    """
    
    try:
        # Validar datos requeridos
        campos_requeridos = ['nombre', 'email', 'telefono', 'documento', 'nombre_negocio', 'ciudad', 'direccion', 'rol', 'password']
        for campo in campos_requeridos:
            if campo not in datos or not datos[campo]:
                raise ValueError(f"Campo requerido: {campo}")
        
        # Verificar que el rol sea vendedor
        if datos.get('rol') != 'Vendedor':
            raise ValueError(f"El rol debe ser 'Vendedor'")
        
        # Verificar si el email ya existe
        usuario_existente = db.query(Usuario).filter(
            Usuario.email == datos['email']
        ).first()
        
        if usuario_existente:
            raise ValueError("El email ya está registrado")
        
        # Crear nuevo usuario
        nuevo_usuario = Usuario(
            email=datos['email'],
            nombre=datos['nombre'],
            apellido=datos.get('apellido', ''),
            telefono=datos.get('telefono', ''),
            documento=datos.get('documento', ''),
            tipo_usuario='vendedor',
            password_hash=hash_password(datos['password']),
            estado='activo',
            es_verificado=True,  # lo crea un admin, no pasa por el flujo de verificación público
            fecha_creacion=datetime.utcnow()
        )
        
        db.add(nuevo_usuario)
        db.flush()  # Para obtener el ID sin hacer commit
        
        # Crear negocio asociado
        nuevo_negocio = Negocio(
            vendedor_id=nuevo_usuario.id,
            nombre_negocio=datos['nombre_negocio'],
            descripcion=datos.get('descripcion', ''),
            categoria=datos.get('categoria', 'General'),
            ciudad=datos.get('ciudad', ''),
            direccion=datos.get('direccion', ''),
            estado='activo',
            fecha_creacion=datetime.utcnow()
        )
        
        db.add(nuevo_negocio)
        db.commit()
        db.refresh(nuevo_usuario)
        
        return {
            "mensaje": "Vendedor creado exitosamente",
            "vendedor": {
                "id": str(nuevo_usuario.id),
                "nombre": nuevo_usuario.nombre,
                "email": nuevo_usuario.email,
                "negocio": nuevo_negocio.nombre_negocio
            }
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear vendedor: {str(e)}"
        )

# ============================================================================
# ENDPOINTS: LISTAR USUARIOS
# ============================================================================

@router.get(
    "/",
    response_model=dict,
    summary="Listar todos los usuarios",
    description="Obtiene la lista de todos los usuarios del sistema (solo admin)"
)
async def listar_usuarios(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    tipo: Optional[str] = None,
    estado: Optional[str] = None,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lista todos los usuarios del sistema con opciones de filtro

    Solo accesible para administradores

    Parámetros:
    - **skip**: Saltar N registros (para paginación)
    - **limit**: Límite de registros a retornar
    - **tipo**: Filtrar por tipo (cliente, vendedor, domiciliario, admin)
    - **estado**: Filtrar por estado (activo, suspendido, inactivo)
    """

    if current_user.tipo_usuario != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un administrador puede listar usuarios"
        )

    query = db.query(Usuario)
    
    if tipo:
        query = query.filter(Usuario.tipo_usuario == tipo)
    
    if estado:
        query = query.filter(Usuario.estado == estado)
    
    total = query.count()
    usuarios = query.offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "usuarios": [
            {
                "id": str(u.id),
                "nombre": u.nombre,
                "email": u.email,
                "tipo": u.tipo_usuario,
                "estado": u.estado,
                "telefono": u.telefono,
                "fecha_creacion": u.fecha_creacion.isoformat() if u.fecha_creacion else None,
            } for u in usuarios
        ]
    }

# ============================================================================
# ENDPOINTS: LISTAR VENDEDORES
# ============================================================================

@router.get(
    "/vendedores/",
    response_model=dict,
    summary="Listar vendedores",
    description="Obtiene la lista de todos los vendedores"
)
async def listar_vendedores(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    ciudad: Optional[str] = None,
    estado: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Lista todos los vendedores con sus negocios asociados
    """
    
    query = db.query(Usuario).filter(Usuario.tipo_usuario == 'vendedor')
    
    if estado:
        query = query.filter(Usuario.estado == estado)
    
    total = query.count()
    usuarios = query.offset(skip).limit(limit).all()
    
    vendedores = []
    for u in usuarios:
        negocio = db.query(Negocio).filter(Negocio.vendedor_id == u.id).first()
        vendedores.append({
            "id": str(u.id),
            "nombre": u.nombre,
            "email": u.email,
            "estado": u.estado,
            "telefono": u.telefono,
            "negocio": {
                "id": str(negocio.id) if negocio else None,
                "nombre": negocio.nombre_negocio if negocio else None,
                "ciudad": negocio.ciudad if negocio else None,
            } if negocio else None,
            "fecha_creacion": u.fecha_creacion.isoformat() if u.fecha_creacion else None,
        })
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "vendedores": vendedores
    }

# ============================================================================
# ENDPOINTS: OBTENER USUARIO
# ============================================================================

@router.get(
    "/{usuario_id}/",
    response_model=dict,
    summary="Obtener detalles de un usuario",
    description="Obtiene los detalles de un usuario específico"
)
async def obtener_usuario(
    usuario_id: str,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtiene la información de un usuario por su ID

    Cualquier usuario autenticado puede consultar nombre/teléfono de otro
    (lo usan vendedores y domiciliarios para contactar al cliente de una orden).
    Datos sensibles (email, documento, estado, fecha de registro) solo se
    devuelven si el que consulta es admin o es el propio usuario.
    """

    try:
        from uuid import UUID
        usuario = db.query(Usuario).filter(Usuario.id == UUID(usuario_id)).first()
    except:
        usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()

    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )

    datos = {
        "id": str(usuario.id),
        "nombre": usuario.nombre,
        "tipo": usuario.tipo_usuario,
        "telefono": usuario.telefono,
    }

    es_propio_o_admin = current_user.tipo_usuario == "admin" or current_user.id == usuario.id
    if es_propio_o_admin:
        datos["email"] = usuario.email
        datos["estado"] = usuario.estado
        datos["documento"] = usuario.documento
        datos["fecha_creacion"] = usuario.fecha_creacion.isoformat() if usuario.fecha_creacion else None

    return datos

# ============================================================================
# ENDPOINTS: CAMBIAR ESTADO DE USUARIO
# ============================================================================

@router.patch(
    "/{usuario_id}/",
    response_model=dict,
    summary="Cambiar estado de usuario",
    description="Activa, suspende o desactiva un usuario"
)
async def cambiar_estado_usuario(
    usuario_id: str,
    datos: dict,
    db: Session = Depends(get_db)
):
    """
    Cambia el estado de un usuario
    
    Body:
    - **estado**: Nuevo estado (activo, suspendido, inactivo)
    """
    
    try:
        from uuid import UUID
        usuario = db.query(Usuario).filter(Usuario.id == UUID(usuario_id)).first()
    except:
        usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    estado_valido = datos.get('estado')
    if estado_valido not in ['activo', 'suspendido', 'inactivo']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Estado inválido. Válidos: activo, suspendido, inactivo"
        )
    
    usuario.estado = estado_valido
    db.commit()
    db.refresh(usuario)
    
    return {
        "mensaje": f"Usuario {estado_valido} exitosamente",
        "usuario": {
            "id": str(usuario.id),
            "nombre": usuario.nombre,
            "estado": usuario.estado
        }
    }
