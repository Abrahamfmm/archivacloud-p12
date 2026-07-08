ArchivaCloud - Proyecto P-12
Integrantes: [Abraham Maltes] & [Francisco Carcamo]
Código de pareja: P-12

1. Parámetros únicos (Anexo B)
Tipos de archivo permitidos: DOCX, ODT, RTF

Tamaño máximo: 14 MB

Bucket / Región: archivacloud-p12 / us-east-2

Feature extra: Renombrar archivos (copia con nuevo nombre y elimina el anterior).

2. Arquitectura

3. Stack Tecnológico
Backend: Python 3.10+, FastAPI, Uvicorn, Boto3, Pydantic.

Frontend: React 18, Vite, Axios.

4. Configuración
Variables de entorno: Crear un archivo .env en backend/ basado en .env.example.

IAM: Debido a que este proyecto se desarrolla en un entorno de **AWS Academy**, el acceso a los recursos se gestiona mediante credenciales temporales (STS) de corta duración, las cuales son rotadas automáticamente por la plataforma.

Para cumplir con el principio de menor privilegio (SEC-05), el código está configurado para interactuar exclusivamente con nuestro bucket asignado (`archivacloud-p12`) mediante las siguientes acciones restringidas:
- `s3:PutObject`
- `s3:GetObject`
- `s3:DeleteObject`
- `s3:ListBucket`

CORS: app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)

5. Escaneo de seguridad (SEC-09)
Backend (pip-audit): Se ejecutó el comando y no se encontraron vulnerabilidades críticas en las dependencias actuales.

Frontend (npm audit): Se ejecutó el comando y el reporte se encuentra limpio.

6. Feature Extra
La funcionalidad de Renombrar permite al usuario cambiar el nombre de un archivo desde la lista del bucket. El backend recibe el nombre antiguo y el nuevo, realiza una operación copy_object en S3 con el nuevo nombre y luego ejecuta delete_object sobre el original, garantizando la persistencia y limpieza.

7. Commits clave
https://github.com/Abrahamfmm/archivacloud-p12/commits/main/