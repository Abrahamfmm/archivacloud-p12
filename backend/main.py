"""
ArchivaCloud SpA — Portal S3
Pareja : P-12
Sprint  : 1 — Backend mínimo
Parámetros únicos:
  - Tipos permitidos : DOCX, ODT, RTF
  - Tamaño máximo   : 14 MB
  - Bucket          : archivacloud-p12
  - Región          : us-east-2 (Ohio)
  - Feature extra   : Renombrar archivo (Sprint 3)
"""
import logging
import os
import re

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

load_dotenv()

# ──────────────────────────────────────────────
# Logging — SEC-07: el cliente nunca ve stack traces
# ──────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("archivacloud-p12")

# ──────────────────────────────────────────────
# App
# ──────────────────────────────────────────────
app = FastAPI(
    title="ArchivaCloud P-12 API",
    description="Portal de carga de archivos a Amazon S3 — Pareja P-12",
    version="0.1.0-sprint1",
)

# ──────────────────────────────────────────────
# SEC-02: CORS restrictivo (solo origen del frontend)
# ──────────────────────────────────────────────
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],          # Nunca "*"
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────
# Parámetros únicos P-12 (Anexo B)
# ──────────────────────────────────────────────
ALLOWED_EXTENSIONS: set[str] = {"docx", "odt", "rtf"}
MAX_SIZE_MB: int = 14
MAX_SIZE_BYTES: int = MAX_SIZE_MB * 1024 * 1024
BUCKET_NAME: str = os.getenv("S3_BUCKET_NAME", "archivacloud-p12")
AWS_REGION: str = os.getenv("AWS_REGION", "us-east-2")
S3_PREFIX: str = "uploads/"


# ──────────────────────────────────────────────
# Cliente S3
# ──────────────────────────────────────────────
def get_s3_client():
    """
    Crea cliente boto3 con credenciales del .env.
    AWS_SESSION_TOKEN es requerido en AWS Academy (Learner Lab).
    """
    return boto3.client(
        "s3",
        region_name=AWS_REGION,
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        aws_session_token=os.getenv("AWS_SESSION_TOKEN"),   # Academy: obligatorio
    )


# ──────────────────────────────────────────────
# Utilidades — SEC-03
# ──────────────────────────────────────────────
def sanitize_filename(filename: str) -> str:
    """
    SEC-03: Elimina caracteres peligrosos y componentes de ruta.
    Solo permite: letras, dígitos, guión, guión_bajo, punto, espacio.
    """
    filename = os.path.basename(filename)           # Previene path traversal
    filename = re.sub(r"[^\w\s\-.]", "", filename)  # Lista blanca
    return filename.strip()


def get_extension(filename: str) -> str:
    """Retorna la extensión en minúsculas; cadena vacía si no tiene."""
    parts = filename.rsplit(".", 1)
    return parts[-1].lower() if len(parts) == 2 else ""


# ──────────────────────────────────────────────
# Schemas Pydantic (validación de entrada — SEC-03)
# ──────────────────────────────────────────────
class PresignedUrlRequest(BaseModel):
    fileName: str
    fileType: str
    fileSize: int   # bytes, enviado desde el frontend antes de subir

    @field_validator("fileName")
    @classmethod
    def filename_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("El nombre de archivo no puede estar vacío.")
        return v

    @field_validator("fileSize")
    @classmethod
    def size_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("El tamaño del archivo debe ser mayor que 0.")
        return v


class PresignedUrlResponse(BaseModel):
    presignedUrl: str
    key: str
    publicUrl: str  # Referencia; no funciona con Block Public Access activo


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────
@app.get("/healthz", tags=["Health"])
def health_check():
    """Endpoint de salud — Sprint 1."""
    return {
        "status": "ok",
        "pair": "P-12",
        "bucket": BUCKET_NAME,
        "region": AWS_REGION,
        "allowed_types": sorted(ALLOWED_EXTENSIONS),
        "max_size_mb": MAX_SIZE_MB,
    }


@app.post(
    "/api/upload/presigned-url",
    response_model=PresignedUrlResponse,
    tags=["Upload"],
    summary="Generar presigned URL para subir archivo a S3",
)
def generate_presigned_url(request: PresignedUrlRequest):
    """
    Recibe fileName, fileType y fileSize.
    Valida extensión (DOCX/ODT/RTF) y tamaño (≤14 MB).
    Devuelve presignedUrl, key y publicUrl.
    """
    # 1. Sanitizar nombre — SEC-03
    safe_name = sanitize_filename(request.fileName)
    if not safe_name:
        raise HTTPException(
            status_code=400,
            detail="Nombre de archivo inválido después de sanitización.",
        )

    # 2. Validar extensión — SEC-03, Anexo B P-12
    ext = get_extension(safe_name)
    if ext not in ALLOWED_EXTENSIONS:
        allowed_str = ", ".join(e.upper() for e in sorted(ALLOWED_EXTENSIONS))
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de archivo no permitido. Solo se aceptan: {allowed_str}.",
        )

    # 3. Validar tamaño — SEC-04, Anexo B P-12
    if request.fileSize > MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"El archivo supera el límite de {MAX_SIZE_MB} MB.",
        )

    key = f"{S3_PREFIX}{safe_name}"

    # 4. Generar presigned URL
    try:
        s3 = get_s3_client()
        presigned_url = s3.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": BUCKET_NAME,
                "Key": key,
                "ContentType": request.fileType,
            },
            ExpiresIn=3600,   # Válida 1 hora
        )
    except ClientError as exc:
        # SEC-07: Solo el log interno ve el detalle; el cliente recibe mensaje genérico
        logger.error("Error generando presigned URL para key=%s: %s", key, exc)
        raise HTTPException(
            status_code=500,
            detail="Error interno al generar la URL de carga. Intenta nuevamente.",
        )

    public_url = (
        f"https://{BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{key}"
    )

    logger.info("Presigned URL generada para key=%s", key)

    return PresignedUrlResponse(
        presignedUrl=presigned_url,
        key=key,
        publicUrl=public_url,
    )