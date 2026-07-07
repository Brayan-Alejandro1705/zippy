# ============================================================================
# seed_super_admins.py - Crea las 3 cuentas de super admin
#
# Uso:
#   DATABASE_URL=<url_de_render> python seed_super_admins.py
#   (o simplemente `python seed_super_admins.py` si tu .env / entorno ya
#   apunta a la base de datos correcta)
# ============================================================================

from sqlalchemy import text
from config import SessionLocal, init_db, engine
from models import Usuario
import bcrypt
from datetime import datetime

SUPER_ADMINS = [
    {"email": "Alejandra@zippy.com.co", "nombre": "Alejandra", "password": "12345678"},
    {"email": "Mauricio@zippy.com.co",  "nombre": "Mauricio",  "password": "12345678"},
    {"email": "Alejandro@zippy.com.co", "nombre": "Alejandro", "password": "12345678"},
]


def hash_password(password: str) -> str:
    password_bytes = password[:72].encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode('utf-8')


def asegurar_columna_super_admin():
    """La tabla 'usuarios' ya existe en producción; create_all no altera
    tablas existentes, así que la columna nueva se agrega a mano."""
    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS es_super_admin BOOLEAN NOT NULL DEFAULT FALSE"
        ))
        conn.commit()


def crear_o_actualizar_super_admin(db, email, nombre, password):
    usuario = db.query(Usuario).filter(Usuario.email == email).first()
    if usuario:
        usuario.tipo_usuario = "admin"
        usuario.estado = "activo"
        usuario.es_super_admin = True
        usuario.password_hash = hash_password(password)
        db.commit()
        print(f"Actualizado a super admin: {email}")
        return

    nuevo = Usuario(
        email=email,
        nombre=nombre,
        apellido="Zippy",
        telefono=None,
        tipo_usuario="admin",
        password_hash=hash_password(password),
        estado="activo",
        es_verificado=True,
        es_super_admin=True,
        fecha_creacion=datetime.utcnow(),
    )
    db.add(nuevo)
    db.commit()
    print(f"Creado super admin: {email}")


def seed():
    init_db()  # crea tablas nuevas que aún no existan (p. ej. mensajes_orden)
    asegurar_columna_super_admin()
    db = SessionLocal()
    try:
        for admin in SUPER_ADMINS:
            crear_o_actualizar_super_admin(db, admin["email"], admin["nombre"], admin["password"])
    finally:
        db.close()


if __name__ == "__main__":
    seed()
