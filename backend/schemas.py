# ============================================================================
# schemas.py - Schemas Pydantic para validación de datos
# ============================================================================

from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal
import uuid

# ============================================================================
# SCHEMAS: USUARIOS
# ============================================================================

class UsuarioBase(BaseModel):
    email: EmailStr
    nombre: str = Field(..., min_length=1, max_length=150)
    apellido: str = Field(..., min_length=1, max_length=150)
    telefono: Optional[str] = None
    tipo_usuario: str

class UsuarioCreate(UsuarioBase):
    password: str = Field(..., min_length=8)
    documento: Optional[str] = None
    metodo_verificacion: str = "email"
    # Campos para vendedor (opcionales en registro)
    nombre_negocio: Optional[str] = None
    categoria_negocio: Optional[str] = None
    ciudad: Optional[str] = None

    @validator('password')
    def validate_password(cls, v):
        if not any(c.isupper() for c in v):
            raise ValueError('Password debe contener al menos una mayúscula')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password debe contener al menos un número')
        return v

    @validator('metodo_verificacion')
    def validate_metodo_verificacion(cls, v, values):
        if v not in ('email', 'sms'):
            raise ValueError("metodo_verificacion debe ser 'email' o 'sms'")
        if v == 'sms' and not values.get('telefono'):
            raise ValueError('Se requiere teléfono para verificación por SMS')
        return v

class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    telefono: Optional[str] = None
    foto_perfil: Optional[str] = None
    latitud: Optional[Decimal] = None
    longitud: Optional[Decimal] = None

class UsuarioResponse(UsuarioBase):
    id: uuid.UUID
    foto_perfil: Optional[str]
    es_verificado: bool
    es_super_admin: bool = False
    estado: str
    fecha_creacion: datetime

    class Config:
        from_attributes = True

# ============================================================================
# SCHEMAS: NEGOCIOS
# ============================================================================

class NegocioBase(BaseModel):
    nombre_negocio: str = Field(..., min_length=1, max_length=255)
    descripcion: Optional[str] = None
    categoria: str
    ciudad: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    whatsapp: Optional[str] = None
    hora_apertura: Optional[str] = None
    hora_cierre: Optional[str] = None
    dias_operacion: Optional[str] = None
    banco: Optional[str] = None
    cuenta_tipo: Optional[str] = None
    cuenta_numero: Optional[str] = None

class NegocioCreate(NegocioBase):
    pass

class NegocioUpdate(BaseModel):
    nombre_negocio: Optional[str] = None
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    ciudad: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    whatsapp: Optional[str] = None
    hora_apertura: Optional[str] = None
    hora_cierre: Optional[str] = None
    dias_operacion: Optional[str] = None
    logo: Optional[str] = None
    imagen_portada: Optional[str] = None
    banco: Optional[str] = None
    cuenta_tipo: Optional[str] = None
    cuenta_numero: Optional[str] = None

class NegocioResponse(NegocioBase):
    id: uuid.UUID
    vendedor_id: uuid.UUID
    logo: Optional[str]
    imagen_portada: Optional[str]
    calificacion_promedio: Decimal
    total_ordenes: int
    es_verificado: bool
    estado: str
    fecha_creacion: datetime

    class Config:
        from_attributes = True

# ============================================================================
# SCHEMAS: PRODUCTOS
# ============================================================================

class ProductoBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=255)
    descripcion: Optional[str] = None
    precio: Decimal = Field(..., gt=0)
    precio_original: Optional[Decimal] = None
    descuento_porcentaje: Optional[Decimal] = Field(default=0, ge=0, le=100)
    stock: int = Field(..., ge=0)
    stock_minimo: Optional[int] = 5
    categoria: Optional[str] = None
    subcategoria: Optional[str] = None

class ProductoCreate(ProductoBase):
    imagenes: Optional[List[str]] = []

class ProductoUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    precio: Optional[Decimal] = None
    precio_original: Optional[Decimal] = None
    descuento_porcentaje: Optional[Decimal] = None
    stock: Optional[int] = None
    stock_minimo: Optional[int] = None
    categoria: Optional[str] = None
    subcategoria: Optional[str] = None
    es_visible: Optional[bool] = None
    imagenes: Optional[List[str]] = None

class ProductoResponse(ProductoBase):
    id: uuid.UUID
    negocio_id: uuid.UUID
    sku: Optional[str]
    imagenes: List[str]
    es_visible: bool
    estado: str
    total_vendidos: int
    calificacion_promedio: Decimal
    fecha_creacion: datetime

    class Config:
        from_attributes = True

# ============================================================================
# SCHEMAS: ÓRDENES
# ============================================================================

class ItemOrdenCreate(BaseModel):
    producto_id: uuid.UUID
    cantidad: int = Field(..., gt=0)
    especificaciones: Optional[Dict[str, Any]] = {}

class ItemOrdenResponse(BaseModel):
    id: uuid.UUID
    producto_id: uuid.UUID
    cantidad: int
    precio_unitario: Decimal
    subtotal: Decimal
    especificaciones: Dict[str, Any]

    class Config:
        from_attributes = True

class OrdenCreate(BaseModel):
    negocio_id: uuid.UUID
    items: List[ItemOrdenCreate]
    metodo_pago: str
    direccion_entrega: str
    notas_cliente: Optional[str] = None

class OrdenUpdate(BaseModel):
    estado: Optional[str] = None
    notas_vendedor: Optional[str] = None
    domiciliario_id: Optional[uuid.UUID] = None

class OrdenResponse(BaseModel):
    id: uuid.UUID
    cliente_id: uuid.UUID
    negocio_id: uuid.UUID
    domiciliario_id: Optional[uuid.UUID] = None
    estado: str
    subtotal: Decimal
    descuento: Decimal
    costo_domicilio: Decimal
    impuesto: Decimal
    total: Decimal
    metodo_pago: str
    estado_pago: str
    direccion_entrega: str
    notas_cliente: Optional[str] = None
    items: List[ItemOrdenResponse]
    fecha_creacion: datetime
    fecha_entrega: Optional[datetime]

    class Config:
        from_attributes = True

# ============================================================================
# SCHEMAS: RESEÑAS
# ============================================================================

class ResenaCreate(BaseModel):
    orden_id: uuid.UUID
    calificacion_general: int = Field(..., ge=1, le=5)
    calificacion_producto: Optional[int] = Field(None, ge=1, le=5)
    calificacion_entrega: Optional[int] = Field(None, ge=1, le=5)
    calificacion_atencion: Optional[int] = Field(None, ge=1, le=5)
    titulo: Optional[str] = None
    comentario: Optional[str] = None
    imagenes: Optional[List[str]] = []

class ResenaResponse(BaseModel):
    id: uuid.UUID
    orden_id: uuid.UUID
    cliente_id: uuid.UUID
    negocio_id: uuid.UUID
    calificacion_general: int
    titulo: Optional[str]
    comentario: Optional[str]
    imagenes: List[str]
    es_verificada: bool
    fecha_creacion: datetime

    class Config:
        from_attributes = True

# ============================================================================
# SCHEMAS: CARRITO
# ============================================================================

class ItemCarritoCreate(BaseModel):
    producto_id: uuid.UUID
    cantidad: int = Field(..., gt=0)
    especificaciones: Optional[Dict[str, Any]] = {}

class ItemCarritoResponse(BaseModel):
    id: uuid.UUID
    producto_id: uuid.UUID
    cantidad: int
    especificaciones: Dict[str, Any]

    class Config:
        from_attributes = True

class CarritoResponse(BaseModel):
    id: uuid.UUID
    cliente_id: uuid.UUID
    negocio_id: uuid.UUID
    items: List[ItemCarritoResponse]
    fecha_creacion: datetime

    class Config:
        from_attributes = True

# ============================================================================
# SCHEMAS: DIRECCIONES
# ============================================================================

class DireccionCreate(BaseModel):
    etiqueta: Optional[str] = None
    direccion: str = Field(..., min_length=5)
    referencia_adicional: Optional[str] = None
    latitud: Optional[Decimal] = None
    longitud: Optional[Decimal] = None
    es_predeterminada: Optional[bool] = False

class DireccionUpdate(BaseModel):
    etiqueta: Optional[str] = None
    direccion: Optional[str] = None
    referencia_adicional: Optional[str] = None
    es_predeterminada: Optional[bool] = None

class DireccionResponse(BaseModel):
    id: uuid.UUID
    usuario_id: uuid.UUID
    etiqueta: Optional[str]
    direccion: str
    referencia_adicional: Optional[str]
    latitud: Optional[Decimal]
    longitud: Optional[Decimal]
    es_predeterminada: bool
    fecha_creacion: datetime

    class Config:
        from_attributes = True

# ============================================================================
# SCHEMAS: AUTENTICACIÓN
# ============================================================================

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    usuario: UsuarioResponse
    token_type: str = "bearer"

class TokenRefresh(BaseModel):
    refresh_token: str

# ============================================================================
# SCHEMAS: RESPUESTAS GENÉRICAS
# ============================================================================

class MensajeResponse(BaseModel):
    mensaje: str
    exito: bool = True

class ErrorResponse(BaseModel):
    error: str
    detalle: Optional[str] = None
    codigo: int

class PaginacionResponse(BaseModel):
    items: List[Any]
    total: int
    pagina: int
    por_pagina: int
    total_paginas: int
