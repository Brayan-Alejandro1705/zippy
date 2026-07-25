# ============================================================================
# seed_super_admins.py - Crea/actualiza las 3 cuentas de super admin
#
# Las contraseñas YA NO viven en este archivo (el repo es público).
# Se leen de variables de entorno:
#
#   SUPER_ADMIN_PASS_ALEJANDRA
#   SUPER_ADMIN_PASS_MAURICIO
#   SUPER_ADMIN_PASS_ALEJANDRO
#
# Uso en local (PowerShell):
#   $env:SUPER_ADMIN_PASS_ALEJANDRA="una-clave-larga"
#   $env:SUPER_ADMIN_PASS_MAURICIO="otra-clave-larga"
#   $env:SUPER_ADMIN_PASS_ALEJANDRO="otra-mas"
#   python seed_super_admins.py
#
# También puedes ponerlas en backend/.env (que está en .gitignore).
# El script NO corre si falta alguna o si alguien deja "12345678".
# ============================================================================

import os
import sys

from sqlalchemy import text
from config import SessionLocal, init_db, engine
from models import Usuario
import bcrypt
from datetime import datetime

try:
    from dotenv import load_dotenv
    load_dotenv()  # permite leer las claves desde backend/.env
except ImportError:
    pass

PASSWORDS_PROHIBIDAS = {"12345678", "password", "zippy123", "admin123"}


def leer_password(var_env: str, nombre: str) -> str:
    valor = os.getenv(var_env, "").strip()
    if not valor:
        print(f"ERROR: falta la variable de entorno {var_env} (contraseña de {nombre}).")
        sys.exit(1)
    if len(valor) < 10:
        print(f"ERROR: la contraseña de {nombre} debe tener al menos 10 caracteres.")
        sys.exit(1)
    if valor.lower() in PASSWORDS_PROHIBIDAS:
        print(f"ERROR: la contraseña de {nombre} es demasiado obvia. Elige otra.")
        sys.exit(1)
    return valor


def cargar_super_admins():
    return [
        {"email": "Alejandra@zippy.com.co", "nombre": "Alejandra",
         "password": leer_password("SUPER_ADMIN_PASS_ALEJANDRA", "Alejandra")},
        {"email": "Mauricio@zippy.com.co",  "nombre": "Mauricio",
         "password": leer_password("SUPER_ADMIN_PASS_MAURICIO", "Mauricio")},
        {"email": "Alejandro@zippy.com.co", "nombre": "Alejandro",
         "password": leer_password("SUPER_ADMIN_PASS_ALEJANDRO", "Alejandro")},
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
    admins = cargar_super_admins()  # valida las 3 claves ANTES de tocar la BD
    init_db()
    asegurar_columna_super_admin()
    db = SessionLocal()
    try:
        for admin in admins:
            crear_o_actualizar_super_admin(db, admin["email"], admin["nombre"], admin["password"])
    finally:
        db.close()


if __name__ == "__main__":
    seed()
