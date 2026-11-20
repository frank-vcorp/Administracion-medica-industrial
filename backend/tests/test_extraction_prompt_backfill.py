"""
La papeleta deja de responder EXTRACTION_PROMPT_NOT_CONFIGURED en Audiometría
cuando está presente el prompt que publica la migración
20261120150000_backfill_empty_extraction_prompts.

El texto del prompt vive solo en el SQL de esa migración (no en el runtime).
"""
from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
MIGRATION = (
    REPO_ROOT
    / "frontend"
    / "prisma"
    / "migrations"
    / "20261120150000_backfill_empty_extraction_prompts"
    / "migration.sql"
)


def _prompt_from_migration(tag: str) -> str:
    sql = MIGRATION.read_text(encoding="utf-8")
    token = f"${tag}$"
    start = sql.index(token) + len(token)
    end = sql.index(token, start)
    return sql[start:end]


def test_migration_file_exists_and_prompts_are_the_historical_blocks():
    assert MIGRATION.is_file()
    audio = _prompt_from_migration("hist_audiometria_extraction_prompt")
    espiro = _prompt_from_migration("hist_espirometria_extraction_prompt")
    ecg = _prompt_from_migration("hist_ecg_extraction_prompt")
    assert "GUARDRAILS ESPECÍFICOS PARA AUDIOMETRÍA" in audio
    assert "REGLAS ESPECÍFICAS PARA EXTRACCIÓN DE AUDIOGRAMAS" in audio
    assert "GUARDRAILS ESPECÍFICOS PARA ESPIROMETRÍA" in espiro
    assert "ESPIROMETRÍA Sibelmed W20s" in espiro
    assert "EXTRACCIÓN DE ELECTROCARDIOGRAMA" in ecg
    assert "Eres un extractor de datos médicos estructurados." in audio
    assert audio.strip() and espiro.strip() and ecg.strip()


def test_prompt_text_is_not_a_runtime_constant():
    extractor = (REPO_ROOT / "backend/app/services/ai/extractor.py").read_text(encoding="utf-8")
    defaults = (
        REPO_ROOT / "frontend/src/lib/clinical/default-ai-calibration.ts"
    ).read_text(encoding="utf-8")
    criteria = (REPO_ROOT / "backend/app/audiometry_criteria.py").read_text(encoding="utf-8")
    marker = "GUARDRAILS ESPECÍFICOS PARA AUDIOMETRÍA"
    assert marker not in extractor
    assert marker not in defaults
    assert marker not in criteria
    assert "hist_audiometria_extraction_prompt" not in extractor
    assert "Criterio audiométrico" in criteria


def test_audiometria_with_migration_calibration_does_not_raise_not_configured(monkeypatch):
    import sys

    sys.path.insert(0, str(REPO_ROOT / "backend"))
    from app.services.ai.extractor import ExtractorService

    prompt = _prompt_from_migration("hist_audiometria_extraction_prompt")
    captured: dict = {}

    def _fake_call(self, file_path, prompt, provider, model, selected_study_type=None):
        captured["prompt"] = prompt
        captured["provider"] = provider
        captured["study"] = selected_study_type
        return (
            {
                "paciente": "Uribe Leticia",
                "fecha_estudio": "2026-11-20",
                "oido_derecho": {"va": {"500": 15, "1000": 10}, "pta": 13},
                "oido_izquierdo": {"va": {"500": 10, "1000": 10}, "pta": 10},
            },
            "m3",
            None,
        )

    monkeypatch.setattr(ExtractorService, "_call_with_dispatch", _fake_call)
    svc = ExtractorService(api_key="test-key", model="MiniMax-M3.1-Flash")

    result = svc.extract_by_type(
        "/fake/audiometria-uribe.pdf",
        "Audiometria",
        ai_calibration={
            "enabled": True,
            "canonicalStudyType": "Audiometria",
            "extraction": {
                "enabled": True,
                "provider": "m3",
                "version": "extract-audio-pre-single-source",
                "prompt": prompt,
            },
        },
        test_name="Audiometría",
    )

    assert captured["prompt"] == prompt
    assert captured["study"] == "Audiometria"
    assert "EXTRACTION_PROMPT_NOT_CONFIGURED" not in str(result)
    assert result["paciente"] == "Uribe Leticia"


def test_audiometria_without_prompt_still_raises_not_configured():
    import sys

    sys.path.insert(0, str(REPO_ROOT / "backend"))
    from app.services.ai.extractor import ExtractorService

    svc = ExtractorService(api_key="test-key", model="MiniMax-M3.1-Flash")
    with pytest.raises(ValueError, match="EXTRACTION_PROMPT_NOT_CONFIGURED"):
        svc.extract_by_type(
            "/fake/audiometria-uribe.pdf",
            "Audiometria",
            ai_calibration={
                "enabled": True,
                "schemaVersion": "V3",
                "extraction": {"enabled": True, "prompt": "   "},
            },
            test_name="Audiometría",
        )


def _psql_prefix() -> list[str]:
    psql = shutil.which("psql")
    if not psql:
        pytest.skip("psql no está instalado; no se ejecuta el backfill contra Postgres")
    direct = subprocess.run(
        [psql, "-d", "postgres", "-c", "SELECT 1"],
        text=True,
        capture_output=True,
    )
    if direct.returncode == 0:
        return [psql]
    sudo = subprocess.run(
        ["sudo", "-u", "postgres", psql, "-d", "postgres", "-c", "SELECT 1"],
        text=True,
        capture_output=True,
    )
    if sudo.returncode == 0:
        return ["sudo", "-u", "postgres", psql]
    pytest.skip("no hay conexión local a Postgres")


def _run_psql(prefix: list[str], database: str, sql: str, extra: list[str] | None = None):
    cmd = [*prefix, "-v", "ON_ERROR_STOP=1", "-d", database, *(extra or ["-f", "-"])]
    proc = subprocess.run(cmd, input=sql, text=True, capture_output=True)
    if proc.returncode != 0:
        raise AssertionError(proc.stderr or proc.stdout)
    return proc.stdout


def _md5(value: str) -> str:
    import hashlib

    return hashlib.md5(value.encode("utf-8")).hexdigest()


def test_migration_backfills_empty_prompts_and_is_idempotent():
    """Aplica el SQL real sobre un catálogo mínimo y comprueba Audiometría, Espiro, ECG y RX."""
    prefix = _psql_prefix()
    database = f"backfill_extract_{os.getpid()}"
    migration_sql = MIGRATION.read_text(encoding="utf-8")
    audio_md5 = _md5(_prompt_from_migration("hist_audiometria_extraction_prompt"))
    empty_md5 = _md5("")
    kept_md5 = _md5("YA CALIBRADO")
    created = subprocess.run(
        [*prefix, "-d", "postgres", "-c", f'CREATE DATABASE "{database}"'],
        text=True,
        capture_output=True,
    )
    if created.returncode != 0:
        raise AssertionError(created.stderr or created.stdout)

    setup = f"""
    DROP TABLE IF EXISTS medical_tests;
    CREATE TABLE medical_tests (
      id text PRIMARY KEY,
      code text,
      name text,
      options jsonb,
      "updatedAt" timestamptz
    );
    INSERT INTO medical_tests (id, code, name, options) VALUES
    (
      'audio-v3-empty',
      'GENERALES-003',
      'Audiometría',
      '{{
        "operationMode": "clinical_interpretation",
        "aiCalibration": {{
          "schemaVersion": "V3",
          "currentPublishedVersionId": "v-pub",
          "draft": {{"extraction": {{"prompt": "borrador no publicado"}}}},
          "legacyV1V2Snapshot": {{"snapshot": {{"extraction": {{"prompt": "legacy"}}}}}},
          "publishedVersions": [{{
            "versionId": "v-pub",
            "versionNumber": 3,
            "status": "published",
            "enabled": true,
            "canonicalStudyType": "Audiometria",
            "extraction": {{"enabled": true, "prompt": "", "provider": "m3", "model": "MiniMax-M3.1-Flash"}},
            "fieldDefinitions": [{{"key": "oido_derecho"}}],
            "clinicalCriteria": {{
              "prompt": "criterio publicado",
              "prediagnosisEnabled": true,
              "requiredParams": ["pta"],
              "confidenceThreshold": 0.6
            }},
            "presentation": {{"enabled": true, "schema": {{"studyType": "Audiometria"}}}}
          }}]
        }}
      }}'::jsonb
    ),
    (
      'audio-v3-kept',
      'AUDIO-KEEP',
      'AUDIOMETRIA',
      '{{
        "aiCalibration": {{
          "schemaVersion": "V3",
          "currentPublishedVersionId": "v1",
          "publishedVersions": [{{
            "versionId": "v1",
            "versionNumber": 1,
            "status": "published",
            "enabled": true,
            "extraction": {{"enabled": true, "prompt": "YA CALIBRADO", "provider": "m3"}},
            "clinicalCriteria": {{"prompt": "no tocar"}},
            "fieldDefinitions": [],
            "presentation": {{"enabled": false, "schema": null}}
          }}]
        }}
      }}'::jsonb
    ),
    (
      'audio-v3-nopub',
      'AUDIO-NOPUB',
      'Audiometria',
      '{{
        "aiCalibration": {{
          "schemaVersion": "V3",
          "currentPublishedVersionId": null,
          "publishedVersions": [],
          "draft": {{"label": "seguir en borrador", "clinicalCriteria": {{"prompt": "draft-clinico"}}}}
        }}
      }}'::jsonb
    ),
    (
      'audio-v1-empty',
      'GEN-AUDIO',
      'Audiometría tonal',
      '{{"aiCalibration": {{"enabled": true, "diagnosis": {{"prompt": "dx-custom"}}, "extraction": {{"prompt": "   "}}}}}}'::jsonb
    ),
    (
      'audio-manual',
      'AUDIO-MAN',
      'Audiometría',
      '{{"operationMode": "manual_service"}}'::jsonb
    ),
    (
      'audio-array',
      'AUDIO-ARR',
      'AUDIOMETRIA',
      '[]'::jsonb
    ),
    (
      'espiro-v3',
      'ESPIRO-1',
      'ESPIROMETRIA',
      '{{
        "aiCalibration": {{
          "schemaVersion": "V3",
          "currentPublishedVersionId": "e1",
          "publishedVersions": [{{
            "versionId": "e1",
            "versionNumber": 2,
            "status": "published",
            "enabled": true,
            "extraction": {{"prompt": null, "provider": "gemini"}},
            "clinicalCriteria": {{"prompt": "criterio espiro"}},
            "fieldDefinitions": [],
            "presentation": {{"enabled": false, "schema": null}}
          }}]
        }}
      }}'::jsonb
    ),
    (
      'espiro-bd',
      'GEN-BD',
      'ESPIROMETRIA CON BRONCODILATADOR',
      '{{}}'::jsonb
    ),
    (
      'ecg-null',
      'CARD-ECG',
      'ELECTROCARDIOGRAMA',
      NULL
    ),
    (
      'rx',
      'IMG-001',
      'RX DE COLUMNA LUMBOSACRA AP Y LATERAL',
      '{{}}'::jsonb
    ),
    (
      'tele',
      'IMG-002',
      'TELE DE TORAX',
      '{{"aiCalibration": {{"schemaVersion": "V3", "publishedVersions": [], "currentPublishedVersionId": null}}}}'::jsonb
    ),
    (
      'score',
      'GEN-SCORE',
      'SCORE CARDIOVASCULAR',
      '{{}}'::jsonb
    );
    """
    try:
        _run_psql(prefix, database, setup)
        _run_psql(prefix, database, migration_sql)
        _run_psql(prefix, database, migration_sql)

        check = r"""
        SELECT id,
               md5(coalesce(options #>> '{aiCalibration,publishedVersions,0,extraction,prompt}', '')),
               md5(coalesce(options #>> '{aiCalibration,extraction,prompt}', '')),
               coalesce(options #>> '{aiCalibration,publishedVersions,0,clinicalCriteria,prompt}', ''),
               coalesce(options #>> '{aiCalibration,publishedVersions,0,extraction,model}', ''),
               coalesce(options #>> '{aiCalibration,publishedVersions,0,fieldDefinitions,0,key}', ''),
               coalesce(options #>> '{aiCalibration,draft,extraction,prompt}', ''),
               coalesce(options #>> '{aiCalibration,legacyV1V2Snapshot,snapshot,extraction,prompt}', ''),
               coalesce(
                 jsonb_array_length(
                   CASE
                     WHEN jsonb_typeof(options #> '{aiCalibration,publishedVersions}') = 'array'
                     THEN options #> '{aiCalibration,publishedVersions}'
                     ELSE '[]'::jsonb
                   END
                 )::text,
                 '0'
               ),
               coalesce(options #>> '{aiCalibration,diagnosis,prompt}', ''),
               coalesce(options #>> '{aiCalibration,publishedVersions,0,extraction,provider}', ''),
               coalesce(options->>'operationMode', ''),
               coalesce(options #>> '{aiCalibration,publishedVersions,0,versionId}', ''),
               coalesce(options #>> '{aiCalibration,draft,clinicalCriteria,prompt}', ''),
               CASE
                 WHEN coalesce(options #>> '{aiCalibration,publishedVersions,0,extraction,prompt}', '')
                      LIKE '%ESPIROMETRÍA Sibelmed W20s%'
                   OR coalesce(options #>> '{aiCalibration,extraction,prompt}', '')
                      LIKE '%ESPIROMETRÍA Sibelmed W20s%'
                 THEN 'espiro' ELSE '' END,
               CASE
                 WHEN coalesce(options #>> '{aiCalibration,extraction,prompt}', '')
                      LIKE '%EXTRACCIÓN DE ELECTROCARDIOGRAMA%'
                   OR coalesce(options #>> '{aiCalibration,publishedVersions,0,extraction,prompt}', '')
                      LIKE '%EXTRACCIÓN DE ELECTROCARDIOGRAMA%'
                 THEN 'ecg' ELSE '' END
        FROM medical_tests
        ORDER BY id;
        """
        proc = subprocess.run(
            [*prefix, "-d", database, "-A", "-F", "\t", "-t", "-c", check],
            text=True,
            capture_output=True,
        )
        assert proc.returncode == 0, proc.stderr
        rows = {}
        for line in proc.stdout.splitlines():
            if not line.strip():
                continue
            cols = line.split("\t")
            rows[cols[0]] = cols

        pub = rows["audio-v3-empty"]
        assert pub[1] == audio_md5
        assert pub[3] == "criterio publicado"
        assert pub[4] == "MiniMax-M3.1-Flash"
        assert pub[5] == "oido_derecho"
        assert pub[6] == "borrador no publicado"
        assert pub[7] == "legacy"
        assert pub[8] == "1"

        kept = rows["audio-v3-kept"]
        assert kept[1] == kept_md5
        assert kept[3] == "no tocar"
        assert kept[8] == "1"

        nopub = rows["audio-v3-nopub"]
        assert nopub[1] == audio_md5
        assert nopub[8] == "1"
        assert nopub[12] == "backfill-extraction-audiometria-20261120"
        assert nopub[13] == "draft-clinico"
        assert nopub[3] == ""

        v1 = rows["audio-v1-empty"]
        assert v1[2] == audio_md5
        assert v1[9] == "dx-custom"

        manual = rows["audio-manual"]
        assert manual[2] == empty_md5
        assert manual[11] == "manual_service"
        assert manual[1] == empty_md5

        array_row = rows["audio-array"]
        assert array_row[2] == audio_md5

        espiro = rows["espiro-v3"]
        assert espiro[14] == "espiro"
        assert espiro[3] == "criterio espiro"
        assert espiro[10] == "gemini"
        assert espiro[8] == "1"

        bronco = rows["espiro-bd"]
        assert bronco[14] == "espiro"

        ecg = rows["ecg-null"]
        assert ecg[15] == "ecg"

        rx = rows["rx"]
        assert rx[1] == empty_md5 and rx[2] == empty_md5
        tele = rows["tele"]
        assert tele[1] == empty_md5 and tele[8] == "0"
        score = rows["score"]
        assert score[1] == empty_md5 and score[2] == empty_md5
    finally:
        subprocess.run(
            [*prefix, "-d", "postgres", "-c", f'DROP DATABASE IF EXISTS "{database}" WITH (FORCE)'],
            text=True,
            capture_output=True,
        )
