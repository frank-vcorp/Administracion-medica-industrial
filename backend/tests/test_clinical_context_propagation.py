"""
@file Tests focales (V1) para la propagación de `clinical_context` al
  prediagnóstico clínico MedGemma/DR7.

IMPL-FEATURE-20260824-02 (gap fix): valida que el cuestionario estructurado
(`espirometria-questionnaire-v1`) se inyecta al prompt del prediagnóstico
como contexto adicional, sin tocar la capa extractiva M3, y que un
payload ausente preserva el comportamiento pre-FEATURE-20260824-02.

Cobertura:
  - clinical_context ausente → flujo idéntico al legacy (no aparece en prompt).
  - clinical_context presente y válido → aparece en `_rendered_prompt`
    con el schemaVersion, dentro del fence `=== CONTEXTO CLÍNICO ===`.
  - clinical_context presente pero no es objeto / no tiene schemaVersion
    → se ignora silenciosamente (no se inyecta, no rompe el flujo).
  - clinical_context válido → `limitations` del resultado documenta la
    inyección con instrucciones explícitas al modelo (no inventar
    respuestas ausentes; no sustituir el documento por el cuestionario).
  - Helper `_render_clinical_context_block` (función pura): vacío para
    entradas inválidas, no vacío para entradas válidas.
  - Firma de `generate_prediagnosis`: acepta el kwarg `clinical_context`
    sin romper callers existentes (compat retroactiva).

@id IMPL-FEATURE-20260824-02
@backup context/SPECs/SPEC-FEATURE-20260824-02-CUESTIONARIO-ESPIROMETRIA.md
"""

import pytest
from unittest.mock import patch

from app.services.ai.prediagnostic import (
    _render_clinical_context_block,
    PrediagnosticService,
)


ESPIRO_V1 = "espirometria-questionnaire-v1"


def _valid_clinical_context():
    return {
        "schemaVersion": ESPIRO_V1,
        "capturedAt": "2026-08-24T12:00:00.000Z",
        "antecedentes": {
            "espirometria_previa": "NO",
            "fuma_o_fumo": "SI",
            "fuma_desde_rango": "MAS_5_ANIOS",
            "embarazo": "NO_APLICA",
        },
        "exploracionFisica": {
            "vias_respiratorias_superiores": {"estado": "NORMAL"},
            "torax": {"estado": "NORMAL"},
            "pulmones": {"estado": "NORMAL"},
        },
    }


@pytest.fixture
def prediagnostic_svc():
    return PrediagnosticService(api_key="test-api-key", model="gemini-2.5-flash")


# ─── Helper puro: _render_clinical_context_block ────────────────────────────


class TestRenderClinicalContextBlock:
    def test_devuelve_string_vacio_si_no_es_dict(self):
        assert _render_clinical_context_block(None) == ""
        assert _render_clinical_context_block("not-a-dict") == ""
        assert _render_clinical_context_block([1, 2, 3]) == ""

    def test_devuelve_string_vacio_si_no_tiene_schemaVersion(self):
        ctx = {"antecedentes": {"fuma_o_fumo": "SI"}}
        assert _render_clinical_context_block(ctx) == ""

    def test_devuelve_string_vacio_si_schemaVersion_vacio_o_no_string(self):
        assert _render_clinical_context_block({"schemaVersion": ""}) == ""
        assert _render_clinical_context_block({"schemaVersion": 123}) == ""
        assert _render_clinical_context_block({"schemaVersion": None}) == ""

    def test_renderiza_bloque_con_schemaVersion_y_json_serializado(self):
        ctx = _valid_clinical_context()
        out = _render_clinical_context_block(ctx)
        assert out != ""
        assert "=== CONTEXTO CLÍNICO DEL PACIENTE" in out
        assert "=== INICIO BLOQUE ===" in out
        assert "=== FIN BLOQUE ===" in out
        assert f"schemaVersion: {ESPIRO_V1}" in out
        assert '"fuma_o_fumo"' in out
        # Instrucciones explícitas anti-injection.
        assert "NO inventes" in out
        assert "documento es la fuente primaria" in out

    def test_no_duplica_pii_del_encabezado(self):
        """
        FEATURE-20260824-02 §Prohibido: el cuestionario no debe incluir PII
        del encabezado de la papeleta (nombre, empresa, etc.). El bloque
        renderizado sólo debe mencionar el schemaVersion y los antecedentes
        clínicos del cuestionario. Verificamos que el helper NO añade
        metadatos del paciente (esos los trae el documento extraído).
        """
        ctx = _valid_clinical_context()
        out = _render_clinical_context_block(ctx)
        # No debe haber nombre, RFC, empresa, etc. en el bloque.
        for forbidden in ["paciente_nombre", "nombre_paciente", "empresa", "rfc", "curp"]:
            assert forbidden.lower() not in out.lower()


# ─── Compatibilidad de la firma de generate_prediagnosis ─────────────────────


class TestGeneratePrediagnosisSignatureCompat:
    def test_acepta_clinical_context_como_kwarg_opcional(self, prediagnostic_svc):
        """
        Firma retrocompatible: callers legacy que NO pasan clinical_context
        deben seguir funcionando idénticamente al pre-FEATURE-20260824-02.
        """
        result = prediagnostic_svc.generate_prediagnosis(
            "Campimetria",
            {"paciente": "Test", "fecha_estudio": "26/03/2026"},
        )
        # Campimetria retorna AI_NON_CONCLUSIVE en V1 — sólo validamos que
        # el kwarg opcional no rompa el flujo.
        assert result.clinical_state == "AI_NON_CONCLUSIVE"

    def test_acepta_clinical_context_explicito_none(self, prediagnostic_svc):
        """clinical_context=None explícito es equivalente a no pasarlo."""
        result = prediagnostic_svc.generate_prediagnosis(
            "Campimetria",
            {"paciente": "Test", "fecha_estudio": "26/03/2026"},
            clinical_context=None,
        )
        assert result.clinical_state == "AI_NON_CONCLUSIVE"


# ─── clinical_context ausente: comportamiento idéntico al legacy ────────────


class TestClinicalContextAbsent:
    @patch("app.services.ai.prediagnostic.MEDGEMMA_ENABLED", True)
    @patch("app.services.ai.prediagnostic.DR7_API_KEY", "fake-dr7-key")
    @patch("app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat")
    def test_sin_clinical_context_prompt_no_contiene_bloque(
        self, mock_dr7, prediagnostic_svc
    ):
        """Sin clinical_context → prompt NO contiene el fence `=== CONTEXTO CLÍNICO ===`."""
        mock_dr7.return_value = {
            "summary": "Prediagnóstico IA.",
            "confidence": 0.7,
            "clinical_state": "AI_PENDING_REVIEW",
            "justification": [],
            "clinical_basis": [],
            "citations": [],
            "limitations": [],
            "red_flags": [],
        }
        result = prediagnostic_svc.generate_prediagnosis(
            "Electrocardiograma",
            {"ritmo": "Sinusal", "frecuencia_bpm": 72},
        )
        assert result.input_debug is not None
        rendered = result.input_debug.rendered_prompt or ""
        assert "=== CONTEXTO CLÍNICO" not in rendered
        # Limitations NO debe mencionar el cuestionario.
        assert not any(
            "Contexto clínico del paciente inyectado" in lim
            for lim in (result.limitations or [])
        )


# ─── clinical_context presente y válido: se inyecta al prompt ───────────────


class TestClinicalContextPresent:
    @patch("app.services.ai.prediagnostic.MEDGEMMA_ENABLED", True)
    @patch("app.services.ai.prediagnostic.DR7_API_KEY", "fake-dr7-key")
    @patch("app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat")
    def test_prompt_incluye_bloque_con_schemaVersion_y_json(
        self, mock_dr7, prediagnostic_svc
    ):
        """Con clinical_context válido → prompt contiene el bloque y el JSON serializado."""
        mock_dr7.return_value = {
            "summary": "Prediagnóstico IA.",
            "confidence": 0.7,
            "clinical_state": "AI_PENDING_REVIEW",
            "justification": [],
            "clinical_basis": [],
            "citations": [],
            "limitations": [],
            "red_flags": [],
        }
        ctx = _valid_clinical_context()
        result = prediagnostic_svc.generate_prediagnosis(
            "Electrocardiograma",
            {"ritmo": "Sinusal", "frecuencia_bpm": 72},
            clinical_context=ctx,
        )
        rendered = result.input_debug.rendered_prompt or ""
        assert "=== CONTEXTO CLÍNICO" in rendered
        assert f"schemaVersion: {ESPIRO_V1}" in rendered
        assert '"fuma_o_fumo"' in rendered
        assert "=== INICIO BLOQUE ===" in rendered
        assert "=== FIN BLOQUE ===" in rendered

    @patch("app.services.ai.prediagnostic.MEDGEMMA_ENABLED", True)
    @patch("app.services.ai.prediagnostic.DR7_API_KEY", "fake-dr7-key")
    @patch("app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat")
    def test_limitations_documenta_inyeccion(self, mock_dr7, prediagnostic_svc):
        """Limitations del resultado documenta la inyección del cuestionario."""
        mock_dr7.return_value = {
            "summary": "Prediagnóstico IA.",
            "confidence": 0.7,
            "clinical_state": "AI_PENDING_REVIEW",
            "justification": [],
            "clinical_basis": [],
            "citations": [],
            "limitations": [],
            "red_flags": [],
        }
        result = prediagnostic_svc.generate_prediagnosis(
            "Electrocardiograma",
            {"ritmo": "Sinusal", "frecuencia_bpm": 72},
            clinical_context=_valid_clinical_context(),
        )
        assert any(
            f"schemaVersion={ESPIRO_V1}" in lim and "NO debe inventar" in lim
            for lim in (result.limitations or [])
        )


# ─── clinical_context inválido: se ignora sin romper el flujo ────────────────


class TestClinicalContextInvalid:
    @patch("app.services.ai.prediagnostic.MEDGEMMA_ENABLED", True)
    @patch("app.services.ai.prediagnostic.DR7_API_KEY", "fake-dr7-key")
    @patch("app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat")
    def test_sin_schemaVersion_se_ignora_silenciosamente(
        self, mock_dr7, prediagnostic_svc
    ):
        """Payload sin schemaVersion → se omite del prompt sin fallar."""
        mock_dr7.return_value = {
            "summary": "Prediagnóstico IA.",
            "confidence": 0.7,
            "clinical_state": "AI_PENDING_REVIEW",
            "justification": [],
            "clinical_basis": [],
            "citations": [],
            "limitations": [],
            "red_flags": [],
        }
        result = prediagnostic_svc.generate_prediagnosis(
            "Electrocardiograma",
            {"ritmo": "Sinusal", "frecuencia_bpm": 72},
            clinical_context={"antecedentes": {"fuma_o_fumo": "SI"}},
        )
        rendered = result.input_debug.rendered_prompt or ""
        assert "=== CONTEXTO CLÍNICO" not in rendered
        assert not any(
            "Contexto clínico del paciente inyectado" in lim
            for lim in (result.limitations or [])
        )

    @patch("app.services.ai.prediagnostic.MEDGEMMA_ENABLED", True)
    @patch("app.services.ai.prediagnostic.DR7_API_KEY", "fake-dr7-key")
    @patch("app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat")
    def test_schemaVersion_futura_se_acepta_pero_se_documenta(self, mock_dr7, prediagnostic_svc):
        """
        SchemaVersion desconocida (futura) → el helper es forward-compatible:
        renderiza el bloque (estructura válida) y documenta la versión en
        `limitations` para trazabilidad. El frontend es responsable de
        restringir a versiones conocidas antes de reenviar; el backend
        acepta y propaga cualquier estructura con schemaVersion string.
        """
        mock_dr7.return_value = {
            "summary": "Prediagnóstico IA.",
            "confidence": 0.7,
            "clinical_state": "AI_PENDING_REVIEW",
            "justification": [],
            "clinical_basis": [],
            "citations": [],
            "limitations": [],
            "red_flags": [],
        }
        result = prediagnostic_svc.generate_prediagnosis(
            "Electrocardiograma",
            {"ritmo": "Sinusal", "frecuencia_bpm": 72},
            clinical_context={
                "schemaVersion": "espirometria-questionnaire-v99",
                "antecedentes": {"fuma_o_fumo": "SI"},
            },
        )
        rendered = result.input_debug.rendered_prompt or ""
        # Forward-compat: se renderiza el bloque, pero se documenta la
        # versión desconocida para trazabilidad.
        assert "=== CONTEXTO CLÍNICO" in rendered
        assert "espirometria-questionnaire-v99" in rendered
        assert any(
            "schemaVersion=espirometria-questionnaire-v99" in lim
            for lim in (result.limitations or [])
        )
