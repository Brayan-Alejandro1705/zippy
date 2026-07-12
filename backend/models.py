# ============================================================================
# models.py - Modelos SQLAlchemy para TOUTAIN
# ============================================================================

from sqlalchemy import (
    Column, String, Integer, Float, DateTime, Boolean, Text, 
    ForeignKey, Numeric, Time, JSON, CheckConstraint,
    DECIMAL, Enum as SQLEnum
)
from sqlalchemy.dialects.postgresql import INET
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from config import Base
from datetime import datetime
import uuid
import enum

# ============================================================================
# ENUMS (Valores constantes)
# ============================================================================

class TipoUsuario(str, enum.Enum):
    CLIENTE = "cliente"
    VENDEDOR = "vendedor"
    DOMICILIARIO = "domiciliario"
    ADMIN = "admin"

class EstadoUsuario(str, enum.Enum):
    ACTIVO = "activo"
    INACTIVO = "inactivo"
    SUSPENDIDO = "suspendido"
    ELIMINADO = "eliminado"

class EstadoNegocio(str, enum.Enum):
    ACTIVO = "activo"
    INACTIVO = "inactivo"
    SUSPENDIDO = "suspendido"

class EstadoProducto(str, enum.Enum):
    ACTIVO = "activo"
    INACTIVO = "inactivo"
    DESCONTINUADO = "descontinuado"

class EstadoOrden(str, enum.Enum):
    PENDIENTE = "pendiente"
    CONFIRMADA = "confirmada"
    EN_PREPARACION = "en_preparacion"
    LISTA_PARA_RETIRAR = "lista_para_retirar"
    EN_DOMICILIO = "en_domicilio"
    ENTREGADA = "entregada"
    CANCELADA = "cancelada"
    RECHAZADA = "rechazada"

class MetodoPago(str, enum.Enum):
    EFECTIVO = "efectivo"
    TARJETA = "tarjeta"
    TRANSFERENCIA = "transferencia"
    BILLETERA = "billetera"

class EstadoPago(str, enum.Enum):
    PENDIENTE = "pendiente"
    COMPLETADO = "completado"
    RECHAZADO = "rechazado"
    REEMBOLSADO = "reembolsado"

class TipoTransaccion(str, enum.Enum):
    COMPRA = "compra"
    REEMBOLSO = "reembolso"
    COMISION_TOUTAIN = "comision_toutain"
    RETIRO_VENDEDOR = "retiro_vendedor"
    BONO = "bono"
    PENALIZACION = "penalizacion"

# ============================================================================
# TABLA: USUARIOS
# ============================================================================

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    nombre = Column(String(150), nullable=False)
    apellido = Column(String(150), nullable=False)
    telefono = Column(String(20))
    documento = Column(String(50))
    foto_perfil = Column(String(500))
    tipo_usuario = Column(SQLEnum(TipoUsuario, native_enum=False, values_callable=lambda x: [e.value for e in x]), nullable=False, index=True)
    estado = Column(SQLEnum(EstadoUsuario, native_enum=False, values_callable=lambda x: [e.value for e in x]), default=EstadoUsuario.ACTIVO, index=True)
    es_verificado = Column(Boolean, default=False)
    es_super_admin = Column(Boolean, default=False, nullable=False)
    codigo_verificacion = Column(String(10))
    codigo_verificacion_expira = Column(DateTime)
    metodo_verificacion = Column(String(10))
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_ultima_actualizacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    fecha_eliminacion = Column(DateTime)
    latitud = Column(DECIMAL(10, 8))
    longitud = Column(DECIMAL(11, 8))

    # Relaciones
    negocio = relationship("Negocio", back_populates="vendedor", uselist=False)
    ordenes_cliente = relationship("Orden", foreign_keys="Orden.cliente_id", back_populates="cliente")
    ordenes_domiciliario = relationship("Orden", foreign_keys="Orden.domiciliario_id", back_populates="domiciliario")
    transacciones = relationship("Transaccion", back_populates="usuario")
    resenas = relationship("ResenaCalificacion", back_populates="cliente")
    notificaciones = relationship("Notificacion", back_populates="usuario")
    direcciones = relationship("Direccion", back_populates="usuario")
    carritos = relationship("Carrito", back_populates="cliente")
    favoritos = relationship("Favorito", back_populates="cliente")
    tickets_soporte = relationship("SoporteTicket", back_populates="usuario")

    def __repr__(self):
        return f"<Usuario {self.email}>"

# ============================================================================
# TABLA: NEGOCIOS
# ============================================================================

class Negocio(Base):
    __tablename__ = "negocios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendedor_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False, unique=True, index=True)
    nombre_negocio = Column(String(255), nullable=False)
    descripcion = Column(Text)
    logo = Column(String(500))
    imagen_portada = Column(String(500))
    categoria = Column(String(100), nullable=False, index=True)
    es_servicio = Column(Boolean, default=False, nullable=False)
    estado = Column(SQLEnum(EstadoNegocio, native_enum=False, values_callable=lambda x: [e.value for e in x]), default=EstadoNegocio.ACTIVO, index=True)
    calificacion_promedio = Column(DECIMAL(3, 2), default=0)
    total_ordenes = Column(Integer, default=0)
    es_verificado = Column(Boolean, default=False)
    
    # Ubicación
    ciudad = Column(String(100))
    direccion = Column(String(500))
    latitud = Column(DECIMAL(10, 8), index=True)
    longitud = Column(DECIMAL(11, 8), index=True)
    
    # Contacto
    telefono = Column(String(20))
    whatsapp = Column(String(20))
    
    # Horarios
    hora_apertura = Column(Time)
    hora_cierre = Column(Time)
    dias_operacion = Column(String(50))
    
    # Datos bancarios
    banco = Column(String(100))
    cuenta_tipo = Column(String(50))
    cuenta_numero = Column(String(50))
    
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_ultima_actualizacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    vendedor = relationship("Usuario", back_populates="negocio")
    productos = relationship("Producto", back_populates="negocio", cascade="all, delete-orphan")
    ordenes = relationship("Orden", back_populates="negocio")
    resenas = relationship("ResenaCalificacion", back_populates="negocio")
    carritos = relationship("Carrito", back_populates="negocio")
    cupones = relationship("CuponDescuento", back_populates="negocio")

    def __repr__(self):
        return f"<Negocio {self.nombre_negocio}>"

# ============================================================================
# TABLA: PRODUCTOS
# ============================================================================

class Producto(Base):
    __tablename__ = "productos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    negocio_id = Column(UUID(as_uuid=True), ForeignKey("negocios.id"), nullable=False, index=True)
    nombre = Column(String(255), nullable=False)
    descripcion = Column(Text)
    precio = Column(DECIMAL(10, 2), nullable=False)
    precio_original = Column(DECIMAL(10, 2))
    descuento_porcentaje = Column(DECIMAL(5, 2), default=0)
    oferta_expira = Column(DateTime, nullable=True)  # fecha/hora en que termina la oferta (si aplica)
    stock = Column(Integer, nullable=False, default=0)
    stock_minimo = Column(Integer, default=5)
    sku = Column(String(100), unique=True)
    
    # Imágenes
    imagenes = Column(JSON, default=[])
    
    # Categorización
    categoria = Column(String(100), index=True)
    subcategoria = Column(String(100))
    
    # Visibilidad
    es_visible = Column(Boolean, default=True, index=True)
    estado = Column(SQLEnum(EstadoProducto, native_enum=False, values_callable=lambda x: [e.value for e in x]), default=EstadoProducto.ACTIVO, index=True)
    
    # Métricas
    total_vendidos = Column(Integer, default=0)
    calificacion_promedio = Column(DECIMAL(3, 2), default=0)
    
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_ultima_actualizacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    negocio = relationship("Negocio", back_populates="productos")
    items_orden = relationship("ItemOrden", back_populates="producto")
    items_carrito = relationship("ItemCarrito", back_populates="producto")
    favoritos = relationship("Favorito", back_populates="producto")

    def __repr__(self):
        return f"<Producto {self.nombre}>"

    @property
    def en_oferta(self):
        """True si el producto tiene una oferta activa (no expirada) en este momento."""
        return bool(self.oferta_expira is not None and self.oferta_expira > datetime.utcnow())

# ============================================================================
# TABLA: ÓRDENES
# ============================================================================

class Orden(Base):
    __tablename__ = "ordenes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False, index=True)
    negocio_id = Column(UUID(as_uuid=True), ForeignKey("negocios.id"), nullable=False, index=True)
    domiciliario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True, index=True)
    
    # Estados
    estado = Column(SQLEnum(EstadoOrden, native_enum=False, values_callable=lambda x: [e.value for e in x]), default=EstadoOrden.PENDIENTE, index=True)
    
    # Montos
    subtotal = Column(DECIMAL(10, 2), nullable=False)
    descuento = Column(DECIMAL(10, 2), default=0)
    costo_domicilio = Column(DECIMAL(10, 2), default=0)
    impuesto = Column(DECIMAL(10, 2), default=0)
    total = Column(DECIMAL(10, 2), nullable=False)
    
    # Pago
    metodo_pago = Column(SQLEnum(MetodoPago, native_enum=False, values_callable=lambda x: [e.value for e in x]), nullable=False)
    estado_pago = Column(SQLEnum(EstadoPago, native_enum=False, values_callable=lambda x: [e.value for e in x]), default=EstadoPago.PENDIENTE, index=True)
    
    # Notas
    notas_cliente = Column(Text)
    notas_vendedor = Column(Text)
    
    # Dirección de entrega
    direccion_entrega = Column(String(500))
    latitud_entrega = Column(DECIMAL(10, 8))
    longitud_entrega = Column(DECIMAL(11, 8))
    
    # Tiempos
    fecha_creacion = Column(DateTime, default=datetime.utcnow, index=True)
    fecha_confirmacion = Column(DateTime)
    fecha_entrega = Column(DateTime)
    hora_entrega_estimada = Column(Time)
    
    # Seguimiento
    numero_rastreo = Column(String(100))
    
    fecha_ultima_actualizacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    cliente = relationship("Usuario", foreign_keys=[cliente_id], back_populates="ordenes_cliente")
    negocio = relationship("Negocio", back_populates="ordenes")
    domiciliario = relationship("Usuario", foreign_keys=[domiciliario_id], back_populates="ordenes_domiciliario")
    items = relationship("ItemOrden", back_populates="orden", cascade="all, delete-orphan")
    transacciones = relationship("Transaccion", back_populates="orden")
    resenas = relationship("ResenaCalificacion", back_populates="orden")
    seguimientos = relationship("SeguimientoOrden", back_populates="orden", cascade="all, delete-orphan")
    mensajes = relationship("MensajeOrden", back_populates="orden", cascade="all, delete-orphan")
    tickets = relationship("SoporteTicket", back_populates="orden")

    def __repr__(self):
        return f"<Orden {self.id}>"

# ============================================================================
# TABLA: ITEMS ORDEN
# ============================================================================

class ItemOrden(Base):
    __tablename__ = "items_orden"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    orden_id = Column(UUID(as_uuid=True), ForeignKey("ordenes.id"), nullable=False, index=True)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("productos.id"), nullable=False, index=True)
    cantidad = Column(Integer, nullable=False)
    precio_unitario = Column(DECIMAL(10, 2), nullable=False)
    descuento_unitario = Column(DECIMAL(10, 2), default=0)
    subtotal = Column(DECIMAL(10, 2), nullable=False)
    
    # Especificaciones
    especificaciones = Column(JSON, default={})
    
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    orden = relationship("Orden", back_populates="items")
    producto = relationship("Producto", back_populates="items_orden")

    def __repr__(self):
        return f"<ItemOrden {self.id}>"

# ============================================================================
# TABLA: TRANSACCIONES
# ============================================================================

class Transaccion(Base):
    __tablename__ = "transacciones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    orden_id = Column(UUID(as_uuid=True), ForeignKey("ordenes.id"), nullable=True, index=True)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False, index=True)
    
    tipo_transaccion = Column(SQLEnum(TipoTransaccion, native_enum=False, values_callable=lambda x: [e.value for e in x]), nullable=False, index=True)
    
    monto = Column(DECIMAL(10, 2), nullable=False)
    moneda = Column(String(3), default="COP")
    
    # Método
    metodo_pago = Column(String(50))
    referencia_externa = Column(String(255))
    
    # Estado
    estado = Column(String(50), default="completada")
    
    descripcion = Column(Text)
    fecha_creacion = Column(DateTime, default=datetime.utcnow, index=True)

    # Relaciones
    usuario = relationship("Usuario", back_populates="transacciones")
    orden = relationship("Orden", back_populates="transacciones")

    def __repr__(self):
        return f"<Transaccion {self.id}>"

# ============================================================================
# TABLA: RESEÑAS Y CALIFICACIONES
# ============================================================================

class ResenaCalificacion(Base):
    __tablename__ = "resenas_calificaciones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    orden_id = Column(UUID(as_uuid=True), ForeignKey("ordenes.id"), nullable=False, index=True)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False, index=True)
    negocio_id = Column(UUID(as_uuid=True), ForeignKey("negocios.id"), nullable=False, index=True)
    
    # Calificaciones
    calificacion_general = Column(Integer, nullable=False)
    calificacion_producto = Column(Integer)
    calificacion_entrega = Column(Integer)
    calificacion_atencion = Column(Integer)
    
    # Reseña
    titulo = Column(String(255))
    comentario = Column(Text)
    imagenes = Column(JSON, default=[])
    
    # Respuesta del vendedor
    respuesta_vendedor = Column(Text)
    fecha_respuesta = Column(DateTime)
    
    es_verificada = Column(Boolean, default=False)
    es_util = Column(Integer, default=0)
    
    fecha_creacion = Column(DateTime, default=datetime.utcnow, index=True)
    fecha_ultima_actualizacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    orden = relationship("Orden", back_populates="resenas")
    cliente = relationship("Usuario", back_populates="resenas")
    negocio = relationship("Negocio", back_populates="resenas")

    def __repr__(self):
        return f"<ResenaCalificacion {self.id}>"

# ============================================================================
# TABLA: CARRITOS
# ============================================================================

class Carrito(Base):
    __tablename__ = "carritos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False, index=True)
    negocio_id = Column(UUID(as_uuid=True), ForeignKey("negocios.id"), nullable=False, index=True)
    estado = Column(String(50), default="activo")
    
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_ultima_actualizacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    cliente = relationship("Usuario", back_populates="carritos")
    negocio = relationship("Negocio", back_populates="carritos")
    items = relationship("ItemCarrito", back_populates="carrito", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Carrito {self.id}>"

# ============================================================================
# TABLA: ITEMS CARRITO
# ============================================================================

class ItemCarrito(Base):
    __tablename__ = "items_carrito"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    carrito_id = Column(UUID(as_uuid=True), ForeignKey("carritos.id"), nullable=False, index=True)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("productos.id"), nullable=False, index=True)
    cantidad = Column(Integer, nullable=False)
    especificaciones = Column(JSON, default={})
    
    fecha_agregado = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    carrito = relationship("Carrito", back_populates="items")
    producto = relationship("Producto", back_populates="items_carrito")

    def __repr__(self):
        return f"<ItemCarrito {self.id}>"

# ============================================================================
# TABLA: FAVORITOS
# ============================================================================

class Favorito(Base):
    __tablename__ = "favoritos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False, index=True)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("productos.id"), nullable=False, index=True)
    
    fecha_agregado = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    cliente = relationship("Usuario", back_populates="favoritos")
    producto = relationship("Producto", back_populates="favoritos")

    def __repr__(self):
        return f"<Favorito {self.id}>"

# ============================================================================
# TABLA: DIRECCIONES
# ============================================================================

class Direccion(Base):
    __tablename__ = "direcciones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False, index=True)
    
    etiqueta = Column(String(100))
    direccion = Column(String(500), nullable=False)
    referencia_adicional = Column(String(300))
    
    latitud = Column(DECIMAL(10, 8))
    longitud = Column(DECIMAL(11, 8))
    
    es_predeterminada = Column(Boolean, default=False)
    estado = Column(String(50), default="activa")
    
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    usuario = relationship("Usuario", back_populates="direcciones")

    def __repr__(self):
        return f"<Direccion {self.etiqueta}>"

# ============================================================================
# TABLA: SEGUIMIENTO ORDEN
# ============================================================================

class SeguimientoOrden(Base):
    __tablename__ = "seguimiento_orden"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    orden_id = Column(UUID(as_uuid=True), ForeignKey("ordenes.id"), nullable=False, index=True)
    
    estado_anterior = Column(String(50))
    estado_nuevo = Column(String(50), nullable=False)
    
    latitud = Column(DECIMAL(10, 8))
    longitud = Column(DECIMAL(11, 8))
    
    descripcion = Column(Text)
    
    fecha_creacion = Column(DateTime, default=datetime.utcnow, index=True)

    # Relaciones
    orden = relationship("Orden", back_populates="seguimientos")

    def __repr__(self):
        return f"<SeguimientoOrden {self.id}>"

# ============================================================================
# TABLA: MENSAJES DE ORDEN (chat cliente ↔ domiciliario)
# ============================================================================

class MensajeOrden(Base):
    __tablename__ = "mensajes_orden"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    orden_id = Column(UUID(as_uuid=True), ForeignKey("ordenes.id"), nullable=False, index=True)
    remitente_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False, index=True)

    contenido = Column(Text, nullable=False)

    fecha_creacion = Column(DateTime, default=datetime.utcnow, index=True)

    # Relaciones
    orden = relationship("Orden", back_populates="mensajes")
    remitente = relationship("Usuario", foreign_keys=[remitente_id])

    def __repr__(self):
        return f"<MensajeOrden {self.id}>"

# ============================================================================
# TABLA: NOTIFICACIONES
# ============================================================================

class Notificacion(Base):
    __tablename__ = "notificaciones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False, index=True)
    
    tipo = Column(String(100), nullable=False)
    titulo = Column(String(255))
    mensaje = Column(Text)
    
    relacionado_tabla = Column(String(100))
    relacionado_id = Column(UUID(as_uuid=True))
    
    es_leida = Column(Boolean, default=False, index=True)
    fecha_lectura = Column(DateTime)
    
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    usuario = relationship("Usuario", back_populates="notificaciones")

    def __repr__(self):
        return f"<Notificacion {self.id}>"

# ============================================================================
# TABLA: CUPONES Y DESCUENTOS
# ============================================================================

class CuponDescuento(Base):
    __tablename__ = "cupones_descuentos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codigo = Column(String(50), unique=True, nullable=False, index=True)
    descripcion = Column(Text)
    
    tipo_descuento = Column(String(50), nullable=False)
    valor_descuento = Column(DECIMAL(10, 2), nullable=False)
    descuento_maximo = Column(DECIMAL(10, 2))
    
    monto_minimo_compra = Column(DECIMAL(10, 2), default=0)
    
    cantidad_total = Column(Integer)
    cantidad_usada = Column(Integer, default=0)
    usos_por_usuario = Column(Integer, default=1)
    
    negocio_id = Column(UUID(as_uuid=True), ForeignKey("negocios.id"), nullable=True)
    
    fecha_inicio = Column(DateTime)
    fecha_fin = Column(DateTime)
    
    estado = Column(String(50), default="activo")
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    negocio = relationship("Negocio", back_populates="cupones")

    def __repr__(self):
        return f"<CuponDescuento {self.codigo}>"

# ============================================================================
# TABLA: SOPORTE TICKETS
# ============================================================================

class SoporteTicket(Base):
    __tablename__ = "soporte_tickets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False, index=True)
    orden_id = Column(UUID(as_uuid=True), ForeignKey("ordenes.id"), nullable=True)
    
    asunto = Column(String(255), nullable=False)
    descripcion = Column(Text, nullable=False)
    categoria = Column(String(100))
    prioridad = Column(String(50), default="normal")
    
    estado = Column(String(50), default="abierto", index=True)
    
    respuesta_soporte = Column(Text)
    fecha_respuesta = Column(DateTime)
    
    imagenes = Column(JSON, default=[])
    
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_cierre = Column(DateTime)

    # Relaciones
    usuario = relationship("Usuario", back_populates="tickets_soporte")
    orden = relationship("Orden", back_populates="tickets")

    def __repr__(self):
        return f"<SoporteTicket {self.id}>"

# ============================================================================
# TABLA: CONFIGURACIÓN DEL SISTEMA
# ============================================================================

class ConfiguracionSistema(Base):
    __tablename__ = "configuracion_sistema"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clave = Column(String(255), unique=True, nullable=False, index=True)
    valor = Column(Text)
    descripcion = Column(Text)
    tipo_dato = Column(String(50))
    
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_ultima_actualizacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<ConfiguracionSistema {self.clave}>"

# ============================================================================
# TABLA: LOGS DEL SISTEMA
# ============================================================================

class LogSistema(Base):
    __tablename__ = "logs_sistema"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True)
    accion = Column(String(255))
    tabla_afectada = Column(String(100))
    registro_id = Column(UUID(as_uuid=True))
    cambios_json = Column(JSON)
    ip_address = Column(INET)
    user_agent = Column(Text)
    
    fecha_creacion = Column(DateTime, default=datetime.utcnow, index=True)

    def __repr__(self):
        return f"<LogSistema {self.id}>"