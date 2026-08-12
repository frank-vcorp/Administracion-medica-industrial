"""
Residente Digital API - Backend con Pipeline IA Modular
IMPL-20260225-01: Clasificação y extracción inteligentes de documentos médicos.
IMPL-20260225-02: Firma Digital Avanzada y Motor de Reportes Masivos.

IMPL-20260326-16: Endpoints V2 para prediagnóstico IA separado (ARCH-20260326-16).
# FIX-20260812-07: Eliminada la propuesta asistida de schema de presentación
# persistida (SPEC_ARCH-20260604-01). El tab Presentación ahora es visor puro.
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel
import os
import re
import time
import json
import hashlib
import tempfile
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional

from app.services.prisma_client import (
    init_prisma_client,
    connect_prisma_client,
    disconnect_prisma_client,
    get_prisma_client,
)

# FIX REFERENCE: FIX-20260812-18 — Causa raíz de la desconexión warmup ↔ probe M3.
# `PYTHONPATH="/app/app"` (Dockerfile:24) hacía que ESTOS imports sin prefijo
# cargaran los módulos BAJO DOS NOMBRES DISTINTOS: `services.ai.*`/`schemas`
# (vía PYTHONPATH) y `app.services.ai.*`/`app.schemas` (vía cwd). Cada nombre
# crea su propio módulo → su propio singleton `key_resolver = KeyResolver()`.
# Evidencia en prod (logs FIX-20260812-18-debug): el warmup y el probe usaban
# la instancia A (resolver_id=...936, caché poblada con key DB api_key_len=125)
# mientras `extract_by_type`/`M3VisionBase._refresh_keys` leían la instancia B
# (resolver_id=...160, caché SIEMPRE fría) → M3CredentialsUnavailableError.
# Unificar al namespace canónico `app.*` deja UN solo key_resolver en el proceso.
from app.services.ai import DocumentClassifierService, ExtractorService, PrediagnosticService
from app.services.ai.base import GeminiBase
from app.services.pdf import SignerService, ReportService
from app.schemas import DocumentClassification, ExtractedDataUnion


def _read_env_var(key: str) -> Optional[str]:
    """ARCH-20260326-02: Normaliza variables con whitespace accidental. Respaldo: context/checkpoints/CHK_ARCH-20260326-02-GEMINI-ENV-NORMALIZATION.md."""
    value = os.getenv(key)
    if value:
        return value.strip()

    for env_key, env_value in os.environ.items():
        if env_key.strip() == key and env_value:
            return env_value.strip()

    return None

# IMPL-20260630-06: Lifespan para inicializar Prisma al startup y desconectar
# al shutdown. Inyecta el cliente en reports, lab_catalog_service y
# lab_order_service (estos dos últimos cubren los routers lab-orders y lab-search
# que importan el prisma vía el servicio).
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Inicializa Prisma al startup y desconecta al shutdown."""
    try:
        prisma = init_prisma_client()
        # FIX-20260706-14: connect() es async. Hacer await antes de inyectar
        # para que el cliente esté realmente conectado al motor de queries.
        await connect_prisma_client()
        # IMPL-20260810-01 (fix B† ARCH-20260809-06 §7.4-W): warmup del default
        # de extracción al startup para curar "restart → primera extracción".
        # Best-effort: si falla (BD no lista, tabla ausente, etc.) cae a fallback
        # "gemini" sin romper el arranque.
        try:
            from app.services.ai.app_config import get_extraction_default_provider
            await get_extraction_default_provider()
        except Exception as warmup_err:
            import logging
            logging.getLogger(__name__).warning(
                "AppConfig warmup failed: %s", type(warmup_err).__name__
            )
        # Inyecta en reports (router con set_prisma_client propio)
        try:
            from app.api.reports import set_prisma_client as _set_reports
            _set_reports(prisma)
        except Exception as e:
            print(f"[reports] set_prisma_client failed: {_sanitize_error(str(e))}")
        # Inyecta en lab_catalog_service (cubre router lab-catalogs)
        try:
            from app.services.lab_catalog_service import set_prisma_client as _set_lab_cat
            _set_lab_cat(prisma)
        except Exception as e:
            print(f"[lab-catalogs] set_prisma_client failed: {_sanitize_error(str(e))}")
        # Inyecta en lab_order_service (cubre routers lab-orders + lab-search,
        # los cuales obtienen prisma vía svc.get_prisma() y NO exponen
        # set_prisma_client a nivel de router — decisión deliberada para
        # mantener una sola fuente de inyección por concern).
        try:
            from app.services.lab_order_service import set_prisma_client as _set_lab_ord
            _set_lab_ord(prisma)
        except Exception as e:
            print(f"[lab-orders] set_prisma_client failed: {_sanitize_error(str(e))}")
        # IMPL-20260707-16: Slice C NOVA absorción — inyecta prisma en
        # lab_result_service (cubre router lab-results + worklist + transición).
        try:
            from app.services.lab_result_service import set_prisma_client as _set_lab_res
            _set_lab_res(prisma)
        except Exception as e:
            print(f"[lab-results] set_prisma_client failed: {_sanitize_error(str(e))}")
        # IMPL-20260711-01: Módulo de Unidades Móviles (ARCH-20260711-01).
        try:
            from app.services.mobile_unit_service import set_prisma_client as _set_mob
            _set_mob(prisma)
        except Exception as e:
            print(f"[mobile-units] set_prisma_client failed: {_sanitize_error(str(e))}")
        print("✅ Prisma client inicializado y conectado")
    except Exception as e:
        print(f"⚠️ No se pudo inicializar Prisma al startup: {_sanitize_error(str(e))}")
    yield
    await disconnect_prisma_client()


app = FastAPI(
    title="Residente Digital API",
    description="Pipeline IA modular para análisis de documentos médicos",
    lifespan=lifespan,
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


# IMPL-20260809-06 — ARCH-20260809-03: Router admin para gestión runtime de
# API Keys IA (m3, gemini, dr7). Prefijo /api/v2/admin/ai-keys. Definido en
# `app.api.v2.admin_ai_keys` para mantener main.py enfocado en el pipeline.
from app.api.v2.admin_ai_keys import router as admin_ai_keys_router
app.include_router(admin_ai_keys_router)

# ARCH-20260809-05: Router admin para "Probar conexión" por proveedor.
# Prefijo /api/v2/admin/ai-keys/{provider}/probe. Solo SUPERADMIN.
from app.api.v2.admin_ai_keys_probe import router as admin_ai_keys_probe_router
app.include_router(admin_ai_keys_probe_router)

# ARCH-20260809-05: Router admin para AppConfig runtime (extraction_default_provider).
# Prefijo /api/v2/admin/app-config. ADMIN/SUPERADMIN GET, SUPERADMIN PUT.
from app.api.v2.admin_app_config import router as admin_app_config_router
app.include_router(admin_app_config_router)

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
# IMPL-20260603-01: proveedor clínico migrado a DR7.ai.
# Respaldo: context/SPECs/SPEC_ARCH-20260603-04-MIGRACION-CLINICA-DR7-TEXTO.md
MEDGEMMA_ENABLED = (_read_env_var("MEDGEMMA_ENABLED") or "false").lower() == "true"
DR7_API_KEY  = _read_env_var("DR7_API_KEY") or ""
DR7_BASE_URL = _read_env_var("DR7_BASE_URL") or "https://dr7.ai/api/v1/medical/chat/completions"
DR7_MODEL    = _read_env_var("DR7_MODEL") or "medgemma-4b-it"
MEDGEMMA_STATUS = "available" if (MEDGEMMA_ENABLED and DR7_API_KEY) else "pending_integration"

# ARCH-20260809-02: Selector de extracción multi-proveedor (Gemini + MiniMax M3).
# Configuración runtime del proveedor M3 (OpenAI-compatible). Solo afecta la
# capa de extracción documental — la capa clínica (MedGemma/DR7) sigue intacta.
# Respaldo: context/SPECs/SPEC_ARCH-20260809-02-SELECTOR-EXTRACCION-MULTI-PROVEEDOR.md
M3_API_KEY = _read_env_var("M3_API_KEY") or ""
M3_BASE_URL = _read_env_var("M3_BASE_URL") or "https://api.minimax.io/v1"
M3_DEFAULT_MODEL = _read_env_var("M3_DEFAULT_MODEL") or "MiniMax-M3"
# IMPL-20260809-06 — ARCH-20260809-03: feature flag opt-in para lectura de
# keys desde BD (ai_provider_keys). Default False → comportamiento idéntico
# al actual (env vars), cero cambio observable. Frank lo activa cuando esté
# listo para usar el panel admin.
AI_KEYS_FROM_DB_ENABLED = (_read_env_var("AI_KEYS_FROM_DB_ENABLED") or "false").lower() == "true"
# FIX-20260812-15: M3_ENABLED ahora considera también `AI_KEYS_FROM_DB_ENABLED`.
# Antes, si M3_API_KEY no estaba en env vars, M3_ENABLED=False aunque la fila
# M3 existiera en BD y `AI_KEYS_FROM_DB_ENABLED=true` (caso de Frank con rollout
# BD-first vía panel admin). Esto provocaba dos síntomas:
#   1. `/api/v2/ai/status` reportaba `m3_enabled=false` aunque el probe
#      (`/admin/ai-keys/m3/probe`) sí funcionaba contra BD.
#   2. El status público daba la falsa impresión de "M3 no configurado"
#      cuando en realidad el resolver leía BD correctamente vía warmup
#      async en `v2_upload_and_analyze`.
# Solución conservadora: si AI_KEYS_FROM_DB_ENABLED=true, asumimos que la
# disponibilidad real la decide el resolver en runtime (cacheada por warmup).
# Esto NO rompe el contrato: `M3VisionBase` se sigue instanciando lazy
# (`extractor.py:424`) y `_refresh_keys()` lee la caché TTL. El cambio solo
# afecta el campo informativo `m3_enabled` del status público.
M3_ENABLED = bool(M3_API_KEY) or AI_KEYS_FROM_DB_ENABLED
M3_STATUS = "available" if M3_ENABLED else "pending_integration"
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


# FIX-20260812-07: Eliminados PresentationSchemaRequest + helpers de schema declarativo
# (_presentation_title, _is_scalar_value, _get_value_at_path, _resolve_source_map,
#  _sanitize_presentation_schema, _build_heuristic_presentation_schema,
#  _build_presentation_summary, _build_presentation_prompt,
#  _call_presentation_gemini, _propose_presentation_schema) y el endpoint
# POST /api/v2/studies/presentation-schema/propose.
# El tab Presentación pasó de editor a visor key/value puro.


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

    IMPL-20260809-06 — ARCH-20260809-03: Extiende con `key_source` por proveedor
    y `ai_keys_from_db_enabled` (feature flag). Esto permite que Frank verifique
    desde el panel admin o curl si la rotación runtime está activa.
    """
    current_api_key = _read_env_var("GEMINI_API_KEY")
    current_extraction_model = _read_env_var("GEMINI_MODEL_EXTRACTION") or GEMINI_MODEL_EXTRACTION
    current_clinical_model   = _read_env_var("GEMINI_MODEL_CLINICAL") or GEMINI_MODEL_CLINICAL
    # IMPL-20260603-01: estado dinámico del proveedor clínico en DR7
    dr7_key_present = bool(_read_env_var("DR7_API_KEY"))
    active_clinical_provider = "dr7" if (MEDGEMMA_ENABLED and dr7_key_present) else "gemini"
    # ARCH-20260519-15: rollback extractivo — Gemini es siempre el proveedor activo
    # de clasificación documental y extracción estructurada en este corte.
    # Featherless/Qwen-VL desactivado del runtime extractivo hasta nueva decisión arquitectónica.
    # ARCH-20260809-05: extraction_provider_active es DINÁMICO = extraction_default_provider
    # (fuente única de verdad; viene del AppConfig con caché TTL 60s).
    from app.services.ai.app_config import (
        EXTRACTION_DEFAULT_PROVIDER_FALLBACK,
        get_extraction_default_provider_sync,
    )
    _extraction_default_provider, _extraction_default_source = get_extraction_default_provider_sync()
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
        # ARCH-20260809-05: trazabilidad del proveedor extractivo activo (DINÁMICO).
        "extraction_provider_active": _extraction_default_provider,
        "extraction_default_provider": _extraction_default_provider,
        "extraction_default_provider_source": _extraction_default_source,
        "extraction_model_active": current_extraction_model,
        # ARCH-20260809-02: selector runtime de extracción (Gemini + MiniMax M3).
        # Nunca exponer secretos — solo flags *_key_present booleanos.
        "m3_enabled": M3_ENABLED,
        "m3_status": M3_STATUS,
        "m3_base_url": M3_BASE_URL,
        "m3_default_model": M3_DEFAULT_MODEL,
        "m3_key_present": bool(M3_API_KEY),
        "extraction_default_provider_configurable": True,
        # IMPL-20260603-01: trazabilidad del proveedor clínico activo (DR7)
        "clinical_provider_active": active_clinical_provider,
        "dr7_key_present": dr7_key_present,
        "dr7_base_url": DR7_BASE_URL,
        "dr7_model": DR7_MODEL,
        "api_key_present": bool(current_api_key),
        "pipeline_version": PIPELINE_VERSION,
        "extraction_prompt_version": EXTRACTION_PROMPT_VERSION,
        "prediagnosis_prompt_version": PREDIAGNOSIS_PROMPT_VERSION,
        "last_init_error": ai_init_error,
        # IMPL-20260809-06 — ARCH-20260809-03: trazabilidad de fuente de key
        # y feature flag de rollout.
        "ai_keys_from_db_enabled": AI_KEYS_FROM_DB_ENABLED,
        "key_source": {
            "gemini": "env",  # sobreescrito abajo si flag on + BD tiene fila
            "m3": "env",
            "dr7": "env",
        },
        # Presencia en BD por proveedor (independiente de la flag) para diagnóstico.
        "key_in_db": {
            "gemini": _key_in_db_sync("gemini"),
            "m3": _key_in_db_sync("m3"),
            "dr7": _key_in_db_sync("dr7"),
        },
    }


def _key_in_db_sync(provider: str) -> bool:
    """
    Helper sincrónico para `/api/v2/ai/status`. Lee ai_provider_keys por
    provider usando el prisma client cacheado. Si la BD no está disponible,
    retorna False (no propagamos excepción al status público).
    """
    try:
        prisma = get_prisma_client()
    except Exception:
        return False
    try:
        # find_unique es async en Prisma Python — pero aquí sólo necesitamos
        # un boolean para diagnóstico. Usamos queryRaw via prisma si está
        # disponible; si no, fallback a False.
        from app.services.ai.keys import CANONICAL_PROVIDERS
        if provider not in CANONICAL_PROVIDERS:
            return False
        # Hacemos un sync lookup via la API async — pero el endpoint es sync.
        # Estrategia: ejecutar el coroutine en el event loop si hay uno; si
        # no, retornar False (la próxima vez que se llame al endpoint el loop
        # ya estará inicializado).
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # No podemos await — retornar False (status público no debe
                # bloquear en runtime). Frank consultará `/admin/ai-keys` para
                # diagnóstico fino.
                return False
            return loop.run_until_complete(
                prisma.aiproviderkey.find_unique(where={"provider": provider})
            ) is not None
        except RuntimeError:
            return False
    except Exception:
        return False


# FIX-20260812-07: eliminado endpoint POST /api/v2/studies/presentation-schema/propose.


@app.post("/api/v1/upload-only")
async def upload_only(file: UploadFile = File(...), key: Optional[str] = Form(default=None)):
    """
    Persiste físicamente el archivo en /uploads sin ejecutar análisis IA.
    FIX ARCH-20260326-04: Fallback para cuando el pipeline IA V2 no está disponible.
    Garantiza que fileUrl en DB apunte a un archivo que realmente existe.

    IMPL-20260624-01: Soporta campo opcional `key` en FormData.
      - Si el cliente envía `key`, se respeta como ruta exacta de almacenamiento
        (ej. `companies/public/<scope>/<section>/<filename>`). Esto permite
        organizar el bucket por scope/sección en lugar de un flat namespace.
      - Si NO envía `key` (compatibilidad con event-test.actions.ts), se usa
        el comportamiento legacy: `<filename> = {int(time.time())}-{file.filename}`.
      - El response siempre expone `key` (ruta efectiva usada) y `file_url` (URL
        accesible vía /api/files/{key} cuando S3 está habilitado, o /uploads/{key}
        en fallback local). Ambos campos son retrocompatibles: `file` se mantiene
        como alias de `key` para no romper consumidores legacy.
    """
    # IMPL-20260624-01: Si el cliente envía `key`, validarlo mínimamente y usarlo.
    # Si no, fallback al filename timestamping para mantener compat con event-test.actions.ts.
    if key and isinstance(key, str) and key.strip():
        safe_key = key.strip()
        # Defensa contra path traversal: no permitir `..`, ni absolutas, ni caracteres peligrosos.
        if safe_key.startswith("/") or ".." in safe_key.split("/"):
            return {"status": "error", "error": "key inválida (path traversal o absoluta no permitida)"}
        # En sistemas locales, prevenir escribir fuera de UPLOAD_DIR.
        target_filename = safe_key.replace(" ", "_")
    else:
        target_filename = f"{int(time.time())}-{file.filename.replace(' ', '_')}"

    try:
        contents = await file.read()
        # IMPL-20260624-01: priorizar bucket cuando está configurado, usando `target_filename` como key.
        if _s3_enabled and _upload_file_to_s3(contents, target_filename):
            print(f"📁 Upload-only (S3): {target_filename} ({len(contents)} bytes)")
            return {
                "status": "success",
                "key": target_filename,
                "file": target_filename,  # retrocompat
                "file_url": f"/api/files/{target_filename}",
            }
        # Fallback: filesystem local. Si la key trae subcarpetas (ej. companies/public/abc/constancia/x.pdf),
        # crear los directorios padre antes de escribir.
        local_path = os.path.join(UPLOAD_DIR, target_filename)
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        with open(local_path, "wb") as f:
            f.write(contents)
        print(f"📁 Upload-only (local): {target_filename} ({len(contents)} bytes)")
        # IMPL-20260624-01: Si la key tenía subcarpetas, devolvemos /api/files/{key}
        # para que el frontend pueda resolverla vía el endpoint /api/files (con fallback local).
        # En modo flat legacy (sin subcarpetas), seguimos devolviendo /uploads/{file} para
        # no romper consumidores que ya servían vía StaticFiles mounted en /uploads.
        if "/" in target_filename:
            file_url = f"/api/files/{target_filename}"
        else:
            file_url = f"/uploads/{target_filename}"
        return {
            "status": "success",
            "key": target_filename,
            "file": target_filename,  # retrocompat
            "file_url": file_url,
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
    # FIX-20260812-11: study_type/triggered_by_user_id deben ser Form() (no query)
    # para que curl -F "study_type=..." y el FormData del frontend funcionen.
    # Sin Form(), FastAPI los trata como query params y study_type llega None.
    study_type: Optional[str] = Form(default=None),
    triggered_by_user_id: Optional[str] = Form(default=None),
    ai_calibration_json: Optional[str] = Form(default=None),
    extraction_provider_override: Optional[str] = Form(default=None),
    extraction_model_override: Optional[str] = Form(default=None),
):
    """
    V2 Pipeline completo — upload, extracción pura y prediagnóstico en capas separadas.
    IMPL-20260326-16: ARCH-20260326-16.
    IMPL-20260518-03: Requiere ai_calibration_json con extraction.prompt configurado.
        La extracción falla explícitamente si falta el prompt de extracción (ARCH-20260518-03).

    ARCH-20260809-02: Acepta `extraction_provider_override` y `extraction_model_override`
    opcionales para A/B sin redeploys (selector multi-proveedor Gemini + MiniMax M3).

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

    # ARCH-20260809-02: import lazy para evitar import circular.
    from app.services.ai.extractor import (
        ExtractionAuthError,
        ExtractionProviderUnknownError,
    )

    # FIX-20260810-06: pre-calentar la caché TTL del key_resolver en contexto
    # async (await nativo) antes de entrar al pipeline sync (extract_by_type /
    # generate_prediagnosis corren en el hilo del event loop y no pueden
    # awaitear; leen la caché vía `resolve_sync_cached`). Sin warmup, caché
    # fría → pipeline degrada a env vars. Fallo suave: el pipeline sync
    # degrada a env (comportamiento legacy). Ver DICTAMEN_FIX-20260810-06.
    from app.services.ai.keys import (
        is_ai_keys_from_db_enabled as _ai_keys_db_enabled,
        key_resolver as _key_resolver_singleton,
    )
    if _ai_keys_db_enabled():
        # FIX-20260812-18-debug: identidad del singleton que calienta la caché
        # (comparar con resolver_id de resolve() y con el que lee _refresh_keys).
        print(
            f"🔍 [FIX-20260812-18] warmup genérico START "
            f"resolver_id={id(_key_resolver_singleton)}"
        )
        for _prov in ("m3", "gemini", "dr7"):
            try:
                _res = await _key_resolver_singleton.resolve(_prov)
                # FIX-20260812-18-debug: estado de la resolución cacheada por el
                # warmup (sin secretos: sólo len/source/warning).
                print(
                    f"🔍 [FIX-20260812-18] warmup provider={_prov} "
                    f"api_key_len={len(_res.api_key) if _res and _res.api_key else 0} "
                    f"source={_res.source if _res else None} "
                    f"warning={_res.warning if _res else None}"
                )
            except Exception as warmup_err:
                # FIX-20260812-14: el warmup pre-calienta la caché TTL del
                # resolver para que el pipeline sync (extract_by_type /
                # call_m3, que corren en el hilo del event loop y no pueden
                # awaitear) lea la key vía `resolve_sync_cached`. Antes, el
                # error se tragaba con `pass` → caché fría silenciosa → el
                # cold-loader deadlockeaba 3s → key vacía → "Missing
                # credentials" del SDK. Ahora se loguea explícito; si la key
                # sigue sin quedar disponible, el guard en
                # `M3VisionBase.call_m3` lanza `M3CredentialsUnavailableError`
                # con mensaje accionable.
                print(
                    f"⚠️ [FIX-20260812-14] Warmup key_resolver para "
                    f"'{_prov}' falló ({type(warmup_err).__name__}); el "
                    f"pipeline degradará a env var / error tipado si la key "
                    f"no queda disponible."
                )
    else:
        # FIX-20260812-18-debug: Hipótesis D — la flag no se lee 'true' en
        # runtime aunque esté configurada. Si esta línea aparece en Railway,
        # el warmup NUNCA se ejecutó y _refresh_keys cae a flag_off/env.
        print(
            "🔍 [FIX-20260812-18] warmup genérico SKIP: "
            "is_ai_keys_from_db_enabled()=False en runtime "
            "(AI_KEYS_FROM_DB_ENABLED no visible para este proceso)"
        )

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
        # FIX-20260812-11 Cambios #1+#2: skip defensivo del clasificador Gemini
        # hardcoded cuando el default provider no es gemini (típicamente m3 tras
        # FIX-20260812-10) y fallback controlado a detected_type='unknown' si el
        # classifier revienta con auth_error (HTTP 401/403). El extractor recibe
        # detected_type='unknown' y delega al selector de proveedor
        # (ARCH-20260809-02). Ver SPEC §2.1, §2.2.
        from app.services.ai.app_config import (
            get_extraction_default_provider_sync as _get_default_provider_sync,
        )
        if study_type:
            detected_type = study_type
            classification_dict = {"detected_type": study_type, "confidence": 1.0, "reason": "provided_by_caller"}
        else:
            # Cambio #1: resolución defensiva antes de invocar al classifier.
            default_provider, default_source = _get_default_provider_sync()
            if default_provider == "gemini":
                # Legacy path preservado (AC-4): classifier Gemini se invoca.
                try:
                    classification = classifier.classify(local_path)
                    detected_type = classification.tipo
                    classification_dict = {
                        "detected_type": classification.tipo,
                        "confidence": classification.confianza,
                        "reason": classification.razon,
                    }
                except Exception as classify_err:
                    # Cambio #2: fallback a 'unknown' sólo en auth_error
                    # (HTTP 401/403). Otros errores (timeout, JSON malformado,
                    # 5xx) se propagan para no enmascarar fallos reales.
                    status_code = getattr(classify_err, "status_code", None)
                    if status_code is None:
                        _resp = getattr(classify_err, "response", None)
                        if _resp is not None:
                            status_code = getattr(_resp, "status_code", None)
                    if status_code is None:
                        status_code = getattr(classify_err, "status", None)
                    if status_code in (401, 403):
                        detected_type = "unknown"
                        classification_dict = {
                            "detected_type": "unknown",
                            "confidence": 0.0,
                            "reason": "classifier_403_skipping",
                        }
                        print(
                            f"⚠️ [FIX-20260812-11] Classifier Gemini falló "
                            f"(HTTP {status_code}) → saltando a detected_type='unknown' "
                            f"para que el extractor use el selector"
                        )
                    else:
                        raise
            elif default_provider == "m3":
                # Skip classifier: M3 no tiene prompt de clasificación definido
                # (SPEC §2.1 nota). El extractor decide con selector M3.
                detected_type = "unknown"
                classification_dict = {
                    "detected_type": "unknown",
                    "confidence": 0.0,
                    "reason": "skipped_classifier_no_study_type",
                }
                print(
                    f"ℹ️ [FIX-20260812-11] study_type ausente; saltando "
                    f"clasificador Gemini (default provider=<{default_provider}>; "
                    f"source={default_source})"
                )
            else:
                # Default provider no determinable (defensivo; sync siempre
                # retorna fallback, pero blindamos contra evoluciones futuras).
                return {
                    "status": "error",
                    "error": (
                        "extraction_default_provider no determinable; "
                        "configura /api/v2/admin/app-config o revisa AI_KEYS_FROM_DB_ENABLED."
                    ),
                    "error_code": "EXTRACTION_PROMPT_NOT_CONFIGURED",
                    "file": filename,
                }
        print(f"   ✓ Tipo: {detected_type}")

        # PASO 2: EXTRACCIÓN PURA (sin interpretación clínica)
        # ARCH-20260518-03: prompt de extracción resuelto únicamente desde aiCalibration;
        # si falta, falla explícitamente (sin fallback backend).
        # ARCH-20260809-02: selector multi-proveedor con override por payload.
        # FIX-20260812-17: resolver la key del provider que el selector eligió
        # ANTES de invocar al extractor sync. El selector decide el provider
        # globalmente (m3 vs gemini); pre-calentar la caché con el provider
        # correcto garantiza que `M3VisionBase._refresh_keys` encuentre la
        # key real cuando el extractor sync se ejecute. Sin esto, si el
        # warmup genérico (`m3, gemini, dr7`) falla silenciosamente para
        # `m3`, el extractor M3 vería caché fría → `_resolve_sync_cold`
        # retorna None (loop corriendo) → key vacía → M3CredentialsUnavailableError.
        # La fix es resolver SÍNCRONAMENTE (await) el provider que vamos a usar.
        if extraction_provider_override:
            _target_provider = extraction_provider_override
            # FIX-20260812-18-debug: origen del provider objetivo del warmup.
            _target_provider_origin = "form_override"
        else:
            from app.services.ai.app_config import (
                get_extraction_default_provider_sync as _get_def_provider_sync,
            )
            try:
                _target_provider, _ = _get_def_provider_sync()
                _target_provider_origin = "app_config_default"
            except Exception:
                _target_provider = "m3"
                _target_provider_origin = "fallback_m3"
        # FIX-20260812-18-debug: si el provider que luego usa el extractor
        # (vía aiCalibration) difiere de _target_provider, el warmup específico
        # calentó OTRO provider (el genérico arriba debe cubrir la diferencia).
        print(
            f"🔍 [FIX-20260812-18] warmup específico provider={_target_provider} "
            f"origin={_target_provider_origin} "
            f"calibration_provider={(ai_calibration or {}).get('extraction', {}).get('provider') if isinstance(ai_calibration, dict) else None}"
        )
        if _ai_keys_db_enabled():
            try:
                _res17 = await _key_resolver_singleton.resolve(_target_provider)
                # FIX-20260812-18-debug: resultado del warmup específico.
                print(
                    f"🔍 [FIX-20260812-18] warmup específico result "
                    f"provider={_target_provider} "
                    f"api_key_len={len(_res17.api_key) if _res17 and _res17.api_key else 0} "
                    f"source={_res17.source if _res17 else None} "
                    f"warning={_res17.warning if _res17 else None}"
                )
            except Exception as _target_warmup_err:
                print(
                    f"⚠️ [FIX-20260812-17] Warmup específico para provider="
                    f"'{_target_provider}' falló ({type(_target_warmup_err).__name__}); "
                    f"el pipeline sync degradará a env var / error tipado."
                )

        extraction_start = time.time()
        try:
            extracted_raw = extractor.extract_by_type(
                local_path,
                detected_type,
                ai_calibration=ai_calibration,
                extraction_provider_override=extraction_provider_override,
                extraction_model_override=extraction_model_override,
            )
        except ExtractionProviderUnknownError as prov_err:
            print(f"❌ [ARCH-20260809-02] {prov_err}")
            return {
                "status": "error",
                "error": str(prov_err),
                "error_code": "EXTRACTION_PROVIDER_UNKNOWN",
                "file": filename,
            }
        except ExtractionAuthError as auth_err:
            print(f"❌ [ARCH-20260809-02] {auth_err}")
            # FIX-20260812-14: error_code específico para credenciales ausentes
            # (reason="credentials_unavailable") — distinto del 401/403
            # (reason="auth_error"). El mensaje `str(auth_err)` ya es
            # user-friendly ("El servicio de análisis IA (M3) no está
            # configurado...") y llega limpio al frontend vía `result.error`
            # (el frontend maneja `status !== 'success'` mostrando `error`).
            _err_code = (
                "M3_CREDENTIALS_UNAVAILABLE"
                if getattr(auth_err, "reason", "auth_error")
                == "credentials_unavailable"
                else "M3_AUTH_ERROR"
            )
            return {
                "status": "error",
                "error": str(auth_err),
                "error_code": _err_code,
                "file": filename,
            }
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
        # ARCH-20260809-02: capturar trazabilidad extractiva del dispatcher.
        extraction_audit: Dict[str, Any] = getattr(extractor, "last_extraction_audit", {}) or {}
        extraction_dict = extracted_raw if isinstance(extracted_raw, dict) else extracted_raw.model_dump()
        extraction_seconds = round(time.time() - extraction_start, 2)
        # ARCH-20260518-03: extracción solo llega aquí si aiCalibration.extraction.prompt fue válido
        _extraction_prompt_source = "ai_calibration"
        _extraction_prompt_version = (ai_calibration or {}).get("extraction", {}).get("version", "calibration_custom")
        print(
            f"   ✓ Extracción en {extraction_seconds}s | prompt_source={_extraction_prompt_source} "
            f"| provider_used={extraction_audit.get('extraction_provider_used')} "
            f"| fallback={extraction_audit.get('extraction_fallback_reason')}"
        )

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
                    # ARCH-20260809-02: trazabilidad extractiva dinámica (provider/model/override/fallback).
                    # Sustituye al antiguo `extraction_provider: "gemini"` hardcodeado.
                    "extraction_provider_used": extraction_audit.get(
                        "extraction_provider_used"
                    ) or "gemini",
                    "extraction_provider_requested": extraction_audit.get(
                        "extraction_provider_requested"
                    ) or (
                        extraction_provider_override
                        or (ai_calibration or {}).get("extraction", {}).get("provider")
                        or "gemini"
                    ),
                    "extraction_model_used": extraction_audit.get(
                        "extraction_model_used"
                    ) or (
                        extraction_model_override
                        or (ai_calibration or {}).get("extraction", {}).get("model")
                        or GEMINI_MODEL_EXTRACTION
                    ),
                    "extraction_fallback_reason": extraction_audit.get(
                        "extraction_fallback_reason"
                    ),
                    # Nota de compat: mantener `model_name` poblado con el mismo valor
                    # que `extraction_model_used` para no romper consumidores legacy.
                    "model_name": extraction_audit.get(
                        "extraction_model_used"
                    ) or GEMINI_MODEL_EXTRACTION,
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
        predx_model_used = getattr(prediagnosis, "clinical_model_used", None)
        predx_provider = getattr(prediagnosis, "clinical_provider", None)
        predx_calibration_source = getattr(prediagnosis, "calibration_source", None)
        predx_prompt_source = getattr(prediagnosis, "prompt_source", None)
        predx_prompt_version = getattr(prediagnosis, "prompt_version", None)
        predx_input_debug = getattr(prediagnosis, "input_debug", None)

        return {
            "status": "success",
            "clinical_state": prediagnosis.clinical_state,
            "prediagnosis": prediagnosis.model_dump(),
            "audit": {
                "model_extraction": GEMINI_MODEL_EXTRACTION,
                "model_clinical": predx_model_used or GEMINI_MODEL_CLINICAL,
                "clinical_provider": predx_provider or "gemini",
                "calibration_source": predx_calibration_source,
                "prompt_source": predx_prompt_source,
                "prompt_version": predx_prompt_version or PREDIAGNOSIS_PROMPT_VERSION,
                "pipeline_version": PIPELINE_VERSION,
                "triggered_by_user_id": triggered_by_user_id,
                "trigger_reason": "manual_regeneration",
            },
            "input_debug": predx_input_debug.model_dump() if predx_input_debug else None,
            "_guardrail": "Este prediagnóstico NO autoriza firma digital, dictamen final ni aptitud laboral sin revisión médica.",
        }
    except Exception as e:
        print(f"❌ Error en prediagnosis-from-params: {e}")
        return {"status": "error", "error": str(e)}


# ========================================
# FIX-20260729-03-G-XML: UPLOAD XML DIRECTO DE AUDIOMETRÍA
# Endpoint que invoca el parser XML directo (parse_audiometry_xml) sin
# pasar por el pipeline Gemini (que devuelve HTTP 400 sobre archivos XML
# binarios no-PDF). Mismo contrato de respuesta que
# /api/v2/studies/upload-and-analyze para que el frontend pueda persistir
# los snapshots (extraction + prediagnóstico) sin cambios estructurales.
#
# Parámetros:
#   - file:           multipart con el XML del audiómetro
#   - event_test_id:  ID del EventTest (papeleta) al que se asocia el archivo
#
# Detección XML:
#   - extensión .xml (case-insensitive)
#   - magic bytes <?xml al inicio del contenido
#
# Pipeline:
#   1. Validar file + event_test_id
#   2. Persistir el XML en /uploads (o S3 si está habilitado)
#   3. Resolver el MedicalTest desde el EventTest para extraer aiCalibration
#   4. parse_audiometry_xml(local_path) → extracción pura
#   5. prediagnostic_svc.generate_prediagnosis(Audiometria, extracted, ai_cal)
#      para la capa DR7.ai clínica posterior
#   6. Retornar el mismo payload que v2_upload_and_analyze, con
#      data_source='xml_direct', model_name='xml_parser',
#      prompt_version='xml_direct_v1' en extraction_snapshot.audit.
# ========================================
def _sanitize_xml_options(raw_options: Any) -> Dict[str, Any]:
    """FIX-20260729-03-G-XML: normaliza options de MedicalTest para extraer aiCalibration.

    Réplica local del helper de calibration.py para no acoplar este endpoint
    a un router externo (mantiene cohesión en main.py).
    """
    if raw_options is None:
        return {}
    if isinstance(raw_options, dict):
        return raw_options
    if isinstance(raw_options, str) and raw_options.strip():
        try:
            parsed = json.loads(raw_options)
            return parsed if isinstance(parsed, dict) else {}
        except (ValueError, TypeError):
            return {}
    return {}


@app.post("/api/v2/event-tests/upload-xml-audiometry")
async def v2_event_test_upload_xml_audiometry(
    file: UploadFile = File(...),
    event_test_id: str = Form(...),
    triggered_by_user_id: Optional[str] = Form(default=None),
):
    """
    FIX-20260729-03-G-XML: Sube un XML de audiómetro DD65 V2 y lo procesa
    con el parser directo (parse_audiometry_xml), sin pasar por Gemini para
    extracción. El prediagnóstico clínico sí se delega a DR7.ai usando el
    PrediagnosticService existente.

    Retorna el mismo shape que /api/v2/studies/upload-and-analyze para que
    el frontend (event-test.actions.ts) persista los snapshots inmutables
    sin cambios de contrato.
    """
    # ── 1. Validaciones básicas ────────────────────────────────────────────
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Archivo es obligatorio")

    filename_lower = file.filename.lower()
    is_xml_by_ext = filename_lower.endswith(".xml")
    if not is_xml_by_ext:
        raise HTTPException(
            status_code=400,
            detail="FIX-20260729-03-G-XML: este endpoint solo acepta archivos .xml. "
            "Use /api/v2/studies/upload-and-analyze para PDF u otros formatos.",
        )

    if not event_test_id or not event_test_id.strip():
        raise HTTPException(status_code=400, detail="event_test_id es obligatorio")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="El archivo está vacío")

    # Validación de magic bytes para reforzar detección XML
    head = contents[:64].lstrip(b'\xef\xbb\xbf \t\n\r').lower()
    if not (head.startswith(b"<?xml") or head.startswith(b"<localsession")):
        raise HTTPException(
            status_code=400,
            detail="FIX-20260729-03-G-XML: contenido no parece XML válido "
            "(falta declaración <?xml o raíz <LocalSession>).",
        )

    # ── 2. Resolver MedicalTest desde el EventTest ─────────────────────────
    prisma = get_prisma_client()
    if prisma is None:
        raise HTTPException(
            status_code=503,
            detail="Prisma no inicializado. Reintenta en unos segundos.",
        )
    try:
        et_row = await prisma.eventtest.find_unique(
            where={"id": event_test_id},
            include={"test": True},
        )
    except Exception as db_err:
        raise HTTPException(
            status_code=503, detail=f"Error consultando EventTest: {db_err}"
        )
    if et_row is None:
        raise HTTPException(
            status_code=404, detail=f"EventTest {event_test_id} no existe"
        )

    # _attr: dict u objeto Prisma
    def _attr(obj: Any, key: str, default: Any = None) -> Any:
        if obj is None:
            return default
        if isinstance(obj, dict):
            return obj.get(key, default)
        return getattr(obj, key, default)

    medical_test = _attr(et_row, "test")
    if medical_test is None:
        raise HTTPException(
            status_code=404,
            detail=f"EventTest {event_test_id} no tiene MedicalTest asociado",
        )

    options = _sanitize_xml_options(_attr(medical_test, "options"))
    ai_calibration_raw = options.get("aiCalibration")
    ai_calibration: Optional[Dict[str, Any]] = (
        ai_calibration_raw if isinstance(ai_calibration_raw, dict) else None
    )
    canonical_study_type = (
        (ai_calibration or {}).get("canonicalStudyType") or "Audiometria"
    )

    # ── 3. Persistir el archivo en /uploads (con S3 si está habilitado) ────
    safe_filename = file.filename.replace(" ", "_").replace("/", "_")
    stored_filename = f"{int(time.time())}-{safe_filename}"
    file_hash = f"sha256:{hashlib.sha256(contents).hexdigest()}"

    local_path = os.path.join(UPLOAD_DIR, stored_filename)
    try:
        # IMPL-20260513-S3: preferir bucket cuando está habilitado
        if _s3_enabled and _upload_file_to_s3(contents, stored_filename):
            file_url = f"/api/files/{stored_filename}"
            # Aún necesitamos un path local para el parser XML (lee de disco).
            with open(local_path, "wb") as f:
                f.write(contents)
        else:
            with open(local_path, "wb") as f:
                f.write(contents)
            file_url = f"/uploads/{stored_filename}"
    except Exception as persist_err:
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo persistir el archivo XML: {persist_err}",
        )

    # ── 4. Parser XML directo (sin IA) ─────────────────────────────────────
    pipeline_start = time.time()
    try:
        from app.services.audiometry_xml_parser import parse_audiometry_xml

        extraction_start = time.time()
        extraction_dict = parse_audiometry_xml(local_path)
        extraction_seconds = round(time.time() - extraction_start, 2)
    except Exception as xml_err:
        # Limpieza del archivo temporal/persistente en caso de fallo de parseo
        try:
            if os.path.exists(local_path):
                os.unlink(local_path)
        except Exception:
            pass
        print(f"❌ [FIX-20260729-03-G-XML] Error parseando XML: {type(xml_err).__name__}: {xml_err}")
        raise HTTPException(
            status_code=400,
            detail=f"FIX-20260729-03-G-XML: XML inválido o no compatible con "
            f"audiómetro DD65 V2: {type(xml_err).__name__}",
        )

    # ── 5. Prediagnóstico clínico (DR7.ai) sobre los umbrales extraídos ───
    if prediagnostic_svc is None:
        # Si DR7.ai no está disponible, devolvemos solo la extracción (xml_direct)
        # para que el frontend pueda persistir el snapshot y el médico revise
        # manualmente. Marcamos explícitamente el clinical_state.
        prediagnosis_payload: Dict[str, Any] = {
            "clinical_state": "AI_PENDING_REVIEW",
            "summary": "Prediagnóstico IA no disponible; revisión médica manual requerida.",
            "confidence": None,
            "justification": None,
            "clinical_basis": [],
            "citations": [],
            "limitations": [
                "FIX-20260729-03-G-XML: PrediagnosticService no inicializado. "
                "Datos extraídos directamente del XML sin interpretación IA."
            ],
            "red_flags": [],
            "non_conclusive_reason": "ai_service_unavailable",
            "audit": {
                "model_name": "none",
                "clinical_provider": "none",
                "prompt_version": PREDIAGNOSIS_PROMPT_VERSION,
                "pipeline_version": PIPELINE_VERSION,
                "triggered_by_user_id": triggered_by_user_id,
                "trigger_reason": "xml_direct_no_ai",
            },
        }
        predx_seconds = 0.0
    else:
        try:
            predx_start = time.time()
            prediagnosis_obj = prediagnostic_svc.generate_prediagnosis(
                study_type=canonical_study_type,
                extracted_data=extraction_dict,
                ai_calibration=ai_calibration,
            )
            predx_seconds = round(time.time() - predx_start, 2)

            predx_provider = getattr(prediagnosis_obj, "clinical_provider", None)
            predx_model_used = getattr(prediagnosis_obj, "clinical_model_used", None)
            predx_calibration_source = getattr(prediagnosis_obj, "calibration_source", None)
            predx_prompt_source = getattr(prediagnosis_obj, "prompt_source", None)
            predx_prompt_version = getattr(prediagnosis_obj, "prompt_version", None)
            predx_input_debug = getattr(prediagnosis_obj, "input_debug", None)

            prediagnosis_payload = {
                "clinical_state": prediagnosis_obj.clinical_state,
                "summary": prediagnosis_obj.summary,
                "confidence": prediagnosis_obj.confidence,
                "justification": prediagnosis_obj.justification,
                "clinical_basis": [cb.model_dump() for cb in prediagnosis_obj.clinical_basis],
                "citations": [c.model_dump() for c in prediagnosis_obj.citations],
                "limitations": prediagnosis_obj.limitations,
                "red_flags": prediagnosis_obj.red_flags,
                "non_conclusive_reason": prediagnosis_obj.non_conclusive_reason,
                "clinical_provider": predx_provider,
                "clinical_model_used": predx_model_used,
                "calibration_source": predx_calibration_source,
                "prompt_source": predx_prompt_source,
                "audit": {
                    "model_name": predx_model_used or GEMINI_MODEL_CLINICAL,
                    "clinical_provider": predx_provider or "gemini",
                    "prompt_version": predx_prompt_version or PREDIAGNOSIS_PROMPT_VERSION,
                    "prompt_source": predx_prompt_source,
                    "pipeline_version": PIPELINE_VERSION,
                    "triggered_by_user_id": triggered_by_user_id,
                    "trigger_reason": "xml_direct_then_ai",
                },
                "_guardrail": "Este prediagnóstico NO autoriza firma digital, "
                "dictamen final ni aptitud laboral sin revisión médica explícita.",
                "input_debug": predx_input_debug.model_dump() if predx_input_debug else None,
            }
        except Exception as predx_err:
            print(f"⚠️ [FIX-20260729-03-G-XML] Prediagnóstico DR7.ai falló sobre "
                  f"datos XML: {type(predx_err).__name__}: {predx_err}")
            prediagnosis_payload = {
                "clinical_state": "AI_PENDING_REVIEW",
                "summary": f"Extracción XML directa exitosa; prediagnóstico IA no concluyente: {type(predx_err).__name__}",
                "confidence": None,
                "limitations": [
                    f"FIX-20260729-03-G-XML: PrediagnosticService.generate_prediagnosis "
                    f"falló: {type(predx_err).__name__}"
                ],
                "audit": {
                    "model_name": "none",
                    "prompt_version": PREDIAGNOSIS_PROMPT_VERSION,
                    "pipeline_version": PIPELINE_VERSION,
                    "triggered_by_user_id": triggered_by_user_id,
                    "trigger_reason": "xml_direct_prediagnosis_failed",
                },
            }
            predx_seconds = 0.0

    total_seconds = round(time.time() - pipeline_start, 2)

    # ── 6. Respuesta con shape compatible con v2_upload_and_analyze ───────
    return {
        "status": "success",
        "pipeline_version": PIPELINE_VERSION,
        "data_source": "xml_direct",  # FIX-20260729-03-G-XML: trazabilidad
        "file": stored_filename,
        "file_url": file_url,
        "classification": {
            "detected_type": canonical_study_type,
            "confidence": 1.0,
            "reason": "xml_direct_audiometry",
        },
        "extraction_snapshot": {
            "study_type": canonical_study_type,
            "extracted_data": extraction_dict,
            "missing_fields": _list_xml_missing_fields(extraction_dict),
            "quality_notes": ["xml_direct", "audiometry_dd65_v2"],
            "audit": {
                "extraction_provider": "xml_direct",
                "extraction_model_used": "xml_parser",
                "model_name": "xml_parser",  # el frontend lo lee aquí
                "prompt_version": "xml_direct_v1",
                "prompt_source": "xml_direct",
                "pipeline_version": PIPELINE_VERSION,
                "source_file_hash": file_hash,
                "triggered_by_user_id": triggered_by_user_id,
                "trigger_reason": "initial_upload_xml",
                "duration_seconds": extraction_seconds,
            },
        },
        "prediagnosis_snapshot": prediagnosis_payload,
        "timings": {
            "extraction_seconds": extraction_seconds,
            "prediagnosis_seconds": predx_seconds,
            "total_seconds": total_seconds,
        },
    }


def _list_xml_missing_fields(extracted_data: Dict[str, Any]) -> List[str]:
    """
    FIX-20260729-03-G-XML: detecta campos vacíos en la extracción XML para
    alimentar el contrato `missing_fields` del StudyExtractionSnapshot.
    """
    missing: List[str] = []
    for ear_key in ("oido_derecho", "oido_izquierdo"):
        ear = extracted_data.get(ear_key) if isinstance(extracted_data, dict) else None
        if not isinstance(ear, dict):
            missing.append(f"{ear_key}")
            continue
        if not ear.get("va"):
            missing.append(f"{ear_key}.va")
        if not ear.get("vo"):
            missing.append(f"{ear_key}.vo")
        if ear.get("pta") is None:
            missing.append(f"{ear_key}.pta")
    return missing


# ========================================
# ENDPOINT DE RESOLUCIÓN DE ARCHIVOS S3 (IMPL-20260513-S3)
# ========================================

@app.get("/api/files/{key:path}")
def resolve_file(key: str):
    """
    IMPL-20260513-S3: Resuelve una key de archivo y devuelve acceso al objeto.

    IMPL-20260624-01 (ruta pública sin token /solicitar-alta):
      - Si S3 está habilitado y la key existe en el bucket:
          genera URL presigned (5 min) y redirige con 302.
          Para PDF/imágenes fuerza ResponseContentType e inline (ARCH-20260516-01).
      - Si S3 está habilitado pero la operación falla, intenta fallback local.
      - Si S3 NO está habilitado en absoluto, sirve desde filesystem local:
          ruta = path.join(UPLOAD_DIR, key); Content-Type según extensión.
      - 404 si no se encuentra ni en S3 ni localmente.
      - 503 si S3 no está configurado Y no se encuentra localmente.

    Permite al frontend y a regenerateStudyAI descargar archivos sin exponer
    credenciales ni almacenar URLs efímeras en la base de datos.
    NUNCA loguea la presigned URL generada.
    """
    content_type, is_embeddable = _detect_content_type(key)

    # --- Camino A: S3 habilitado → intentar presigned URL -----------------------
    if _s3_enabled and _s3_client:
        try:
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
            # Falla S3 → intentar fallback local antes de rendirse.
            print(f"⚠️ S3 presigned URL falló para key={key}: {_sanitize_error(str(e))}; intentando fallback local.")

    # --- Camino B: Fallback a filesystem local ----------------------------------
    local_path = os.path.join(UPLOAD_DIR, key)
    # Defensa contra path traversal: la key podría contener `..` y escapar de UPLOAD_DIR.
    try:
        local_abs = os.path.realpath(local_path)
        upload_abs = os.path.realpath(UPLOAD_DIR)
        if not local_abs.startswith(upload_abs + os.sep) and local_abs != upload_abs:
            raise HTTPException(status_code=400, detail="key inválida")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="key inválida")

    if os.path.isfile(local_path):
        try:
            with open(local_path, "rb") as fh:
                file_bytes = fh.read()
            headers: Dict[str, str] = {"Content-Type": content_type}
            if is_embeddable:
                # Inline para que el visor embebido no fuerce descarga.
                headers["Content-Disposition"] = "inline"
            return Response(content=file_bytes, headers=headers, media_type=content_type)
        except Exception as e:
            print(f"❌ Error leyendo archivo local key={key}: {_sanitize_error(str(e))}")
            raise HTTPException(status_code=500, detail="No se pudo leer el archivo local")

    # --- Camino C: No encontrado -----------------------------------------------
    if not _s3_enabled:
        # S3 nunca estuvo configurado y el archivo no está local: 503 explícito
        # para distinguir de un 404 "el archivo fue borrado".
        raise HTTPException(
            status_code=503,
            detail="Storage S3 no configurado y archivo no disponible localmente",
        )
    raise HTTPException(status_code=404, detail=f"Archivo no encontrado: {key}")


# ========================================
# IMPL-20260630-03: ENDPOINTS REPORTES MASIVOS POR PROYECTO (ARCH-20260623-01)
# ========================================
try:
    from app.api.reports import router as reports_router

    # IMPL-20260630-06: Prisma se inyecta vía lifespan (ver arriba). No se hace
    # inyección top-level aquí porque antes del lifespan el cliente aún no
    # está inicializado (conexión asíncrona a Railway Postgres).
    app.include_router(reports_router)
except Exception as _reports_import_err:
    print(f"⚠️ No se pudo registrar router de reports: {_sanitize_error(str(_reports_import_err))}")


# ========================================
# IMPL-20260630-06: SLICE A NOVA ABSORCIÓN (ARCH-20260630-02)
# Catálogos LIS — 8 mods (unidades, muestras, recipientes, metodologías,
# lugares de proceso, clasificaciones, indicaciones, departamentos).
# Prefijo: /api/v1/lab
# ========================================
try:
    from app.api.v1.lab.catalogs import router as lab_catalogs_router

    # IMPL-20260630-06: Prisma se inyecta vía lifespan (ver arriba) en
    # lab_catalog_service.set_prisma_client. La inyección top-level aquí era
    # la causa del ModuleNotFoundError silencioso (prisma_client.py no existía).
    app.include_router(lab_catalogs_router)
    print("✅ Router lab-catalogs registrado (/api/v1/lab/catalogs)")
except Exception as _lab_import_err:
    print(f"⚠️ No se pudo registrar router de lab-catalogs: {_sanitize_error(str(_lab_import_err))}")

# ========================================
# IMPL-20260701-03: SLICE B NOVA ABSORCIÓN (ARCH-20260701-03)
# Admisión LabOrder + LabOrderItem + autocomplete (workers/doctors/companies/tests).
# Reusa el mismo Prisma client inyectado por lab_catalog_service para que tests
# y runtime compartan la misma conexión. Prefijo: /api/v1/lab/orders y /api/v1/lab/search
# ========================================
try:
    from app.api.v1.lab.orders import router as lab_orders_router
    from app.api.v1.lab.search import router as lab_search_router

    app.include_router(lab_orders_router)
    app.include_router(lab_search_router)
    print("✅ Routers lab-orders + lab-search registrados (/api/v1/lab/orders, /api/v1/lab/search)")
except Exception as _lab_b_import_err:
    print(f"⚠️ No se pudieron registrar routers de lab-orders/lab-search: {_sanitize_error(str(_lab_b_import_err))}")

# ========================================
# IMPL-20260707-16: SLICE C NOVA ABSORCIÓN (ARCH-20260707-16)
# Captura de LabResult + ciclo P/R/A/V + worklist + integración papeleta.
# Inyección del prisma client se hace en lifespan() (arriba) siguiendo el
# patrón de Slice A/B. Aquí solo se monta el router.
# ========================================
try:
    from app.api.v1.lab.results import router as lab_results_router

    app.include_router(lab_results_router)
    print("✅ Router lab-results registrado (/api/v1/lab/results)")
except Exception as _lab_c_import_err:
    print(f"⚠️ No se pudo registrar router de lab-results: {_sanitize_error(str(_lab_c_import_err))}")


# ========================================
# IMPL-20260707-17: Fase 1 NOVA absorción (ARCH-20260707-17) — B-v2 + E
# Bandeja de papeletas + trigger SAMPLE_TAKEN + catálogo avanzado de estudios.
# Reusa el Prisma client inyectado por lifespan() arriba (mismo patrón Slice A/B/C).
# Prefijos: /api/v1/lab/pending-orders, /api/v1/event_tests, /api/v1/lab/auto-generate-from-event,
#           /api/v1/medical_tests/lab-catalog, /api/v1/lab/analytes, /api/v1/lab/reference-ranges,
#           /api/v1/lab/seed-typical-tests
# ========================================
try:
    from app.api.v1.lab.pending_orders import router as lab_pending_orders_router
    from app.api.v1.lab.medical_tests import router as lab_medical_tests_router

    app.include_router(lab_pending_orders_router)
    app.include_router(lab_medical_tests_router)
    print("✅ Routers Fase 1 registrados (pending-orders + medical-tests catalog)")
except Exception as _fase1_import_err:
    print(f"⚠️ No se pudieron registrar routers de Fase 1: {_sanitize_error(str(_fase1_import_err))}")


# ========================================
# IMPL-20260707-18: Fase 2 NOVA absorción (ARCH-20260707-17) — D Trazabilidad
# Timeline muestra→proceso→entrega de LabOrder.
# Prefijo: /api/v1/lab/orders/{id}/trace
# ========================================
try:
    from app.api.v1.lab.trace import router as lab_trace_router
    from app.services.lab_trace_service import set_prisma_client as _set_lab_trace

    # Reusa el mismo Prisma client ya inyectado por lifespan (mismo patrón
    # que catalog/orders/results/pending-orders) para no abrir conexiones
    # nuevas. Si por alguna razón no está, intenta obtenerlo de
    # lab_order_service que es la fuente canónica de inyección.
    try:
        from app.services import lab_order_service as _los
        _trace_prisma = _los.get_prisma()
        _set_lab_trace(_trace_prisma)
    except Exception:
        pass  # main.py lifespan se encarga en producción

    app.include_router(lab_trace_router)
    print("✅ Router lab-trace registrado (/api/v1/lab/orders/{id}/trace)")
except Exception as _lab_trace_import_err:
    print(f"⚠️ No se pudo registrar router de lab-trace: {_sanitize_error(str(_lab_trace_import_err))}")


# ========================================
# IMPL-20260708-19: Fase 3 NOVA absorción (ARCH-20260707-17) — F + G
# F: Reportes PDF imprimibles (etiquetas, resultados, recibos)
# G: Caja, cortesías y corte de caja
# Prefijos: /api/v1/lab/reports, /api/v1/lab/orders/{id}/payments, /api/v1/lab/orders/{id}/courtesy,
#           /api/v1/lab/cash-closing
# ========================================
try:
    from app.api.v1.lab.reports import router as lab_reports_router
    from app.api.v1.lab.cash import router as lab_cash_router
    from app.services.lab_cash_service import set_prisma_client as _set_lab_cash

    try:
        from app.services import lab_order_service as _los_fase3
        _fase3_prisma = _los_fase3.get_prisma()
        _set_lab_cash(_fase3_prisma)
    except Exception:
        pass  # lifespan se encarga en producción

    app.include_router(lab_reports_router)
    app.include_router(lab_cash_router)
    print("✅ Routers Fase 3 registrados (reports PDF + cash/courtesy)")
except Exception as _fase3_import_err:
    print(f"⚠️ No se pudieron registrar routers de Fase 3: {_sanitize_error(str(_fase3_import_err))}")


# ========================================
# IMPL-20260708-FINAL: Fase 4 NOVA absorción (ARCH-20260707-17) — I Cutover
# Estado de las 9 fases del roadmap NOVA→AMI. Read-only, sin auth.
# ========================================
try:
    from app.api.v1.lab.cutover import router as lab_cutover_router
    app.include_router(lab_cutover_router)
    print("✅ Router Fase 4 (cutover-status) registrado (/api/v1/lab/cutover-status)")
except Exception as _fase4_cutover_import_err:
    print(f"⚠️ No se pudo registrar router de cutover: {_sanitize_error(str(_fase4_cutover_import_err))}")


# ========================================
# IMPL-20260711-01: Módulo de Unidades Móviles (ARCH-20260711-01)
# CRUD unidades, upload de imagen, validación de disponibilidad, mantenimiento,
# reprogramación flexible de mantenimientos y completación con auto-cálculo
# de nextDueDate según tipo. Reusa el Prisma client inyectado por lifespan().
# Prefijos: /api/v1/mobile-units y /api/v1/maintenance
# ========================================
try:
    from app.api.v1.mobile_units import router as mobile_units_router
    from app.api.v1.maintenance import router as maintenance_router

    app.include_router(mobile_units_router)
    app.include_router(maintenance_router)
    print("✅ Routers IMPL-20260711-01 registrados (mobile-units + maintenance)")
except Exception as _mob_import_err:
    print(f"⚠️ No se pudieron registrar routers mobile-units/maintenance: {_sanitize_error(str(_mob_import_err))}")


# ========================================
# IMPL-20260715-04: Upload de PDFs de prueba en módulo de Calibración.
# SPEC: context/SPECs/SPEC_ARCH-20260715-04-UPLOAD-PDFS-CALIBRACION.md.
# Endpoints:
#   - POST /api/v1/calibration/upload
#   - GET  /api/v1/calibration/test/{test_id}/results
# NO persiste en DB ni crea EventTest real: solo ejecuta el pipeline
# IA en runtime y retorna resultados al frontend de calibración.
# ========================================
try:
    from app.api.v1.calibration import router as calibration_router

    app.include_router(calibration_router)
    print("✅ Router IMPL-20260715-04 registrado (/api/v1/calibration)")
except Exception as _calibration_import_err:
    print(
        "⚠️ No se pudo registrar router de calibration: "
        f"{_sanitize_error(str(_calibration_import_err))}"
    )


