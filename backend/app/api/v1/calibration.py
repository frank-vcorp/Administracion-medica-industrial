"""
IMPL-20260715-04 — Upload de PDFs de prueba en módulo de Calibración.

SPEC: context/SPECs/SPEC_ARCH-20260715-04-UPLOAD-PDFS-CALIBRACION.md

Rutas REST:
  - POST /api/v1/calibration/upload
  - GET  /api/v1/calibration/test/{test_id}/results
  - GET  /api/v1/calibration/snapshots?test_id=...

Propósito: permitir subir un PDF de prueba desde el módulo de calibración,
procesarlo con el pipeline de extracción/prediagnóstico y retornar los
resultados SIN crear EventTest real ni persistir en DB.

FIX-20260810-08: Persistencia defensiva de snapshots en tabla
`calibration_snapshots` (modelo CalibrationSnapshot). Solo se persiste
si la extracción/prediagnóstico fue exitoso. Si la persistencia falla,
se log warning y se devuelve `snapshot_id=null` (la respuesta HTTP sigue
siendo 200 con el cache en memoria como fallback para el tab Pruebas).

ARCH-20260809-02: Integración con selector multi-proveedor de extracción
(Gemini + MiniMax M3). El endpoint retorna `extraction_provider_used`,
`extraction_provider_requested` y `extraction_fallback_reason` además de
los campos legacy.

Notas arquitectónicas (desviación respecto al SPEC):
  - El proyecto no usa `backend/app/api/v1/router.py` ni `endpoints/`.
    Los routers son archivos planos en `backend/app/api/v1/` (mismo patrón
    que `maintenance.py`, `mobile_units.py`) y se registran en `main.py`
    vía `app.include_router()`. Por eso este archivo vive directamente
    en `backend/app/api/v1/calibration.py` y se monta desde `main.py`.
  - Se reusan los servicios de IA ya existentes (ExtractorService /
    PrediagnosticService) sin modificar su lógica, instanciándolos
    localmente con las mismas env vars que `main.py`.
  - El Prisma client se obtiene vía `app.services.prisma_client.get_prisma_client()`
    (patrón ya usado en lifespan de main.py).
"""
from __future__ import annotations

import os
import tempfile
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.services.ai import ExtractorService, PrediagnosticService
from app.services.ai.extractor import (
    ExtractionAuthError,
    ExtractionProviderUnknownError,
)
from app.services.prisma_client import get_prisma_client


router = APIRouter(prefix="/api/v1/calibration", tags=["calibration"])


# ---------------------------------------------------------------------------
# Almacenamiento temporal de resultados en memoria (no persistido en DB).
# IMPL-20260715-04: solo para que el endpoint GET de la SPEC tenga respuesta
# inmediata en V1. Se limpia al reiniciar el proceso.
# ---------------------------------------------------------------------------
_TEST_RESULTS_CACHE: Dict[str, Dict[str, Any]] = {}


def _sanitize_options(raw_options: Any) -> Dict[str, Any]:
    """Normaliza el campo `options` de MedicalTest (puede ser dict, str JSON, None)."""
    if raw_options is None:
        return {}
    if isinstance(raw_options, dict):
        return raw_options
    if isinstance(raw_options, str) and raw_options.strip():
        import json

        try:
            parsed = json.loads(raw_options)
            return parsed if isinstance(parsed, dict) else {}
        except (ValueError, TypeError):
            return {}
    return {}


def _attr(obj: Any, key: str, default: Any = None) -> Any:
    """Lee atributo o key indistintamente (dict u objeto Prisma)."""
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _resolve_test_ai_calibration(test_row: Any) -> Optional[Dict[str, Any]]:
    """Extrae el bloque aiCalibration de MedicalTest.options."""
    options = _sanitize_options(_attr(test_row, "options"))
    ai_calibration = options.get("aiCalibration")
    return ai_calibration if isinstance(ai_calibration, dict) else None


def _build_services() -> tuple[Optional[ExtractorService], Optional[PrediagnosticService]]:
    """
    Crea instancias de los servicios IA reusando env vars (mismo patrón que main.py).

    FIX-20260810-05: si AI_KEYS_FROM_DB_ENABLED=true, pasa el `key_resolver`
    singleton al ExtractorService para que `_is_m3_unavailable` consulte la
    BD cuando M3_API_KEY no está en env. Si la flag está off, no pasamos
    resolver (singleton es None dentro del service) — firma intacta.
    """
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    extraction_model = os.getenv("GEMINI_MODEL_EXTRACTION") or os.getenv("GEMINI_MODEL") or "gemini-2.5-flash"
    clinical_model = os.getenv("GEMINI_MODEL_CLINICAL") or os.getenv("GEMINI_MODEL") or "gemini-2.5-flash"
    # FIX-20260810-05: inyectar resolver cuando la flag está activa.
    from app.services.ai.keys import is_ai_keys_from_db_enabled, key_resolver
    resolver_to_pass = key_resolver if is_ai_keys_from_db_enabled() else None
    try:
        extractor = ExtractorService(
            api_key=gemini_api_key,
            model=extraction_model,
            key_resolver=resolver_to_pass,
        )
        prediagnostic_svc = PrediagnosticService(api_key=gemini_api_key, model=clinical_model)
        return extractor, prediagnostic_svc
    except Exception:
        return None, None


def _serialize_extraction_result(extraction_result: Any) -> Dict[str, Any]:
    """Normaliza el resultado de extracción a dict JSON-serializable."""
    if extraction_result is None:
        return {}
    if isinstance(extraction_result, dict):
        return extraction_result
    if hasattr(extraction_result, "model_dump"):
        try:
            return extraction_result.model_dump()
        except Exception:
            pass
    if hasattr(extraction_result, "dict"):
        try:
            return extraction_result.dict()
        except Exception:
            pass
    # Fallback defensivo
    return {"value": str(extraction_result)}


async def _persist_calibration_snapshot(
    *,
    prisma: Any,
    medical_test_id: str,
    study_type: str,
    source_file_name: Optional[str],
    source_file_url: Optional[str],
    structured_data: Dict[str, Any],
    model_name: str,
    prompt_version: str,
) -> Optional[str]:
    """
    FIX-20260810-08: Persiste un CalibrationSnapshot en BD. Defensivo:
    si la inserción falla (Prisma down, FK inválida, etc.) se log
    warning y retorna None — el endpoint sigue devolviendo 200 con
    el resultado del pipeline IA en cache de memoria.

    Política:
      - Append-only (nunca UPDATE ni UPSERT).
      - JSON wrapper safe para structuredData (deep copy + JSON round-trip
        para evitar referencias circulares / tipos no serializables).
      - clinicalState fijo en 'DRAFT_EXTRACTED' (no hay revisión médica
        real en el flujo de calibración).
    """
    try:
        import json as _json
        from prisma._fields import Json as PrismaJson  # FIX-04: wrapper Json para Prisma 0.15

        # FIX-20260810-09e: convertir keys numéricas a strings ANTES del Json
        # wrapper. Prisma 0.15 + GraphQL no acepta keys numéricos en JSON
        # (ej. {"125": null}) — las interpreta como IntValue no quoted.
        def _stringify_numeric_keys(obj):
            if isinstance(obj, dict):
                return {_str(k): _stringify_numeric_keys(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [_stringify_numeric_keys(x) for x in obj]
            return obj

        def _str(k):
            return str(k) if isinstance(k, (int, float)) else k

        safe_structured = _stringify_numeric_keys(structured_data)
        safe_structured = _json.loads(_json.dumps(safe_structured, default=str))

        # FIX-20260810-09c: usar FK crudo en vez de medicalTest.connect.
        # El cliente Prisma cacheado en Railway no regenera con la relación
        # explícita; el FK crudo es compatible con cualquier versión del cliente.
        created = await prisma.calibrationsnapshot.create(
            data={
                "medicalTestId": medical_test_id,
                "studyType": study_type,
                "sourceFileName": source_file_name,
                "sourceFileUrl": source_file_url,
                "structuredData": PrismaJson(safe_structured),
                "modelName": model_name,
                "promptVersion": prompt_version,
                "clinicalState": "DRAFT_EXTRACTED",
            }
        )
        return _attr(created, "id")
    except Exception as persist_err:
        # Defensivo: NO fallar el response. La extracción IA sigue siendo
        # válida en cache de memoria; el snapshot solo se usará para el
        # tab Presentación.
        print(
            f"⚠️ [FIX-20260810-08] No se pudo persistir CalibrationSnapshot "
            f"para test_id={medical_test_id[:8]}: {type(persist_err).__name__}: {persist_err}"
        )
        return None


def _serialize_calibration_snapshot(row: Any) -> Dict[str, Any]:
    """Normaliza una fila de CalibrationSnapshot a dict JSON-serializable
    para el endpoint GET /snapshots. Convierte datetime → ISO string."""
    structured = _attr(row, "structuredData")
    if structured is None:
        structured = {}
    created_at = _attr(row, "createdAt")
    created_at_iso = (
        created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at)
    )
    return {
        "id": _attr(row, "id"),
        "medicalTestId": _attr(row, "medicalTestId"),
        "studyType": _attr(row, "studyType"),
        "sourceFileName": _attr(row, "sourceFileName"),
        "sourceFileUrl": _attr(row, "sourceFileUrl"),
        "structuredData": structured,
        "modelName": _attr(row, "modelName"),
        "promptVersion": _attr(row, "promptVersion"),
        "clinicalState": _attr(row, "clinicalState"),
        "createdAt": created_at_iso,
    }


# ---------------------------------------------------------------------------
# POST /api/v1/calibration/upload
# ---------------------------------------------------------------------------
@router.post("/upload")
async def upload_calibration_test(
    file: UploadFile = File(...),
    test_id: str = Form(...),
    test_type: str = Form(...),
    extraction_provider_override: Optional[str] = Form(default=None),
    extraction_model_override: Optional[str] = Form(default=None),
):
    """
    Sube y procesa un archivo de prueba (PDF o XML) para calibración.

    ARCH-20260715-06: Soporte para XML de audiómetro DD65 V2.
    Si el archivo es XML, se usa parser directo sin IA.
    Si es PDF, se usa el pipeline de extracción con IA.

    ARCH-20260809-02: Acepta `extraction_provider_override` y
    `extraction_model_override` opcionales para A/B sin redeploys.
    Retorna `extraction_provider_used`, `extraction_provider_requested`
    y `extraction_fallback_reason` en `extraction.*`.

    NO persiste en DB, NO crea EventTest real. Solo ejecuta el pipeline
    de extracción + prediagnóstico usando la `aiCalibration` vigente de
    la MedicalTest, y retorna los resultados al frontend.

    Errores:
      - 400 Bad Request: archivo inválido, falta file/test_id
      - 404 Not Found: test_id no existe en MedicalTest
      - 500 Internal Server Error: fallo de extracción/prediagnóstico
    """
    # ── Validaciones de input ──────────────────────────────────────────────
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Archivo es obligatorio")
    
    filename_lower = file.filename.lower()
    is_xml = filename_lower.endswith(".xml")
    is_pdf = filename_lower.endswith(".pdf")
    
    if not (is_xml or is_pdf):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF o XML")
    
    if not test_id or not test_id.strip():
        raise HTTPException(status_code=400, detail="test_id es obligatorio")
    if not test_type or not test_type.strip():
        raise HTTPException(status_code=400, detail="test_type es obligatorio")

    # ── Cargar MedicalTest para obtener aiCalibration ──────────────────────
    prisma = get_prisma_client()
    if prisma is None:
        raise HTTPException(
            status_code=503,
            detail="Prisma no inicializado. Reintenta en unos segundos.",
        )
    try:
        test_row = await prisma.medicaltest.find_unique(where={"id": test_id})
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Error consultando MedicalTest: {e}")
    if test_row is None:
        raise HTTPException(status_code=404, detail=f"MedicalTest {test_id} no existe")

    ai_calibration = _resolve_test_ai_calibration(test_row)
    canonical_study_type = (
        (ai_calibration or {}).get("canonicalStudyType") or test_type
    )

    # ── Guardar archivo en temporal (PDF o XML) ────────────────────────────
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="El archivo está vacío")
    
    file_extension = ".xml" if is_xml else ".pdf"
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=file_extension, prefix="calibration_test_")
    try:
        with os.fdopen(tmp_fd, "wb") as tmp_fp:
            tmp_fp.write(contents)
    except Exception:
        # Si falla la escritura, asegurar limpieza del descriptor
        try:
            os.close(tmp_fd)
        except Exception:
            pass
        if os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail="No se pudo persistir el archivo temporal")

    # ── Pipeline de extracción + prediagnóstico ───────────────────────────
    # ARCH-20260715-06: Si es XML de audiometría, usar parser directo sin IA
    if is_xml and canonical_study_type == "Audiometria":
        try:
            from app.services.audiometry_xml_parser import parse_audiometry_xml
            
            extraction_start = time.time()
            extraction_dict = parse_audiometry_xml(tmp_path)
            extraction_seconds = round(time.time() - extraction_start, 2)
            
            # Para XML, no necesitamos IA de extracción, pero sí necesitamos prediagnóstico
            extractor, prediagnostic_svc = _build_services()
            if prediagnostic_svc is None:
                raise HTTPException(
                    status_code=503,
                    detail="Servicio de prediagnóstico no disponible.",
                )
            
            # Generar prediagnóstico con los datos extraídos del XML
            predx_start = time.time()
            prediagnosis_obj = prediagnostic_svc.generate_prediagnosis(
                study_type=canonical_study_type,
                extracted_data=extraction_dict,
                ai_calibration=ai_calibration,
            )
            predx_seconds = round(time.time() - predx_start, 2)
            
            prediagnosis_payload: Dict[str, Any] = (
                prediagnosis_obj.model_dump()
                if hasattr(prediagnosis_obj, "model_dump")
                else (
                    prediagnosis_obj.dict()
                    if hasattr(prediagnosis_obj, "dict")
                    else {"value": str(prediagnosis_obj)}
                )
            )
            
            response_payload = {
                "success": True,
                "test_id": f"calibration_test_{test_id[:8]}",
                "canonical_study_type": canonical_study_type,
                "data_source": "xml_direct",  # Indicar que viene de XML directo
                "extraction": {
                    "structured_data": extraction_dict,
                    "raw_payload": extraction_dict,
                    "model_used": "xml_parser",
                    "prompt_version": "xml_direct_v1",
                    "duration_seconds": extraction_seconds,
                    # ARCH-20260809-02: trazabilidad multi-proveedor (XML directo = sin IA extractiva).
                    "extraction_provider_used": "xml_parser",
                    "extraction_provider_requested": "xml_parser",
                    "extraction_fallback_reason": None,
                },
                "prediagnosis": {
                    "result": prediagnosis_payload,
                    "model_used": _attr(prediagnosis_obj, "clinical_model_used", None)
                    or _attr(prediagnosis_obj, "model_name", None)
                    or "gemini",
                    "prompt_version": _attr(prediagnosis_obj, "prompt_version", None)
                    or (ai_calibration or {}).get("diagnosis", {}).get("version", "calibration_custom"),
                    "duration_seconds": predx_seconds,
                },
                "created_at": datetime.now(timezone.utc).isoformat(),
            }

            # FIX-20260810-08: persistencia defensiva del snapshot (XML directo).
            snapshot_id = await _persist_calibration_snapshot(
                prisma=prisma,
                medical_test_id=test_id,
                study_type=canonical_study_type,
                source_file_name=file.filename,
                source_file_url=None,
                structured_data={
                    "extraction": response_payload["extraction"],
                    "prediagnosis": response_payload["prediagnosis"],
                },
                model_name="xml_parser",
                prompt_version="xml_direct_v1",
            )
            response_payload["snapshot_id"] = snapshot_id

            _TEST_RESULTS_CACHE[response_payload["test_id"]] = response_payload
            return response_payload
            
        except Exception as e:
            print(f"❌ [ARCH-20260715-06] Error parseando XML: {type(e).__name__}: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Error procesando XML de audiómetro: {type(e).__name__}",
            )
        finally:
            # Limpieza del archivo temporal
            if os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass
    
    # ── Flujo PDF (existente) ──────────────────────────────────────────────
    # FIX-20260810-06: pre-calentar la caché TTL del key_resolver en contexto
    # async (await nativo). El pipeline sync (extract_by_type →
    # _is_m3_unavailable / M3VisionBase._refresh_keys, y generate_prediagnosis
    # → _resolve_dr7_config) corre en el hilo del event loop y NO puede
    # awaitear; lee la caché vía `resolve_sync_cached`. Sin este warmup, la
    # caché estaría fría y el pipeline degradaría a env vars (M3 sin key en
    # env → fallback erróneo a Gemini → 500). Fallo suave: si el resolver
    # falla, el pipeline sync degrada a env (comportamiento legacy).
    from app.services.ai.keys import (
        is_ai_keys_from_db_enabled as _ai_keys_db_enabled,
        key_resolver as _key_resolver_singleton,
    )
    if _ai_keys_db_enabled():
        for _prov in ("m3", "gemini", "dr7"):
            try:
                await _key_resolver_singleton.resolve(_prov)
            except Exception:
                pass

    extractor, prediagnostic_svc = _build_services()
    if extractor is None or prediagnostic_svc is None:
        if os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
        raise HTTPException(
            status_code=503,
            detail="Servicios de IA no disponibles. Verifica GEMINI_API_KEY.",
        )

    try:
        # ARCH-20260518-03: extract_by_type requiere ai_calibration con
        # extraction.prompt configurado. Si falta, devuelve error explícito
        # que propagamos tal cual al cliente (400 con error_code conocido).
        # ARCH-20260809-02: selector multi-proveedor con override por payload.
        # FIX-20260810-05: ExtractionAuthError → 503 con error_code accionable
        # (M3_API_KEY_EXPIRED / GEMINI_API_KEY_EXPIRED) según el provider.
        # Antes era 400 opaco (`str(auth_err)`).
        extraction_start = time.time()
        try:
            extraction_result = extractor.extract_by_type(
                file_path=tmp_path,
                doc_type=canonical_study_type,
                ai_calibration=ai_calibration,
                extraction_provider_override=extraction_provider_override,
                extraction_model_override=extraction_model_override,
            )
        except ExtractionProviderUnknownError as prov_err:
            raise HTTPException(
                status_code=400,
                detail=str(prov_err),
            ) from prov_err
        except ExtractionAuthError as auth_err:
            # FIX-20260810-05: 503 accionable. NO exponer la key ni el stack
            # crudo (B-6 / SPEC §6 restricciones). `error_code` se deriva del
            # provider vía mapping estable (`_EXTRACTION_AUTH_ERROR_CODES`).
            from app.services.ai.extractor import _EXTRACTION_AUTH_ERROR_CODES
            error_code = _EXTRACTION_AUTH_ERROR_CODES.get(
                auth_err.provider, "EXTRACTION_AUTH_ERROR"
            )
            provider_label = (
                "Gemini" if auth_err.provider == "gemini" else "M3"
            )
            raise HTTPException(
                status_code=503,
                detail=(
                    f"{error_code}: {provider_label} key inválida o revocada. "
                    "Rota la key en /admin/ai-keys o cambia el proveedor de extracción."
                ),
            ) from auth_err
        except ValueError as ve:
            err_msg = str(ve)
            if "EXTRACTION_PROMPT_NOT_CONFIGURED" in err_msg:
                raise HTTPException(
                    status_code=400,
                    detail=err_msg,
                ) from ve
            raise
        extraction_seconds = round(time.time() - extraction_start, 2)

        # ARCH-20260809-02: trazabilidad extractiva del dispatcher.
        extraction_audit_dispatcher: Dict[str, Any] = (
            getattr(extractor, "last_extraction_audit", {}) or {}
        )

        extraction_dict = _serialize_extraction_result(extraction_result)

        # Prediagnóstico
        predx_start = time.time()
        prediagnosis_obj = prediagnostic_svc.generate_prediagnosis(
            study_type=canonical_study_type,
            extracted_data=extraction_dict,
            ai_calibration=ai_calibration,
        )
        predx_seconds = round(time.time() - predx_start, 2)

        prediagnosis_payload: Dict[str, Any] = (
            prediagnosis_obj.model_dump()
            if hasattr(prediagnosis_obj, "model_dump")
            else (
                prediagnosis_obj.dict()
                if hasattr(prediagnosis_obj, "dict")
                else {"value": str(prediagnosis_obj)}
            )
        )

        extraction_audit = {
            "model_name": _attr(extraction_result, "model_name", None) or "gemini",
            "prompt_version": (ai_calibration or {}).get("extraction", {}).get(
                "version", "calibration_custom"
            ),
            "duration_seconds": extraction_seconds,
        }
        predx_audit = {
            "model_name": _attr(prediagnosis_obj, "clinical_model_used", None)
            or _attr(prediagnosis_obj, "model_name", None)
            or "gemini",
            "prompt_version": _attr(prediagnosis_obj, "prompt_version", None)
            or (ai_calibration or {}).get("diagnosis", {}).get("version", "calibration_custom"),
            "duration_seconds": predx_seconds,
        }

        # ARCH-20260809-02: trazabilidad del proveedor extractivo resuelto.
        # Fallback robusto para clientes que aún no propaguen el audit del dispatcher.
        extraction_provider_used = extraction_audit_dispatcher.get(
            "extraction_provider_used"
        ) or "gemini"
        extraction_provider_requested = extraction_audit_dispatcher.get(
            "extraction_provider_requested"
        ) or (
            extraction_provider_override
            or (ai_calibration or {}).get("extraction", {}).get("provider")
            or "gemini"
        )
        extraction_fallback_reason = extraction_audit_dispatcher.get(
            "extraction_fallback_reason"
        )
        extraction_model_used_effective = extraction_audit_dispatcher.get(
            "extraction_model_used"
        ) or extraction_audit["model_name"]

        response_payload = {
            "success": True,
            "test_id": f"calibration_test_{test_id[:8]}",
            "canonical_study_type": canonical_study_type,
            "extraction": {
                "structured_data": extraction_dict,
                "raw_payload": extraction_dict,
                "model_used": extraction_model_used_effective,
                "prompt_version": extraction_audit["prompt_version"],
                "duration_seconds": extraction_seconds,
                # ARCH-20260809-02: trazabilidad extractiva multi-proveedor.
                "extraction_provider_used": extraction_provider_used,
                "extraction_provider_requested": extraction_provider_requested,
                "extraction_fallback_reason": extraction_fallback_reason,
            },
            "prediagnosis": {
                "result": prediagnosis_payload,
                "model_used": predx_audit["model_name"],
                "prompt_version": predx_audit["prompt_version"],
                "duration_seconds": predx_seconds,
            },
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        # FIX-20260810-08: persistencia defensiva del snapshot (PDF).
        snapshot_id = await _persist_calibration_snapshot(
            prisma=prisma,
            medical_test_id=test_id,
            study_type=canonical_study_type,
            source_file_name=file.filename,
            source_file_url=None,
            structured_data={
                "extraction": response_payload["extraction"],
                "prediagnosis": response_payload["prediagnosis"],
            },
            model_name=extraction_audit["model_name"],
            prompt_version=extraction_audit["prompt_version"],
        )
        response_payload["snapshot_id"] = snapshot_id

        # Cache en memoria para que GET /test/{id}/results pueda responder
        # aunque el frontend pierda la respuesta del POST.
        _TEST_RESULTS_CACHE[response_payload["test_id"]] = response_payload

        return response_payload

    except HTTPException:
        raise
    except Exception as e:
        # IMPL-20260715-04: nunca exponer secretos ni stack crudo.
        print(f"❌ [IMPL-20260715-04] Error en upload_calibration_test: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error procesando PDF de prueba: {type(e).__name__}",
        )
    finally:
        # ── Limpieza del archivo temporal (CRÍTICO) ────────────────────────
        if os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception as cleanup_err:
                print(f"⚠️ [IMPL-20260715-04] No se pudo eliminar temporal {tmp_path}: {cleanup_err}")


# ---------------------------------------------------------------------------
# GET /api/v1/calibration/test/{test_id}/results
# ---------------------------------------------------------------------------
@router.get("/test/{test_id}/results")
async def get_calibration_test_results(test_id: str):
    """
    Retorna los resultados cacheados en memoria del último upload con ese
    test_id (formato `calibration_test_<8 chars>`). En V1 no hay
    persistencia: si el proceso se reinicia o el ID no está en cache, 404.

    Reservado para futura persistencia (Redis/DB) sin romper contrato.
    """
    cached = _TEST_RESULTS_CACHE.get(test_id)
    if cached is None:
        raise HTTPException(
            status_code=404,
            detail=f"Sin resultados cacheados para test_id={test_id}. "
            "Vuelve a subir el PDF para regenerar.",
        )
    return cached


# ---------------------------------------------------------------------------
# GET /api/v1/calibration/snapshots?test_id=<medical_test_id>
# FIX-20260810-08: Lista snapshots persistidos de una MedicalTest para que
# la tab Presentación pueda renderizarlos. Orden: más reciente primero.
# ---------------------------------------------------------------------------
@router.get("/snapshots")
async def list_calibration_snapshots(test_id: str):
    """
    Lista los CalibrationSnapshot persistidos para una MedicalTest.

    Args:
      test_id: ID de MedicalTest (string UUID).

    Returns:
      { "snapshots": [<calibration_snapshot>, ...] }

    Errores:
      - 400: falta test_id
      - 503: Prisma no inicializado
      - 500: error de BD
    """
    if not test_id or not test_id.strip():
        raise HTTPException(status_code=400, detail="test_id es obligatorio")

    prisma = get_prisma_client()
    if prisma is None:
        raise HTTPException(
            status_code=503,
            detail="Prisma no inicializado. Reintenta en unos segundos.",
        )

    try:
        rows = await prisma.calibrationsnapshot.find_many(
            where={"medicalTestId": test_id},
            order={"createdAt": "desc"},
        )
    except Exception as e:
        print(f"❌ [FIX-20260810-08] Error listando snapshots: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error consultando CalibrationSnapshot: {type(e).__name__}",
        )

    return {"snapshots": [_serialize_calibration_snapshot(r) for r in rows]}