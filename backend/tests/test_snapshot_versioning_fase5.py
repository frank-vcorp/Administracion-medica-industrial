"""
ARCH-20260820-01 Fase 5 — Tests del helper de snapshot versionado histórico.

Cubre:
  - AC-5.1: el helper `build_snapshot_versioning_payload` produce hashes
    correctos (`sha256:`) y `presentationSchemaSnapshot` (post-fusión) a
    partir de la `AICalibrationVersionResolved` del resolver.
  - Comportamiento cuando `calibration_version is None` (legacy_hardcoded /
    disabled / pre-V5): todos los campos = null.

Razonamiento:
  El handoff §6 expone AC-5.1 desde el lado backend: el nuevo contrato de
  payload debe llevar `extraction_prompt_hash`, `clinical_prompt_hash`,
  `clinical_criteria_hash`, `presentation_schema_snapshot` y los
  identificadores de versión. Esta clase valida el helper responsable de
  producir ese bloque, sin invocar la red (Prisma + FastAPI).

Respaldo:
  context/interconsultas/HANDOFF_ARCH-20260820-01_FASE5_SOFIA_CALIBRACION-FUENTE-UNICA.md
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

import pytest


@dataclass
class _FakeResolved:
    """Mínimo compatible con `build_snapshot_versioning_payload`."""

    operationMode: str = "clinical_interpretation"
    enabled: bool = True
    canonicalStudyType: Optional[str] = "Audiometria"
    extraction: Optional[Dict[str, Any]] = None
    fieldDefinitions: list = field(default_factory=list)
    clinicalCriteria: Optional[Dict[str, Any]] = None
    presentation: Optional[Dict[str, Any]] = None
    versionId: Optional[str] = None
    versionNumber: Optional[int] = None
    familyTemplateId: Optional[str] = None
    requiresReview: bool = False
    schemaVersion: str = "V3"
    status: str = "published"


class TestSnapshotVersioningBuilder:
    """AC-5.1: `build_snapshot_versioning_payload` produce hashes correctos."""

    def test_returns_all_null_when_calibration_version_is_none(self):
        """Pre-V5 / `calibration_version=None` ⇒ todos los campos = null."""
        from app.services.ai.snapshot_versioning import (
            build_snapshot_versioning_payload,
        )

        payload = build_snapshot_versioning_payload(None)
        assert payload == {
            "calibrationVersionId": None,
            "calibrationVersionNumber": None,
            "presentationSchemaSnapshot": None,
            "extractionPromptHash": None,
            "clinicalPromptHash": None,
            "clinicalCriteriaHash": None,
        }, (
            "AC-5.1 — calibración no resuelta (legacy_hardcoded/disabled/pre-V5) "
            "debe persistir todos los campos congelados como null para mantener "
            "compatibilidad con snapshots pre-V5 (CB-08)."
        )

    def test_version_identifiers_are_populated(self):
        """`versionId` y `versionNumber` se copian del snapshot resuelto."""
        from app.services.ai.snapshot_versioning import (
            build_snapshot_versioning_payload,
        )

        resolved = _FakeResolved(versionId="cal-v3-001", versionNumber=3)
        payload = build_snapshot_versioning_payload(resolved)
        assert payload["calibrationVersionId"] == "cal-v3-001"
        assert payload["calibrationVersionNumber"] == 3

    def test_extraction_prompt_hash_is_sha256_of_prompt(self):
        """`extractionPromptHash` = `sha256:<hex>` del prompt de extracción."""
        from app.services.ai.snapshot_versioning import (
            build_snapshot_versioning_payload,
        )

        prompt_text = "Bloque específico editable desde aiCalibration.extraction.prompt"
        resolved = _FakeResolved(
            extraction={"prompt": prompt_text, "version": "extract-v2"}
        )
        payload = build_snapshot_versioning_payload(resolved)

        expected = f"sha256:{hashlib.sha256(prompt_text.encode('utf-8')).hexdigest()}"
        assert payload["extractionPromptHash"] == expected
        assert payload["extractionPromptHash"].startswith("sha256:")
        assert len(payload["extractionPromptHash"]) == len("sha256:") + 64

    def test_presentation_schema_snapshot_is_included_when_enabled(self):
        """`presentationSchemaSnapshot` copia el schema efectivo."""
        from app.services.ai.snapshot_versioning import (
            build_snapshot_versioning_payload,
        )

        presentation = {
            "enabled": True,
            "schema": {
                "sections": [
                    {"kind": "keyValue", "title": "Umbrales OD"},
                ]
            },
        }
        resolved = _FakeResolved(presentation=presentation)
        payload = build_snapshot_versioning_payload(resolved)

        assert payload["presentationSchemaSnapshot"] == presentation["schema"]

    def test_presentation_schema_is_none_when_presentation_missing(self):
        """Sin bloque `presentation` el snapshot queda con schema=null."""
        from app.services.ai.snapshot_versioning import (
            build_snapshot_versioning_payload,
        )

        resolved = _FakeResolved(extraction=None, presentation=None)
        payload = build_snapshot_versioning_payload(resolved)

        assert payload["presentationSchemaSnapshot"] is None
        assert payload["extractionPromptHash"] is None

    def test_clinical_hashes_populated_only_when_clinical_criteria_present(self):
        """`clinicalCriteria` poblado ⇒ ambos hashes clínicos."""
        from app.services.ai.snapshot_versioning import (
            build_snapshot_versioning_payload,
        )

        clinical = {
            "prediagnosisEnabled": True,
            "requiredParams": ["oido_derecho", "oido_izquierdo"],
            "confidenceThreshold": 0.55,
            "prompt": "PROMPT CLINICO v3",
            "promptVersion": "predx-audiometria-v3",
            "supportingReferences": [],
        }
        resolved = _FakeResolved(clinicalCriteria=clinical)
        payload = build_snapshot_versioning_payload(resolved)

        # Prompt clínico
        assert payload["clinicalPromptHash"] == (
            f"sha256:{hashlib.sha256(clinical['prompt'].encode('utf-8')).hexdigest()}"
        )
        # JSON canónico del clinicalCriteria completo
        canonical = json.dumps(
            clinical,
            sort_keys=True,
            ensure_ascii=False,
            separators=(",", ":"),
            default=str,
        ).encode("utf-8")
        expected_criteria_hash = f"sha256:{hashlib.sha256(canonical).hexdigest()}"
        assert payload["clinicalCriteriaHash"] == expected_criteria_hash

    def test_clinical_hashes_are_none_for_document_extraction(self):
        """`document_extraction` ⇒ `clinicalCriteria=None` ⇒ sin hashes clínicos."""
        from app.services.ai.snapshot_versioning import (
            build_snapshot_versioning_payload,
        )

        resolved = _FakeResolved(
            operationMode="document_extraction",
            clinicalCriteria=None,
            extraction={"prompt": "extract prompt", "version": "extract-v2"},
        )
        payload = build_snapshot_versioning_payload(resolved)

        assert payload["clinicalPromptHash"] is None
        assert payload["clinicalCriteriaHash"] is None
        # Pero la capa extractiva sí se persiste (document_extraction tiene
        # extraction.prompt sin clinicalCriteria).
        assert payload["extractionPromptHash"] is not None

    def test_hash_determinism(self):
        """Mismo input ⇒ mismo hash; distinto input ⇒ hash distinto (SPEC §5.5)."""
        from app.services.ai.snapshot_versioning import (
            build_snapshot_versioning_payload,
        )

        r1 = _FakeResolved(
            extraction={"prompt": "same prompt"},
            clinicalCriteria={"prompt": "same prompt", "requiredParams": ["a"]},
        )
        r2 = _FakeResolved(
            extraction={"prompt": "same prompt"},
            clinicalCriteria={"prompt": "same prompt", "requiredParams": ["a"]},
        )
        r3 = _FakeResolved(
            extraction={"prompt": "DIFFERENT prompt"},
            clinicalCriteria={"prompt": "same prompt", "requiredParams": ["a"]},
        )

        p1 = build_snapshot_versioning_payload(r1)
        p2 = build_snapshot_versioning_payload(r2)
        p3 = build_snapshot_versioning_payload(r3)

        assert p1["extractionPromptHash"] == p2["extractionPromptHash"]
        assert p1["extractionPromptHash"] != p3["extractionPromptHash"]


class TestSha256Helper:
    """Tests unitarios del helper `sha256_prefixed`."""

    def test_returns_none_for_none(self):
        from app.services.ai.snapshot_versioning import sha256_prefixed

        assert sha256_prefixed(None) is None

    def test_returns_none_for_empty_string(self):
        from app.services.ai.snapshot_versioning import sha256_prefixed

        assert sha256_prefixed("") is None

    def test_hashes_string_directly(self):
        from app.services.ai.snapshot_versioning import sha256_prefixed

        text = "hello world"
        expected = f"sha256:{hashlib.sha256(text.encode('utf-8')).hexdigest()}"
        assert sha256_prefixed(text) == expected

    def test_hashes_dict_with_sorted_keys(self):
        """El JSON canónico ordena claves ⇒ hash determinista independiente del orden de entrada."""
        from app.services.ai.snapshot_versioning import sha256_prefixed

        d1 = {"a": 1, "b": 2, "c": 3}
        d2 = {"c": 3, "b": 2, "a": 1}
        assert sha256_prefixed(d1) == sha256_prefixed(d2)
