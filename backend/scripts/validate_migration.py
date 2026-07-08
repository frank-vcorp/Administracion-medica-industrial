#!/usr/bin/env python3
"""
IMPL-20260708-FINAL — validate_migration.py

Valida el estado post-migración de los catálogos LIS en AMI.
Devuelve JSON estructurado con conteos, errores y warnings.

Uso:
  PYTHONPATH=backend/app python3 backend/scripts/validate_migration.py

ID: IMPL-20260708-FINAL
Backup: context/SPECs/MIGRATION-NOVA-MAPPING.md §6
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional


def _emit(level: str, msg: str, **payload: Any) -> None:
    line = {
        "ts": datetime.utcnow().isoformat() + "Z",
        "level": level,
        "msg": msg,
    }
    line.update(payload)
    print(json.dumps(line, ensure_ascii=False), flush=True)


async def _count(prisma: Any, model_name: str, where: Optional[Dict[str, Any]] = None) -> int:
    try:
        delegate = getattr(prisma, model_name, None)
        if delegate is None:
            return -1
        result = delegate.count(where=where) if where else delegate.count()
        if hasattr(result, "__await__"):
            return int(await result)
        return int(result)
    except Exception as e:
        _emit("WARN", "count_failed", model=model_name, error=f"{type(e).__name__}: {e}")
        return -1


async def _run(lab_cat_id: str) -> Dict[str, Any]:
    """Ejecuta la validación. Devuelve el reporte JSON."""
    report: Dict[str, Any] = {
        "ok": True,
        "ts": datetime.utcnow().isoformat() + "Z",
        "id": "IMPL-20260708-FINAL",
        "lab_cat_id": lab_cat_id,
        "catalogs": {},
        "medical_tests_laboratorio": 0,
        "medical_tests_with_novaClave": 0,
        "medical_tests_with_metadata": 0,
        "lab_analytes_total": 0,
        "lab_analytes_with_ranges": 0,
        "errors": [],
        "warnings": [],
    }

    try:
        from app.services.prisma_client import init_prisma_client  # type: ignore
        prisma = init_prisma_client()
    except Exception as e:
        report["ok"] = False
        report["errors"].append(f"prisma_unavailable: {type(e).__name__}: {e}")
        return report

    catalog_models = [
        "labUnit",
        "labSample",
        "labContainer",
        "labMethod",
        "labProcessArea",
        "labDepartment",
        "labClassification",
        "labIndication",
        "labSignature",
    ]

    for model in catalog_models:
        report["catalogs"][model] = await _count(prisma, model)

    # MedicalTest de cat=Laboratorio
    mt_lab = await _count(prisma, "medicalTest", where={"categoryId": lab_cat_id})
    report["medical_tests_laboratorio"] = mt_lab

    mt_with_clave = await _count(
        prisma,
        "medicalTest",
        where={"categoryId": lab_cat_id, "novaClave": {"not": None}},
    )
    report["medical_tests_with_novaClave"] = mt_with_clave

    mt_full = await _count(
        prisma,
        "medicalTest",
        where={
            "categoryId": lab_cat_id,
            "novaClave": {"not": None},
            "daysToResult": {"not": None},
            "labMethodId": {"not": None},
            "labSampleId": {"not": None},
            "labProcessAreaId": {"not": None},
        },
    )
    report["medical_tests_with_metadata"] = mt_full

    # Analytes
    report["lab_analytes_total"] = await _count(prisma, "labAnalyte")
    report["lab_analytes_with_ranges"] = await _count(
        prisma, "labAnalyte", where={"ranges": {"some": {}}}
    )

    # Warnings
    if mt_lab > 0 and mt_with_clave < mt_lab:
        diff = mt_lab - mt_with_clave
        report["warnings"].append(
            f"{diff} MedicalTest de Laboratorio sin novaClave "
            f"(ejecutar sync_nova_metadata.py --apply)"
        )
    if mt_lab > 0 and mt_full < mt_lab:
        diff = mt_lab - mt_full
        report["warnings"].append(
            f"{diff} MedicalTest de Laboratorio sin metadata LIS completa "
            f"(novaClave + labMethodId + labSampleId + labProcessAreaId + daysToResult)"
        )

    if report["lab_analytes_total"] > 0 and report["lab_analytes_with_ranges"] < report["lab_analytes_total"]:
        diff = report["lab_analytes_total"] - report["lab_analytes_with_ranges"]
        report["warnings"].append(
            f"{diff} LabAnalyte sin rangos de referencia"
        )

    # Catálogo vacío = informativo, no error
    for cat, n in report["catalogs"].items():
        if n == 0:
            report["warnings"].append(
                f"Catálogo {cat} vacío (seed pendiente o no aplica)"
            )

    if report["errors"]:
        report["ok"] = False

    _emit("OK" if report["ok"] else "ERROR", "validation_complete",
          ok=report["ok"],
          errors=len(report["errors"]),
          warnings=len(report["warnings"]))
    return report


def main() -> int:
    lab_cat_id = os.getenv("LAB_CAT_ID", "64d3f863")
    try:
        result = asyncio.run(_run(lab_cat_id=lab_cat_id))
    except KeyboardInterrupt:
        _emit("ERROR", "interrupted")
        return 130
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())