"""
Tests unitarios de fuente única de verdad en BD (`MedicalTest.options.aiCalibration`)
para extracción y prediagnóstico IA (sin prompts ni guardrails hardcodeados en código).
"""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


class TestNoHardcodedPromptsOrGuardrails:
    def test_extractor_has_no_hardcoded_prompt_guardrails(self):
        import app.services.ai.extractor as ext_mod
        from app.services.ai.extractor import ExtractorService

        assert not hasattr(ext_mod, "_ESPIROMETRIA_BACKEND_GUARDRAILS")
        assert not hasattr(ext_mod, "_AUDIOMETRIA_BACKEND_GUARDRAILS")
        assert not hasattr(ExtractorService, "BASE_EXTRACTION_PROMPT")
        assert not hasattr(ExtractorService, "_build_extraction_prompt")
        assert not hasattr(ExtractorService, "_build_audiometria_extraction_prompt")
        assert not hasattr(ExtractorService, "_build_espirometria_extraction_prompt")

    def test_prediagnostic_has_no_hardcoded_prompts(self):
        from app.services.ai.prediagnostic import PrediagnosticService

        assert PrediagnosticService.PREDIAGNOSTIC_PROMPTS == {}

    def test_extractor_uses_db_prompt_verbatim_without_concatenation(self, monkeypatch):
        from app.services.ai.extractor import ExtractorService

        svc = ExtractorService(api_key="test-key", model="MiniMax-M3.1-Flash")
        captured = {}

        def _fake_call_with_dispatch(self, file_path, prompt, provider, model, selected_study_type=None):
            captured["prompt"] = prompt
            return {"paciente": "Juan Perez", "fecha_estudio": "2026-11-19", "hallazgos": []}, "m3", None

        monkeypatch.setattr(ExtractorService, "_call_with_dispatch", _fake_call_with_dispatch)

        db_prompt = "PROMPT UNICO DE BD PARA RX DE COLUMNA"
        svc.extract_by_type(
            "/fake/rx.pdf",
            "Rayos_X",
            ai_calibration={"enabled": True, "extraction": {"enabled": True, "prompt": db_prompt, "provider": "m3"}},
            test_name="RX DE COLUMNA LUMBOSACRA AP Y LATERAL",
        )
        assert captured["prompt"] == db_prompt


class TestMissingCalibrationSpanishErrors:
    def test_extractor_missing_calibration_fails_clearly_in_spanish_with_test_name_and_route(self):
        from app.services.ai.extractor import ExtractorService

        svc = ExtractorService(api_key="test-key", model="MiniMax-M3.1-Flash")

        with pytest.raises(ValueError) as exc_info:
            svc.extract_by_type(
                "/fake/rx.pdf",
                "Rayos_X",
                ai_calibration=None,
                test_name="RX DE COLUMNA LUMBOSACRA AP Y LATERAL",
            )

        msg = str(exc_info.value)
        assert "EXTRACTION_PROMPT_NOT_CONFIGURED" in msg
        assert "RX DE COLUMNA LUMBOSACRA AP Y LATERAL" in msg
        assert "/admin/services" in msg
        assert "calibración IA" in msg

    def test_prediagnostic_missing_calibration_returns_non_conclusive_in_spanish_without_llm_call(self):
        from app.services.ai.prediagnostic import PrediagnosticService

        svc = PrediagnosticService(api_key="test-key", model="MiniMax-M3.1-Flash")
        with patch.object(PrediagnosticService, "_call_m3_clinical_chat") as mock_call:
            res = svc.generate_prediagnosis(
                study_type="Rayos_X",
                extracted_data={"hallazgos": ["sin alteraciones"], "localizacion": "Columna lumbar"},
                calibration_version=None,
                ai_calibration=None,
                test_name="RX DE COLUMNA LUMBOSACRA AP Y LATERAL",
            )

        mock_call.assert_not_called()
        assert res.clinical_state == "AI_NON_CONCLUSIVE"
        assert res.calibration_source == "missing_calibration"
        assert res.prompt_source == "missing_calibration"
        assert "RX DE COLUMNA LUMBOSACRA AP Y LATERAL" in res.summary
        assert "/admin/services" in res.summary
        assert res.non_conclusive_reason is not None
        assert "/admin/services" in res.non_conclusive_reason

    def test_prediagnostic_respects_calibration_disabled_without_runtime_fallback(self):
        from app.services.ai.calibration_resolver import CalibrationResolver
        from app.services.ai.prediagnostic import PrediagnosticService

        resolver = CalibrationResolver(cache_ttl_seconds=0.0)
        row = {
            "id": "t-disabled",
            "name": "Espirometría",
            "options": {
                "operationMode": "clinical_interpretation",
                "aiCalibration": {
                    "schemaVersion": "V3",
                    "currentPublishedVersionId": "v1",
                    "publishedVersions": [
                        {
                            "versionId": "v1",
                            "versionNumber": 1,
                            "status": "published",
                            "enabled": False,
                            "canonicalStudyType": "Espirometria",
                            "extraction": {"enabled": True, "prompt": "p"},
                            "fieldDefinitions": [],
                            "clinicalCriteria": {
                                "prediagnosisEnabled": True,
                                "requiredParams": ["fev1", "fvc"],
                                "confidenceThreshold": 0.6,
                                "prompt": "prompt db",
                            },
                            "presentation": {"enabled": False, "schema": None},
                        }
                    ],
                },
            },
        }
        resolved = resolver.resolve(row, "published")
        svc = PrediagnosticService(api_key="test-key", model="MiniMax-M3.1-Flash")

        with patch.object(PrediagnosticService, "_call_m3_clinical_chat") as mock_call:
            res = svc.generate_prediagnosis(
                study_type="Espirometria",
                extracted_data={"fev1": 3.5, "fvc": 4.2},
                calibration_version=resolved,
                test_name="Espirometría",
            )

        mock_call.assert_not_called()
        assert res.clinical_state == "AI_NON_CONCLUSIVE"
        assert res.calibration_source == "calibration_disabled"
        assert res.non_conclusive_reason == "calibration_disabled"


class TestMainEndpointsSingleSource:
    def test_upload_and_analyze_uncalibrated_rx_fails_with_clear_spanish_message(self, monkeypatch, tmp_path):
        import os
        os.environ.setdefault("UPLOAD_DIR", str(tmp_path / "uploads"))

        from fastapi.testclient import TestClient
        import app.main as main_mod
        from app.services import prisma_client as prisma_client_module
        from app.services.ai.extractor import ExtractorService
        from app.services.ai.prediagnostic import PrediagnosticService

        class _FakePrisma:
            class _MedicaltestModel:
                async def find_unique(self_inner, where):
                    return {
                        "id": where["id"],
                        "name": "RX DE COLUMNA LUMBOSACRA AP Y LATERAL",
                        "options": [],
                    }

            medicaltest = _MedicaltestModel()

        monkeypatch.setattr(prisma_client_module, "get_prisma_client", lambda: _FakePrisma())
        monkeypatch.setattr(main_mod, "get_prisma_client", lambda: _FakePrisma())
        monkeypatch.setattr(main_mod, "UPLOAD_DIR", str(tmp_path / "uploads"))
        os.makedirs(main_mod.UPLOAD_DIR, exist_ok=True)
        monkeypatch.setattr(main_mod, "classifier", object())
        monkeypatch.setattr(main_mod, "extractor", ExtractorService(api_key="test-key"))
        monkeypatch.setattr(main_mod, "prediagnostic_svc", PrediagnosticService(api_key="test-key"))

        client = TestClient(main_mod.app)
        resp = client.post(
            "/api/v2/studies/upload-and-analyze",
            data={
                "study_type": "Rayos_X",
                "medical_test_id": "rx-test-1",
                "triggered_by_user_id": "user-1",
            },
            files={"file": ("rx_lumbar.pdf", b"%PDF-1.4\n%fake", "application/pdf")},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "error"
        assert body["error_code"] == "EXTRACTION_PROMPT_NOT_CONFIGURED"
        assert "RX DE COLUMNA LUMBOSACRA AP Y LATERAL" in body["message"]
        assert "/admin/services" in body["message"]

    def test_prediagnosis_from_params_uncalibrated_returns_missing_calibration(self, monkeypatch, tmp_path):
        import os
        os.environ.setdefault("UPLOAD_DIR", str(tmp_path / "uploads"))

        from fastapi.testclient import TestClient
        import app.main as main_mod
        from app.services import prisma_client as prisma_client_module
        from app.services.ai.prediagnostic import PrediagnosticService

        class _FakePrisma:
            class _MedicaltestModel:
                async def find_unique(self_inner, where):
                    return {
                        "id": where["id"],
                        "name": "TELE DE TORAX",
                        "options": {},
                    }

            medicaltest = _MedicaltestModel()

        monkeypatch.setattr(prisma_client_module, "get_prisma_client", lambda: _FakePrisma())
        monkeypatch.setattr(main_mod, "get_prisma_client", lambda: _FakePrisma())
        monkeypatch.setattr(main_mod, "prediagnostic_svc", PrediagnosticService(api_key="test-key"))

        client = TestClient(main_mod.app)
        resp = client.post(
            "/api/v2/studies/prediagnosis-from-params",
            params={"study_type": "Rayos_X", "medical_test_id": "rx-torax-1"},
            json={"extracted_data": {"hallazgos": ["normal"], "localizacion": "Tórax"}},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "success"
        assert body["clinical_state"] == "AI_NON_CONCLUSIVE"
        predx = body["prediagnosis"]
        assert predx["calibration_source"] == "missing_calibration"
        assert predx["prompt_source"] == "missing_calibration"
        assert "TELE DE TORAX" in predx["summary"]
        assert "/admin/services" in predx["summary"]
