"""
IMPL-20260707-16: Slice C NOVA absorción (ARCH-20260707-16) — LabResult.

Servicio CRUD + ciclo de vida + validación contra rangos + auditoría.

Diseño:
  - Trabaja contra un cliente Prisma inyectable (set_prisma_client).
  - Permite tests sin DB real usando un mock (MagicMock).
  - Cálculo de edad puro (`calculate_age_in_months`).
  - Validación contra rango (`validate_value_against_range`).
  - Ciclo de vida con transiciones explícitas + registro en LabResultAudit.
  - bulk_create_lab_results: alta de varios analitos en una sola llamada.
  - get_worklist: hoja de trabajo con analitos esperados del MedicalTest.
"""
from __future__ import annotations

import math
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from app.schemas.lab_results import (
    LabResultStatus,
    LabResultTransitionAction,
)

# ---------------------------------------------------------------------------
# Prisma client injection (mismo patrón que lab_order_service)
# ---------------------------------------------------------------------------
_prisma = None


def set_prisma_client(client: Any) -> None:
    global _prisma
    _prisma = client


def get_prisma() -> Any:
    if _prisma is None:
        raise RuntimeError(
            "Prisma client no inyectado. "
            "Llamar set_prisma_client() desde main.py o inyectar mock en tests."
        )
    return _prisma


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _round2(n: float) -> float:
    return math.floor(n * 100 + 0.5) / 100.0


def _now() -> datetime:
    return datetime.utcnow()


def _serialize(obj: Any) -> Dict[str, Any]:
    """Convierte un modelo Prisma a dict serializable JSON."""
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


def _value_of(obj: Any, key: str, default: Any = None) -> Any:
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def calculate_age_in_months(birth_date: Optional[Any], sample_date: Optional[Any] = None) -> Optional[int]:
    """Calcula edad en meses entre dos fechas."""
    if not birth_date:
        return None
    try:
        if isinstance(birth_date, str):
            bd = datetime.fromisoformat(birth_date.replace("Z", "+00:00")).replace(tzinfo=None)
        elif isinstance(birth_date, datetime):
            bd = birth_date.replace(tzinfo=None) if birth_date.tzinfo else birth_date
        else:
            return None
        sd = (
            datetime.fromisoformat(sample_date.replace("Z", "+00:00")).replace(tzinfo=None)
            if isinstance(sample_date, str)
            else sample_date
            if isinstance(sample_date, datetime)
            else _now()
        )
        months = (sd.year - bd.year) * 12 + (sd.month - bd.month)
        if sd.day < bd.day:
            months -= 1
        return max(0, months)
    except Exception:
        return None


def validate_value_against_range(
    value: Optional[float],
    value_text: Optional[str],
    range_min: Optional[float],
    range_max: Optional[float],
    critical_low: Optional[float] = None,
    critical_high: Optional[float] = None,
    text_value: Optional[str] = None,
) -> Dict[str, bool]:
    """Compara un valor contra un rango numérico o de texto.

    Retorna {isOutOfRange, isCritical, matchedText}.
    """
    is_out = False
    is_crit = False
    matched_text = False

    if value is not None:
        if range_min is not None and value < range_min:
            is_out = True
        if range_max is not None and value > range_max:
            is_out = True
        if critical_low is not None and value <= critical_low:
            is_crit = True
        if critical_high is not None and value >= critical_high:
            is_crit = True
    elif value_text is not None and text_value is not None:
        # ENUM/TEXT: match contra el textValue del rango.
        matched_text = value_text.strip().lower() == text_value.strip().lower()

    return {
        "isOutOfRange": is_out,
        "isCritical": is_crit,
        "matchedText": matched_text,
    }


def _pick_range(
    ranges: List[Dict[str, Any]],
    sex: Optional[str],
    age_months: Optional[int],
) -> Optional[Dict[str, Any]]:
    """Selecciona el rango más específico aplicable."""
    candidates: List[Dict[str, Any]] = []
    for r in ranges or []:
        r_sex = r.get("sex") or "A"
        if r_sex not in ("A", sex):
            continue
        if age_months is not None:
            amin = r.get("ageMinMonths")
            amax = r.get("ageMaxMonths")
            if amin is not None and age_months < amin:
                continue
            if amax is not None and age_months > amax:
                continue
        candidates.append(r)
    if not candidates:
        return None
    # Prioriza el rango con sex específico (M/F) sobre A.
    candidates.sort(key=lambda r: 0 if r.get("sex") in ("M", "F") else 1)
    return candidates[0]


# ---------------------------------------------------------------------------
# Audit log (específico de LabResult; usa LabResultAudit, NO AuditLog genérico)
# ---------------------------------------------------------------------------
async def _record_audit(
    prisma: Any,
    result_id: str,
    action: str,
    from_status: Optional[str],
    to_status: Optional[str],
    before: Optional[Dict[str, Any]],
    after: Optional[Dict[str, Any]],
    reason: Optional[str],
    user_id: str,
) -> None:
    try:
        # FIX-20260707-16: Prisma Python model LabResultAudit -> prisma.labresultaudit.
        audit = getattr(prisma, "labresultaudit", None)
        if audit is None:
            return
        await audit.create(
            data={
                "resultId": result_id,
                "action": action,
                "fromStatus": from_status,
                "toStatus": to_status,
                "before": before,
                "after": after,
                "reason": reason,
                "userId": user_id,
            }
        )
    except Exception:
        # El audit no rompe el flujo principal.
        pass


# ---------------------------------------------------------------------------
# CRUD principal
# ---------------------------------------------------------------------------
async def create_lab_results_bulk(
    items: List[Dict[str, Any]],
    current_user: Dict[str, str],
    prisma: Any,
) -> Dict[str, Any]:
    """Crea N LabResults (1 por analito por item).

    Calcula isOutOfRange/isCritical contra los rangos existentes del analito
    (resolviendo por edad/sexo si se puede).
    """
    user_id = current_user.get("id") if isinstance(current_user, dict) else None
    if not user_id:
        raise ValueError("current_user.id es obligatorio")

    created_ids: List[str] = []
    errors: List[str] = []

    for idx, item in enumerate(items):
        try:
            analyte_id = item.get("analyteId")
            order_item_id = item.get("labOrderItemId")
            if not analyte_id or not order_item_id:
                raise ValueError(f"item[{idx}]: analyteId y labOrderItemId son obligatorios")
            if item.get("valueText") is None and item.get("valueNumber") is None:
                raise ValueError(f"item[{idx}]: debe proporcionar valueText o valueNumber")

            # Resolver rangos del analito
            ranges = []
            try:
                ranges = await prisma.labreferencerange.find_many(
                    where={"analyteId": analyte_id}
                )
            except Exception:
                ranges = []

            # Edad/sexo del paciente: simplificado — sin expandir; usa rangos
            # con sex="A" como fallback. Si el caller quiere refinar, pasa
            # ageMonths/sex explícitos en el item.
            picked = _pick_range(
                ranges,
                sex=item.get("sex"),
                age_months=item.get("ageMonths"),
            )

            flags = validate_value_against_range(
                value=item.get("valueNumber"),
                value_text=item.get("valueText"),
                range_min=_value_of(picked, "valueMin") if picked else None,
                range_max=_value_of(picked, "valueMax") if picked else None,
                critical_low=_value_of(picked, "criticalLow") if picked else None,
                critical_high=_value_of(picked, "criticalHigh") if picked else None,
                text_value=_value_of(picked, "textValue") if picked else None,
            )

            now = _now()
            payload = {
                "labOrderItemId": order_item_id,
                "analyteId": analyte_id,
                "eventTestId": item.get("eventTestId"),
                "valueText": item.get("valueText"),
                "valueNumber": item.get("valueNumber"),
                "unitId": item.get("unitId"),
                "status": "PENDING",
                "capturedById": user_id,
                "capturedAt": now,
                "isOutOfRange": flags["isOutOfRange"],
                "isCritical": flags["isCritical"],
                "isAbnormal": bool(item.get("isAbnormal", False)),
                "observations": item.get("observations"),
                "createdAt": now,
                "updatedAt": now,
            }
            created = await prisma.labresult.create(data=payload)
            cid = created["id"] if isinstance(created, dict) else getattr(created, "id", None)
            created_ids.append(cid)

            await _record_audit(
                prisma,
                result_id=cid,
                action="CREATE",
                from_status=None,
                to_status="PENDING",
                before=None,
                after=_serialize(created),
                reason=None,
                user_id=user_id,
            )

            # Si out-of-range, evento adicional OUT_OF_RANGE_DETECTED.
            if flags["isOutOfRange"] or flags["isCritical"]:
                await _record_audit(
                    prisma,
                    result_id=cid,
                    action="OUT_OF_RANGE_DETECTED",
                    from_status="PENDING",
                    to_status="PENDING",
                    before=None,
                    after={"isOutOfRange": flags["isOutOfRange"], "isCritical": flags["isCritical"]},
                    reason=None,
                    user_id=user_id,
                )
        except Exception as e:  # noqa: BLE001
            errors.append(str(e))

    return {"ids": created_ids, "errors": errors, "created": len(created_ids)}


async def update_lab_result(
    result_id: str,
    data: Dict[str, Any],
    current_user: Dict[str, str],
    prisma: Any,
) -> Dict[str, Any]:
    """Actualiza valor + flags manuales. Recalcula out-of-range si hay valor."""
    user_id = current_user.get("id") if isinstance(current_user, dict) else None
    if not user_id:
        raise ValueError("current_user.id es obligatorio")

    existing = await prisma.labresult.find_unique(where={"id": result_id})
    if existing is None:
        raise LookupError(f"LabResult {result_id} no existe")

    payload = {k: v for k, v in data.items() if v is not None}
    payload["updatedAt"] = _now()

    # Recalcular flags si cambió el valor
    if "valueNumber" in payload or "valueText" in payload:
        analyte_id = _value_of(existing, "analyteId")
        ranges = []
        try:
            ranges = await prisma.labreferencerange.find_many(where={"analyteId": analyte_id})
        except Exception:
            ranges = []
        picked = _pick_range(ranges, sex=None, age_months=None)
        flags = validate_value_against_range(
            value=payload.get("valueNumber", _value_of(existing, "valueNumber")),
            value_text=payload.get("valueText", _value_of(existing, "valueText")),
            range_min=_value_of(picked, "valueMin") if picked else None,
            range_max=_value_of(picked, "valueMax") if picked else None,
            critical_low=_value_of(picked, "criticalLow") if picked else None,
            critical_high=_value_of(picked, "criticalHigh") if picked else None,
            text_value=_value_of(picked, "textValue") if picked else None,
        )
        payload["isOutOfRange"] = flags["isOutOfRange"]
        payload["isCritical"] = flags["isCritical"]

    updated = await prisma.labresult.update(where={"id": result_id}, data=payload)

    await _record_audit(
        prisma,
        result_id=result_id,
        action="UPDATE_VALUE",
        from_status=_value_of(existing, "status"),
        to_status=_value_of(updated, "status"),
        before=_serialize(existing),
        after=_serialize(updated),
        reason=None,
        user_id=user_id,
    )

    return _serialize(updated)


# ---------------------------------------------------------------------------
# Ciclo de vida
# ---------------------------------------------------------------------------
_LEGAL_TRANSITIONS = {
    LabResultStatus.PENDING: {LabResultStatus.REPORTED, LabResultStatus.INVALIDATED},
    LabResultStatus.REPORTED: {LabResultStatus.AUTHORIZED, LabResultStatus.INVALIDATED},
    LabResultStatus.AUTHORIZED: {LabResultStatus.VALIDATED, LabResultStatus.INVALIDATED},
    LabResultStatus.VALIDATED: {LabResultStatus.INVALIDATED},
    LabResultStatus.INVALIDATED: set(),
}


_ACTION_TO_STATUS = {
    LabResultTransitionAction.REPORT: LabResultStatus.REPORTED,
    LabResultTransitionAction.AUTHORIZE: LabResultStatus.AUTHORIZED,
    LabResultTransitionAction.VALIDATE: LabResultStatus.VALIDATED,
    LabResultTransitionAction.INVALIDATE: LabResultStatus.INVALIDATED,
}

_ACTION_TO_USER_FIELD = {
    LabResultTransitionAction.REPORT: ("reportedById", "reportedAt"),
    LabResultTransitionAction.AUTHORIZE: ("authorizedById", "authorizedAt"),
    LabResultTransitionAction.VALIDATE: ("validatedById", "validatedAt"),
    LabResultTransitionAction.INVALIDATE: ("invalidatedById", "invalidatedAt"),
}


async def transition_lab_result(
    result_id: str,
    action: LabResultTransitionAction,
    reason: Optional[str],
    current_user: Dict[str, str],
    prisma: Any,
) -> Dict[str, Any]:
    """Aplica una transición al ciclo de vida y registra audit."""
    user_id = current_user.get("id") if isinstance(current_user, dict) else None
    if not user_id:
        raise ValueError("current_user.id es obligatorio")

    existing = await prisma.labresult.find_unique(where={"id": result_id})
    if existing is None:
        raise LookupError(f"LabResult {result_id} no existe")

    from_status_str = _value_of(existing, "status")
    try:
        from_status = LabResultStatus(from_status_str)
    except ValueError:
        raise ValueError(f"Estado actual inválido: {from_status_str}")

    target = _ACTION_TO_STATUS[action]
    legal = _LEGAL_TRANSITIONS.get(from_status, set())
    if target not in legal:
        raise ValueError(
            f"Transición ilegal: {from_status_str} -> {target.value}. "
            f"Estados permitidos desde {from_status_str}: {[s.value for s in legal]}"
        )

    if action == LabResultTransitionAction.REPORT:
        # Requiere que el resultado tenga un valor capturado.
        if _value_of(existing, "valueNumber") is None and _value_of(existing, "valueText") is None:
            raise ValueError("Para REPORTED se requiere capturar valor (valueText o valueNumber)")
    if action == LabResultTransitionAction.INVALIDATE:
        if not reason or len(reason.strip()) < 5:
            raise ValueError("INVALIDATE requiere motivo de al menos 5 caracteres")

    user_field, date_field = _ACTION_TO_USER_FIELD[action]
    now = _now()
    payload: Dict[str, Any] = {
        "status": target.value,
        user_field: user_id,
        date_field: now,
        "updatedAt": now,
    }
    if action == LabResultTransitionAction.INVALIDATE:
        payload["invalidateReason"] = reason

    updated = await prisma.labresult.update(where={"id": result_id}, data=payload)

    await _record_audit(
        prisma,
        result_id=result_id,
        action=action.value.upper(),
        from_status=from_status.value,
        to_status=target.value,
        before=_serialize(existing),
        after=_serialize(updated),
        reason=reason,
        user_id=user_id,
    )

    return _serialize(updated)


# ---------------------------------------------------------------------------
# Worklist (analitos esperados para una orden)
# ---------------------------------------------------------------------------
async def get_worklist(
    order_id: str,
    prisma: Any,
) -> Dict[str, Any]:
    """Hoja de trabajo: para cada LabOrderItem de la orden, devuelve los analitos
    esperados del MedicalTest con el rango aplicable + resultado existente (si hay)."""
    order = await prisma.laborder.find_unique(where={"id": order_id})
    if order is None:
        raise LookupError(f"LabOrder {order_id} no existe")

    items = await prisma.laborderitem.find_many(where={"labOrderId": order_id})
    worklist_items: List[Dict[str, Any]] = []

    for it in items:
        medical_test_id = _value_of(it, "medicalTestId")
        test = await prisma.medicaltest.find_unique(where={"id": medical_test_id})
        test_code = _value_of(test, "code") if test else ""
        test_name = _value_of(test, "name") if test else ""

        analytes = await prisma.labanalyte.find_many(
            where={"medicalTestId": medical_test_id, "active": True},
            order={"orderIndex": "asc"},
        )

        # Resultados existentes del item
        existing_results = await prisma.labresult.find_many(
            where={"labOrderItemId": _value_of(it, "id")}
        )
        existing_by_analyte = {
            _value_of(r, "analyteId"): r for r in existing_results
        }

        expected: List[Dict[str, Any]] = []
        for a in analytes:
            analyte_id = _value_of(a, "id")
            ranges = await prisma.labreferencerange.find_many(where={"analyteId": analyte_id})
            picked = _pick_range(ranges, sex=None, age_months=None)
            default_unit_id = _value_of(a, "defaultUnitId")
            default_unit_symbol = None
            if default_unit_id:
                try:
                    unit = await prisma.labunit.find_unique(where={"id": default_unit_id})
                    default_unit_symbol = _value_of(unit, "symbol") if unit else None
                except Exception:
                    default_unit_symbol = None

            existing = existing_by_analyte.get(analyte_id)
            expected.append(
                {
                    "analyteId": analyte_id,
                    "code": _value_of(a, "code"),
                    "name": _value_of(a, "name"),
                    "dataType": _value_of(a, "dataType"),
                    "orderIndex": _value_of(a, "orderIndex"),
                    "defaultUnitId": default_unit_id,
                    "defaultUnitSymbol": default_unit_symbol,
                    "rangeMin": _value_of(picked, "valueMin") if picked else None,
                    "rangeMax": _value_of(picked, "valueMax") if picked else None,
                    "rangeText": _value_of(picked, "textValue") if picked else None,
                    "criticalLow": _value_of(picked, "criticalLow") if picked else None,
                    "criticalHigh": _value_of(picked, "criticalHigh") if picked else None,
                    "existingResultId": _value_of(existing, "id") if existing else None,
                    "existingValueText": _value_of(existing, "valueText") if existing else None,
                    "existingValueNumber": _value_of(existing, "valueNumber") if existing else None,
                    "existingStatus": _value_of(existing, "status") if existing else None,
                }
            )

        worklist_items.append(
            {
                "labOrderItemId": _value_of(it, "id"),
                "medicalTestId": medical_test_id,
                "medicalTestCode": test_code,
                "medicalTestName": test_name,
                "analytes": expected,
            }
        )

    return {
        "orderId": order_id,
        "folio": _value_of(order, "folio"),
        "orderStatus": _value_of(order, "status"),
        "items": worklist_items,
    }


# ---------------------------------------------------------------------------
# Listado paginado (DataTables)
# ---------------------------------------------------------------------------
async def get_results_paginated(
    prisma: Any,
    draw: int = 1,
    start: int = 0,
    length: int = 25,
    search: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    order_id: Optional[str] = None,
    worker_id: Optional[str] = None,
) -> Dict[str, Any]:
    where: Dict[str, Any] = {}
    if status:
        where["status"] = status
    if order_id:
        where["labOrderItem"] = {"labOrderId": order_id}
    if date_from or date_to:
        date_range: Dict[str, Any] = {}
        if date_from:
            date_range["gte"] = date_from
        if date_to:
            date_range["lte"] = date_to
        where["createdAt"] = date_range

    delegate = prisma.labresult
    total = await delegate.count(where={})
    records_filtered = await delegate.count(where=where)
    rows = await delegate.find_many(
        where=where,
        order={"createdAt": "desc"},
        skip=max(0, int(start or 0)),
        take=max(1, min(int(length or 25), 100)),
    )

    data: List[Dict[str, Any]] = []
    for r in rows:
        d = _serialize(r)
        # Enriquecer con analyte
        try:
            analyte = await prisma.labanalyte.find_unique(where={"id": d.get("analyteId")})
            d["analyteCode"] = _value_of(analyte, "code") if analyte else None
            d["analyteName"] = _value_of(analyte, "name") if analyte else None
        except Exception:
            pass
        # Enriquecer con unit
        try:
            if d.get("unitId"):
                unit = await prisma.labunit.find_unique(where={"id": d["unitId"]})
                d["unitSymbol"] = _value_of(unit, "symbol") if unit else None
        except Exception:
            pass
        data.append(d)

    return {
        "draw": int(draw or 1),
        "recordsTotal": total,
        "recordsFiltered": records_filtered,
        "data": data,
    }


# ---------------------------------------------------------------------------
# Get individual con audit
# ---------------------------------------------------------------------------
async def get_result_with_audit(result_id: str, prisma: Any) -> Optional[Dict[str, Any]]:
    res = await prisma.labresult.find_unique(where={"id": result_id})
    if res is None:
        return None
    base = _serialize(res)
    audits = await prisma.labresultaudit.find_many(
        where={"resultId": result_id},
        order={"createdAt": "desc"},
    )
    base["auditEvents"] = [_serialize(a) for a in audits]
    return base


# ---------------------------------------------------------------------------
# Vinculación LabOrderItem ↔ EventTest (papeleta)
# ---------------------------------------------------------------------------
async def link_lab_order_item_to_event_test(
    item_id: str,
    event_test_id: Optional[str],
    current_user: Dict[str, str],
    prisma: Any,
) -> Dict[str, Any]:
    user_id = current_user.get("id") if isinstance(current_user, dict) else None
    if not user_id:
        raise ValueError("current_user.id es obligatorio")

    item = await prisma.laborderitem.find_unique(where={"id": item_id})
    if item is None:
        raise LookupError(f"LabOrderItem {item_id} no existe")

    updated = await prisma.laborderitem.update(
        where={"id": item_id},
        data={"eventTestId": event_test_id, "updatedAt": _now()},
    )
    return _serialize(updated)