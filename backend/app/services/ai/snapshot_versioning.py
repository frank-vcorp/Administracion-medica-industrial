"""
ARCH-20260820-01 Fase 5 — Helper de hashing para snapshot versionado histórico.

Responsabilidad única: cómputo de `sha256:<hex>` del JSON canónico de un campo,
para auditoría sin duplicar el texto del prompt en cada snapshot
(SPEC §5.5, §10.1, §14 Fase 5; ADR §6 decisión 7).

Reglas:
  - Hash determinista: JSON con `sort_keys=True` + `ensure_ascii=False`.
  - Salida con prefijo `sha256:` para distinguirlas de futuros algoritmos.
  - Si el input es `None` o vacío → devuelve `None` (NO hashea nulls).
  - Sin secretos en logs. El hash es seguro de loguear.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any, Optional


def _canonical_json_bytes(value: Any) -> Optional[bytes]:
    """
    Serializa un valor arbitrario a bytes canónicos para hashear.

    None → None (no se hashea).
    dict/list → JSON canónico con claves ordenadas.
    str → bytes UTF-8 directos (sin re-serializar a JSON).
    Otros tipos (int/float/bool) → JSON canónico.

    Returns:
        bytes JSON canónicos, o None si el input es None/empty.
    """
    if value is None:
        return None
    if isinstance(value, str):
        if not value:
            return None
        return value.encode("utf-8")
    if isinstance(value, (dict, list)):
        return json.dumps(
            value,
            sort_keys=True,
            ensure_ascii=False,
            separators=(",", ":"),
            default=str,
        ).encode("utf-8")
    if isinstance(value, (int, float, bool)):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    # Último recurso: serialización JSON estándar.
    return json.dumps(value, sort_keys=True, ensure_ascii=False, default=str).encode("utf-8")


def sha256_prefixed(value: Any) -> Optional[str]:
    """
    Devuelve `sha256:<64-hex>` o None si el valor no produce hash.

    Contrato con SPEC §5.5: hashes usan prefijo `sha256:` para distinguir el
    algoritmo y para que la columna `extractionPromptHash` sea trivialmente
    identificable en logs.
    """
    payload = _canonical_json_bytes(value)
    if not payload:
        return None
    digest = hashlib.sha256(payload).hexdigest()
    return f"sha256:{digest}"


def build_snapshot_versioning_payload(
    calibration_version: Any,
) -> dict:
    """
    Construye el bloque de campos congelados (Fase 5) a partir de la
    `AICalibrationVersionResolved` del resolver.

    Si `calibration_version is None` (calibración disabled/legacy) o no trae
    campos poblados, devuelve `None`s. Esto preserva compatibilidad con
    snapshots pre-V5 (SPEC §10.2, CB-08: `calibration_version_mismatch=true`).

    Devuelve SIEMPRE un dict con todos los campos, para que el caller pueda
    mergear directamente sin verificar presencia.
    """
    payload = {
        "calibrationVersionId": None,
        "calibrationVersionNumber": None,
        "presentationSchemaSnapshot": None,  # capa extractiva
        "extractionPromptHash": None,        # capa extractiva
        "clinicalPromptHash": None,          # capa interpretativa
        "clinicalCriteriaHash": None,        # capa interpretativa
    }
    if calibration_version is None:
        return payload

    payload["calibrationVersionId"] = getattr(calibration_version, "versionId", None)
    payload["calibrationVersionNumber"] = getattr(calibration_version, "versionNumber", None)

    # Capa extractiva: presentation.schema (ya fusionada con familia+overrides
    # por el resolver en `_resolve_v3`/`_merge_v3_with_family`).
    presentation = getattr(calibration_version, "presentation", None)
    if isinstance(presentation, dict):
        schema_block = presentation.get("schema")
        if isinstance(schema_block, (dict, list)) and schema_block:
            payload["presentationSchemaSnapshot"] = schema_block

    # extraction.prompt → sha256
    extraction = getattr(calibration_version, "extraction", None)
    if isinstance(extraction, dict):
        prompt = extraction.get("prompt")
        if isinstance(prompt, str) and prompt:
            payload["extractionPromptHash"] = sha256_prefixed(prompt)

    # Capa interpretativa: clinicalCriteria.prompt + clinicalCriteria completo.
    clinical = getattr(calibration_version, "clinicalCriteria", None)
    if isinstance(clinical, dict) and clinical:
        cprompt = clinical.get("prompt")
        if isinstance(cprompt, str) and cprompt:
            payload["clinicalPromptHash"] = sha256_prefixed(cprompt)
        # Hash del JSON canónico completo del clinicalCriteria (SPEC §5.5).
        # Usamos todo el dict (no solo prompt) para que el hash identifique
        # el contrato completo: requiredParams, confidenceThreshold,
        # supportingReferences, promptVersion, etc.
        payload["clinicalCriteriaHash"] = sha256_prefixed(clinical)

    return payload
