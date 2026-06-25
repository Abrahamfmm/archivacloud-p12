from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
import boto3
from botocore.client import Config
import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

# Importaciones de nuestro nuevo módulo de seguridad (Sprint 3)
from auth import get_password_hash, verify_password, create_access_token, get_current_user

# --- Base de datos simulada en memoria ---
DB_USUARIOS = {}

# 1. Forzar la ruta absoluta de la carpeta donde está este main.py
BASE_DIR = Path(__file__).resolve().parent
dotenv_path = BASE_DIR / ".env"

print("\n=== DIAGNÓSTICO DEL ENTORNO ===")
print(f"Ruta actual de main.py: {BASE_DIR}")
print(f"Buscando archivo .env en: {dotenv_path}")

# Verificar si el archivo existe físicamente
if dotenv_path.exists():
    print("✅ ¡El archivo .env FÍSICAMENTE SÍ EXISTE en esa carpeta!")
else:
    print("❌ El archivo '.env' NO existe con ese nombre exacto.")
print("===============================\n")

# 2. Cargar el .env usando la ruta absoluta calculada
load_dotenv(dotenv_path=dotenv_path)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], # Tu frontend React
    allow_credentials=True,
    allow_methods=["*"], # Permite POST, GET, OPTIONS, PUT, DELETE
    allow_headers=["*"], # Permite todos los headers (Content-Type, Authorization, etc.)
)

BUCKET_NAME = os.getenv('BUCKET_NAME')

if not BUCKET_NAME:
    print("⚠️ ADVERTENCIA: No se encontró BUCKET_NAME en las variables de entorno.\n")

# Configuración del cliente S3 con Endpoint Regional Forzado
aws_region = os.getenv('AWS_REGION')

s3_client = boto3.client(
    's3',
    region_name=aws_region,
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    aws_session_token=os.getenv('AWS_SESSION_TOKEN'),
    endpoint_url=f"https://s3.{aws_region}.amazonaws.com" if aws_region else None,
    config=Config(signature_version='s3v4')
)

# ==========================================
# MODELOS DE DATOS (Pydantic)
# ==========================================
class UploadRequest(BaseModel):
    fileName: str
    fileType: str

class UserAuth(BaseModel):
    username: str
    password: str

class RenameRequest(BaseModel):
    newFilename: str

# ==========================================
# ENDPOINTS DE AUTENTICACIÓN (SPRINT 3)
# ==========================================
@app.post("/api/auth/register")
def register(user: UserAuth):
    if user.username in DB_USUARIOS:
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    
    # Guardamos el usuario con contraseña encriptada
    DB_USUARIOS[user.username] = {
        "username": user.username,
        "password": get_password_hash(user.password)
    }
    return {"message": "Usuario registrado exitosamente"}

@app.post("/api/auth/login")
def login(user: UserAuth):
    usuario_encontrado = DB_USUARIOS.get(user.username)
    if not usuario_encontrado or not verify_password(user.password, usuario_encontrado["password"]):
        raise HTTPException(status_code=400, detail="Usuario o contraseña incorrectos")
    
    # Generamos el token JWT
    token = create_access_token(data={"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}

# --- Nuevo Endpoint PUT para renombrar archivos (Feature P-12) ---
@app.put("/api/files/{filename}/rename")
def rename_file(filename: str, request: RenameRequest, user: str = Depends(get_current_user)):
    # 1. Validar que el nuevo nombre mantenga una extensión permitida para P-12
    allowed_extensions = ['.docx', '.odt', '.rtf']
    _, ext = os.path.splitext(request.newFilename)
    if ext.lower() not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail="Extensión inválida. El nuevo nombre debe terminar en .docx, .odt o .rtf"
        )

    # Sanitizar el nuevo nombre
    clean_new_name = "".join([c if c.isalnum() or c in "._-" else "_" for c in request.newFilename])
    
    old_key = f"uploads/{filename}"
    new_key = f"uploads/{clean_new_name}"

    try:
        # PASO 1: Copiar el objeto con el nuevo nombre
        copy_source = {'Bucket': BUCKET_NAME, 'Key': old_key}
        s3_client.copy_object(
            CopySource=copy_source, 
            Bucket=BUCKET_NAME, 
            Key=new_key
        )
        
        # PASO 2: Eliminar el objeto original
        s3_client.delete_object(Bucket=BUCKET_NAME, Key=old_key)
        
        return {"message": f"Archivo renombrado exitosamente a {clean_new_name}"}
        
    except Exception as e:
        import traceback
        print("--- ERROR AL RENOMBRAR EN S3 ---")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Error interno al renombrar el archivo.")

# ==========================================
# ENDPOINTS PROTEGIDOS DE AWS S3 (SPRINT 2 + 3)
# ==========================================

# Notarás que agregamos "user: str = Depends(get_current_user)" a las funciones de abajo.
# Esto obliga a FastAPI a pedir un token JWT válido antes de ejecutar el código.

@app.post("/api/upload/presigned-url")
def generate_presigned_url(request: UploadRequest, user: str = Depends(get_current_user)):
    allowed_extensions = ['.docx', '.odt', '.rtf']
    _, ext = os.path.splitext(request.fileName)
    if ext.lower() not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido. Solo DOCX, ODT, RTF.")

    # Sanitizar el nombre del archivo
    clean_name = "".join([c if c.isalnum() or c in "._-" else "_" for c in request.fileName])
    object_key = f"uploads/{clean_name}"

    try:
        # FORZAMOS 'application/octet-stream' para neutralizar diferencias de navegadores/OS
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': object_key,
                'ContentType': 'application/octet-stream'
            },
            ExpiresIn=3600
        )
        
        public_url = f"https://{BUCKET_NAME}.s3.{os.getenv('AWS_REGION')}.amazonaws.com/{object_key}"
        
        return {
            "presignedUrl": presigned_url, 
            "key": object_key, 
            "publicUrl": public_url
        }
        
    except Exception as e:
        import traceback
        print("--- ERROR DETALLADO DE BOTO3 ---")
        traceback.print_exc() 
        raise HTTPException(status_code=500, detail="Error interno al generar la URL.")
    
# --- Endpoint GET para listar archivos (PROTEGIDO) ---
@app.get("/api/files")
def list_files(user: str = Depends(get_current_user)):
    try:
        # Intentar listar los objetos del bucket en AWS
        response = s3_client.list_objects_v2(Bucket=BUCKET_NAME)
        
        file_list = []
        # Si el bucket tiene archivos, los procesamos
        if 'Contents' in response:
            for obj in response['Contents']:
                # Generar una URL limpia para descargar/ver el archivo
                file_url = f"https://{BUCKET_NAME}.s3.{os.getenv('AWS_REGION')}.amazonaws.com/{obj['Key']}"
                file_list.append({
                    "filename": obj['Key'].replace("uploads/", ""), # Limpiamos el prefijo de la carpeta
                    "size": obj['Size'],
                    "url": file_url
                })
        
        return file_list

    except Exception as e:
        import traceback
        print("--- 🚨 ERROR CRÍTICO EN /api/files ---")
        traceback.print_exc() 
        raise HTTPException(
            status_code=500, 
            detail=f"Error al conectar con S3: {str(e)}. ¡Revisa si tus credenciales .env expiraron!"
        )

# --- Endpoint DELETE para borrar un archivo (PROTEGIDO) ---
@app.delete("/api/files/{filename}")
def delete_file(filename: str, user: str = Depends(get_current_user)):
    object_key = f"uploads/{filename}"
    try:
        s3_client.delete_object(Bucket=BUCKET_NAME, Key=object_key)
        return {"message": f"Archivo {filename} eliminado exitosamente."}
    except Exception as e:
        print("Error al eliminar:", e)
        raise HTTPException(status_code=500, detail="Error interno al eliminar el archivo.")