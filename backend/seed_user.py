from sqlalchemy.orm import Session
from config import SessionLocal, init_db
from models import Usuario
import bcrypt
from datetime import datetime

def hash_password(password: str) -> str:
    password_bytes = password[:72].encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode('utf-8')

def create_user(db, email, nombre, password):
    user = db.query(Usuario).filter(Usuario.email == email).first()
    if not user:
        print(f"Creando usuario: {email}")
        nuevo_usuario = Usuario(
            email=email,
            nombre=nombre,
            apellido="Zippy",
            telefono="1234567890",
            tipo_usuario="admin",
            password_hash=hash_password(password),
            estado="activo",
            fecha_creacion=datetime.utcnow(),
            es_verificado=True
        )
        db.add(nuevo_usuario)
        db.commit()
        print(f"✅ Usuario {email} creado con éxito.")
    else:
        print(f"El usuario {email} ya existe.")

def seed():
    init_db()
    db = SessionLocal()
    create_user(db, "admin@zippy.com", "Admin Zippy", "Alejo1705.")
    create_user(db, "admin@example.com", "Admin Example", "Alejo1705.")
    db.close()

if __name__ == "__main__":
    seed()
