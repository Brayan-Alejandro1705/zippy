# ============================================================================
# routes_adicionales.py - Adicionales de los productos (nov 2026)
#
# Lo que un negocio cobra aparte encima de un producto: gomas y shot en un
# granizado, extra queso en una hamburguesa. Antes los negocios los subían
# como productos sueltos ("Adicional Gomas $1.000") y el cliente podía pedir
# las gomas solas, sin granizado.
#
# - El negocio maneja su lista (crear, cambiar precio, apagar si se acaba,
#   borrar) y escoge en qué productos salen (Producto.adicionales).
# - El cliente ve los disponibles de un producto y los marca al agregarlo.
# - El precio de la orden lo calcula el servidor (precio_de_adicionales),
#   nunca se recibe del celular.
# ============================================================================

from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config import get_db
from models import Adicional, Negocio, Producto, Usuario
from routes_auth import get_current_user

router = APIRouter(prefix="/api/v1/adicionales", tags=["Adicionales"])

MAX_POR_NEGOCIO = 60
PRECIO_MAXIMO = 200000


class AdicionalCrear(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=120)
    precio: Decimal = Field(..., ge=0)


class AdicionalCambiar(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=120)
    precio: Optional[Decimal] = Field(None, ge=0)
    disponible: Optional[bool] = None


class AdicionalesDeProducto(BaseModel):
    ids: List[UUID] = []
    # Poner esta misma lista en todos los productos del negocio con la misma categoría
    aplicar_a_categoria: bool = False


def _fila(a: Adicional) -> dict:
    return {"id": str(a.id), "nombre": a.nombre, "precio": float(a.precio or 0), "disponible": bool(a.disponible)}


def _negocio(db: Session, usuario: Usuario) -> Negocio:
    if str(getattr(usuario.tipo_usuario, "value", usuario.tipo_usuario)) != "vendedor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo los negocios tienen adicionales")
    negocio = db.query(Negocio).filter(Negocio.vendedor_id == usuario.id).first()
    if not negocio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No encontramos tu negocio")
    return negocio


def _revisar_precio(precio: Decimal):
    if precio > PRECIO_MAXIMO:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ese precio parece un error de dedo")
    # Igual que en los productos: "1.000" escrito como 1 (el punto tomado como decimal)
    if 0 < precio < 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Ningún adicional cuesta menos de $100. Escribe el precio completo, ej: 1000")


def precio_de_adicionales(db: Session, producto: Producto, ids) -> tuple:
    """Valida los adicionales que el cliente marcó para un producto y
    devuelve (copia para guardar en la orden, suma de precios)."""
    if not ids:
        return [], Decimal(0)
    pedidos = list(dict.fromkeys(str(i) for i in ids))          # sin repetidos, en orden
    permitidos = {str(i) for i in (producto.adicionales or [])}
    if any(i not in permitidos for i in pedidos):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Uno de los adicionales ya no está disponible para {producto.nombre}. Vuelve a agregarlo al carrito.")
    filas = {str(a.id): a for a in db.query(Adicional).filter(Adicional.id.in_(pedidos)).all()}
    copia, suma = [], Decimal(0)
    for i in pedidos:
        a = filas.get(i)
        if not a or a.eliminado or not a.disponible or a.negocio_id != producto.negocio_id:
            nombre = a.nombre if a else "un adicional"
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"{nombre} ya no está disponible. Vuelve a agregar {producto.nombre} al carrito.")
        copia.append({"id": i, "nombre": a.nombre, "precio": float(a.precio)})
        suma += Decimal(a.precio)
    return copia, suma


# ── Negocio ────────────────────────────────────────────────────────────────

@router.get("/mios", summary="Adicionales del negocio")
async def mis_adicionales(current_user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    negocio = _negocio(db, current_user)
    filas = db.query(Adicional).filter(Adicional.negocio_id == negocio.id, Adicional.eliminado == False)  # noqa: E712
    return [_fila(a) for a in filas.order_by(Adicional.fecha_creacion.asc()).all()]


@router.post("/", summary="Crear un adicional")
async def crear_adicional(datos: AdicionalCrear, current_user: Usuario = Depends(get_current_user),
                          db: Session = Depends(get_db)):
    negocio = _negocio(db, current_user)
    _revisar_precio(datos.precio)
    nombre = datos.nombre.strip()
    existentes = db.query(Adicional).filter(Adicional.negocio_id == negocio.id, Adicional.eliminado == False).all()  # noqa: E712
    if len(existentes) >= MAX_POR_NEGOCIO:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Puedes tener hasta {MAX_POR_NEGOCIO} adicionales")
    if any(a.nombre.strip().lower() == nombre.lower() for a in existentes):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Ya tienes un adicional que se llama {nombre}")
    a = Adicional(negocio_id=negocio.id, nombre=nombre, precio=datos.precio)
    db.add(a)
    db.commit()
    db.refresh(a)
    return _fila(a)


def _del_negocio(db: Session, negocio: Negocio, adicional_id: UUID) -> Adicional:
    a = db.query(Adicional).filter(Adicional.id == adicional_id, Adicional.negocio_id == negocio.id,
                                   Adicional.eliminado == False).first()  # noqa: E712
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ese adicional ya no existe")
    return a


@router.put("/{adicional_id}", summary="Cambiar nombre, precio o apagarlo")
async def cambiar_adicional(adicional_id: UUID, datos: AdicionalCambiar,
                            current_user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    negocio = _negocio(db, current_user)
    a = _del_negocio(db, negocio, adicional_id)
    if datos.nombre is not None:
        a.nombre = datos.nombre.strip()
    if datos.precio is not None:
        _revisar_precio(datos.precio)
        a.precio = datos.precio
    if datos.disponible is not None:
        a.disponible = datos.disponible
    db.commit()
    db.refresh(a)
    return _fila(a)


@router.delete("/{adicional_id}", summary="Borrar un adicional")
async def borrar_adicional(adicional_id: UUID, current_user: Usuario = Depends(get_current_user),
                           db: Session = Depends(get_db)):
    negocio = _negocio(db, current_user)
    a = _del_negocio(db, negocio, adicional_id)
    # Se marca y no se borra: las órdenes viejas lo tienen copiado
    a.eliminado = True
    clave = str(a.id)
    for p in db.query(Producto).filter(Producto.negocio_id == negocio.id).all():
        if p.adicionales and clave in [str(x) for x in p.adicionales]:
            p.adicionales = [x for x in p.adicionales if str(x) != clave]
    db.commit()
    return {"ok": True}


@router.put("/producto/{producto_id}", summary="Escoger qué adicionales salen en un producto")
async def adicionales_de_producto(producto_id: UUID, datos: AdicionalesDeProducto,
                                  current_user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    negocio = _negocio(db, current_user)
    producto = db.query(Producto).filter(Producto.id == producto_id, Producto.negocio_id == negocio.id).first()
    if not producto:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    validos = {str(a.id) for a in db.query(Adicional).filter(
        Adicional.negocio_id == negocio.id, Adicional.eliminado == False).all()}  # noqa: E712
    ids = [str(i) for i in dict.fromkeys(datos.ids) if str(i) in validos]

    productos = [producto]
    if datos.aplicar_a_categoria and producto.categoria:
        productos = db.query(Producto).filter(
            Producto.negocio_id == negocio.id, Producto.categoria == producto.categoria,
            Producto.estado == "activo").all()
    for p in productos:
        p.adicionales = list(ids)
    db.commit()
    return {"ok": True, "productos": len(productos), "adicionales": ids}


# ── Cliente ────────────────────────────────────────────────────────────────

@router.get("/producto/{producto_id}", summary="Adicionales disponibles de un producto")
async def adicionales_disponibles(producto_id: UUID, db: Session = Depends(get_db)):
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto or not producto.adicionales:
        return []
    ids = [str(i) for i in producto.adicionales]
    filas = {str(a.id): a for a in db.query(Adicional).filter(
        Adicional.id.in_(ids), Adicional.eliminado == False, Adicional.disponible == True).all()}  # noqa: E712
    return [_fila(filas[i]) for i in ids if i in filas]
