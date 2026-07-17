"""
IMPL-20260715-04 — Upload de PDFs de prueba en módulo de Calibración.

SPEC: context/SPECs/SPEC_ARCH-20260715-04-UPLOAD-PDFS-CALIBRACION.md

Rutas REST:
  - POST /api/v1/calibration/upload
  - GET  /api/v1/calibration/test/{test_id}/results

Propósito: permitir subir un PDF de prueba desde el módulo de calibración,
procesarlo con el pipeline de extracción/prediagnóstico y retornar los
resultados SIN crear EventTest real ni persistir en DB.

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
    """Crea instancias de los servicios IA reusando env vars (mismo patrón que main.py)."""
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    extraction_model = os.getenv("GEMINI_MODEL_EXTRACTION") or os.getenv("GEMINI_MODEL") or "gemini-2.5-flash"
    clinical_model = os.getenv("GEMINI_MODEL_CLINICAL") or os.getenv("GEMINI_MODEL") or "gemini-2.5-flash"
    try:
        extractor = ExtractorService(api_key=gemini_api_key, model=extraction_model)
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


# ---------------------------------------------------------------------------
# POST /api/v1/calibration/upload
# ---------------------------------------------------------------------------
@router.post("/upload")
async def upload_calibration_test(
    file: UploadFile = File(...),
    test_id: str = Form(...),
    test_type: str = Form(...),
):
    """
    Sube y procesa un archivo de prueba (PDF o XML) para calibración.

    ARCH-20260715-06: Soporte para XML de audiómetro DD65 V2.
    Si el archivo es XML, se usa parser directo sin IA.
    Si es PDF, se usa el pipeline de extracción con IA.

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
        extraction_start = time.time()
        try:
            extraction_result = extractor.extract_by_type(
                file_path=tmp_path,
                doc_type=canonical_study_type,
                ai_calibration=ai_calibration,
            )
        except ValueError as ve:
            err_msg = str(ve)
            if "EXTRACTION_PROMPT_NOT_CONFIGURED" in err_msg:
                raise HTTPException(
                    status_code=400,
                    detail=err_msg,
                ) from ve
            raise
        extraction_seconds = round(time.time() - extraction_start, 2)

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

        response_payload = {
            "success": True,
            "test_id": f"calibration_test_{test_id[:8]}",
            "canonical_study_type": canonical_study_type,
            "extraction": {
                "structured_data": extraction_dict,
                "raw_payload": extraction_dict,
                "model_used": extraction_audit["model_name"],
                "prompt_version": extraction_audit["prompt_version"],
                "duration_seconds": extraction_seconds,
            },
            "prediagnosis": {
                "result": prediagnosis_payload,
                "model_used": predx_audit["model_name"],
                "prompt_version": predx_audit["prompt_version"],
                "duration_seconds": predx_seconds,
            },
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

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