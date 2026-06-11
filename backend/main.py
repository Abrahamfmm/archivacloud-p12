from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import boto3
from botocore.client import Config
import os
from pathlib import Path
from dotenv import load_dotenv

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
    print(f"Archivos reales detectados en esta carpeta: {os.listdir(BASE_DIR)}")
print("===============================\n")

# 2. Cargar el .env usando la ruta absoluta calculada
load_dotenv(dotenv_path=dotenv_path)

app = FastAPI()

BUCKET_NAME = os.getenv('BUCKET_NAME')

if not BUCKET_NAME:
    print("⚠️ ADVERTENCIA: No se encontró BUCKET_NAME en las variables de entorno.\n")

# Configuración del cliente S3
s3_client = boto3.client(
    's3',
    region_name=os.getenv('AWS_REGION'),
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    aws_session_token=os.getenv('AWS_SESSION_TOKEN'),
    config=Config(signature_version='s3v4')
)

class UploadRequest(BaseModel):
    fileName: str
    fileType: str

@app.post("/api/upload/presigned-url")
def generate_presigned_url(request: UploadRequest):
    allowed_extensions = ['.docx', '.odt', '.rtf']
    _, ext = os.path.splitext(request.fileName)
    if ext.lower() not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido. Solo DOCX, ODT, RTF.")

    object_key = f"uploads/{request.fileName}"

    try:
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': object_key,
                'ContentType': request.fileType
            },
            ExpiresIn=3600
        )
        
        # --- CORRECCIÓN AQUÍ: Definir la variable antes de usarla ---
        public_url = f"https://{BUCKET_NAME}.s3.{os.getenv('AWS_REGION')}.amazonaws.com/{object_key}"
        
        return {
            "presignedUrl": presigned_url, 
            "key": object_key, 
            "publicUrl": public_url
        }
        
    except Exception as e:
        # Ahora que el código está limpio, si falla aquí es 100% culpa de AWS
        import traceback
        print("--- ERROR DETALLADO DE BOTO3 ---")
        traceback.print_exc() 
        raise HTTPException(status_code=500, detail="Error interno al generar la URL.")