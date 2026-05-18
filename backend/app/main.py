"""
Residente Digital API - Backend con Pipeline IA Modular
IMPL-20260225-01: Clasificação y extracción inteligentes de documentos médicos.
IMPL-20260225-02: Firma Digital Avanzada y Motor de Reportes Masivos.

IMPL-20260326-16: Endpoints V2 para prediagnóstico IA separado (ARCH-20260326-16).
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
import os
import re
import time
import json
import hashlib
from typing import List, Dict, Any, Optional

from services.ai import DocumentClassifierService, ExtractorService, PrediagnosticService
from services.pdf import SignerService, ReportService
from schemas import DocumentClassification, ExtractedDataUnion


def _read_env_var(key: str) -> Optional[str]:
    """ARCH-20260326-02: Normaliza variables con whitespace accidental. Respaldo: context/checkpoints/CHK_ARCH-20260326-02-GEMINI-ENV-NORMALIZATION.md."""
    value = os.getenv(key)
    if value:
        return value.strip()

    for env_key, env_value in os.environ.items():
        if env_key.strip() == key and env_value:
            return env_value.strip()

    return None

app = FastAPI(
    title="Residente Digital API",
    description="Pipeline IA modular para análisis de documentos médicos"
)

# CORS: permitir al frontend de Vercel comunicarse con este backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = _read_env_var("UPLOAD_DIR") or "/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# IMPL-20260513-S3: Storage S3-compatible (Railway Bucket).
# Secretos vienen exclusivamente por env vars — nunca hardcodeados ni logueados.
STORAGE_S3_ENDPOINT   = _read_env_var("STORAGE_S3_ENDPOINT")
STORAGE_S3_REGION     = _read_env_var("STORAGE_S3_REGION") or "auto"
STORAGE_S3_BUCKET     = _read_env_var("STORAGE_S3_BUCKET")
STORAGE_S3_ACCESS_KEY = _read_env_var("STORAGE_S3_ACCESS_KEY")
STORAGE_S3_SECRET_KEY = _read_env_var("STORAGE_S3_SECRET_KEY")

_s3_client = None
_s3_enabled = False
if all([STORAGE_S3_ENDPOINT, STORAGE_S3_BUCKET, STORAGE_S3_ACCESS_KEY, STORAGE_S3_SECRET_KEY]):
    try:
        import boto3
        from botocore.config import Config as _BotocoreConfig
        _s3_client = boto3.client(
            "s3",
            endpoint_url=STORAGE_S3_ENDPOINT,
            region_name=STORAGE_S3_REGION,
            aws_access_key_id=STORAGE_S3_ACCESS_KEY,
            aws_secret_access_key=STORAGE_S3_SECRET_KEY,
            config=_BotocoreConfig(signature_version="s3v4"),
        )
        _s3_enabled = True
        print("✅ S3 Storage inicializado (bucket configurado)")
    except Exception as _s3_init_err:
        print(f"⚠️ S3 Storage no disponible: {str(_s3_init_err)[:200]}")

# In production this MUST be an env variable.
GEMINI_API_KEY = _read_env_var("GEMINI_API_KEY")
# IMPL-20260513-01: Separación de modelos por capa
# GEMINI_MODEL_EXTRACTION: modelo para extracción documental (OCR + structuring) → operativo: gemini-2.5-flash
# GEMINI_MODEL_CLINICAL:   modelo para interpretación clínica → objetivo: medgemma-27b-text-it (fallback: flash)
# GEMINI_MODEL queda como retrocompat para código que aún no fue migrado.
GEMINI_MODEL_EXTRACTION = _read_env_var("GEMINI_MODEL_EXTRACTION") or _read_env_var("GEMINI_MODEL") or "gemini-2.5-flash"
GEMINI_MODEL_CLINICAL   = _read_env_var("GEMINI_MODEL_CLINICAL") or _read_env_var("GEMINI_MODEL") or "gemini-2.5-flash"
GEMINI_MODEL = GEMINI_MODEL_EXTRACTION  # retrocompat
# IMPL-20260513-01: Bandera MedGemma — False hasta que la integración esté habilitada en runtime
# IMPL-20260513-03: MEDGEMMA_STATUS es dinámico: 'available' si MEDGEMMA_ENABLED=true y key presente
MEDGEMMA_ENABLED = (_read_env_var("MEDGEMMA_ENABLED") or "false").lower() == "true"
FEATHERLESS_API_KEY  = _read_env_var("FEATHERLESS_API_KEY") or ""
FEATHERLESS_BASE_URL = _read_env_var("FEATHERLESS_BASE_URL") or "https://api.featherless.ai/v1"
FEATHERLESS_MODEL    = _read_env_var("FEATHERLESS_MODEL") or "google/medgemma-27b-text-it"
MEDGEMMA_STATUS = "available" if (MEDGEMMA_ENABLED and FEATHERLESS_API_KEY) else "pending_integration"
PIPELINE_VERSION = "ai-pipeline-2026-03"
EXTRACTION_PROMPT_VERSION = "extract-v4"   # IMPL-20260516-07: campos fuente audiometría (faringe, CAD, CAI, MTD, MTI)
# ARCH-20260518-03: la versión real puede ser 'calibration_custom' cuando viene de aiCalibration
PREDIAGNOSIS_PROMPT_VERSION = "predx-v2"   # IMPL-20260513-01: soporte calibración médica

# ARCH-20260326-05: Estado de inicialización IA — persiste en memoria para diagnóstico.
_GOOGLE_API_KEY_RE = re.compile(r'AIza[A-Za-z0-9_\-]{30,}')
ai_init_error: Optional[str] = None


def _sanitize_error(err: str) -> str:
    """Redacta API keys y trunca errores para exponer sólo diagnóstico seguro. ARCH-20260326-05."""
    if not err:
        return ""
    clean = _GOOGLE_API_KEY_RE.sub('[API_KEY_REDACTED]', str(err))
    return clean[:300]


def _detect_content_type(key: str) -> tuple:
    """
    Deriva ContentType y si el archivo debe presentarse inline (PDF/imagen) desde la extensión.
    Retorna (content_type: str, is_embeddable: bool).
    IMPL-20260516-01: Slice A — visor inline bucket. ARCH-20260516-01.
    """
    ext = key.rsplit(".", 1)[-1].lower() if "." in key else ""
    type_map = {
        "pdf":  ("application/pdf",  True),
        "png":  ("image/png",        True),
        "jpg":  ("image/jpeg",       True),
        "jpeg": ("image/jpeg",       True),
        "gif":  ("image/gif",        True),
        "webp": ("image/webp",       True),
        "tiff": ("image/tiff",       True),
        "tif":  ("image/tiff",       True),
    }
    return type_map.get(ext, ("application/octet-stream", False))


def _upload_file_to_s3(contents: bytes, key: str) -> bool:
    """
    IMPL-20260513-S3: Sube bytes al bucket S3-compatible. Retorna True si exitoso. No loguea secretos.
    IMPL-20260516-01: Preserva ContentType correcto y ContentDisposition=inline para PDF/imágenes
    para que el visor embebido del panel lateral no dispare descarga automática. ARCH-20260516-01.
    """
    import io
    if not _s3_enabled or not _s3_client:
        return False
    try:
        content_type, is_embeddable = _detect_content_type(key)
        extra_args: dict = {"ContentType": content_type}
        if is_embeddable:
            extra_args["ContentDisposition"] = "inline"
        _s3_client.upload_fileobj(
            io.BytesIO(contents), STORAGE_S3_BUCKET, key, ExtraArgs=extra_args
        )
        return True
    except Exception as e:
        print(f"⚠️ S3 upload error key={key}: {_sanitize_error(str(e))}")
        return False


def _ai_unavailable_response(msg: str = "Servicios de IA no están disponibles") -> dict:
    """Respuesta estándar cuando IA no está disponible, con detalles de diagnóstico. ARCH-20260326-05."""
    current_api_key = _read_env_var("GEMINI_API_KEY")
    current_model = _read_env_var("GEMINI_MODEL") or GEMINI_MODEL
    return {
        "status": "error",
        "error": msg,
        "details": {
            "classifier": classifier is not None,
            "extractor": extractor is not None,
            "prediagnostic": prediagnostic_svc is not None,
            "api_key_present": bool(current_api_key),
            "model": current_model,
            "last_init_error": ai_init_error,
        },
    }


# Inicializar servicios de IA
# IMPL-20260513-01: Extractor usa GEMINI_MODEL_EXTRACTION (Pro); PrediagnosticService usa GEMINI_MODEL_CLINICAL
try:
    classifier = DocumentClassifierService(api_key=GEMINI_API_KEY, model=GEMINI_MODEL_EXTRACTION)
    extractor = ExtractorService(api_key=GEMINI_API_KEY, model=GEMINI_MODEL_EXTRACTION)
    prediagnostic_svc = PrediagnosticService(api_key=GEMINI_API_KEY, model=GEMINI_MODEL_CLINICAL)
    ai_init_error = None
except Exception as e:
    print(f"⚠️ Error inicializando servicios de IA: {e}")
    ai_init_error = _sanitize_error(str(e))
    classifier = None
    extractor = None
    prediagnostic_svc = None

# Inicializar servicios de PDF
try:
    signer = SignerService(cert_dir="/app/certs")
    reporter = ReportService(output_dir="/app/reports")
except Exception as e:
    print(f"⚠️ Error inicializando servicios de PDF: {e}")
    signer = None
    reporter = None

class AnalyzeRequest(BaseModel):
    """Solicitud de análisis de documento médico."""
    file_path: str
    expected_type: str | None = None  # Para retrocompatibilidad (ahora se detecta automáticamente)


class SignPdfRequest(BaseModel):
    """Solicitud para firmar un PDF."""
    input_pdf: str
    output_pdf: Optional[str] = None
    reason: Optional[str] = "Certificado Médico AMI"
    password: str  # Requerido, sin valor por defecto por seguridad


class GenerateReportRequest(BaseModel):
    """Solicitud para generar un reporte masivo."""
    data_list: List[Dict[str, Any]]
    formats: Optional[List[str]] = ["excel", "json", "html"]  # Formatos a generar
    title: Optional[str] = "Reporte de Consolidación"


@app.get("/")
def read_root():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "Residente Digital Backend (Pipeline IA Modular)",
        "version": "2.1",
        "pipeline": "Clasificador + Extractor Especializado"
    }


@app.get("/api/v2/ai/status")
def v2_ai_status():
    """
    Estado de diagnóstico de servicios IA — solo lectura, sin secretos.
    ARCH-20260326-05: Expone causa raíz de fallos de inicialización de forma segura.
    IMPL-20260513-01: Expone modelos separados por capa y estado real de MedGemma.
    Nunca retorna el valor de GEMINI_API_KEY; sólo informa si está presente.
    """
    current_api_key = _read_env_var("GEMINI_API_KEY")
    current_extraction_model = _read_env_var("GEMINI_MODEL_EXTRACTION") or GEMINI_MODEL_EXTRACTION
    current_clinical_model   = _read_env_var("GEMINI_MODEL_CLINICAL") or GEMINI_MODEL_CLINICAL
    # IMPL-20260513-03: estado dinámico del proveedor clínico
    featherless_key_present = bool(_read_env_var("FEATHERLESS_API_KEY"))
    active_clinical_provider = "featherless" if (MEDGEMMA_ENABLED and featherless_key_present) else "gemini"
    return {
        "overall_status": "ok" if all([classifier, extractor, prediagnostic_svc]) else "degraded",
        "classifier": classifier is not None,
        "extractor": extractor is not None,
        "prediagnostic": prediagnostic_svc is not None,
        # IMPL-20260513-01: separación por capa
        "model_extraction": current_extraction_model,
        "model_clinical": current_clinical_model,
        "medgemma_enabled": MEDGEMMA_ENABLED,
        "medgemma_status": MEDGEMMA_STATUS,
        # IMPL-20260513-03: trazabilidad del proveedor activo
        "clinical_provider_active": active_clinical_provider,
        "featherless_key_present": featherless_key_present,
        "featherless_base_url": FEATHERLESS_BASE_URL,
        "featherless_model": FEATHERLESS_MODEL,
        "api_key_present": bool(current_api_key),
        "pipeline_version": PIPELINE_VERSION,
        "extraction_prompt_version": EXTRACTION_PROMPT_VERSION,
        "prediagnosis_prompt_version": PREDIAGNOSIS_PROMPT_VERSION,
        "last_init_error": ai_init_error,
    }


@app.post("/api/v1/upload-only")
async def upload_only(file: UploadFile = File(...)):
    """
    Persiste físicamente el archivo en /uploads sin ejecutar análisis IA.
    FIX ARCH-20260326-04: Fallback para cuando el pipeline IA V2 no está disponible.
    Garantiza que fileUrl en DB apunte a un archivo que realmente existe.
    """
    filename = f"{int(time.time())}-{file.filename.replace(' ', '_')}"
    try:
        contents = await file.read()
        # IMPL-20260513-S3: priorizar bucket cuando está configurado
        if _s3_enabled and _upload_file_to_s3(contents, filename):
            print(f"📁 Upload-only (S3): {filename} ({len(contents)} bytes)")
            return {
                "status": "success",
                "file": filename,
                "file_url": f"/api/files/{filename}",
            }
        # Fallback: filesystem local
        local_path = os.path.join(UPLOAD_DIR, filename)
        with open(local_path, "wb") as f:
            f.write(contents)
        print(f"📁 Upload-only (local): {filename} ({len(contents)} bytes)")
        return {
            "status": "success",
            "file": filename,
            "file_url": f"/uploads/{filename}",
        }
    except Exception as e:
        print(f"❌ Error en upload-only: {e}")
        return {"status": "error", "error": str(e)}


@app.post("/api/v1/upload-and-analyze")
async def upload_and_analyze(file: UploadFile = File(...)):
    """
    Endpoint combinado: recibe un archivo multipart, lo guarda en /uploads,
    ejecuta el pipeline IA completo y retorna el resultado.
    Diseñado para ser llamado desde Vercel (serverless, sin filesystem propio).
    """
    if not classifier or not extractor:
        return {
            "status": "error",
            "error": "Servicios de IA no están disponibles"
        }
    
    filename = f"{int(time.time())}-{file.filename.replace(' ', '_')}"
    local_path = os.path.join(UPLOAD_DIR, filename)
    
    try:
        # Guardar archivo en disco de Railway
        contents = await file.read()
        with open(local_path, "wb") as f:
            f.write(contents)
        
        print(f"\n🚀 Upload+Analyze: {filename} ({len(contents)} bytes)")
        pipeline_start = time.time()
        
        # PASO 1: CLASIFICACIÓN
        classification = classifier.classify(local_path)
        print(f"   ✓ Clasificado: {classification.tipo} ({classification.confianza:.2f})")
        
        # PASO 2: EXTRACCIÓN
        extracted_data = extractor.extract_by_type(local_path, classification.tipo)
        
        total_time = time.time() - pipeline_start
        print(f"   ✓ Pipeline completo en {total_time:.2f}s")
        
        return {
            "status": "success",
            "file": filename,
            "classification": {
                "detected_type": classification.tipo,
                "confidence": classification.confianza,
                "reason": classification.razon,
            },
            "extraction": extracted_data if isinstance(extracted_data, dict) else extracted_data.model_dump(),
            "timings": {"total_seconds": round(total_time, 2)},
        }
    
    except Exception as e:
        print(f"❌ Error en upload-and-analyze: {e}")
        return {"status": "error", "error": str(e), "file": filename}


@app.post("/api/v1/analyze")
def analyze_document_v2(request: AnalyzeRequest):
    """
    Endpoint mejorado que usa el Pipeline IA Modular.
    
    1. Clasifica el documento (Audiometría, Laboratorio, etc.)
    2. Extrae datos estructurados según el tipo específico.
    3. Retorna JSON con validación Pydantic.
    
    IMPL-20260225-01: Pipeline IA modular.
    """
    if not classifier or not extractor:
        return {
            "status": "error",
            "error": "Servicios de IA no están disponibles"
        }
    
    filename = os.path.basename(request.file_path)
    local_path = os.path.join(UPLOAD_DIR, filename)
    
    if not os.path.exists(local_path):
        raise HTTPException(
            status_code=404,
            detail=f"Archivo no encontrado: {filename}"
        )
    
    try:
        print(f"\n🚀 Analizando documento: {filename}")
        pipeline_start = time.time()
        
        # PASO 1: CLASIFICACIÓN
        print("► Paso 1: Clasificación de documento")
        classification = classifier.classify(local_path)
        classification_time = time.time() - pipeline_start
        print(f"   ✓ Clasificado como: {classification.tipo} (confianza: {classification.confianza:.2f})")
        
        # PASO 2: EXTRACCIÓN ESPECIALIZADA
        print(f"► Paso 2: Extracción de datos para {classification.tipo}")
        extraction_start = time.time()
        extracted_data = extractor.extract_by_type(local_path, classification.tipo)
        extraction_time = time.time() - extraction_start
        print(f"   ✓ Datos extraídos correctamente")
        
        # PASO 3: RETORNAR RESULTADO ESTRUCTURADO
        total_time = time.time() - pipeline_start
        
        return {
            "status": "success",
            "file": filename,
            "classification": {
                "detected_type": classification.tipo,
                "confidence": classification.confianza,
                "reason": classification.razon,
            },
            "extraction": extracted_data if isinstance(extracted_data, dict) else extracted_data.model_dump(),
            "timings": {
                "classification_seconds": round(classification_time, 2),
                "extraction_seconds": round(extraction_time, 2),
                "total_seconds": round(total_time, 2),
            },
            "pipeline_version": "2.0"
        }
    
    except Exception as e:
        print(f"❌ Error en pipeline: {e}")
        return {
            "status": "error",
            "error": str(e),
            "file": filename
        }


@app.post("/analyze")
def analyze_document(request: AnalyzeRequest):
    """
    DEPRECATED: Endpoint legacy para retrocompatibilidad.
    Use /api/v1/analyze en su lugar.
    """
    return analyze_document_v2(request)


# ========================================
# ENDPOINTS DE FIRMA DIGITAL (IMPL-20260225-02)
# ========================================

@app.post("/api/v1/sign-pdf")
def sign_pdf(request: SignPdfRequest):
    """
    Endpoint para firmar un PDF con certificado X.509.
    
    Aplica una firma digital avanzada a un documento PDF.
    Genera certificado autofirmado de prueba si no existe.
    
    Args:
        input_pdf: Ruta del PDF a firmar
        output_pdf: Ruta del PDF firmado (se genera automáticamente si no se proporciona)
        reason: Razón de la firma
        password: Contraseña del certificado
    
    IMPL-20260225-02: Firma Digital Avanzada
    """
    if not signer:
        return {
            "status": "error",
            "error": "Servicio de firma no está disponible"
        }
    
    try:
        input_path = os.path.join(UPLOAD_DIR, os.path.basename(request.input_pdf))
        
        if not os.path.exists(input_path):
            raise HTTPException(
                status_code=404,
                detail=f"Archivo no encontrado: {request.input_pdf}"
            )
        
        # Generar nombre de salida si no se proporciona
        if request.output_pdf:
            safe_filename = os.path.basename(request.output_pdf)
            output_path = os.path.join(UPLOAD_DIR, safe_filename)
        else:
            base_name = os.path.splitext(os.path.basename(request.input_pdf))[0]
            output_path = os.path.join(UPLOAD_DIR, f"{base_name}_signed.pdf")
        
        print(f"\n🔐 Firmando PDF: {os.path.basename(input_path)}")
        print(f"   → Certificado: {signer.cert_path}")
        
        result = signer.sign_pdf(
            input_pdf=input_path,
            output_pdf=output_path,
            reason=request.reason,
            password=request.password
        )
        
        if result["status"] == "success":
            print(f"   ✓ PDF firmado exitosamente")
        else:
            print(f"   ❌ Error: {result.get('message')}")
        
        return result
    
    except Exception as e:
        print(f"❌ Error en sign_pdf: {e}")
        return {
            "status": "error",
            "error": str(e)
        }


@app.post("/api/v1/verify-signature")
def verify_pdf_signature(file_path: str):
    """
    Endpoint para verificar la firma digital de un PDF.
    
    Args:
        file_path: Ruta del PDF a verificar
    
    IMPL-20260225-02: Verificación de firmas
    """
    if not signer:
        return {
            "status": "error",
            "error": "Servicio de firma no está disponible"
        }
    
    try:
        pdf_path = os.path.join(UPLOAD_DIR, os.path.basename(file_path))
        
        if not os.path.exists(pdf_path):
            raise HTTPException(
                status_code=404,
                detail=f"Archivo no encontrado: {file_path}"
            )
        
        print(f"\n🔍 Verificando firma de: {os.path.basename(pdf_path)}")
        result = signer.verify_signature(pdf_path)
        
        return result
    
    except Exception as e:
        print(f"❌ Error en verify_signature: {e}")
        return {
            "status": "error",
            "error": str(e)
        }


# ========================================
# ENDPOINTS DE REPORTES MASIVOS (IMPL-20260225-02)
# ========================================

@app.post("/api/v1/generate-report")
def generate_report(request: GenerateReportRequest):
    """
    Endpoint para generar reportes masivos consolidados.
    
    Acepta una lista de datos y genera reportes en múltiples formatos:
    - Excel (XLSX) con formato básico
    - JSON estructurado
    - HTML para visualización
    
    Args:
        data_list: Lista de diccionarios con datos (ej. múltiples audiometrías)
        formats: Formatos a generar (['excel', 'json', 'html'])
        title: Título del reporte
    
    IMPL-20260225-02: Motor de Reportes Masivos
    """
    if not reporter:
        return {
            "status": "error",
            "error": "Servicio de reportes no está disponible"
        }
    
    try:
        print(f"\n📊 Generando reporte masivo para {len(request.data_list)} registros")
        print(f"   → Formatos: {request.formats}")
        
        result = reporter.batch_process(
            data_list=request.data_list,
            formats=request.formats
        )
        
        if result["status"] == "success":
            print(f"   ✓ Reportes generados exitosamente")
            print(f"   → Batch ID: {result.get('batch_id')}")
        else:
            print(f"   ⚠️ Errores: {result.get('errors')}")
        
        return result
    
    except Exception as e:
        print(f"❌ Error en generate_report: {e}")
        return {
            "status": "error",
            "error": str(e)
        }


@app.post("/api/v1/generate-excel-report")
def generate_excel_report(request: GenerateReportRequest):
    """
    Endpoint especializado para generar reporte en Excel.
    
    IMPL-20260225-02: Generación de Excel
    FIX-20260225-03: Retorno de Excel en Base64
    """
    if not reporter:
        return {
            "status": "error",
            "error": "Servicio de reportes no está disponible"
        }
    
    try:
        print(f"\n📈 Generando reporte Excel para {len(request.data_list)} registros")
        
        result = reporter.generate_excel_report(
            data_list=request.data_list
        )
        
        if result.get("status") == "success" and "output_file" in result:
            import base64
            with open(result["output_file"], "rb") as f:
                encoded = base64.b64encode(f.read()).decode("utf-8")
            result["data"] = {"xlsx": encoded}
            
        return result
    
    except Exception as e:
        print(f"❌ Error en generate_excel_report: {e}")
        return {
            "status": "error",
            "error": str(e)
        }


@app.post("/api/v1/generate-json-report")
def generate_json_report(request: GenerateReportRequest):
    """
    Endpoint especializado para generar reporte en JSON.
    
    IMPL-20260225-02: Generación de JSON
    """
    if not reporter:
        return {
            "status": "error",
            "error": "Servicio de reportes no está disponible"
        }
    
    try:
        print(f"\n📋 Generando reporte JSON para {len(request.data_list)} registros")
        
        result = reporter.generate_json_report(
            data_list=request.data_list
        )
        
        return result
    
    except Exception as e:
        print(f"❌ Error en generate_json_report: {e}")
        return {
            "status": "error",
            "error": str(e)
        }


# ========================================
# ENDPOINTS V2: PREDIAGNÓSTICO IA ESTRUCTURADO (IMPL-20260326-16)
# ARCH-20260326-16: Separación extracción / interpretación / revisión médica
# GUARDRAIL: estos endpoints nunca propagan contenido IA a dictamen final ni PDF firmado.
# ========================================


class V2AnalyzeStudyRequest(BaseModel):
    """
    Solicitud de análisis V2 — devuelve extracción pura + prediagnóstico en capas separadas.
    IMPL-20260326-16
    """
    file_path: str
    study_type: Optional[str] = None  # Si ya se conoce el tipo, omite clasificación
    triggered_by_user_id: Optional[str] = None
    trigger_reason: str = "initial_upload"


@app.post("/api/v2/studies/upload-and-analyze")
async def v2_upload_and_analyze(
    file: UploadFile = File(...),
    study_type: Optional[str] = None,
    triggered_by_user_id: Optional[str] = None,
    ai_calibration_json: Optional[str] = Form(default=None),
):
    """
    V2 Pipeline completo — upload, extracción pura y prediagnóstico en capas separadas.
    IMPL-20260326-16: ARCH-20260326-16.
    IMPL-20260518-03: Requiere ai_calibration_json con extraction.prompt configurado.
        La extracción falla explícitamente si falta el prompt de extracción (ARCH-20260518-03).

    Retorna:
      - classification: tipo y confianza de clasificación
      - extraction_snapshot: capa extractiva (parámetros canónicos sin diagnóstico)
      - prediagnosis_snapshot: capa de interpretación IA (con justificación, citas, limitaciones)
      - audit: metadatos de auditoría transaccional de toda la corrida

    GUARDRAIL: prediagnosis_snapshot NO puede usarse para cerrar expediente, emitir dictamen
    ni firmar documentos PDF sin revisión médica explícita.
    """
    if not classifier or not extractor or not prediagnostic_svc:
        return _ai_unavailable_response()

    # ARCH-20260518-03: parsear aiCalibration del form JSON
    ai_calibration: Optional[Dict[str, Any]] = None
    if ai_calibration_json:
        try:
            ai_calibration = json.loads(ai_calibration_json)
        except (json.JSONDecodeError, ValueError) as parse_err:
            return {
                "status": "error",
                "error": f"ai_calibration_json inválido: {parse_err}",
                "error_code": "AI_CALIBRATION_JSON_INVALID",
            }

    filename = f"{int(time.time())}-{file.filename.replace(' ', '_')}"
    local_path = os.path.join(UPLOAD_DIR, filename)

    try:
        contents = await file.read()
        with open(local_path, "wb") as f:
            f.write(contents)

        file_hash = f"sha256:{hashlib.sha256(contents).hexdigest()}"
        # IMPL-20260513-S3: subir al bucket para persistencia durable (pipeline lee desde local_path)
        _v2_file_url = (
            f"/api/files/{filename}"
            if (_s3_enabled and _upload_file_to_s3(contents, filename))
            else f"/uploads/{filename}"
        )
        print(f"\n🚀 V2 Upload+Analyze: {filename} ({len(contents)} bytes) → {_v2_file_url}")
        pipeline_start = time.time()

        # PASO 1: CLASIFICACIÓN (si no se provee study_type)
        if study_type:
            detected_type = study_type
            classification_dict = {"detected_type": study_type, "confidence": 1.0, "reason": "provided_by_caller"}
        else:
            classification = classifier.classify(local_path)
            detected_type = classification.tipo
            classification_dict = {
                "detected_type": classification.tipo,
                "confidence": classification.confianza,
                "reason": classification.razon,
            }
        print(f"   ✓ Tipo: {detected_type}")

        # PASO 2: EXTRACCIÓN PURA (sin interpretación clínica)
        # ARCH-20260518-03: prompt de extracción resuelto únicamente desde aiCalibration;
        # si falta, falla explícitamente (sin fallback backend).
        extraction_start = time.time()
        try:
            extracted_raw = extractor.extract_by_type(local_path, detected_type, ai_calibration=ai_calibration)
        except ValueError as ve:
            err_msg = str(ve)
            if "EXTRACTION_PROMPT_NOT_CONFIGURED" in err_msg:
                print(f"❌ [ARCH-20260518-03] {err_msg}")
                return {
                    "status": "error",
                    "error": err_msg,
                    "error_code": "EXTRACTION_PROMPT_NOT_CONFIGURED",
                    "file": filename,
                }
            raise
        extraction_dict = extracted_raw if isinstance(extracted_raw, dict) else extracted_raw.model_dump()
        extraction_seconds = round(time.time() - extraction_start, 2)
        # ARCH-20260518-03: extracción solo llega aquí si aiCalibration.extraction.prompt fue válido
        _extraction_prompt_source = "ai_calibration"
        _extraction_prompt_version = (ai_calibration or {}).get("extraction", {}).get("version", "calibration_custom")
        print(f"   ✓ Extracción en {extraction_seconds}s | prompt_source={_extraction_prompt_source}")

        # PASO 3: PREDIAGNÓSTICO IA (capa separada)
        predx_start = time.time()
        prediagnosis = prediagnostic_svc.generate_prediagnosis(
            detected_type,
            extraction_dict,
            ai_calibration=ai_calibration,
        )
        predx_seconds = round(time.time() - predx_start, 2)
        predx_prompt_source = getattr(prediagnosis, "prompt_source", None)
        predx_provider = getattr(prediagnosis, "clinical_provider", None)
        predx_model_used = getattr(prediagnosis, "clinical_model_used", None)
        predx_calibration_source = getattr(prediagnosis, "calibration_source", None)
        predx_prompt_version = getattr(prediagnosis, "prompt_version", None)
        predx_input_debug = getattr(prediagnosis, "input_debug", None)
        print(f"   ✓ Prediagnóstico ({prediagnosis.clinical_state}) en {predx_seconds}s | prompt_source={predx_prompt_source}")

        total_seconds = round(time.time() - pipeline_start, 2)

        return {
            "status": "success",
            "pipeline_version": PIPELINE_VERSION,
            "file": filename,
            "file_url": _v2_file_url,
            "classification": classification_dict,
            "extraction_snapshot": {
                "study_type": detected_type,
                "extracted_data": extraction_dict,
                "audit": {
                    "model_name": GEMINI_MODEL,
                    "prompt_version": _extraction_prompt_version,
                    "prompt_source": _extraction_prompt_source,
                    "pipeline_version": PIPELINE_VERSION,
                    "source_file_hash": file_hash,
                    "triggered_by_user_id": triggered_by_user_id,
                    "trigger_reason": "initial_upload",
                },
            },
            "prediagnosis_snapshot": {
                "clinical_state": prediagnosis.clinical_state,
                "summary": prediagnosis.summary,
                "confidence": prediagnosis.confidence,
                "justification": prediagnosis.justification,
                "clinical_basis": [cb.model_dump() for cb in prediagnosis.clinical_basis],
                "citations": [c.model_dump() for c in prediagnosis.citations],
                "limitations": prediagnosis.limitations,
                "red_flags": prediagnosis.red_flags,
                "non_conclusive_reason": prediagnosis.non_conclusive_reason,
                # IMPL-20260513-08: trazabilidad real de proveedor/modelo clínico (ARCH-20260513-08)
                "clinical_provider": predx_provider,
                "clinical_model_used": predx_model_used,
                "calibration_source": predx_calibration_source,
                # IMPL-20260518-03: fuente real del prompt clínico (ARCH-20260518-03)
                "prompt_source": predx_prompt_source,
                "audit": {
                    # IMPL-20260513-08: model_name refleja modelo clínico real, no el de extracción
                    "model_name": predx_model_used or GEMINI_MODEL,
                    "clinical_provider": predx_provider or "gemini",
                    "prompt_version": predx_prompt_version or PREDIAGNOSIS_PROMPT_VERSION,
                    "prompt_source": predx_prompt_source,
                    "pipeline_version": PIPELINE_VERSION,
                    "triggered_by_user_id": triggered_by_user_id,
                    "trigger_reason": "initial_upload",
                },
                # GUARDRAIL explícito en respuesta API
                "_guardrail": "Este prediagnóstico NO autoriza firma digital, dictamen final ni aptitud laboral sin revisión médica explícita.",
                # IMPL-20260516-08: RAW de entrada clínica para trazabilidad (ARCH-20260516-08)
                "input_debug": predx_input_debug.model_dump() if predx_input_debug else None,
            },
            "timings": {
                "extraction_seconds": extraction_seconds,
                "prediagnosis_seconds": predx_seconds,
                "total_seconds": total_seconds,
            },
        }

    except Exception as e:
        print(f"❌ Error en V2 upload-and-analyze: {e}")
        return {"status": "error", "error": str(e), "file": filename}


@app.post("/api/v2/studies/prediagnosis-from-params")
def v2_prediagnosis_from_params(
    study_type: str,
    extracted_data: Dict[str, Any],
    triggered_by_user_id: Optional[str] = None,
    medical_calibration: Optional[Dict[str, Any]] = None,
    ai_calibration: Optional[Dict[str, Any]] = None,
):
    """
    Genera prediagnóstico IA a partir de parámetros ya extraídos.
    Útil para regenerar el prediagnóstico sin re-procesar el archivo original.
    IMPL-20260326-16: Requiere que exista un snapshot de extracción previo.
    IMPL-20260513-01: Acepta medical_calibration del panel aiCalibration.
    IMPL-20260518-03: Acepta ai_calibration para resolver prompt clínico desde
        aiCalibration.diagnosis.prompt con fallback general backend (ARCH-20260518-03).
    """
    if not prediagnostic_svc:
        return _ai_unavailable_response("Servicio de prediagnóstico no disponible")

    try:
        prediagnosis = prediagnostic_svc.generate_prediagnosis(
            study_type,
            extracted_data,
            medical_calibration=medical_calibration,
            ai_calibration=ai_calibration,
        )
                "model_clinical": getattr(prediagnosis, "clinical_model_used", None) or GEMINI_MODEL_CLINICAL,
                "clinical_provider": getattr(prediagnosis, "clinical_provider", None) or "gemini",
                "calibration_source": getattr(prediagnosis, "calibration_source", None),
            "prediagnosis": prediagnosis.model_dump(),
                "prompt_source": getattr(prediagnosis, "prompt_source", None),
                "prompt_version": getattr(prediagnosis, "prompt_version", None) or PREDIAGNOSIS_PROMPT_VERSION,
                "model_extraction": GEMINI_MODEL_EXTRACTION,
                "model_clinical": prediagnosis.clinical_model_used or GEMINI_MODEL_CLINICAL,
                "clinical_provider": prediagnosis.clinical_provider or "gemini",
                "calibration_source": prediagnosis.calibration_source,
                # IMPL-20260518-03: fuente real del prompt clínico (ARCH-20260518-03)
            "input_debug": getattr(prediagnosis, "input_debug", None).model_dump() if getattr(prediagnosis, "input_debug", None) else None,
                "prompt_version": prediagnosis.prompt_version or PREDIAGNOSIS_PROMPT_VERSION,
                "pipeline_version": PIPELINE_VERSION,
                "triggered_by_user_id": triggered_by_user_id,
                "trigger_reason": "manual_regeneration",
            },
            # IMPL-20260516-08: RAW de entrada clínica para trazabilidad (ARCH-20260516-08)
            "input_debug": prediagnosis.input_debug.model_dump() if prediagnosis.input_debug else None,
            "_guardrail": "Este prediagnóstico NO autoriza firma digital, dictamen final ni aptitud laboral sin revisión médica.",
        }
    except Exception as e:
        print(f"❌ Error en prediagnosis-from-params: {e}")
        return {"status": "error", "error": str(e)}


# ========================================
# ENDPOINT DE RESOLUCIÓN DE ARCHIVOS S3 (IMPL-20260513-S3)
# ========================================

@app.get("/api/files/{key:path}")
def resolve_file(key: str):
    """
    IMPL-20260513-S3: Resuelve una key de archivo en el bucket S3-compatible y
    redirige (HTTP 302) a una URL presignada de corta duración (5 min).
    Permite al frontend y a regenerateStudyAI descargar archivos sin exponer
    credenciales ni almacenar URLs efímeras en la base de datos.
    IMPL-20260516-01: Para PDF/imágenes se fuerzan ResponseContentType e inline en la URL
    presignada como capa de defensa adicional sobre los metadatos del objeto. ARCH-20260516-01.
    NUNCA loguea la presigned URL generada.
    """
    if not _s3_enabled or not _s3_client:
        raise HTTPException(status_code=503, detail="Storage S3 no configurado en este entorno")
    try:
        content_type, is_embeddable = _detect_content_type(key)
        params: dict = {"Bucket": STORAGE_S3_BUCKET, "Key": key}
        if is_embeddable:
            params["ResponseContentDisposition"] = "inline"
            params["ResponseContentType"] = content_type
        presigned_url = _s3_client.generate_presigned_url(
            "get_object",
            Params=params,
            ExpiresIn=300,  # 5 minutos — suficiente para visor y descarga
        )
        return RedirectResponse(url=presigned_url, status_code=302)
    except Exception as e:
        print(f"⚠️ Error generando presigned URL para key={key}: {_sanitize_error(str(e))}")
        raise HTTPException(status_code=500, detail="No se pudo generar acceso al archivo")


