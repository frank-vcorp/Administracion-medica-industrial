"""
CalibrationResolver — ARCH-20260820-01 Fase 1
==============================================

Servicio único de lectura del contrato `aiCalibration` V3 (única fuente
runtime de Extracción / Criterios clínicos / Presentación por prueba).

Contratos respaldados:
  - SPEC §5.0 (`operationMode` en `MedicalTest.options`)
  - SPEC §5.1 / §5.2 (estructura V3 raíz + versión publicada)
  - SPEC §5.6 (herencia `familyTemplate` + `overrides`)
  - SPEC §7 (resolución runtime única)
  - SPEC §11.3 (inferencia conservadora de `operationMode` — 4 ramas; NUNCA
    Audiometría por defecto — DEC-20260820-02 + anti-patrón H3)
  - ADR §2.9 (adaptador V1/V2 → V3 de lectura, sin escritura)
  - ADR §2.11 (clasificación operativa `operationMode`)

NO IMPLEMENTADO en Fase 1 (queda para Fases 2-7):
  - Gates de publicación G0-G9 (Fase 2 — `saveAICalibrationV3` / `publish`).
  - Editor V3 (Fase 2).
  - Snapshot versionado (Fase 5).
  - Eliminación de hardcodeos (Fase 7).
  - Registry real de `FamilyTemplate` (Fase 4+ / decisión funcional ATLAS).
  - Herencia `familyTemplateId` con plantilla vacía/configurable en Fase 1.

REGLA ANTI-H3 (CRÍTICA):
  Una prueba sin `operationMode` confirmado y sin calibración V1/V2
  inferible NUNCA cae a `Audiometria`/`clinical_interpretation`. Cae a
  `manual_service` + `requiresReview=true` (DEC-20260820-02).
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any, Dict, List, Literal, Optional

from .prediagnostic import (
    CONFIDENCE_THRESHOLDS,
    PREDIAGNOSIS_SUPPORTED_TYPES,
    REQUIRED_PARAMS,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Tipos públicos
# ─────────────────────────────────────────────────────────────────────────────

OperationMode = Literal["manual_service", "document_extraction", "clinical_interpretation"]
DesiredState = Literal["published", "tested", "draft"]

# Lista canónica de tipos clínicos cubiertos por prediagnóstico V1.
# Se cruza con PREDIAGNOSIS_SUPPORTED_TYPES del módulo `prediagnostic` para
# no duplicar la verdad en dos lugares.
_CLINICAL_CANONICAL_STUDY_TYPES = frozenset(
    t for t in PREDIAGNOSIS_SUPPORTED_TYPES
    if t in CONFIDENCE_THRESHOLDS
)

# Tokens léxicos para la rama "servicio manual seguro" de §11.3.
# Cobertura del DEC-20260820-02: ambulancias, traslados, atención médica,
# urgencias, inyecciones, curaciones, suturas, lavados, vacunas y consultas
# simples. Coincide con el catálogo genérico de servicios sin IA.
_MANUAL_SERVICE_TOKENS = frozenset(
    {
        "ambulancia",
        "ambulancia",
        "traslado",
        "atencion",
        "atención",
        "urgencia",
        "urgencias",
        "inyeccion",
        "inyección",
        "curacion",
        "curación",
        "sutura",
        "suturas",
        "lavado",
        "lavados",
        "vacuna",
        "vacunas",
        "consulta",
        "consultas",
    }
)


# ─────────────────────────────────────────────────────────────────────────────
# Modelos de resultado
# ─────────────────────────────────────────────────────────────────────────────


class AICalibrationVersionResolved:
    """
    Versión resuelta efectivamente (no el JSON crudo).

    Contiene los campos que el consumidor (front Events, snap de extracción,
    prediagnóstico) necesita para operar. La presencia de `clinicalCriteria`
    depende de `operationMode` (None para `document_extraction` y
    `manual_service`; completo para `clinical_interpretation`).

    Regla: NO exponer API keys, prompts completos pueden incluirse porque no
    son secretos (son metadata clínica operativa). El resolver jamás filtra
    secretos — el contrato de la SPEC §17.1 se respeta aquí porque el
    contrato V3 no contiene secretos.
    """

    __slots__ = (
        "operationMode",
        "enabled",
        "canonicalStudyType",
        "extraction",
        "fieldDefinitions",
        "clinicalCriteria",
        "presentation",
        "versionId",
        "versionNumber",
        "familyTemplateId",
        "requiresReview",
        "schemaVersion",
        "status",
        "sourceRaw",
    )

    def __init__(
        self,
        *,
        operationMode: OperationMode,
        enabled: bool,
        canonicalStudyType: Optional[str],
        extraction: Optional[Dict[str, Any]],
        fieldDefinitions: Optional[List[Dict[str, Any]]],
        clinicalCriteria: Optional[Dict[str, Any]],
        presentation: Optional[Dict[str, Any]],
        versionId: Optional[str],
        versionNumber: Optional[int],
        familyTemplateId: Optional[str],
        requiresReview: bool,
        schemaVersion: str,
        status: str,
        sourceRaw: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.operationMode = operationMode
        self.enabled = enabled
        self.canonicalStudyType = canonicalStudyType
        self.extraction = extraction
        self.fieldDefinitions = fieldDefinitions
        self.clinicalCriteria = clinicalCriteria
        self.presentation = presentation
        self.versionId = versionId
        self.versionNumber = versionNumber
        self.familyTemplateId = familyTemplateId
        self.requiresReview = requiresReview
        self.schemaVersion = schemaVersion
        self.status = status
        self.sourceRaw = sourceRaw

    def to_dict(self) -> Dict[str, Any]:
        """Serializa a dict JSON-serializable para el endpoint /resolve."""
        return {
            "operationMode": self.operationMode,
            "enabled": self.enabled,
            "canonicalStudyType": self.canonicalStudyType,
            "extraction": self.extraction,
            "fieldDefinitions": self.fieldDefinitions or [],
            "clinicalCriteria": self.clinicalCriteria,
            "presentation": self.presentation,
            "versionId": self.versionId,
            "versionNumber": self.versionNumber,
            "familyTemplateId": self.familyTemplateId,
            "requiresReview": self.requiresReview,
            "schemaVersion": self.schemaVersion,
            "status": self.status,
        }


# ─────────────────────────────────────────────────────────────────────────────
# Registry de FamilyTemplate (stub Fase 1 — FND-20260820-04, ADR §7.7)
# ─────────────────────────────────────────────────────────────────────────────


class FamilyTemplateRegistry:
    """
    Registry de `FamilyTemplate` (entrada vacía en Fase 1).

    Decisión funcional pendiente (ADR §7.7): el catálogo de plantillas
    (qué familias, qué analitos base, qué schemas tabulares) es propiedad
    de ATLAS/Frank. En Fase 1 el resolver SOLO lee `familyTemplateId` y
    lo expone; la fusión con `overrides` sólo se aplica si la plantilla
    está registrada. Si el registry está vacío, `familyTemplateId` se
    devuelve como referencia, pero la fusión es no-op (no se inventa
    contenido).

    Esto es deliberadamente conservador: mejor devolver `overrides` solos
    que inventar defaults clínicos que no existen.
    """

    def __init__(self) -> None:
        self._templates: Dict[str, Dict[str, Any]] = {}

    def register(self, template_id: str, template: Dict[str, Any]) -> None:
        """Registra una plantilla (uso admin/debug; vacío en Fase 1)."""
        self._templates[template_id] = template

    def get(self, template_id: Optional[str]) -> Optional[Dict[str, Any]]:
        """Devuelve la plantilla o None si no está registrada."""
        if not template_id:
            return None
        return self._templates.get(template_id)

    def clear(self) -> None:
        """Limpia el registry (uso de tests)."""
        self._templates.clear()


# Registry singleton — Fase 1 vacío. Se rellenará en Fase 4 cuando ATLAS
# confirme el catálogo funcional.
_family_template_registry = FamilyTemplateRegistry()


def get_family_template_registry() -> FamilyTemplateRegistry:
    """Devuelve el registry singleton (lectura/exposición)."""
    return _family_template_registry


# ─────────────────────────────────────────────────────────────────────────────
# Funciones puras: default synthesis + inferencia conservadora
# ─────────────────────────────────────────────────────────────────────────────


def _synthesize_clinical_criteria_defaults(
    canonical_study_type: Optional[str],
) -> Optional[Dict[str, Any]]:
    """
    Construye `clinicalCriteria` desde los defaults hardcodeados actuales
    de `prediagnostic.py` (preserva comportamiento durante la migración
    V1/V2 → V3).

    Si `canonical_study_type` no está en `PREDIAGNOSIS_SUPPORTED_TYPES` se
    asume `prediagnosisEnabled=false` (no hay prompt default para ese
    tipo). Si no hay `canonical_study_type`, se construye `clinicalCriteria`
    "vacío" con `prediagnosisEnabled=false` — el resolver nunca asume
    Audiometría por defecto.
    """
    if not canonical_study_type:
        return {
            "prediagnosisEnabled": False,
            "requiredParams": [],
            "confidenceThreshold": None,
            "prompt": None,
            "promptHash": None,
            "promptVersion": None,
            "supportingReferences": [],
        }

    prediagnosis_enabled = canonical_study_type in PREDIAGNOSIS_SUPPORTED_TYPES
    default_prompt = (
        # Importación local para evitar ciclos y reflejar snapshots al
        # import (consistente con `prediagnostic.py`).
        __import__(
            "app.services.ai.prediagnostic", fromlist=["PrediagnosticService"]
        ).PrediagnosticService.PREDIAGNOSTIC_PROMPTS.get(
            canonical_study_type, ""
        )
        if prediagnosis_enabled
        else ""
    )

    return {
        "prediagnosisEnabled": prediagnosis_enabled,
        "requiredParams": list(REQUIRED_PARAMS.get(canonical_study_type, [])),
        "confidenceThreshold": CONFIDENCE_THRESHOLDS.get(canonical_study_type),
        "prompt": default_prompt or None,
        "promptHash": None,
        "promptVersion": "backend_v1_default",
        "supportingReferences": [],
    }


def _infer_operation_mode_from_v1v2(
    raw_ai_calibration: Optional[Dict[str, Any]],
    *,
    test_name: Optional[str] = None,
    test_category: Optional[str] = None,
) -> tuple[OperationMode, bool]:
    """
    Inferencia conservadora de `operationMode` (SPEC §11.3, ADR §2.11).

    Cuatro ramas (NUNCA Audiometría por defecto — DEC-20260820-02):

      1. Clínica: `aiCalibration` con `canonicalStudyType` cubierto por
         `PREDIAGNOSIS_SUPPORTED_TYPES`  →  `clinical_interpretation`
      2. Extracción: `aiCalibration` con extracción pero sin tipo clínico
         cubierto  →  `document_extraction`
      3. Manual seguro: sin `aiCalibration` y categoría/nombre sugiere
         servicio manual (ambulancia, consulta, vacuna, curación, sutura,
         traslado, urgencia)  →  `manual_service` (seguro)
      4. No-inferible: sin `aiCalibration` y sin evidencia de servicio
         manual  →  `manual_service` + `requiresReview=true` (NUNCA
         `clinical_interpretation` ni `Audiometria`)

    Returns:
        (operationMode, requiresReview)
    """
    # Rama 1: clínica
    if raw_ai_calibration:
        canonical = raw_ai_calibration.get("canonicalStudyType")
        if (
            canonical
            and canonical in PREDIAGNOSIS_SUPPORTED_TYPES
            and canonical in CONFIDENCE_THRESHOLDS
        ):
            return "clinical_interpretation", False

        # Rama 2: extracción (tiene aiCalibration pero no cae en clínica)
        extraction = raw_ai_calibration.get("extraction")
        if isinstance(extraction, dict) and extraction:
            return "document_extraction", False

    # Rama 3: manual seguro (categoría o nombre sugiere servicio manual)
    haystack = " ".join(
        [
            str(test_name or "").lower(),
            str(test_category or "").lower(),
        ]
    )
    if any(token in haystack for token in _MANUAL_SERVICE_TOKENS):
        return "manual_service", False

    # Rama 4: no-inferible → manual + flag de revisión
    return "manual_service", True


# ─────────────────────────────────────────────────────────────────────────────
# Adaptador V1/V2 → V3
# ─────────────────────────────────────────────────────────────────────────────


def _adapt_v1v2_to_v3(
    raw_ai_calibration: Dict[str, Any],
    *,
    test_name: Optional[str],
    test_category: Optional[str],
) -> AICalibrationVersionResolved:
    """
    Normaliza una calibración V1/V2 a V3 sintética (status=published),
    preservando comportamiento actual (defaults = `prediagnostic.py`).

    NO escribe en DB. Sólo lectura.

    Ramas:
      - `clinical_interpretation` (V1/V2 con tipo clínico)  →  clinicalCriteria
        sintetizado desde defaults de `prediagnostic.py`.
      - `document_extraction` (V1/V2 con extracción sin tipo clínico)  →
        clinicalCriteria=None.
    """
    operation_mode, requires_review = _infer_operation_mode_from_v1v2(
        raw_ai_calibration,
        test_name=test_name,
        test_category=test_category,
    )

    enabled = bool(raw_ai_calibration.get("enabled", True))
    canonical_study_type = raw_ai_calibration.get("canonicalStudyType")
    extraction = raw_ai_calibration.get("extraction")
    field_definitions = raw_ai_calibration.get("fieldDefinitions") or []
    presentation = raw_ai_calibration.get("presentation") or {}

    if operation_mode == "clinical_interpretation":
        clinical_criteria = _synthesize_clinical_criteria_defaults(
            canonical_study_type
        )
    else:  # document_extraction
        clinical_criteria = None

    # status semántico: si viene disabled → disabled; si no → published (sintético).
    raw_status = raw_ai_calibration.get("status")
    if raw_status == "disabled" or enabled is False:
        status = "disabled"
        resolved_enabled = False
    else:
        status = "published"
        resolved_enabled = True

    # CB-02: enabled=false explícito es propagación fiel, no se sobreescribe.
    if enabled is False:
        resolved_enabled = False
        status = "disabled"

    return AICalibrationVersionResolved(
        operationMode=operation_mode,
        enabled=resolved_enabled,
        canonicalStudyType=canonical_study_type,
        extraction=extraction if isinstance(extraction, dict) else None,
        fieldDefinitions=field_definitions if isinstance(field_definitions, list) else [],
        clinicalCriteria=clinical_criteria,
        presentation=presentation if isinstance(presentation, dict) else {},
        versionId=None,  # V1/V2 no tienen versionId V3
        versionNumber=None,
        familyTemplateId=None,  # V1/V2 no usan familia
        requiresReview=requires_review,
        schemaVersion="V3",
        status=status,
        sourceRaw=raw_ai_calibration,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Adaptador V3 ya leído → versión efectiva (fusión familia)
# ─────────────────────────────────────────────────────────────────────────────


def _merge_v3_with_family(
    *,
    v3_version: Dict[str, Any],
    overrides: Optional[Dict[str, Any]],
    family_template: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Fusiona `FamilyTemplate.defaults` con `overrides` (override gana).

    En Fase 1 el registry está vacío: si `family_template` es None, la
    fusión es no-op (la versión se devuelve tal cual). Esto preserva el
    comportamiento actual.

    La función conserva `enabled`/`canonicalStudyType`/`status` de la
    versión per-test (la plantilla no los sobrescribe).
    """
    if not family_template:
        # Sin registry resoluble: no fusionar nada. Devolver la versión
        #Efectiva tal cual (con overrides aplicados si están presentes).
        if overrides:
            return _apply_overrides(v3_version, overrides)
        return v3_version

    defaults = family_template.get("defaults") or {}
    merged = _deep_merge(defaults, v3_version)
    if overrides:
        merged = _apply_overrides(merged, overrides)
    return merged


def _apply_overrides(base: Dict[str, Any], overrides: Dict[str, Any]) -> Dict[str, Any]:
    """Override gana sobre base. Override de `fieldDefinitions` reemplaza
    la lista (no deep-merge por entrada — por analito decide Fase 4)."""
    out = dict(base)
    for key, value in overrides.items():
        if key == "fieldDefinitions" and isinstance(value, list):
            # Reemplazar lista completa (override, no merge por analito).
            out["fieldDefinitions"] = value
        else:
            out[key] = value
    return out


def _deep_merge(a: Dict[str, Any], b: Dict[str, Any]) -> Dict[str, Any]:
    """Deep merge b sobre a (b gana). Recursivo en dicts; listas reemplazan."""
    out = dict(a)
    for k, v in b.items():
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Resolver principal
# ─────────────────────────────────────────────────────────────────────────────


class CalibrationResolver:
    """
    Servicio único de resolución runtime de `aiCalibration`.

    Métodos:
      - resolve(medical_test_row, desired_state) -> Optional[VersionResolved]
        Resuelve consultando `MedicalTest.options` (operationMode +
        aiCalibration). Devuelve `None` para `manual_service` sin IA.

    Cache:
      - TTL corto en memoria (default 5s, configurable). Cachea el
        `MedicalTest.options` parseado, no la versión resuelta final
        (mantiene frescura ante cambios administrativos). Las normalizaciones
        V1/V2 → V3 se cachean también porque son costosas.

    Contratosque el resolver NO rompe:
      - Sólo lectura. No escribe en DB (CB-11: JSON corrupto → None + log).
      - No expone secretos (SPEC §17.1).
      - Autoriza una sola fuente runtime (Regla §15 — Único lector).
    """

    DEFAULT_CACHE_TTL_SECONDS = 5.0

    def __init__(
        self,
        *,
        family_template_registry: Optional[FamilyTemplateRegistry] = None,
        cache_ttl_seconds: float = DEFAULT_CACHE_TTL_SECONDS,
    ) -> None:
        self._registry = family_template_registry or get_family_template_registry()
        self._cache_ttl = cache_ttl_seconds
        self._cache: Dict[str, tuple[float, Optional[AICalibrationVersionResolved]]] = {}

    # ── API pública ────────────────────────────────────────────────────────

    def resolve(
        self,
        medical_test_row: Any,
        desired_state: DesiredState = "published",
    ) -> Optional[AICalibrationVersionResolved]:
        """
        Resuelve la calibración efectiva para un `MedicalTest`.

        Args:
            medical_test_row: Objeto Prisma o dict con `id` y `options`.
                Acepta el resultado directo de `prisma.medicaltest.find_unique`.
            desired_state: 'published' | 'tested' | 'draft'.
                Fase 1 sólo implementa 'published' correctamente; 'tested' y
                'draft' devuelven None si la MedicalTest sólo tiene V1/V2
                (no hay borrador V3 todavía — Fase 2 introducirá `draft`).

        Returns:
            AICalibrationVersionResolved, o None si:
              - `operationMode == manual_service` (no aplica IA).
              - Sin aiCalibration y modo inferido `manual_service`.
              - desired_state no disponible (e.g. 'tested' sin borrador).
              - JSON corrupto (CB-11): devuelve None + log.
        """
        test_id = self._attr(medical_test_row, "id", "")
        options = self._parse_options(self._attr(medical_test_row, "options"))
        operation_mode = options.get("operationMode")
        ai_calibration = options.get("aiCalibration")
        test_name = self._attr(medical_test_row, "name", None)
        test_category = self._attr(medical_test_row, "category", None)

        # 1. operationMode explícito wins
        if operation_mode in ("manual_service", "document_extraction", "clinical_interpretation"):
            return self._resolve_with_explicit_mode(
                test_id=test_id,
                operation_mode=operation_mode,
                ai_calibration=ai_calibration,
                desired_state=desired_state,
            )

        # 2. aiCalibration V3 con schemaVersion='V3' y operationMode declarada
        if isinstance(ai_calibration, dict) and ai_calibration.get("schemaVersion") == "V3":
            return self._resolve_v3(
                test_id=test_id,
                ai_calibration=ai_calibration,
                desired_state=desired_state,
            )

        # 3. aiCalibration V1/V2 (sin operationMode declarada) → adaptador
        if isinstance(ai_calibration, dict):
            return self._resolve_v1v2(
                test_id=test_id,
                raw_ai_calibration=ai_calibration,
                desired_state=desired_state,
                test_name=test_name,
                test_category=test_category,
            )

        # 4. Sin aiCalibration → inferencia conservadora
        inferred_mode, requires_review = _infer_operation_mode_from_v1v2(
            None,
            test_name=test_name,
            test_category=test_category,
        )
        if inferred_mode == "manual_service":
            # CB-13 / CB-15: manual_service → None, no habilita IA.
            if requires_review:
                logger.info(
                    "[ARCH-20260820-01] test_id=%s sin operationMode confirmado; "
                    "manual_service+requires_review=true (no Audiometria por defecto).",
                    test_id,
                )
            return None

        # document_extraction / clinical_interpretation sin calibración es
        # un estado inconsistente, pero devolvemos None con log (no inventamos).
        logger.warning(
            "[ARCH-20260820-01] test_id=%s operationMode=%s sin aiCalibration; "
            "devolviendo None.",
            test_id,
            inferred_mode,
        )
        return None

    # ── Helpers privados ──────────────────────────────────────────────────

    def _resolve_with_explicit_mode(
        self,
        *,
        test_id: str,
        operation_mode: OperationMode,
        ai_calibration: Optional[Dict[str, Any]],
        desired_state: DesiredState,
    ) -> Optional[AICalibrationVersionResolved]:
        if operation_mode == "manual_service":
            return None  # CB-13: manual_service no dispara IA.
        if not isinstance(ai_calibration, dict):
            if ai_calibration is not None:
                # Bloque no-dict corrupto: log + None (CB-11).
                logger.warning(
                    "[ARCH-20260820-01] test_id=%s aiCalibration no es dict: %s",
                    test_id,
                    type(ai_calibration).__name__,
                )
            return None

        if ai_calibration.get("schemaVersion") == "V3":
            return self._resolve_v3(
                test_id=test_id,
                ai_calibration=ai_calibration,
                desired_state=desired_state,
            )

        # V1/V2 con operationMode explícita: tratar como adaptador.
        return self._resolve_v1v2(
            test_id=test_id,
            raw_ai_calibration=ai_calibration,
            desired_state=desired_state,
            test_name=None,
            test_category=None,
        )

    def _resolve_v3(
        self,
        *,
        test_id: str,
        ai_calibration: Dict[str, Any],
        desired_state: DesiredState,
    ) -> Optional[AICalibrationVersionResolved]:
        version = _select_version_for_state(ai_calibration, desired_state)
        if not version:
            return None

        family_template_id = ai_calibration.get("familyTemplateId")
        overrides = ai_calibration.get("overrides") or {}
        family_template = self._registry.get(family_template_id)

        # Fusión effective (defaults+overrides). Si registry vacío, no-op.
        effective = _merge_v3_with_family(
            v3_version=version,
            overrides=overrides,
            family_template=family_template,
        )

        operation_mode = ai_calibration.get("operationMode") or _operation_mode_from_v3(
            effective
        )
        if operation_mode not in (
            "manual_service",
            "document_extraction",
            "clinical_interpretation",
        ):
            # V3 sin operationMode explícita: el resolver la pide en catálogo.
            # Fallback conservador: forzar inferencia.
            inferred_mode, _ = _infer_operation_mode_from_v1v2(
                effective,
            )
            operation_mode = inferred_mode

        if operation_mode == "manual_service":
            return None

        clinical_criteria = effective.get("clinicalCriteria")
        if operation_mode == "document_extraction":
            clinical_criteria = None  # CA-G20: doc_extraction ⇒ None.

        return AICalibrationVersionResolved(
            operationMode=operation_mode,
            enabled=bool(effective.get("enabled", True)),
            canonicalStudyType=effective.get("canonicalStudyType"),
            extraction=effective.get("extraction"),
            fieldDefinitions=effective.get("fieldDefinitions") or [],
            clinicalCriteria=clinical_criteria,
            presentation=effective.get("presentation"),
            versionId=effective.get("versionId"),
            versionNumber=effective.get("versionNumber"),
            familyTemplateId=family_template_id,
            requiresReview=False,
            schemaVersion="V3",
            status=effective.get("status", "published"),
            sourceRaw=ai_calibration,
        )

    def _resolve_v1v2(
        self,
        *,
        test_id: str,
        raw_ai_calibration: Dict[str, Any],
        desired_state: DesiredState,
        test_name: Optional[str],
        test_category: Optional[str],
    ) -> Optional[AICalibrationVersionResolved]:
        if desired_state != "published":
            # V1/V2 no tienen draft/tested V3 todavía (Fase 2 introducirá).
            return None

        cache_key = self._cache_key(test_id, "v1v2", desired_state)
        cached = self._cache_get(cache_key)
        if cached is not None:
            return cached

        resolved = _adapt_v1v2_to_v3(
            raw_ai_calibration,
            test_name=test_name,
            test_category=test_category,
        )
        # CB-13 / CB-15: manual_service (seguro o no-inferible) ⇒ None,
        # no habilita IA. CB-15 anexa requires_review en cache para que el
        # llamador pueda consultarlo vía /resolve (futuro enriquecimiento).
        if resolved.operationMode == "manual_service":
            self._cache_set(cache_key, None)
            return None

        self._cache_set(cache_key, resolved)
        return resolved

    # ── Cache (TTL muy corto) ─────────────────────────────────────────────

    def _cache_key(self, test_id: str, kind: str, state: str) -> str:
        return f"{kind}:{state}:{test_id}"

    def _cache_get(self, key: str) -> Optional[AICalibrationVersionResolved]:
        entry = self._cache.get(key)
        if not entry:
            return None
        ts, value = entry
        if (time.time() - ts) > self._cache_ttl:
            self._cache.pop(key, None)
            return None
        return value

    def _cache_set(self, key: str, value: Optional[AICalibrationVersionResolved]) -> None:
        self._cache[key] = (time.time(), value)

    def clear_cache(self) -> None:
        """Limpia la caché (uso de tests)."""
        self._cache.clear()

    # ── Utilidades ────────────────────────────────────────────────────────

    @staticmethod
    def _attr(obj: Any, key: str, default: Any = None) -> Any:
        """Lee atributo o key indistintamente (dict u objeto Prisma)."""
        if obj is None:
            return default
        if isinstance(obj, dict):
            return obj.get(key, default)
        return getattr(obj, key, default)

    @staticmethod
    def _parse_options(raw_options: Any) -> Dict[str, Any]:
        """Normaliza `options` (dict, JSON-string, None)."""
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


def _select_version_for_state(
    ai_calibration: Dict[str, Any], desired_state: DesiredState
) -> Optional[Dict[str, Any]]:
    """
    Devuelve la versión V3 correspondiente al estado deseado.

    Fase 1 sólo soporta `published` correctamente:
      - 'published': la versión vigente (published o disabled).
      - 'tested': el draft con status='tested' (raro en Fase 1).
      - 'draft': el draft actual (Fase 2 introducirá campo).
    """
    if desired_state == "published":
        current_id = ai_calibration.get("currentPublishedVersionId")
        published = ai_calibration.get("publishedVersions") or []
        if current_id:
            for v in published:
                if isinstance(v, dict) and v.get("versionId") == current_id:
                    return v
        # Fallback: primera published o disabled.
        for v in published:
            if isinstance(v, dict) and v.get("status") in ("published", "disabled"):
                return v
        return None

    if desired_state == "tested":
        draft = ai_calibration.get("draft")
        if isinstance(draft, dict) and draft.get("status") == "tested":
            return draft
        return None

    if desired_state == "draft":
        draft = ai_calibration.get("draft")
        return draft if isinstance(draft, dict) else None

    return None


def _operation_mode_from_v3(v3_version: Dict[str, Any]) -> Optional[OperationMode]:
    """Heurística de respaldo: si la versión V3 no trae operationMode
    explícita (legacy), derivarla de la presencia de clinicalCriteria."""
    if v3_version.get("clinicalCriteria") is not None:
        return "clinical_interpretation"
    if v3_version.get("extraction") is not None:
        return "document_extraction"
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Singleton de conveniencia (uso opcional; el endpoint construye el suyo)
# ─────────────────────────────────────────────────────────────────────────────

_default_resolver: Optional[CalibrationResolver] = None


def get_default_resolver() -> CalibrationResolver:
    """Devuelve el resolver singleton (lectura/exposición)."""
    global _default_resolver
    if _default_resolver is None:
        _default_resolver = CalibrationResolver()
    return _default_resolver


def reset_default_resolver() -> None:
    """Resetea el singleton (uso de tests)."""
    global _default_resolver
    _default_resolver = None
