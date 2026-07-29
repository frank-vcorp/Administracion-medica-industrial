"""
IMPL-20260707-17: Fase 1 NOVA absorción (ARCH-20260707-17) — E.

Servicio para catálogo avanzado de estudios de laboratorio:
MedicalTest (filtrado por categoría Laboratorio) + LabAnalyte + LabReferenceRange.

Incluye seed de 5 estudios típicos (BH, QS, EGO, Perfil Lipídico, TP) con
6-8 analitos cada uno y rangos de referencia por edad/sexo.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from app.schemas.pending_orders import LAB_CATEGORY_ID


def _serialize(obj: Any) -> Dict[str, Any]:
    if obj is None:
        return {}
    if hasattr(obj, "model_dump"):
        d = obj.model_dump()
    elif hasattr(obj, "__dict__"):
        d = dict(obj.__dict__)
    elif isinstance(obj, dict):
        d = dict(obj)
    else:
        return obj
    out: Dict[str, Any] = {}
    for k, v in d.items():
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, (str, int, float, bool)) or v is None:
            out[k] = v
        else:
            out[k] = str(v)
    return out


def _now() -> datetime:
    return datetime.utcnow()


# ---------------------------------------------------------------------------
# Helpers de hidratación
# ---------------------------------------------------------------------------
async def _get_unit_code(prisma: Any, unit_id: Optional[str]) -> Optional[str]:
    if not unit_id:
        return None
    try:
        u = await prisma.labunit.find_unique(where={"id": unit_id})
        if u is None:
            return None
        return u.get("code") if isinstance(u, dict) else getattr(u, "code", None)
    except Exception:
        return None


async def _resolve_unit_id(prisma: Any, code: Optional[str]) -> Optional[str]:
    """Busca LabUnit por code (case-insensitive). Si no existe, devuelve None."""
    if not code:
        return None
    try:
        rows = await prisma.labunit.find_many(
            where={"code": {"equals": code, "mode": "insensitive"}},
            take=1,
        )
        if rows:
            r = rows[0]
            return r.get("id") if isinstance(r, dict) else getattr(r, "id", None)
    except Exception:
        return None
    return None


# ---------------------------------------------------------------------------
# Listado / Get
# ---------------------------------------------------------------------------
async def list_lab_catalog(
    prisma: Any,
    search: Optional[str] = None,
    category_id: str = LAB_CATEGORY_ID,
) -> Dict[str, Any]:
    where: Dict[str, Any] = {"categoryId": category_id}
    if search:
        where["OR"] = [
            {"code": {"contains": search, "mode": "insensitive"}},
            {"name": {"contains": search, "mode": "insensitive"}},
        ]
    tests = await prisma.medicaltest.find_many(
        where=where,
        include={"analytes": {"include": {"referenceRanges": True, "defaultUnit": True}}},
        order_by={"code": "asc"},
    )

    rows: List[Dict[str, Any]] = []
    for t in tests:
        t_dict = _serialize(t)
        analytes_payload: List[Dict[str, Any]] = []
        analytes = t.get("analytes") if isinstance(t, dict) else getattr(t, "analytes", None)
        if not analytes:
            analytes = []
        for a in analytes:
            a_dict = _serialize(a)
            default_unit = (
                a.get("defaultUnit") if isinstance(a, dict) else getattr(a, "defaultUnit", None)
            )
            default_unit_code = (
                default_unit.get("code") if isinstance(default_unit, dict) else getattr(default_unit, "code", None)
            ) if default_unit else None
            ranges = (
                a.get("referenceRanges")
                if isinstance(a, dict)
                else getattr(a, "referenceRanges", None)
            ) or []
            ranges_payload: List[Dict[str, Any]] = []
            for r in ranges:
                r_dict = _serialize(r)
                unit = (
                    r.get("unit") if isinstance(r, dict) else getattr(r, "unit", None)
                )
                unit_code = (
                    unit.get("code") if isinstance(unit, dict) else getattr(unit, "code", None)
                ) if unit else r_dict.get("unitId")
                ranges_payload.append({
                    "id": r_dict.get("id"),
                    "sex": r_dict.get("sex") or "A",
                    "ageMinMonths": r_dict.get("ageMinMonths"),
                    "ageMaxMonths": r_dict.get("ageMaxMonths"),
                    "valueMin": r_dict.get("valueMin"),
                    "valueMax": r_dict.get("valueMax"),
                    "textValue": r_dict.get("textValue"),
                    "unitCode": unit_code,
                    "criticalLow": r_dict.get("criticalLow"),
                    "criticalHigh": r_dict.get("criticalHigh"),
                    "isCritical": bool(r_dict.get("isCritical", False)),
                })
            analytes_payload.append({
                "id": a_dict.get("id"),
                "code": a_dict.get("code"),
                "name": a_dict.get("name"),
                "orderIndex": int(a_dict.get("orderIndex") or 0),
                "dataType": a_dict.get("dataType") or "NUMERIC",
                "defaultUnitCode": default_unit_code,
                "active": bool(a_dict.get("active", True)),
                "referenceRanges": ranges_payload,
            })
        analytes_payload.sort(key=lambda x: (x["orderIndex"], x["code"]))
        rows.append({
            "id": t_dict.get("id"),
            "code": t_dict.get("code"),
            "name": t_dict.get("name"),
            "categoryId": t_dict.get("categoryId"),
            "novaClave": t_dict.get("novaClave"),
            "daysToResult": t_dict.get("daysToResult"),
            "isProfile": bool(t_dict.get("isProfile", False)),
            "isPackage": bool(t_dict.get("isPackage", False)),
            "analytes": analytes_payload,
        })
    return {"total": len(rows), "rows": rows}


async def get_lab_catalog_test(test_id: str, prisma: Any) -> Optional[Dict[str, Any]]:
    t = await prisma.medicaltest.find_unique(
        where={"id": test_id},
        include={"analytes": {"include": {"referenceRanges": True, "defaultUnit": True}}},
    )
    if t is None:
        return None
    t_dict = _serialize(t)
    result = await list_lab_catalog(prisma=prisma, search=None, category_id=t_dict.get("categoryId") or LAB_CATEGORY_ID)
    for row in result["rows"]:
        if row["id"] == test_id:
            return row
    return None


# ---------------------------------------------------------------------------
# LabAnalyte CRUD
# ---------------------------------------------------------------------------
async def create_analyte(data: Dict[str, Any], current_user: Dict[str, str], prisma: Any) -> Dict[str, Any]:
    user_id = current_user.get("id")
    if not user_id:
        raise ValueError("current_user.id es obligatorio")

    test_id = data.get("medicalTestId")
    if not test_id:
        raise ValueError("medicalTestId es obligatorio")
    test = await prisma.medicaltest.find_unique(where={"id": test_id})
    if test is None:
        raise LookupError(f"MedicalTest {test_id} no existe")

    # Resolver defaultUnitCode → defaultUnitId
    default_unit_id = await _resolve_unit_id(prisma, data.get("defaultUnitCode"))

    existing = await prisma.labanalyte.find_unique(
        where={"medicalTestId_code": {"medicalTestId": test_id, "code": data["code"]}}
    )
    if existing is not None:
        raise ValueError(f"Ya existe analito con code={data['code']} en este MedicalTest")

    now = _now()
    analyte = await prisma.labanalyte.create(
        data={
            "medicalTestId": test_id,
            "code": data["code"],
            "name": data["name"],
            "orderIndex": data.get("orderIndex", 0),
            "dataType": data.get("dataType", "NUMERIC"),
            "defaultUnitId": default_unit_id,
            "active": data.get("active", True),
            "createdAt": now,
            "updatedAt": now,
        }
    )
    return _serialize(analyte)


async def update_analyte(analyte_id: str, data: Dict[str, Any], current_user: Dict[str, str], prisma: Any) -> Dict[str, Any]:
    existing = await prisma.labanalyte.find_unique(where={"id": analyte_id})
    if existing is None:
        raise LookupError(f"LabAnalyte {analyte_id} no existe")

    payload: Dict[str, Any] = {}
    for f in ("name", "orderIndex", "dataType", "active"):
        if f in data:
            payload[f] = data[f]
    if "defaultUnitCode" in data:
        payload["defaultUnitId"] = await _resolve_unit_id(prisma, data.get("defaultUnitCode"))

    if not payload:
        return _serialize(existing)
    payload["updatedAt"] = _now()
    updated = await prisma.labanalyte.update(where={"id": analyte_id}, data=payload)
    return _serialize(updated)


async def delete_analyte(analyte_id: str, current_user: Dict[str, str], prisma: Any) -> Dict[str, Any]:
    existing = await prisma.labanalyte.find_unique(where={"id": analyte_id})
    if existing is None:
        raise LookupError(f"LabAnalyte {analyte_id} no existe")
    await prisma.labanalyte.delete(where={"id": analyte_id})
    return {"id": analyte_id, "deleted": True}


# ---------------------------------------------------------------------------
# LabReferenceRange CRUD
# ---------------------------------------------------------------------------
async def create_reference_range(data: Dict[str, Any], current_user: Dict[str, str], prisma: Any) -> Dict[str, Any]:
    analyte_id = data.get("analyteId")
    if not analyte_id:
        raise ValueError("analyteId es obligatorio")
    analyte = await prisma.labanalyte.find_unique(where={"id": analyte_id})
    if analyte is None:
        raise LookupError(f"LabAnalyte {analyte_id} no existe")

    unit_id = await _resolve_unit_id(prisma, data.get("unitCode"))

    now = _now()
    rng = await prisma.labreferencerange.create(
        data={
            "analyteId": analyte_id,
            "sex": data.get("sex", "A"),
            "ageMinMonths": data.get("ageMinMonths"),
            "ageMaxMonths": data.get("ageMaxMonths"),
            "valueMin": data.get("valueMin"),
            "valueMax": data.get("valueMax"),
            "textValue": data.get("textValue"),
            "unitId": unit_id,
            "criticalLow": data.get("criticalLow"),
            "criticalHigh": data.get("criticalHigh"),
            "isCritical": data.get("isCritical", False),
            "createdAt": now,
            "updatedAt": now,
        }
    )
    return _serialize(rng)


async def update_reference_range(range_id: str, data: Dict[str, Any], current_user: Dict[str, str], prisma: Any) -> Dict[str, Any]:
    existing = await prisma.labreferencerange.find_unique(where={"id": range_id})
    if existing is None:
        raise LookupError(f"LabReferenceRange {range_id} no existe")

    payload: Dict[str, Any] = {}
    for f in ("sex", "ageMinMonths", "ageMaxMonths", "valueMin", "valueMax", "textValue", "criticalLow", "criticalHigh", "isCritical"):
        if f in data:
            payload[f] = data[f]
    if "unitCode" in data:
        payload["unitId"] = await _resolve_unit_id(prisma, data.get("unitCode"))

    if not payload:
        return _serialize(existing)
    payload["updatedAt"] = _now()
    updated = await prisma.labreferencerange.update(where={"id": range_id}, data=payload)
    return _serialize(updated)


async def delete_reference_range(range_id: str, current_user: Dict[str, str], prisma: Any) -> Dict[str, Any]:
    existing = await prisma.labreferencerange.find_unique(where={"id": range_id})
    if existing is None:
        raise LookupError(f"LabReferenceRange {range_id} no existe")
    await prisma.labreferencerange.delete(where={"id": range_id})
    return {"id": range_id, "deleted": True}


# ---------------------------------------------------------------------------
# Seed de 5 estudios típicos
# ---------------------------------------------------------------------------
async def seed_typical_tests(current_user: Dict[str, str], prisma: Any, category_id: str = LAB_CATEGORY_ID) -> Dict[str, Any]:
    """Inserta (si no existen) 5 estudios típicos con sus analitos y rangos.

    Estudios: BH (Biometría Hemática), QS (Química Sanguínea), EGO (Examen General de Orina),
    Perfil Lipídico, TP (Tiempos de Coagulación / Tiempo de Protrombina).
    """
    user_id = current_user.get("id")

    # Verificar categoría existe
    cat = await prisma.testcategory.find_unique(where={"id": category_id})
    if cat is None:
        # Fallback: usar el primer TestCategory que tenga id que contenga 'Lab'
        cats = await prisma.testcategory.find_many(take=10)
        for c in cats:
            cid = c.get("id") if isinstance(c, dict) else getattr(c, "id", None)
            cname = c.get("name") if isinstance(c, dict) else getattr(c, "name", "")
            if cid and ("lab" in str(cname).lower() or cid == "16c16ef0-cf35-4fe5-9bef-311f6fc8674c"):
                category_id = cid
                break

    studies = _seed_studies_definition()

    seeded_tests = 0
    seeded_analytes = 0
    seeded_ranges = 0
    now = _now()

    for study in studies:
        existing = await prisma.medicaltest.find_unique(where={"code": study["code"]})
        if existing is None:
            test = await prisma.medicaltest.create(
                data={
                    "code": study["code"],
                    "name": study["name"],
                    "categoryId": category_id,
                    "options": [],
                    "novaClave": study.get("novaClave"),
                    "daysToResult": study.get("daysToResult", 1),
                    "isProfile": study.get("isProfile", False),
                    "isPackage": study.get("isPackage", False),
                    "createdAt": now,
                    "updatedAt": now,
                }
            )
            test_id = test.get("id") if isinstance(test, dict) else getattr(test, "id", None)
            seeded_tests += 1
        else:
            test_id = existing.get("id") if isinstance(existing, dict) else getattr(existing, "id", None)

        for analyte_def in study["analytes"]:
            # Buscar analito existente
            analyte = await prisma.labanalyte.find_unique(
                where={"medicalTestId_code": {"medicalTestId": test_id, "code": analyte_def["code"]}}
            )
            if analyte is None:
                default_unit_id = await _resolve_unit_id(prisma, analyte_def.get("defaultUnitCode"))
                analyte = await prisma.labanalyte.create(
                    data={
                        "medicalTestId": test_id,
                        "code": analyte_def["code"],
                        "name": analyte_def["name"],
                        "orderIndex": analyte_def.get("orderIndex", 0),
                        "dataType": analyte_def.get("dataType", "NUMERIC"),
                        "defaultUnitId": default_unit_id,
                        "active": True,
                        "createdAt": now,
                        "updatedAt": now,
                    }
                )
                seeded_analytes += 1

            analyte_id = analyte.get("id") if isinstance(analyte, dict) else getattr(analyte, "id", None)
            if not analyte_id:
                continue

            # Rangos
            for rng_def in analyte_def.get("ranges", []):
                # Verificar si ya existe (por analyte + sex + ageMin + ageMax)
                existing_ranges = await prisma.labreferencerange.find_many(
                    where={"analyteId": analyte_id, "sex": rng_def["sex"]},
                )
                age_min = rng_def.get("ageMinMonths")
                age_max = rng_def.get("ageMaxMonths")
                already = False
                for er in existing_ranges:
                    if er.get("ageMinMonths") == age_min and er.get("ageMaxMonths") == age_max:
                        already = True
                        break
                if already:
                    continue

                unit_id = await _resolve_unit_id(prisma, rng_def.get("unitCode"))
                await prisma.labreferencerange.create(
                    data={
                        "analyteId": analyte_id,
                        "sex": rng_def["sex"],
                        "ageMinMonths": rng_def.get("ageMinMonths"),
                        "ageMaxMonths": rng_def.get("ageMaxMonths"),
                        "valueMin": rng_def.get("valueMin"),
                        "valueMax": rng_def.get("valueMax"),
                        "textValue": rng_def.get("textValue"),
                        "unitId": unit_id,
                        "criticalLow": rng_def.get("criticalLow"),
                        "criticalHigh": rng_def.get("criticalHigh"),
                        "isCritical": rng_def.get("isCritical", False),
                        "createdAt": now,
                        "updatedAt": now,
                    }
                )
                seeded_ranges += 1

    return {
        "status": "success",
        "seeded": seeded_tests,
        "analytes": seeded_analytes,
        "referenceRanges": seeded_ranges,
        "note": "Seed idempotente: ya existentes se omiten sin error.",
    }


def _seed_studies_definition() -> List[Dict[str, Any]]:
    """Definición canónica de los 5 estudios típicos.

    Rangos basados en valores de referencia típicos para población adulta mexicana
    (varían por laboratorio — ajustar localmente)."""
    return [
        # ------------------------------------------------------------------
        # BH — Biometría Hemática
        # ------------------------------------------------------------------
        {
            "code": "BH",
            "name": "Biometría Hemática",
            "novaClave": "BH",
            "daysToResult": 1,
            "analytes": [
                {"code": "HGB", "name": "Hemoglobina", "orderIndex": 1, "defaultUnitCode": "g/dL",
                 "ranges": [
                     {"sex": "M", "ageMinMonths": 216, "valueMin": 13.5, "valueMax": 17.5, "unitCode": "g/dL",
                      "criticalLow": 8.0, "criticalHigh": 20.0},
                     {"sex": "F", "ageMinMonths": 216, "valueMin": 12.0, "valueMax": 16.0, "unitCode": "g/dL",
                      "criticalLow": 8.0, "criticalHigh": 20.0},
                 ]},
                {"code": "HTO", "name": "Hematocrito", "orderIndex": 2, "defaultUnitCode": "%",
                 "ranges": [
                     {"sex": "M", "ageMinMonths": 216, "valueMin": 41, "valueMax": 53, "unitCode": "%"},
                     {"sex": "F", "ageMinMonths": 216, "valueMin": 36, "valueMax": 46, "unitCode": "%"},
                 ]},
                {"code": "LEU", "name": "Leucocitos", "orderIndex": 3, "defaultUnitCode": "x10^3/uL",
                 "ranges": [
                     {"sex": "A", "ageMinMonths": 216, "valueMin": 4.0, "valueMax": 11.0, "unitCode": "x10^3/uL"},
                 ]},
                {"code": "PLT", "name": "Plaquetas", "orderIndex": 4, "defaultUnitCode": "x10^3/uL",
                 "ranges": [
                     {"sex": "A", "ageMinMonths": 216, "valueMin": 150, "valueMax": 400, "unitCode": "x10^3/uL",
                      "criticalLow": 50, "criticalHigh": 1000},
                 ]},
                {"code": "RBC", "name": "Eritrocitos", "orderIndex": 5, "defaultUnitCode": "x10^6/uL",
                 "ranges": [
                     {"sex": "M", "ageMinMonths": 216, "valueMin": 4.5, "valueMax": 5.9, "unitCode": "x10^6/uL"},
                     {"sex": "F", "ageMinMonths": 216, "valueMin": 4.0, "valueMax": 5.2, "unitCode": "x10^6/uL"},
                 ]},
                {"code": "MCV", "name": "Volumen Corpuscular Medio", "orderIndex": 6, "defaultUnitCode": "fL",
                 "ranges": [
                     {"sex": "A", "ageMinMonths": 216, "valueMin": 80, "valueMax": 100, "unitCode": "fL"},
                 ]},
                {"code": "MCH", "name": "Hemoglobina Corpuscular Media", "orderIndex": 7, "defaultUnitCode": "pg",
                 "ranges": [
                     {"sex": "A", "ageMinMonths": 216, "valueMin": 27, "valueMax": 33, "unitCode": "pg"},
                 ]},
            ],
        },
        # ------------------------------------------------------------------
        # QS — Química Sanguínea
        # ------------------------------------------------------------------
        {
            "code": "QS",
            "name": "Química Sanguínea",
            "novaClave": "QS",
            "daysToResult": 1,
            "analytes": [
                {"code": "GLU", "name": "Glucosa", "orderIndex": 1, "defaultUnitCode": "mg/dL",
                 "ranges": [
                     {"sex": "A", "ageMinMonths": 216, "valueMin": 70, "valueMax": 110, "unitCode": "mg/dL",
                      "criticalLow": 50, "criticalHigh": 400},
                 ]},
                {"code": "BUN", "name": "Urea (BUN)", "orderIndex": 2, "defaultUnitCode": "mg/dL",
                 "ranges": [
                     {"sex": "A", "ageMinMonths": 216, "valueMin": 7, "valueMax": 20, "unitCode": "mg/dL"},
                 ]},
                {"code": "CREA", "name": "Creatinina", "orderIndex": 3, "defaultUnitCode": "mg/dL",
                 "ranges": [
                     {"sex": "M", "ageMinMonths": 216, "valueMin": 0.7, "valueMax": 1.3, "unitCode": "mg/dL"},
                     {"sex": "F", "ageMinMonths": 216, "valueMin": 0.6, "valueMax": 1.1, "unitCode": "mg/dL"},
                 ]},
                {"code": "URIC", "name": "Ácido Úrico", "orderIndex": 4, "defaultUnitCode": "mg/dL",
                 "ranges": [
                     {"sex": "M", "ageMinMonths": 216, "valueMin": 3.4, "valueMax": 7.0, "unitCode": "mg/dL"},
                     {"sex": "F", "ageMinMonths": 216, "valueMin": 2.4, "valueMax": 6.0, "unitCode": "mg/dL"},
                 ]},
                {"code": "TGO", "name": "AST / TGO", "orderIndex": 5, "defaultUnitCode": "U/L",
                 "ranges": [
                     {"sex": "A", "ageMinMonths": 216, "valueMin": 5, "valueMax": 40, "unitCode": "U/L"},
                 ]},
                {"code": "TGP", "name": "ALT / TGP", "orderIndex": 6, "defaultUnitCode": "U/L",
                 "ranges": [
                     {"sex": "A", "ageMinMonths": 216, "valueMin": 7, "valueMax": 56, "unitCode": "U/L"},
                 ]},
                {"code": "NA", "name": "Sodio", "orderIndex": 7, "defaultUnitCode": "mEq/L",
                 "ranges": [
                     {"sex": "A", "ageMinMonths": 216, "valueMin": 136, "valueMax": 145, "unitCode": "mEq/L",
                      "criticalLow": 120, "criticalHigh": 160},
                 ]},
                {"code": "K", "name": "Potasio", "orderIndex": 8, "defaultUnitCode": "mEq/L",
                 "ranges": [
                     {"sex": "A", "ageMinMonths": 216, "valueMin": 3.5, "valueMax": 5.1, "unitCode": "mEq/L",
                      "criticalLow": 2.5, "criticalHigh": 6.5},
                 ]},
            ],
        },
        # ------------------------------------------------------------------
        # EGO — Examen General de Orina
        # ------------------------------------------------------------------
        {
            "code": "EGO",
            "name": "Examen General de Orina",
            "novaClave": "EGO",
            "daysToResult": 1,
            "analytes": [
                {"code": "COLOR", "name": "Color", "orderIndex": 1, "dataType": "TEXT",
                 "ranges": [
                     {"sex": "A", "textValue": "Amarillo", "unitCode": None},
                 ]},
                {"code": "PH", "name": "pH", "orderIndex": 2, "defaultUnitCode": None,
                 "ranges": [
                     {"sex": "A", "ageMinMonths": 216, "valueMin": 5.0, "valueMax": 7.5},
                 ]},
                {"code": "DEN", "name": "Densidad", "orderIndex": 3,
                 "ranges": [
                     {"sex": "A", "ageMinMonths": 216, "valueMin": 1.005, "valueMax": 1.030},
                 ]},
                {"code": "PROT", "name": "Proteínas", "orderIndex": 4, "dataType": "ENUM",
                 "ranges": [
                     {"sex": "A", "textValue": "Negativo"},
                 ]},
                {"code": "GLU_OR", "name": "Glucosa", "orderIndex": 5, "dataType": "ENUM",
                 "ranges": [
                     {"sex": "A", "textValue": "Negativo"},
                 ]},
                {"code": "HB_OR", "name": "Sangre (Hemoglobina)", "orderIndex": 6, "dataType": "ENUM",
                 "ranges": [
                     {"sex": "A", "textValue": "Negativo"},
                 ]},
                {"code": "LEU_OR", "name": "Leucocitos", "orderIndex": 7, "dataType": "ENUM",
                 "ranges": [
                     {"sex": "A", "textValue": "Negativo"},
                 ]},
            ],
        },
        # ------------------------------------------------------------------
        # PL — Perfil Lipídico
        # ------------------------------------------------------------------
        {
            "code": "PL",
            "name": "Perfil Lipídico",
            "novaClave": "PL",
            "daysToResult": 1,
            "isProfile": True,
            "analytes": [
                {"code": "COL", "name": "Colesterol Total", "orderIndex": 1, "defaultUnitCode": "mg/dL",
                 "ranges": [
                     {"sex": "A", "ageMinMonths": 216, "valueMin": 0, "valueMax": 200, "unitCode": "mg/dL",
                      "criticalHigh": 300},
                 ]},
                {"code": "HDL", "name": "HDL Colesterol", "orderIndex": 2, "defaultUnitCode": "mg/dL",
                 "ranges": [
                     {"sex": "M", "ageMinMonths": 216, "valueMin": 40, "valueMax": 60, "unitCode": "mg/dL"},
                     {"sex": "F", "ageMinMonths": 216, "valueMin": 50, "valueMax": 70, "unitCode": "mg/dL"},
                 ]},
                {"code": "LDL", "name": "LDL Colesterol", "orderIndex": 3, "defaultUnitCode": "mg/dL",
                 "ranges": [
                     {"sex": "A", "ageMinMonths": 216, "valueMin": 0, "valueMax": 130, "unitCode": "mg/dL",
                      "criticalHigh": 250},
                 ]},
                {"code": "VLDL", "name": "VLDL Colesterol", "orderIndex": 4, "defaultUnitCode": "mg/dL",
                 "ranges": [
                     {"sex": "A", "ageMinMonths": 216, "valueMin": 0, "valueMax": 30, "unitCode": "mg/dL"},
                 ]},
                {"code": "TG", "name": "Triglicéridos", "orderIndex": 5, "defaultUnitCode": "mg/dL",
                 "ranges": [
                     {"sex": "A", "ageMinMonths": 216, "valueMin": 0, "valueMax": 150, "unitCode": "mg/dL",
                      "criticalHigh": 500},
                 ]},
                {"code": "COL_HDL", "name": "Índice Col/HDL", "orderIndex": 6,
                 "ranges": [
                     {"sex": "A", "ageMinMonths": 216, "valueMin": 0, "valueMax": 4.5},
                 ]},
            ],
        },
        # ------------------------------------------------------------------
        # TP — Tiempos de Coagulación (Tiempo de Protrombina)
        # ------------------------------------------------------------------
        {
            "code": "TP",
            "name": "Tiempos de Coagulación",
            "novaClave": "TP",
            "daysToResult": 1,
            "analytes": [
                {"code": "TPROT", "name": "Tiempo de Protrombina", "orderIndex": 1, "defaultUnitCode": "seg",
                 "ranges": [
                     {"sex": "A", "ageMinMonths": 216, "valueMin": 11, "valueMax": 13.5, "unitCode": "seg",
                      "criticalHigh": 30},
                 ]},
                {"code": "INR", "name": "INR", "orderIndex": 2,
                 "ranges": [
                     {"sex": "A", "ageMinMonths": 216, "valueMin": 0.8, "valueMax": 1.2,
                      "criticalHigh": 4.0},
                 ]},
                {"code": "TTPA", "name": "TTPa", "orderIndex": 3, "defaultUnitCode": "seg",
                 "ranges": [
                     {"sex": "A", "ageMinMonths": 216, "valueMin": 25, "valueMax": 35, "unitCode": "seg"},
                 ]},
                {"code": "FIB", "name": "Fibrinógeno", "orderIndex": 4, "defaultUnitCode": "mg/dL",
                 "ranges": [
                     {"sex": "A", "ageMinMonths": 216, "valueMin": 200, "valueMax": 400, "unitCode": "mg/dL",
                      "criticalLow": 100, "criticalHigh": 700},
                 ]},
                {"code": "TP_PCT", "name": "Actividad Protrombina (%)", "orderIndex": 5, "defaultUnitCode": "%",
                 "ranges": [
                     {"sex": "A", "ageMinMonths": 216, "valueMin": 70, "valueMax": 120, "unitCode": "%"},
                 ]},
                {"code": "DIMD", "name": "Dímero D", "orderIndex": 6, "defaultUnitCode": "ug/mL",
                 "ranges": [
                     {"sex": "A", "ageMinMonths": 216, "valueMin": 0, "valueMax": 0.5, "unitCode": "ug/mL",
                      "criticalHigh": 5.0},
                 ]},
            ],
        },
    ]