"""
ARCH-20260820-01 Fase 1 — Tests del CalibrationResolver.

Cubre:
  - AC-1.1: V1/V2 → V3 sintética sin escribir en DB.
  - AC-1.2: MedicalTest sin aiCalibration + operationMode inferido manual_service
    ⇒ resolver devuelve None.
  - AC-1.3: GET /api/v1/calibration/resolve retorna JSON V3 resuelto con
    operationMode efectivo; no expone secretos.
  - AC-1.4: 4 ramas de inferencia de operationMode (SPEC §11.3) — NUNCA
    Audiometria por defecto (DEC-20260820-02, anti-patrón H3).
  - AC-1.5: clinicalCriteria=null para document_extraction.
  - CA-G01: existe `calibration_resolver.py` con `resolve()`.
  - CA-G02: el endpoint `/resolve` retorna V3 resuelta sin secretos.
  - CA-G19: el adaptador infiere operationMode según §11.3 sin asumir nunca
    Audiometria; tests cubren las 4 ramas.
  - CA-G20: el resolver devuelve clinicalCriteria=null para document_extraction
    y completo para clinical_interpretation; None para manual_service.

Casos borde cubiertos:
  - CB-01: MedicalTest sin options.aiCalibration.
  - CB-02: aiCalibration.enabled=false ⇒ versión devuelta con enabled=false.
  - CB-11: JSON corrupto ⇒ None + log de error (no crash).
  - CB-13: operationMode=manual_service ⇒ None.
  - CB-14: operationMode=document_extraction ⇒ clinicalCriteria=null.
  - CB-15: sin operationMode ni calibración inferible ⇒ manual_service + requires_review.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Dict, Optional

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def _row(test_id: str, options: Any, *, name: Optional[str] = None, category: Optional[str] = None) -> Dict[str, Any]:
    """Construye un mock de MedicalTest (dict) para el resolver."""
    row: Dict[str, Any] = {"id": test_id, "options": options}
    if name is not None:
        row["name"] = name
    if category is not None:
        row["category"] = category
    return row


@pytest.fixture
def resolver():
    """Resolver fresco con cache limpia por test."""
    from app.services.ai.calibration_resolver import CalibrationResolver

    r = CalibrationResolver(cache_ttl_seconds=0.0)  # cache effectively off
    yield r
    r.clear_cache()


# ─────────────────────────────────────────────────────────────────────────────
# AC-1.1 + adaptación V1/V2 → V3
# ─────────────────────────────────────────────────────────────────────────────


class TestV1V2ToV3Adapter:
    """AC-1.1: el resolver devuelve V3 sintética para MedicalTest con
    calibración V1/V2 existente, sin escribir en DB."""

    def test_v1_calibration_returns_synthetic_v3(self, resolver):
        """V1 (sin fieldDefinitions, sin schemaVersion) → V3 sintética."""
        raw = {
            "canonicalStudyType": "Audiometria",
            "enabled": True,
            "extraction": {"prompt": "extrae umbrales", "version": "extract-v1"},
            "diagnosis": {"prompt": "interpreta umbrales"},
            "presentation": {"schema": {"sections": []}},
        }
        row = _row("t-v1", {"aiCalibration": raw})

        resolved = resolver.resolve(row, "published")
        assert resolved is not None, "V1 debe producir V3 sintética"
        assert resolved.schemaVersion == "V3"
        assert resolved.status == "published"
        assert resolved.operationMode == "clinical_interpretation"
        assert resolved.canonicalStudyType == "Audiometria"
        assert resolved.versionId is None  # V1/V2 no tienen versionId V3
        assert resolved.versionNumber is None
        assert resolved.extraction == {"prompt": "extrae umbrales", "version": "extract-v1"}
        # clinicalCriteria sintetizado desde defaults de prediagnostic.py.
        assert resolved.clinicalCriteria is not None
        assert resolved.clinicalCriteria["prediagnosisEnabled"] is True
        assert "oido_derecho" in resolved.clinicalCriteria["requiredParams"]
        from app.services.ai.prediagnostic import CONFIDENCE_THRESHOLDS
        assert resolved.clinicalCriteria["confidenceThreshold"] == CONFIDENCE_THRESHOLDS["Audiometria"]

    def test_v2_calibration_returns_synthetic_v3(self, resolver):
        """V2 (con fieldDefinitions, sin schemaVersion) → V3 sintética."""
        raw = {
            "canonicalStudyType": "Audiometria",
            "enabled": True,
            "extraction": {"prompt": "extrae umbrales", "version": "extract-v2"},
            "fieldDefinitions": [
                {"key": "oido_derecho", "label": "Oído Derecho", "type": "object",
                 "aliases": ["od"], "required": True},
            ],
            "presentation": {"schema": {"sections": []}},
        }
        row = _row("t-v2", {"aiCalibration": raw})

        resolved = resolver.resolve(row, "published")
        assert resolved is not None
        assert resolved.schemaVersion == "V3"
        assert resolved.operationMode == "clinical_interpretation"
        assert isinstance(resolved.fieldDefinitions, list)
        assert len(resolved.fieldDefinitions) == 1
        assert resolved.fieldDefinitions[0]["key"] == "oido_derecho"

    def test_v1v2_adapter_does_not_persist(self, resolver, monkeypatch):
        """El adaptador NO escribe en DB (sólo lectura)."""
        # Verificar que no se invoca ningún método de escritura en Prisma
        # durante la resolución. Si el resolver intentara escribir, monkeypatch
        # detectaría la llamada.
        from app.services import prisma_client as _prisma_mod

        class _ForbiddenWriter:
            def __getattr__(self, name):
                if name.startswith(("create", "upsert", "update", "delete")):
                    raise AssertionError(
                        f"CalibrationResolver intentó llamar a prisma.{name}() "
                        f"(debe ser sólo lectura)."
                    )
                return _AsyncForbidden()

        class _AsyncForbidden:
            async def __call__(self, *args, **kwargs):
                raise AssertionError("Llamada async no permitida en el resolver")

        monkeypatch.setattr(_prisma_mod, "get_prisma_client", lambda: _ForbiddenWriter())

        raw = {"canonicalStudyType": "Audiometria", "extraction": {"prompt": "p"}}
        row = _row("t-nopush", {"aiCalibration": raw})
        # Si el resolver escribe, la fixture monkeypatch reventará arriba.
        resolved = resolver.resolve(row, "published")
        assert resolved is not None


# ─────────────────────────────────────────────────────────────────────────────
# AC-1.2 + manuales / no-inferible
# ─────────────────────────────────────────────────────────────────────────────


class TestManualServiceReturnsNone:
    """AC-1.2: resolver devuelve None para manual_service / no-inferible."""

    def test_explicit_manual_service_returns_none(self, resolver):
        """DEC-20260820-02: manual_service explícito ⇒ None, no habilita IA."""
        row = _row("t-manual", {"operationMode": "manual_service"})
        assert resolver.resolve(row, "published") is None

    def test_manual_service_with_ai_calibration_returns_none(self, resolver):
        """Aunque tenga aiCalibration, manual_service ⇒ None (CB-13)."""
        row = _row("t-manual-ai", {
            "operationMode": "manual_service",
            "aiCalibration": {"canonicalStudyType": "Audiometria", "extraction": {"prompt": "p"}},
        })
        assert resolver.resolve(row, "published") is None

    def test_inferred_manual_service_no_calibration_returns_none(self, resolver):
        """Sin aiCalibration + manual_service inferido ⇒ None (AC-1.2)."""
        row = _row("t-no-cal", {"operationMode": "manual_service"})
        assert resolver.resolve(row, "published") is None

    def test_no_calibration_no_inference_returns_none(self, resolver):
        """Sin aiCalibration ni operationMode ni categoría inferible
        ⇒ None (CB-15 / DEC-20260820-02)."""
        row = _row("t-orphan", {"options": "{}"}, name="Examen Sensoriomotor")
        assert resolver.resolve(row, "published") is None

    def test_inferred_manual_service_via_name_no_ai_calibration(self, resolver):
        """Sin aiCalibration + nombre sugiere servicio manual
        ⇒ resolver None (rama 3 de §11.3)."""
        # Sin aiCalibration, sólo el nombre indica manual service.
        row = _row(
            "t-ambulancia",
            {},
            name="Servicio de Ambulancia",
        )
        assert resolver.resolve(row, "published") is None

    def test_v1v2_with_extraction_no_clinical_type_is_docex(self, resolver):
        """V1/V2 con extracción sin tipo clínico ⇒ document_extraction
        (rama 2), aunque el nombre suene clínico. NO cae a manual_service."""
        raw = {"extraction": {"prompt": "extrae"}}
        row = _row(
            "t-v1v2-manualname",
            {"aiCalibration": raw},
            name="Consulta médica",
        )
        # Rama 2 wins (aiCalibration con extraction sin tipo clínico).
        resolved = resolver.resolve(row, "published")
        assert resolved is not None
        assert resolved.operationMode == "document_extraction"

    def test_v1v2_no_classification_returns_none(self, resolver):
        """V1/V2 sin canonicalStudyType y sin tokens manuales
        ⇒ operationMode=document_extraction (rama 2) ⇒ resolver devuelve
        versión con extraction pero sin prediagnóstico."""
        raw = {"extraction": {"prompt": "extrae algo"}, "fieldDefinitions": []}
        row = _row("t-flaco", {"aiCalibration": raw})  # sin name, sin category
        resolved = resolver.resolve(row, "published")
        # Espera: document_extraction (rama 2 del §11.3 — extracción sin tipo clínico)
        assert resolved is not None
        assert resolved.operationMode == "document_extraction"


# ─────────────────────────────────────────────────────────────────────────────
# AC-1.4 + 4 ramas de inferencia §11.3 (CA-G19)
# ─────────────────────────────────────────────────────────────────────────────


class TestOperationModeInferenceBranches:
    """CA-G19: 4 ramas de inferencia de §11.3 — NUNCA Audiometria por defecto."""

    def test_branch_1_clinical_with_canonical_study_type(self, resolver):
        """Rama 1: aiCalibration con canonicalStudyType clínico +
        PREDIAGNOSIS_SUPPORTED_TYPES ⇒ clinical_interpretation."""
        from app.services.ai.calibration_resolver import _infer_operation_mode_from_v1v2

        for study_type in ("Audiometria", "Espirometria", "Electrocardiograma", "ExamenMedico"):
            mode, review = _infer_operation_mode_from_v1v2({
                "canonicalStudyType": study_type,
                "extraction": {"prompt": "p"},
            })
            assert mode == "clinical_interpretation", f"{study_type} debería ser clínica"
            assert review is False

    def test_branch_2_extraction_without_clinical_type(self, resolver):
        """Rama 2: aiCalibration con extracción pero sin tipo clínico
        ⇒ document_extraction."""
        from app.services.ai.calibration_resolver import _infer_operation_mode_from_v1v2

        mode, review = _infer_operation_mode_from_v1v2({
            "extraction": {"prompt": "p"},
            "fieldDefinitions": [{"key": "k", "label": "L", "type": "string"}],
        })
        assert mode == "document_extraction"
        assert review is False

    def test_branch_3_manual_safe_via_name(self, resolver):
        """Rama 3: sin aiCalibration + categoría/nombre manual seguro
        ⇒ manual_service."""
        from app.services.ai.calibration_resolver import _infer_operation_mode_from_v1v2

        for name in (
            "Servicio de Ambulancia",
            "Traslado de paciente",
            "Atención médica general",
            "Consulta simple",
            "Aplicación de vacuna",
            "Curación menor",
            "Sutura de herida",
            "Lavado ótico",
            "Inyección intramuscular",
            "Urgencias menores",
        ):
            mode, review = _infer_operation_mode_from_v1v2(None, test_name=name)
            assert mode == "manual_service", f"{name!r} debería ser manual_service"
            assert review is False, f"{name!r} no debería requerir revisión"

    def test_branch_4_no_inference_safe_default(self, resolver):
        """Rama 4: sin aiCalibration + sin tokens manuales ⇒ manual_service
        + requires_review=true. NUNCA Audiometria/clinical_interpretation."""
        from app.services.ai.calibration_resolver import _infer_operation_mode_from_v1v2

        # Nombres ambiguos que no caen en manual seguro
        for name in ("Radiografia de Torax", "Prueba de Esfuerzo", "Analisis XYZ"):
            mode, review = _infer_operation_mode_from_v1v2(None, test_name=name)
            assert mode == "manual_service", f"{name!r} debería ser manual_service"
            assert review is True, f"{name!r} debería requerir revisión"

    def test_branch_4_never_defaults_to_clinical_interpretation(self, resolver):
        """REGLA ANTI-H3: incluso un nombre que SUENE clínico (ej. 'Audiometria
        Ocupacional') sin aiCalibration debe caer a manual_service +
        requires_review, NUNCA a clinical_interpretation ni Audiometria
        por defecto."""
        from app.services.ai.calibration_resolver import _infer_operation_mode_from_v1v2

        mode, review = _infer_operation_mode_from_v1v2(
            None, test_name="Audiometria Ocupacional"
        )
        assert mode == "manual_service", (
            "Anti-H3: sin aiCalibration, NUNCA clinical_interpretation "
            "incluso si el nombre sugiere Audiometria"
        )
        assert review is True

    def test_no_calibration_never_returns_audiometria(self, resolver):
        """AC-1.4: prueba sin calibración NUNCA cae a Audiometria
        (DEC-20260820-02)."""
        # Sin aiCalibration, sin nombre, sin category.
        row = _row("t-x", {})
        # Simular el flujo del resolver: sin datos no debe inferir Audiometria.
        from app.services.ai.calibration_resolver import _infer_operation_mode_from_v1v2

        mode, review = _infer_operation_mode_from_v1v2(None)
        assert mode != "clinical_interpretation"
        assert mode == "manual_service"
        assert review is True


# ─────────────────────────────────────────────────────────────────────────────
# AC-1.5 + CA-G20: clinicalCriteria por modo
# ─────────────────────────────────────────────────────────────────────────────


class TestClinicalCriteriaByOperationMode:
    """CA-G20: clinicalCriteria=null para document_extraction, completo
    para clinical_interpretation, None para manual_service."""

    def test_document_extraction_returns_null_clinical_criteria(self, resolver):
        """AC-1.5 / CA-G20: resolver devuelve clinicalCriteria=null
        para operationMode=document_extraction."""
        row = _row("t-docex", {
            "operationMode": "document_extraction",
            "aiCalibration": {
                "extraction": {"prompt": "extrae campos tabulares"},
                "fieldDefinitions": [{"key": "hemoglobina", "label": "Hb", "type": "number"}],
            },
        })
        resolved = resolver.resolve(row, "published")
        assert resolved is not None
        assert resolved.operationMode == "document_extraction"
        assert resolved.clinicalCriteria is None, (
            "document_extraction debe devolver clinicalCriteria=null"
        )

    def test_clinical_interpretation_returns_full_clinical_criteria(self, resolver):
        """CA-G20: resolver devuelve clinicalCriteria completo para
        clinical_interpretation."""
        row = _row("t-cli", {
            "operationMode": "clinical_interpretation",
            "aiCalibration": {
                "canonicalStudyType": "Audiometria",
                "extraction": {"prompt": "p"},
            },
        })
        resolved = resolver.resolve(row, "published")
        assert resolved is not None
        assert resolved.operationMode == "clinical_interpretation"
        assert resolved.clinicalCriteria is not None
        assert resolved.clinicalCriteria["prediagnosisEnabled"] is True
        assert "oido_derecho" in resolved.clinicalCriteria["requiredParams"]

    def test_manual_service_returns_none(self, resolver):
        """CA-G20: manual_service ⇒ resolver None (no hay version que
        incluya clinicalCriteria)."""
        row = _row("t-man", {"operationMode": "manual_service"})
        assert resolver.resolve(row, "published") is None

    def test_v1v2_adapter_document_extraction_clinical_criteria_null(self, resolver):
        """V1/V2 con extracción sin tipo clínico ⇒ document_extraction
        ⇒ clinicalCriteria=null."""
        raw = {
            "extraction": {"prompt": "extrae labs"},
            "fieldDefinitions": [{"key": "k", "label": "L", "type": "number"}],
        }
        row = _row("t-v1v2-docex", {"aiCalibration": raw})
        resolved = resolver.resolve(row, "published")
        assert resolved is not None
        assert resolved.operationMode == "document_extraction"
        assert resolved.clinicalCriteria is None


# ─────────────────────────────────────────────────────────────────────────────
# CB-02: enabled=false
# ─────────────────────────────────────────────────────────────────────────────


class TestEnabledFlag:
    """CB-02: MedicalTest con aiCalibration.enabled=false ⇒ versión
    resuelta con enabled=false."""

    def test_v1_enabled_false_returns_version_with_enabled_false(self, resolver):
        raw = {
            "canonicalStudyType": "Audiometria",
            "enabled": False,
            "extraction": {"prompt": "p"},
        }
        row = _row("t-disabled", {"aiCalibration": raw})
        resolved = resolver.resolve(row, "published")
        assert resolved is not None
        assert resolved.enabled is False
        assert resolved.status == "disabled"

    def test_v2_enabled_false_returns_version_with_enabled_false(self, resolver):
        raw = {
            "canonicalStudyType": "Audiometria",
            "enabled": False,
            "extraction": {"prompt": "p"},
            "fieldDefinitions": [],
        }
        row = _row("t-disabled-v2", {"aiCalibration": raw})
        resolved = resolver.resolve(row, "published")
        assert resolved is not None
        assert resolved.enabled is False


# ─────────────────────────────────────────────────────────────────────────────
# CB-11: JSON corrupto
# ─────────────────────────────────────────────────────────────────────────────


class TestCorruptedJson:
    """CB-11: JSON corrupto ⇒ None + no crash."""

    def test_corrupted_options_json_returns_none(self, resolver):
        """options como string no-JSON ⇒ None."""
        row = _row("t-corrupt", '{"not valid json,,,')
        assert resolver.resolve(row, "published") is None

    def test_corrupted_ai_calibration_dict_returns_none(self, resolver):
        """aiCalibration presente pero no es dict (ej. string) ⇒ None + log."""
        row = _row("t-ai-string", {"aiCalibration": "not a dict"})
        # ai_calibration no es dict ⇒ resolver lo trata como ausente (None).
        assert resolver.resolve(row, "published") is None

    def test_options_as_list_returns_none(self, resolver):
        """options como list (no dict) ⇒ resolver trata como vacío."""
        row = _row("t-list", [])
        # _parse_options([]) no es dict, devuelve {}.
        resolved = resolver.resolve(row, "published")
        # Sin operationMode, sin aiCalibration: cae a inferencia conservadora.
        # Como tampoco hay name, manual_service+requires_review ⇒ None.
        assert resolved is None


# ─────────────────────────────────────────────────────────────────────────────
# V3 con esquema actual
# ─────────────────────────────────────────────────────────────────────────────


class TestV3Schema:
    """Verifica el camino V3 puro (operationMode + aiCalibration V3)."""

    def test_v3_with_clinical_interpretation(self, resolver):
        ai_cal = {
            "schemaVersion": "V3",
            "operationMode": "clinical_interpretation",
            "currentPublishedVersionId": "v-001",
            "publishedVersions": [
                {
                    "versionId": "v-001",
                    "versionNumber": 1,
                    "status": "published",
                    "enabled": True,
                    "canonicalStudyType": "Audiometria",
                    "extraction": {"prompt": "p"},
                    "fieldDefinitions": [],
                    "clinicalCriteria": {
                        "prediagnosisEnabled": True,
                        "requiredParams": ["oido_derecho", "oido_izquierdo"],
                        "confidenceThreshold": 0.55,
                        "prompt": "prompt personalizado",
                    },
                    "presentation": {"schema": {}},
                }
            ],
        }
        row = _row("t-v3", {"operationMode": "clinical_interpretation", "aiCalibration": ai_cal})
        resolved = resolver.resolve(row, "published")
        assert resolved is not None
        assert resolved.operationMode == "clinical_interpretation"
        assert resolved.clinicalCriteria["prompt"] == "prompt personalizado"
        assert resolved.versionId == "v-001"

    def test_v3_document_extraction_clinical_criteria_forced_to_null(self, resolver):
        """Aunque V3 tenga clinicalCriteria, si operationMode es
        document_extraction ⇒ resolver fuerza clinicalCriteria=null."""
        ai_cal = {
            "schemaVersion": "V3",
            "operationMode": "document_extraction",
            "currentPublishedVersionId": "v-001",
            "publishedVersions": [
                {
                    "versionId": "v-001",
                    "versionNumber": 1,
                    "status": "published",
                    "enabled": True,
                    "canonicalStudyType": None,
                    "extraction": {"prompt": "p"},
                    "clinicalCriteria": {
                        "prediagnosisEnabled": True,
                        "requiredParams": ["x"],
                    },
                }
            ],
        }
        row = _row("t-v3-docex", {"operationMode": "document_extraction", "aiCalibration": ai_cal})
        resolved = resolver.resolve(row, "published")
        assert resolved is not None
        assert resolved.operationMode == "document_extraction"
        assert resolved.clinicalCriteria is None, (
            "document_extraction fuerza clinicalCriteria=null por contrato"
        )

    def test_v3_without_current_published_version_id(self, resolver):
        """V3 sin currentPublishedVersionId ⇒ resolver selecciona la primera
        versión published/disabled."""
        ai_cal = {
            "schemaVersion": "V3",
            "operationMode": "document_extraction",
            "publishedVersions": [
                {
                    "versionId": "v-x",
                    "versionNumber": 1,
                    "status": "disabled",
                    "enabled": False,
                    "extraction": {"prompt": "p"},
                }
            ],
        }
        row = _row("t-v3-disabled", {"operationMode": "document_extraction", "aiCalibration": ai_cal})
        resolved = resolver.resolve(row, "published")
        assert resolved is not None
        assert resolved.enabled is False
        assert resolved.status == "disabled"

    def test_v3_no_published_versions_returns_none(self, resolver):
        """V3 sin versiones publicadas ⇒ None."""
        ai_cal = {
            "schemaVersion": "V3",
            "operationMode": "document_extraction",
            "publishedVersions": [],
        }
        row = _row("t-v3-empty", {"operationMode": "document_extraction", "aiCalibration": ai_cal})
        assert resolver.resolve(row, "published") is None


# ─────────────────────────────────────────────────────────────────────────────
# Cache TTL
# ─────────────────────────────────────────────────────────────────────────────


class TestCacheTTL:
    def test_cache_does_not_leak_across_resolvers(self):
        """Cada resolver tiene su propia cache (independencia)."""
        from app.services.ai.calibration_resolver import CalibrationResolver

        r1 = CalibrationResolver()
        r2 = CalibrationResolver()
        r1.clear_cache()
        r2.clear_cache()
        raw = {"canonicalStudyType": "Audiometria", "extraction": {"prompt": "p"}}
        r1.resolve(_row("t-c", {"aiCalibration": raw}), "published")
        # r2 no debe ver la cache de r1.
        assert r2._cache == {}, "r2 no debe heredar cache de r1"

    def test_cache_ttl_zero_returns_stale_everytime(self):
        """TTL=0 ⇒ las entradas se invalidan en cada lectura."""
        from app.services.ai.calibration_resolver import CalibrationResolver

        r = CalibrationResolver(cache_ttl_seconds=0.0)
        raw = {"canonicalStudyType": "Audiometria", "extraction": {"prompt": "p"}}
        r.resolve(_row("t-c", {"aiCalibration": raw}), "published")
        # TTL=0 ⇒ el siguiente _cache_get debe retornar None (entrada vencida).
        assert r._cache_get("v1v2:published:t-c") is None, (
            "TTL=0 debe invalidar la entrada en cada lectura"
        )


# ─────────────────────────────────────────────────────────────────────────────
# FamilyTemplateRegistry (stub Fase 1)
# ─────────────────────────────────────────────────────────────────────────────


class TestFamilyTemplateRegistry:
    def test_registry_empty_by_default(self):
        from app.services.ai.calibration_resolver import (
            FamilyTemplateRegistry,
            get_family_template_registry,
        )

        reg = get_family_template_registry()
        assert reg.get("cualquier-id") is None

    def test_registry_register_and_get(self):
        from app.services.ai.calibration_resolver import FamilyTemplateRegistry

        reg = FamilyTemplateRegistry()
        reg.register("lab-hema", {"defaults": {"extraction": {"prompt": "p"}}})
        assert reg.get("lab-hema") == {"defaults": {"extraction": {"prompt": "p"}}}
        assert reg.get("no-existe") is None

    def test_registry_merge_no_op_when_empty(self, resolver):
        """Con registry vacío, resolver devuelve version tal cual sin
        inventar defaults."""
        ai_cal = {
            "schemaVersion": "V3",
            "operationMode": "document_extraction",
            "familyTemplateId": "lab-hema-no-existe",
            "overrides": {"extraction": {"prompt": "override"}},
            "publishedVersions": [
                {
                    "versionId": "v-001",
                    "versionNumber": 1,
                    "status": "published",
                    "enabled": True,
                    "extraction": {"prompt": "base"},
                }
            ],
        }
        row = _row("t-family", {"operationMode": "document_extraction", "aiCalibration": ai_cal})
        resolved = resolver.resolve(row, "published")
        assert resolved is not None
        # Sin registry, el resolver no inventa defaults pero aplica overrides.
        assert resolved.extraction == {"prompt": "override"}
        # familyTemplateId se preserva (es el contrato, no el catálogo).
        assert resolved.familyTemplateId == "lab-hema-no-existe"


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint /resolve (AC-1.3, CA-G02)
# ─────────────────────────────────────────────────────────────────────────────


class TestResolveEndpoint:
    """AC-1.3 / CA-G02: endpoint GET /resolve retorna V3 resuelta sin secretos."""

    def _build_app(self, fake_prisma):
        from fastapi import FastAPI
        from app.api.v1.calibration import router
        from app.services import prisma_client as prisma_client_module

        app = FastAPI()
        app.include_router(router)
        prisma_client_module.set_prisma_client(fake_prisma)
        return app

    def _patch_build_services(self, monkeypatch):
        """No se llama a /upload en estos tests, pero en caso de reuso
        silencioso, devolvemos servicios dummy."""
        from app.api.v1 import calibration as cal_mod

        def _fake_builder():
            return None, None

        monkeypatch.setattr(cal_mod, "_build_services", _fake_builder)

    def test_endpoint_returns_v3_with_operation_mode(self, monkeypatch):
        from fastapi.testclient import TestClient

        class _FakePrisma:
            class _MedicaltestModel:
                async def find_unique(self_inner, where):  # noqa: N805
                    return {
                        "id": where["id"],
                        "options": {
                            "operationMode": "document_extraction",
                            "aiCalibration": {
                                "extraction": {"prompt": "p"},
                                "fieldDefinitions": [],
                            },
                        },
                        "name": "Lab",
                        "category": None,
                    }

            medicaltest = _MedicaltestModel()

        app = self._build_app(_FakePrisma())
        self._patch_build_services(monkeypatch)
        client = TestClient(app)
        response = client.get(
            "/api/v1/calibration/resolve"
            "?test_id=test-001&state=published"
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["test_id"] == "test-001"
        assert body["state"] == "published"
        assert body["version"] is not None
        assert body["version"]["operationMode"] == "document_extraction"
        assert body["version"]["clinicalCriteria"] is None
        # No exponer secretos — V3 no debería contener API keys.
        body_text = json.dumps(body).lower()
        assert "api_key" not in body_text
        assert "apikey" not in body_text
        assert "dr7_api_key" not in body_text

    def test_endpoint_returns_null_for_manual_service(self, monkeypatch):
        from fastapi.testclient import TestClient

        class _FakePrisma:
            class _MedicaltestModel:
                async def find_unique(self_inner, where):  # noqa: N805
                    return {
                        "id": where["id"],
                        "options": {"operationMode": "manual_service"},
                        "name": "Ambulancia",
                        "category": None,
                    }

            medicaltest = _MedicaltestModel()

        app = self._build_app(_FakePrisma())
        self._patch_build_services(monkeypatch)
        client = TestClient(app)
        response = client.get(
            "/api/v1/calibration/resolve"
            "?test_id=test-manual&state=published"
        )
        assert response.status_code == 200
        body = response.json()
        assert body["version"] is None

    def test_endpoint_returns_404_for_missing_test(self, monkeypatch):
        from fastapi.testclient import TestClient

        class _FakePrisma:
            class _MedicaltestModel:
                async def find_unique(self_inner, where):  # noqa: N805
                    return None

            medicaltest = _MedicaltestModel()

        app = self._build_app(_FakePrisma())
        self._patch_build_services(monkeypatch)
        client = TestClient(app)
        response = client.get(
            "/api/v1/calibration/resolve"
            "?test_id=does-not-exist&state=published"
        )
        assert response.status_code == 404

    def test_endpoint_validates_state(self, monkeypatch):
        from fastapi.testclient import TestClient

        class _FakePrisma:
            class _MedicaltestModel:
                async def find_unique(self_inner, where):  # noqa: N805
                    return None

            medicaltest = _MedicaltestModel()

        app = self._build_app(_FakePrisma())
        self._patch_build_services(monkeypatch)
        client = TestClient(app)
        response = client.get(
            "/api/v1/calibration/resolve?test_id=test-001&state=invalid"
        )
        assert response.status_code == 400, response.text

    def test_endpoint_requires_test_id(self, monkeypatch):
        from fastapi.testclient import TestClient

        class _FakePrisma:
            class _MedicaltestModel:
                async def find_unique(self_inner, where):  # noqa: N805
                    return None

            medicaltest = _MedicaltestModel()

        app = self._build_app(_FakePrisma())
        self._patch_build_services(monkeypatch)
        client = TestClient(app)
        response = client.get("/api/v1/calibration/resolve")
        assert response.status_code == 422  # FastAPI valida query params


# ─────────────────────────────────────────────────────────────────────────────
# Disclosure: no exponer secretos
# ─────────────────────────────────────────────────────────────────────────────


class TestNoSecretsExposed:
    """AC-1.3 / SPEC §17.1: el resolver no expone secretos.

    El resolver NO inyecta secretos en el resultado. La responsabilidad
    de NO guardar secretos dentro del contrato `aiCalibration` es del
    editor (Fase 2+); el contrato V3 por diseño (ADR §2.9) no incluye
    campos de credenciales. El resolver pasa a través de `extraction.*`
    y `clinicalCriteria.*` tal cual porque la fuente de verdad es la
    calibración persistida."""

    def test_resolver_does_not_inject_secrets(self, resolver):
        """El resolver NO agrega apiKey/apiKeys/dbKeys desde su propio
        estado. La fuente es el contrato persistido, no el resolver."""
        raw = {
            "canonicalStudyType": "Audiometria",
            "extraction": {"prompt": "p"},
        }
        row = _row("t-secrets", {"aiCalibration": raw})
        resolved = resolver.resolve(row, "published")
        assert resolved is not None
        d = resolved.to_dict()
        # El resolver no debe exponer credenciales del proceso.
        assert "apiKey" not in d
        assert "apiKeys" not in d
        assert "processCredentials" not in d
        # Y la respuesta serializada del endpoint tampoco.
        payload = json.dumps(d).lower()
        assert "dr7_api_key" not in payload
        assert "m3_api_key" not in payload
        assert "gemini_api_key" not in payload

    def test_endpoint_does_not_expose_request_secrets(self, monkeypatch):
        """El endpoint debe sanitizar headers sensibles si los hubiera
        y nunca responder con credenciales del proceso."""
        from fastapi.testclient import TestClient

        class _FakePrisma:
            class _MedicaltestModel:
                async def find_unique(self_inner, where):  # noqa: N805
                    return {
                        "id": where["id"],
                        "options": {
                            "operationMode": "document_extraction",
                            "aiCalibration": {"extraction": {"prompt": "p"}},
                        },
                    }

            medicaltest = _MedicaltestModel()

        from app.api.v1 import calibration as cal_mod
        from app.services import prisma_client as prisma_client_module

        def _noop_builder():
            return None, None

        monkeypatch.setattr(cal_mod, "_build_services", _noop_builder)

        app = cal_mod if False else None  # placeholder
        from fastapi import FastAPI
        app = FastAPI()
        app.include_router(cal_mod.router)
        prisma_client_module.set_prisma_client(_FakePrisma())

        client = TestClient(app)
        response = client.get(
            "/api/v1/calibration/resolve?test_id=test-x&state=published"
        )
        assert response.status_code == 200
        body_text = response.text.lower()
        assert "api_key" not in body_text
        assert "apikey" not in body_text


# ─────────────────────────────────────────────────────────────────────────────
# Defaults del adaptador §11.3 (CA-G20: clinicalCriteria exacto)
# ─────────────────────────────────────────────────────────────────────────────


class TestAdaptorDefaultsFromHardcoded:
    """CA-G20: clinicalCriteria defaults = valores hardcodeados actuales
    de `prediagnostic.py` (preserva comportamiento)."""

    def test_defaults_audiometria(self, resolver):
        from app.services.ai.prediagnostic import (
            CONFIDENCE_THRESHOLDS,
            REQUIRED_PARAMS,
        )

        raw = {"canonicalStudyType": "Audiometria", "extraction": {"prompt": "p"}}
        row = _row("t-def-aud", {"aiCalibration": raw})
        resolved = resolver.resolve(row, "published")
        assert resolved is not None
        assert resolved.clinicalCriteria["confidenceThreshold"] == CONFIDENCE_THRESHOLDS["Audiometria"]
        assert resolved.clinicalCriteria["requiredParams"] == REQUIRED_PARAMS["Audiometria"]
        assert resolved.clinicalCriteria["prediagnosisEnabled"] is True

    def test_defaults_laboratorio(self, resolver):
        from app.services.ai.prediagnostic import CONFIDENCE_THRESHOLDS

        raw = {"canonicalStudyType": "Laboratorio", "extraction": {"prompt": "p"}}
        row = _row("t-def-lab", {"aiCalibration": raw})
        resolved = resolver.resolve(row, "published")
        assert resolved is not None
        assert resolved.clinicalCriteria["confidenceThreshold"] == CONFIDENCE_THRESHOLDS["Laboratorio"]
        assert resolved.clinicalCriteria["prediagnosisEnabled"] is True
