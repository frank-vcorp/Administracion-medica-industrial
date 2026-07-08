#!/usr/bin/env python3
"""
IMPL-20260708-FINAL — sync_nova_metadata.py

Script auxiliar que asigna `novaClave` y los metadatos LIS a los
MedicalTest existentes de cat=Laboratorio. Es la versión standalone
del modo --persistent-only de migrate_nova.py.

Uso:
  # Dry-run (no escribe)
  PYTHONPATH=backend/app python3 backend/scripts/sync_nova_metadata.py --dry-run

  # Aplicar
  PYTHONPATH=backend/app python3 backend/scripts/sync_nova_metadata.py --apply

Algoritmo:
  novaClave    = "LAB-" + (code[:6]).upper().replace(/[^A-Z0-9]/g, '')
  daysToResult = 1 (default)
  labMethodId  = round-robin entre LabMethod activos
  labSampleId  = round-robin entre LabSample activos
  labProcessAreaId = round-robin entre LabProcessArea activos

Idempotente: solo asigna campos NULL. No sobrescribe.

ID: IMPL-20260708-FINAL
Backup: context/SPECs/MIGRATION-NOVA-MAPPING.md §4
"""
from __future__ import annotations

import argparse
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


def _compute_nova_clave(code: str) -> str:
    cleaned = "".join(ch for ch in (code or "").upper() if ch.isalnum())
    return f"LAB-{cleaned[:6]}"


async def _run(apply: bool, lab_cat_id: str) -> Dict[str, Any]:
    """Ejecuta el sync. Devuelve reporte."""
    try:
        from app.services.prisma_client import init_prisma_client  # type: ignore
        prisma = init_prisma_client()
    except Exception as e:
        _emit("ERROR", "prisma_unavailable", error=f"{type(e).__name__}: {e}")
        return {"ok": False, "error": "prisma_unavailable", "detail": str(e)}

    try:
        tests = await prisma.medicaltest.find_many(where={"categoryId": lab_cat_id})
    except Exception as e:
        _emit("ERROR", "find_many_failed", error=f"{type(e).__name__}: {e}")
        return {"ok": False, "error": "find_many_failed", "detail": str(e)}

    methods: List[Any] = []
    samples: List[Any] = []
    areas: List[Any] = []
    try:
        methods = await prisma.labmethod.find_many(where={"active": True})
    except Exception as e:
        _emit("WARN", "labmethod_unavailable", error=f"{type(e).__name__}: {e}")
    try:
        samples = await prisma.labsample.find_many(where={"active": True})
    except Exception as e:
        _emit("WARN", "labsample_unavailable", error=f"{type(e).__name__}: {e}")
    try:
        areas = await prisma.labprocessarea.find_many(where={"active": True})
    except Exception as e:
        _emit("WARN", "labprocessarea_unavailable", error=f"{type(e).__name__}: {e}")

    result = {
        "ok": True,
        "applied": apply,
        "scanned": len(tests),
        "updated": 0,
        "skipped": 0,
        "errors": [],
        "examples": [],
    }

    for idx, t in enumerate(tests):
        if isinstance(t, dict):
            data = dict(t)
        else:
            data = {k: getattr(t, k, None) for k in (
                "id", "code", "novaClave", "labMethodId", "labSampleId",
                "labProcessAreaId", "daysToResult",
            )}

        update: Dict[str, Any] = {}

        if not data.get("novaClave"):
            update["novaClave"] = _compute_nova_clave(data.get("code") or "")
        if data.get("daysToResult") is None:
            update["daysToResult"] = 1
        if not data.get("labMethodId") and methods:
            m = methods[idx % len(methods)]
            mid = m.get("id") if isinstance(m, dict) else getattr(m, "id", None)
            if mid:
                update["labMethodId"] = mid
        if not data.get("labSampleId") and samples:
            s = samples[idx % len(samples)]
            sid = s.get("id") if isinstance(s, dict) else getattr(s, "id", None)
            if sid:
                update["labSampleId"] = sid
        if not data.get("labProcessAreaId") and areas:
            a = areas[idx % len(areas)]
            aid = a.get("id") if isinstance(a, dict) else getattr(a, "id", None)
            if aid:
                update["labProcessAreaId"] = aid

        if not update:
            result["skipped"] += 1
            continue

        if not apply:
            result["updated"] += 1  # dry-run: cuenta como "would update"
            if len(result["examples"]) < 3:
                result["examples"].append({
                    "id": data.get("id"),
                    "code": data.get("code"),
                    "would_set": update,
                })
            continue

        try:
            await prisma.medicaltest.update(where={"id": data["id"]}, data=update)
            result["updated"] += 1
            if len(result["examples"]) < 3:
                result["examples"].append({
                    "id": data.get("id"),
                    "code": data.get("code"),
                    "set": update,
                })
        except Exception as e:
            result["errors"].append(
                f"update {data.get('id')}: {type(e).__name__}: {e}"
            )

    _emit("OK", "sync_complete",
          scanned=result["scanned"],
          updated=result["updated"],
          skipped=result["skipped"],
          errors=len(result["errors"]),
          applied=apply)
    return result


def main() -> int:
    p = argparse.ArgumentParser(
        prog="sync_nova_metadata.py",
        description="Sincroniza novaClave + labMethodId/labSampleId/labProcessAreaId/daysToResult en MedicalTest de Laboratorio.",
    )
    p.add_argument("--apply", action="store_true", help="Aplicar cambios. Sin este flag, dry-run.")
    p.add_argument(
        "--lab-cat-id",
        default=os.getenv("LAB_CAT_ID", "64d3f863"),
        help="ID de TestCategory='Laboratorio' (default: 64d3f863).",
    )
    args = p.parse_args()

    try:
        result = asyncio.run(_run(apply=args.apply, lab_cat_id=args.lab_cat_id))
    except KeyboardInterrupt:
        _emit("ERROR", "interrupted")
        return 130
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())