"""
Residente Digital API - Backend con Pipeline IA Modular
IMPL-20260225-01: Clasificação y extracción inteligentes de documentos médicos.
IMPL-20260225-02: Firma Digital Avanzada y Motor de Reportes Masivos.

IMPL-20260326-16: Endpoints V2 para prediagnóstico IA separado (ARCH-20260326-16).
IMPL-20260604-01: Propuesta asistida de schema de presentación persistida (SPEC_ARCH-20260604-01).
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
from typing import List, Dict, Any, Optional

from services.ai import DocumentClassifierService, ExtractorService, PrediagnosticService
from services.ai.base import GeminiBase
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
# IMPL-20260603-01: proveedor clínico migrado a DR7.ai.
# Respaldo: context/SPECs/SPEC_ARCH-20260603-04-MIGRACION-CLINICA-DR7-TEXTO.md
MEDGEMMA_ENABLED = (_read_env_var("MEDGEMMA_ENABLED") or "false").lower() == "true"
DR7_API_KEY  = _read_env_var("DR7_API_KEY") or ""
DR7_BASE_URL = _read_env_var("DR7_BASE_URL") or "https://dr7.ai/api/v1/medical/chat/completions"
DR7_MODEL    = _read_env_var("DR7_MODEL") or "medgemma-4b-it"
MEDGEMMA_STATUS = "available" if (MEDGEMMA_ENABLED and DR7_API_KEY) else "pending_integration"
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


class PresentationSchemaRequest(BaseModel):
    """
    IMPL-20260604-01. Respaldo: context/SPECs/SPEC_ARCH-20260604-01-CALIBRACION-PRESENTACION-ESTUDIOS-IA.md.
    Entrada del asistente de presentación persistida; nunca se usa en runtime clínico.
    """
    study_type: str
    extracted_data: Dict[str, Any]
    ai_calibration: Optional[Dict[str, Any]] = None


def _presentation_title(raw_key: str) -> str:
    return raw_key.replace("_", " ").strip().title() or "Seccion"


def _is_scalar_value(value: Any) -> bool:
    return value is None or isinstance(value, (str, int, float, bool))


def _get_value_at_path(data: Dict[str, Any], path: Optional[str]) -> Any:
    if not path:
        return data

    current: Any = data
    for segment in path.split("."):
        if not isinstance(current, dict):
            return None
        current = current.get(segment)
    return current


def _resolve_source_map(data: Dict[str, Any], source_key: Optional[str]) -> Dict[str, Any]:
    if not source_key:
        return data
    resolved = _get_value_at_path(data, source_key)
    return resolved if isinstance(resolved, dict) else data


def _sanitize_presentation_schema(candidate: Any, study_type: str, extracted_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    IMPL-20260604-01. Respaldo: context/SPECs/SPEC_ARCH-20260604-01-CALIBRACION-PRESENTACION-ESTUDIOS-IA.md.
    Normaliza la salida del modelo para conservar solo rutas y claves presentes en extracted_data.
    """
    if not isinstance(candidate, dict):
        candidate = {}

    sections: List[Dict[str, Any]] = []
    for raw_section in candidate.get("sections", []):
        if not isinstance(raw_section, dict):
            continue

        kind = str(raw_section.get("kind") or "").strip()
        title = str(raw_section.get("title") or _presentation_title(kind)).strip() or "Seccion"

        if kind in {"keyValue", "badges"}:
            source_key = str(raw_section.get("sourceKey") or "").strip() or None
            source = _resolve_source_map(extracted_data, source_key)
            fields = []
            for field in raw_section.get("fields", []):
                field_key = str(field).strip()
                if field_key and field_key in source:
                    fields.append(field_key)
            if fields:
                payload = {"kind": kind, "title": title, "fields": fields}
                if source_key:
                    payload["sourceKey"] = source_key
                sections.append(payload)
            continue

        if kind == "table":
            source = str(raw_section.get("source") or "").strip()
            rows = _get_value_at_path(extracted_data, source)
            if not source or not isinstance(rows, list) or not rows:
                continue
            object_rows = [row for row in rows if isinstance(row, dict)]
            if not object_rows:
                continue
            valid_keys = set().union(*(row.keys() for row in object_rows))
            columns = []
            for col in raw_section.get("columns", []):
                if not isinstance(col, dict):
                    continue
                col_key = str(col.get("key") or "").strip()
                if col_key and col_key in valid_keys:
                    columns.append({
                        "key": col_key,
                        "label": str(col.get("label") or _presentation_title(col_key)).strip() or col_key,
                    })
            if columns:
                sections.append({"kind": kind, "title": title, "source": source, "columns": columns})
            continue

        if kind == "note":
            source = str(raw_section.get("source") or "").strip()
            if source and _get_value_at_path(extracted_data, source) is not None:
                sections.append({"kind": kind, "title": title, "source": source})
            continue

        if kind == "bilateralFrequency":
            right_key = str(raw_section.get("rightKey") or "").strip()
            left_key = str(raw_section.get("leftKey") or "").strip()
            right_value = _get_value_at_path(extracted_data, right_key)
            left_value = _get_value_at_path(extracted_data, left_key)
            if isinstance(right_value, dict) and isinstance(left_value, dict):
                section_payload = {
                    "kind": kind,
                    "title": title,
                    "rightKey": right_key,
                    "leftKey": left_key,
                }
                preferred_order = raw_section.get("preferredOrder")
                if isinstance(preferred_order, list):
                    section_payload["preferredOrder"] = [
                        int(freq) for freq in preferred_order if isinstance(freq, (int, float))
                    ]
                sections.append(section_payload)

    return {
        "studyType": str(candidate.get("studyType") or study_type).strip() or study_type,
        "sections": sections,
    }


def _build_heuristic_presentation_schema(study_type: str, extracted_data: Dict[str, Any]) -> Dict[str, Any]:
    sections: List[Dict[str, Any]] = []

    root_scalars = [
        key for key, value in extracted_data.items()
        if _is_scalar_value(value) and value not in (None, "")
    ]
    if root_scalars:
        sections.append({
            "kind": "keyValue",
            "title": "Resumen principal",
            "fields": root_scalars[:8],
        })

    for key, value in extracted_data.items():
        if isinstance(value, dict):
            scalar_children = [
                child_key for child_key, child_value in value.items()
                if _is_scalar_value(child_value) and child_value not in (None, "")
            ]
            if scalar_children:
                sections.append({
                    "kind": "keyValue",
                    "title": _presentation_title(key),
                    "sourceKey": key,
                    "fields": scalar_children[:10],
                })

        if isinstance(value, list) and value:
            if all(isinstance(item, dict) for item in value):
                valid_keys: List[str] = []
                for row in value:
                    for row_key in row.keys():
                        if row_key not in valid_keys:
                            valid_keys.append(row_key)
                sections.append({
                    "kind": "table",
                    "title": _presentation_title(key),
                    "source": key,
                    "columns": [
                        {"key": column_key, "label": _presentation_title(column_key)}
                        for column_key in valid_keys[:8]
                    ],
                })
            elif all(_is_scalar_value(item) for item in value):
                sections.append({
                    "kind": "note",
                    "title": _presentation_title(key),
                    "source": key,
                })

    right_ear = extracted_data.get("oido_derecho")
    left_ear = extracted_data.get("oido_izquierdo")
    if isinstance(right_ear, dict) and isinstance(left_ear, dict):
        for nested_key in sorted(set(right_ear.keys()).intersection(left_ear.keys())):
            right_nested = right_ear.get(nested_key)
            left_nested = left_ear.get(nested_key)
            if isinstance(right_nested, dict) and isinstance(left_nested, dict):
                sections.append({
                    "kind": "bilateralFrequency",
                    "title": _presentation_title(nested_key),
                    "rightKey": f"oido_derecho.{nested_key}",
                    "leftKey": f"oido_izquierdo.{nested_key}",
                })

    return _sanitize_presentation_schema({"studyType": study_type, "sections": sections}, study_type, extracted_data)


def _build_presentation_summary(schema: Dict[str, Any]) -> str:
    sections = schema.get("sections", []) if isinstance(schema, dict) else []
    if not sections:
        return "Propuse un schema base sin secciones válidas; requiere ajuste manual."

    section_titles = [str(section.get("title") or section.get("kind") or "seccion") for section in sections[:4]]
    return f"Agrupé {', '.join(section_titles)} y dejé {len(sections)} sección(es) listas para ajuste manual."


def _build_presentation_prompt(request: PresentationSchemaRequest) -> str:
    canonical_type = None
    if isinstance(request.ai_calibration, dict):
        canonical_type = request.ai_calibration.get("canonicalStudyType")

    return (
        "Eres un asistente de calibración de presentación clínica para medicina ocupacional. "
        "Debes devolver SOLO JSON válido con las claves schema y summary. "
        "schema debe contener studyType y sections. "
        "Usa exclusivamente estos tipos de sección: keyValue, table, note, badges, bilateralFrequency. "
        "No generes HTML, JSX, markdown ni texto clínico interpretativo. "
        "No inventes rutas ni campos ausentes. "
        "Si encuentras arrays homogéneos de objetos, prioriza table. "
        "Si encuentras objetos con escalares, agrúpalos como keyValue o badges según tenga sentido. "
        "Usa títulos médicos legibles. "
        "Preferir rutas explícitas del JSON real. "
        f"Study type solicitado: {request.study_type}. "
        f"Study type canónico: {canonical_type or request.study_type}. "
        "Responde en este formato JSON: "
        '{"schema":{"studyType":"...","sections":[...]},"summary":"..."}. '
        f"JSON real de extracted_data: {json.dumps(request.extracted_data, ensure_ascii=False)}"
    )


def _call_presentation_gemini(prompt: str) -> Dict[str, Any]:
    import requests

    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY no configurada para propuesta asistida")

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GEMINI_MODEL_EXTRACTION}:generateContent?key={GEMINI_API_KEY}"
    )
    response = requests.post(
        url,
        headers={"Content-Type": "application/json"},
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 2048},
        },
        timeout=(10, 60),
    )
    response.raise_for_status()
    payload = response.json()
    candidates = payload.get("candidates", [])
    if not candidates:
        raise ValueError("Gemini no devolvió candidatos para presentation schema")
    text = GeminiBase._sanitize_model_json_text(
        (((candidates[0] or {}).get("content") or {}).get("parts") or [{}])[0].get("text", "")
    )
    if not text:
        raise ValueError("Gemini devolvió contenido vacío para presentation schema")
    return GeminiBase._tolerant_json_parse(text)


def _propose_presentation_schema(request: PresentationSchemaRequest) -> Dict[str, Any]:
    heuristic_schema = _build_heuristic_presentation_schema(request.study_type, request.extracted_data)
    schema = heuristic_schema
    summary = _build_presentation_summary(heuristic_schema)
    model_name = "heuristic-fallback"

    if GEMINI_API_KEY:
        try:
            model_result = _call_presentation_gemini(_build_presentation_prompt(request))
            schema = _sanitize_presentation_schema(
                model_result.get("schema"), request.study_type, request.extracted_data
            )
            if not schema.get("sections"):
                schema = heuristic_schema
            summary = str(model_result.get("summary") or _build_presentation_summary(schema))
            model_name = GEMINI_MODEL_EXTRACTION
        except Exception as exc:
            print(f"⚠️ Presentation schema fallback heurístico: {_sanitize_error(str(exc))}")

    return {
        "schema": schema,
        "summary": summary,
        "audit": {
            "model_name": model_name,
            "prompt_source": "presentation_schema_assistant",
            "prompt_version": "presentation-schema-v1",
        },
    }


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
    # IMPL-20260603-01: estado dinámico del proveedor clínico en DR7
    dr7_key_present = bool(_read_env_var("DR7_API_KEY"))
    active_clinical_provider = "dr7" if (MEDGEMMA_ENABLED and dr7_key_present) else "gemini"
    # ARCH-20260519-15: rollback extractivo — Gemini es siempre el proveedor activo
    # de clasificación documental y extracción estructurada en este corte.
    # Featherless/Qwen-VL desactivado del runtime extractivo hasta nueva decisión arquitectónica.
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
        # ARCH-20260519-15: trazabilidad del proveedor extractivo activo
        "extraction_provider_active": "gemini",
        "extraction_model_active": current_extraction_model,
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
    }


@app.post("/api/v2/studies/presentation-schema/propose")
def propose_presentation_schema(request: PresentationSchemaRequest):
    """
    IMPL-20260604-01. Respaldo: context/SPECs/SPEC_ARCH-20260604-01-CALIBRACION-PRESENTACION-ESTUDIOS-IA.md.
    Genera una propuesta de schema declarativo persistible a partir de extracted_data.
    Solo se invoca desde calibración bajo demanda; nunca en runtime de la papeleta.
    """
    if not request.study_type.strip():
        raise HTTPException(status_code=400, detail="study_type es obligatorio")
    if not isinstance(request.extracted_data, dict) or not request.extracted_data:
        raise HTTPException(status_code=400, detail="extracted_data es obligatorio y debe ser objeto")

    return _propose_presentation_schema(request)


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
                    # ARCH-20260519-15: trazabilidad honesta del proveedor/modelo extractivo activo
                    "extraction_provider": "gemini",
                    "extraction_model_used": GEMINI_MODEL_EXTRACTION,
                    "model_name": GEMINI_MODEL_EXTRACTION,
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
    from app.api.reports import router as reports_router, set_prisma_client as _set_reports_prisma

    # Inyectar Prisma client si esta disponible (entorno real con Prisma corriendo).
    try:
        from app.services.prisma_client import get_prisma_client as _get_prisma
        _set_reports_prisma(_get_prisma())
    except Exception as _prisma_inject_err:
        print(f"[reports] Prisma no inyectado (modo testing o sin DB): {_sanitize_error(str(_prisma_inject_err))}")

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
    from app.services.lab_catalog_service import set_prisma_client as _set_lab_prisma

    try:
        from app.services.prisma_client import get_prisma_client as _get_lab_prisma
        _set_lab_prisma(_get_lab_prisma())
    except Exception as _lab_prisma_inject_err:
        print(f"[lab-catalogs] Prisma no inyectado (modo testing o sin DB): {_sanitize_error(str(_lab_prisma_inject_err))}")

    app.include_router(lab_catalogs_router)
    print("✅ Router lab-catalogs registrado (/api/v1/lab/catalogs)")
except Exception as _lab_import_err:
    print(f"⚠️ No se pudo registrar router de lab-catalogs: {_sanitize_error(str(_lab_import_err))}")


