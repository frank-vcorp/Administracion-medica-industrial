#!/usr/bin/env python3
"""
IMPL-20260706-16 (Slice 2): Validacion runtime del refactor Prisma Python naming.

Prisma Python usa snake_case para nombres de modelos (model LabUnit -> prisma.labunit).
Este script ejecuta queries reales contra la DB para verificar que el refactor
de los servicios del backend no rompio el contrato con Prisma.

Cubre:
  - 9 catalogos LIS (labunit, labsample, labcontainer, labmethod, labprocessarea,
    labdepartment, labclassification, labindication, auditlog).
  - Slice B: laborder, laborderitem.
  - Reportes masivos: project, projectreport.
  - Autocomplete: worker, company, medicaltest.
  - Smoke test end-to-end via lab_catalog_service.list_catalog().

Uso:
    cd backend
    DATABASE_URL="postgresql://user:pass@host:port/db" \
        python3 scripts/test_prisma_naming.py

Exit codes:
    0 -> todas las queries OK (refactor validado en runtime)
    1 -> al menos una query fallo (bug del refactor)
    2 -> error de conexion / DATABASE_URL faltante
"""
from __future__ import annotations

import asyncio
import os
import sys
import traceback
from typing import Any, Awaitable, List, Tuple


def _setup_path() -> None:
    backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, backend_root)


async def _try(label: str, coro_factory: Awaitable[Any]) -> Tuple[bool, str]:
    """Ejecuta una coroutine, captura el resultado o error."""
    try:
        result = await coro_factory
        if result is None:
            return True, "OK (None)"
        if isinstance(result, (list, tuple)):
            return True, f"OK ({len(result)} rows)"
        return True, f"OK ({type(result).__name__})"
    except AttributeError as e:
        # El bug original: AttributeError: 'Prisma' object has no attribute 'labUnit'
        return False, f"FAIL AttributeError: {e}"
    except Exception as e:  # noqa: BLE001
        return False, f"FAIL {type(e).__name__}: {e}"


async def _run_all_tests() -> List[Tuple[str, bool, str]]:
    from app.services.prisma_client import init_prisma_client, set_prisma_client

    prisma = init_prisma_client()
    set_prisma_client(prisma)
    await prisma.connect()

    results: List[Tuple[str, bool, str]] = []

    # --- Catalogos LIS ---
    catalog_models = [
        "labunit", "labsample", "labcontainer", "labmethod",
        "labprocessarea", "labdepartment", "labclassification",
        "labindication", "auditlog",
    ]
    for m in catalog_models:
        ok, msg = await _try(f"count({m})", getattr(prisma, m).count())
        results.append((f"count({m})", ok, msg))

    # --- Slice B (LabOrder) ---
    for m in ["laborder", "laborderitem"]:
        ok, msg = await _try(f"find_many({m}, take=3)", getattr(prisma, m).find_many(take=3))
        results.append((f"find_many({m}, take=3)", ok, msg))

    # --- Reportes masivos ---
    for m in ["project", "projectreport"]:
        ok, msg = await _try(f"count({m})", getattr(prisma, m).count())
        results.append((f"count({m})", ok, msg))

    # --- Autocomplete (worker/company/medicaltest) ---
    for m in ["worker", "company", "medicaltest"]:
        ok, msg = await _try(f"find_many({m}, take=3)", getattr(prisma, m).find_many(take=3))
        results.append((f"find_many({m}, take=3)", ok, msg))

    # --- Smoke test end-to-end via el servicio ---
    try:
        from app.services.lab_catalog_service import list_catalog, set_prisma_client as _set_svc
        _set_svc(prisma)
        # FIX-20260706-16: list_catalog es async (Prisma Python es async-only).
        res = await list_catalog(
            mod="unidades", draw=1, start=0, length=5,
            search=None, order_column=0, order_dir="asc",
        )
        n = len(res.get("data", []))
        total = res.get("recordsTotal", "?")
        results.append(
            (f"lab_catalog_service.list_catalog(mod='unidades')", True,
             f"OK ({n} items, recordsTotal={total})")
        )
    except Exception as e:  # noqa: BLE001
        results.append(
            (f"lab_catalog_service.list_catalog(mod='unidades')", False,
             f"FAIL {type(e).__name__}: {e}")
        )

    await prisma.disconnect()
    return results


def main() -> int:
    _setup_path()

    if not os.environ.get("DATABASE_URL"):
        print("ERROR: DATABASE_URL no esta definida.", file=sys.stderr)
        print("Uso:", file=sys.stderr)
        print('  DATABASE_URL="postgresql://user:pass@host:port/db" \\', file=sys.stderr)
        print('      python3 scripts/test_prisma_naming.py', file=sys.stderr)
        return 2

    print("=" * 72)
    print("IMPL-20260706-16 (Slice 2): Test runtime Prisma Python naming")
    print("=" * 72)
    print(f"DATABASE_URL: {os.environ['DATABASE_URL'][:50]}...")
    print()

    try:
        results = asyncio.run(_run_all_tests())
    except Exception as e:  # noqa: BLE001
        print(f"ERROR conectando a la DB: {type(e).__name__}: {e}", file=sys.stderr)
        traceback.print_exc()
        return 2

    failed = 0
    for label, ok, msg in results:
        prefix = "[OK]" if ok else "[FAIL]"
        print(f"{prefix} {label}: {msg}")
        if not ok:
            failed += 1

    print()
    print("=" * 72)
    if failed == 0:
        print(f"REFACTOR VALIDADO EN RUNTIME ({len(results)} queries OK)")
        return 0
    else:
        print(f"{failed} QUERIES FALLARON de {len(results)}")
        return 1


if __name__ == "__main__":
    sys.exit(main())