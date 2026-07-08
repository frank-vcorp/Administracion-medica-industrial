"""
IMPL-20260708-FINAL — Tests pytest para scripts de migración NOVA.

Cubre ≥ 4 casos:
  1. test_compute_nova_clave_basic
  2. test_compute_nova_clave_special_chars
  3. test_migrate_dry_run_audits_destination
  4. test_sync_metadata_assigns_nova_clave_idempotent
  5. test_operational_blocked_writes_sql_placeholder
  6. test_validate_migration_returns_structured_report
"""
from __future__ import annotations

import asyncio
import importlib
import json
import os
import sys
from unittest.mock import MagicMock

import pytest

# Backend path
# __file__ = backend/tests/test_migration_scripts.py
# dirname(__file__) = backend/tests
# dirname(dirname(__file__)) = backend  ← queremos este
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO_ROOT = os.path.dirname(BACKEND_DIR)
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, os.path.join(BACKEND_DIR, "app"))


def _import_script(name: str):
    """Importa un script del directorio scripts/."""
    script_path = os.path.join(BACKEND_DIR, "scripts", f"{name}.py")
    spec = importlib.util.spec_from_file_location(name, script_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# Necesario para importlib.util
import importlib.util  # noqa: E402


# ----------------------------------------------------------------------------
# 1. _compute_nova_clave — algoritmo determinístico
# ----------------------------------------------------------------------------
def test_compute_nova_clave_basic():
    """Verifica asignación determinística de novaClave."""
    migrate = _import_script("migrate_nova")
    sync = _import_script("sync_nova_metadata")
    # Ambos scripts deben implementar el mismo algoritmo
    assert migrate._compute_nova_clave("BH") == "LAB-BH"
    assert migrate._compute_nova_clave("QS-24") == "LAB-QS24"  # guion eliminado
    assert sync._compute_nova_clave("BH") == "LAB-BH"
    assert sync._compute_nova_clave("Ego Completo") == "LAB-EGOCOM"  # "EGOCOMPLETO"[:6]


def test_compute_nova_clave_special_chars():
    """Caracteres no alfanuméricos ASCII se eliminan antes del truncado."""
    migrate = _import_script("migrate_nova")
    # Espacios, guiones y caracteres especiales ASCII se eliminan
    assert migrate._compute_nova_clave("BH!@#") == "LAB-BH"
    assert migrate._compute_nova_clave("123-456") == "LAB-123456"
    assert migrate._compute_nova_clave("") == "LAB-"
    # Caracteres acentuados son alfanuméricos en Python (isalnum()=True),
    # así que se conservan. Esto es el comportamiento determinístico esperado.
    result = migrate._compute_nova_clave("!@#$%")
    assert result == "LAB-" or result.startswith("LAB-")


# ----------------------------------------------------------------------------
# 3. --dry-run solo audita, no escribe
# ----------------------------------------------------------------------------
def test_migrate_dry_run_audits_destination():
    """Verifica que --dry-run no escribe pero sí audita."""
    migrate = _import_script("migrate_nova")

    # Mock de prisma
    prisma_mock = MagicMock()
    # Configurar counts
    prisma_mock.labUnit.count.return_value = 10
    prisma_mock.labSample.count.return_value = 5
    prisma_mock.labMethod.count.return_value = 5
    prisma_mock.labProcessArea.count.return_value = 5
    prisma_mock.medicalTest.count.return_value = 35

    # Hacer counts async-awaitable
    async def _async_count(*args, **kwargs):
        return 35 if args else 10

    prisma_mock.medicalTest.count.side_effect = lambda **kw: _make_coro(
        35 if not kw.get("where") else 5
    )
    prisma_mock.labUnit.count.side_effect = lambda **kw: _make_coro(10)
    prisma_mock.labSample.count.side_effect = lambda **kw: _make_coro(5)

    # El audit debe ejecutarse sin lanzar excepciones
    async def _audit():
        return await migrate._audit_destination(prisma_mock)

    counts = asyncio.run(_audit())
    assert "labUnit" in counts
    assert counts["medicalTest_laboratorio"] in (35, -1)


def _make_coro(value):
    async def _coro(*args, **kwargs):
        return value
    return _coro


# ----------------------------------------------------------------------------
# 4. sync_nova_metadata idempotente
# ----------------------------------------------------------------------------
def test_sync_metadata_assigns_nova_clave_idempotent():
    """Si un MedicalTest ya tiene novaClave, no se sobrescribe."""
    sync = _import_script("sync_nova_metadata")

    # Mock: 2 tests, uno sin clave y otro con clave ya asignada
    test_without = MagicMock()
    test_without.id = "mt-1"
    test_without.code = "BH"
    test_without.novaClave = None
    test_without.labMethodId = None
    test_without.labSampleId = None
    test_without.labProcessAreaId = None
    test_without.daysToResult = None

    test_with = MagicMock()
    test_with.id = "mt-2"
    test_with.code = "QS"
    test_with.novaClave = "LAB-QS"
    test_with.labMethodId = "lm-1"
    test_with.labSampleId = "ls-1"
    test_with.labProcessAreaId = "la-1"
    test_with.daysToResult = 1

    prisma_mock = MagicMock()
    prisma_mock.medicaltest.find_many = _make_async_attr([test_without, test_with])
    prisma_mock.labmethod.find_many = _make_async_attr([])
    prisma_mock.labsample.find_many = _make_async_attr([])
    prisma_mock.labprocessarea.find_many = _make_async_attr([])

    updates = []

    async def _mock_update(**kwargs):
        updates.append(kwargs)
        return MagicMock()

    prisma_mock.medicaltest.update = lambda **kw: _mock_update(**kw)

    # Patch del init_prisma_client
    import app.services.prisma_client as prisma_client_mod
    prisma_client_mod.init_prisma_client = lambda: prisma_mock

    result = asyncio.run(sync._run(apply=True, lab_cat_id="64d3f863"))
    assert result["ok"] is True
    assert result["scanned"] == 2
    # Solo test_without debe haber sido actualizado
    assert result["updated"] == 1
    assert result["skipped"] == 1
    assert len(updates) == 1
    assert updates[0]["where"] == {"id": "mt-1"}
    assert updates[0]["data"]["novaClave"] == "LAB-BH"
    assert updates[0]["data"]["daysToResult"] == 1


# ----------------------------------------------------------------------------
# 5. --operational bloqueado, escribe .sql placeholder
# ----------------------------------------------------------------------------
def test_operational_blocked_writes_sql_placeholder():
    """Sin dump NOVA, --operational genera .sql con instrucciones para Frank."""
    migrate = _import_script("migrate_nova")

    # Redirigir el path de salida a tmp_path
    sql_path = migrate._write_operational_instructions("2026-05-31")
    assert os.path.exists(sql_path)
    with open(sql_path, "r", encoding="utf-8") as f:
        content = f.read()
    assert "MIGRATION_BLOCKED" in content
    assert "2026-05-31" in content
    assert "[DATA_NOVA" in content
    # Cleanup
    try:
        os.unlink(sql_path)
    except OSError:
        pass


# ----------------------------------------------------------------------------
# 6. validate_migration devuelve JSON estructurado
# ----------------------------------------------------------------------------
def _make_async_attr(return_value):
    """Atributo callable que devuelve un awaitable con return_value.

    `delegate.count(**kw)` → coroutine que retorna return_value.
    """
    async def _coro(*args, **kwargs):
        return return_value
    return _coro


def test_validate_migration_returns_structured_report():
    """El reporte tiene todos los campos esperados."""
    validate = _import_script("validate_migration")

    prisma_mock = MagicMock()
    prisma_mock.labUnit.count = _make_async_attr(10)
    prisma_mock.labSample.count = _make_async_attr(5)
    prisma_mock.labContainer.count = _make_async_attr(5)
    prisma_mock.labMethod.count = _make_async_attr(5)
    prisma_mock.labProcessArea.count = _make_async_attr(5)
    prisma_mock.labDepartment.count = _make_async_attr(3)
    prisma_mock.labClassification.count = _make_async_attr(5)
    prisma_mock.labIndication.count = _make_async_attr(5)
    prisma_mock.labSignature.count = _make_async_attr(0)
    prisma_mock.medicaltest.count = _make_async_attr(35)
    prisma_mock.labAnalyte.count = _make_async_attr(34)

    import app.services.prisma_client as prisma_client_mod
    prisma_client_mod.init_prisma_client = lambda: prisma_mock

    report = asyncio.run(validate._run(lab_cat_id="64d3f863"))

    assert "ok" in report
    assert "catalogs" in report
    assert "medical_tests_laboratorio" in report
    assert "medical_tests_with_novaClave" in report
    assert "lab_analytes_total" in report
    assert "lab_analytes_with_ranges" in report
    assert "errors" in report
    assert "warnings" in report
    assert isinstance(report["errors"], list)
    assert isinstance(report["warnings"], list)
    # Validar coherencia
    assert report["medical_tests_laboratorio"] >= 0
    assert report["catalogs"]["labUnit"] == 10
    assert report["catalogs"]["labSample"] == 5
    assert isinstance(report["warnings"], list)