"""
IMPL-20260707-17: Fase 1 NOVA absorción (ARCH-20260707-17) — B-v2.

Servicio de bandeja de papeletas + trigger automático al SAMPLE_TAKEN.

Lógica del trigger (ver SPEC §3.1):
  Input: medicalEventId
  Encuentra todos los EventTest del medicalEventId con:
    - testId.categoryId === "Laboratorio" (id 64d3f863)
    - status === SAMPLE_TAKEN
    - que NO tengan ya LabOrderItem.eventTestId apuntando a ellos
  Crea LabOrder DRAFT con:
    - workerId = medicalEvent.workerId
    - medicalEventId = medicalEventId
    - doctorName = intakeCreatedByUser.fullName o "Por asignar"
    - companyId = medicalEvent.worker.companyId
    - branch = medicalEvent.branchId (mapeado a MATRIZ por ahora)
    - items = LabOrderItem por cada EventTest SAMPLE_TAKEN con eventTestId
  Status: DRAFT
  createdById = currentUser.id

Idempotencia:
  - Si ya existe una LabOrder DRAFT con esos eventTestId, retorna la existente.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from app.schemas.pending_orders import LAB_CATEGORY_ID


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
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


def _normalize_status(value: Any) -> str:
    """Acepta enum Prisma o string; devuelve str."""
    if value is None:
        return ""
    if hasattr(value, "value"):
        return str(value.value)
    return str(value)


# ---------------------------------------------------------------------------
# Bandeja de papeletas pendientes
# ---------------------------------------------------------------------------
async def list_pending_orders(
    branch_id: Optional[str],
    prisma: Any,
    category_id: str = LAB_CATEGORY_ID,
) -> Dict[str, Any]:
    """Lista MedicalEvents con EventTests SAMPLE_TAKEN de cat=Laboratorio
    que aún NO tienen LabOrder asociada vía LabOrderItem.eventTestId.

    Retorna dict con `total` y `rows`.
    """
    # 1) Buscar todos los EventTest SAMPLE_TAKEN de la categoría Laboratorio
    et_where: Dict[str, Any] = {"status": "SAMPLE_TAKEN"}
    event_tests = await prisma.eventtest.find_many(
        where=et_where,
        include={"test": True, "event": True},
    )

    # 2) Filtrar por categoría Laboratorio y branchId (en memoria — baja cardinalidad)
    matching_ets: List[Any] = []
    for et in event_tests:
        test = et.get("test") if isinstance(et, dict) else getattr(et, "test", None)
        event = et.get("event") if isinstance(et, dict) else getattr(et, "event", None)
        if test is None:
            continue
        cat_id = (
            test.get("categoryId")
            if isinstance(test, dict)
            else getattr(test, "categoryId", None)
        )
        if cat_id != category_id:
            continue
        if branch_id:
            ev_branch = (
                event.get("branchId") if isinstance(event, dict) else getattr(event, "branchId", None)
            ) if event else None
            if ev_branch != branch_id:
                continue
        matching_ets.append(et)

    # 3) Filtrar los que ya tienen LabOrderItem asociado
    et_ids = [
        et.get("id") if isinstance(et, dict) else getattr(et, "id", None)
        for et in matching_ets
    ]
    et_ids = [e for e in et_ids if e]

    linked_items: List[Any] = []
    if et_ids:
        linked_items = await prisma.laborderitem.find_many(
            where={"eventTestId": {"in": et_ids}},
            include={"labOrder": True},
        )

    # Map eventTestId → LabOrder (DRAFT)
    et_to_draft_order: Dict[str, Dict[str, Any]] = {}
    for item in linked_items:
        item_et_id = (
            item.get("eventTestId")
            if isinstance(item, dict)
            else getattr(item, "eventTestId", None)
        )
        if not item_et_id:
            continue
        order = (
            item.get("labOrder")
            if isinstance(item, dict)
            else getattr(item, "labOrder", None)
        )
        order_status = (
            order.get("status") if isinstance(order, dict) else getattr(order, "status", None)
        )
        if order_status == "DRAFT":
            order_id = order.get("id") if isinstance(order, dict) else getattr(order, "id", None)
            order_folio = order.get("folio") if isinstance(order, dict) else getattr(order, "folio", None)
            et_to_draft_order[item_et_id] = {
                "id": order_id,
                "folio": order_folio,
            }

    # 4) Agrupar por MedicalEvent
    by_event: Dict[str, Dict[str, Any]] = {}
    for et in matching_ets:
        et_id = et.get("id") if isinstance(et, dict) else getattr(et, "id", None)
        event = et.get("event") if isinstance(et, dict) else getattr(et, "event", None)
        if event is None:
            continue
        event_id = event.get("id") if isinstance(event, dict) else getattr(event, "id", None)
        if not event_id:
            continue
        # Si ya tiene LabOrder DRAFT asociada, no aparece en la bandeja
        if et_id in et_to_draft_order:
            continue

        test = et.get("test") if isinstance(et, dict) else getattr(et, "test", None)
        et_dict = {
            "id": et_id,
            "testNameSnapshot": et.get("testNameSnapshot") if isinstance(et, dict) else getattr(et, "testNameSnapshot", None),
            "medicalTestId": test.get("id") if isinstance(test, dict) else getattr(test, "id", None) if test else None,
            "medicalTestCode": test.get("code") if isinstance(test, dict) else getattr(test, "code", None) if test else None,
            "status": _normalize_status(et.get("status") if isinstance(et, dict) else getattr(et, "status", None)),
            "selectedOption": et.get("selectedOption") if isinstance(et, dict) else getattr(et, "selectedOption", None),
            "createdAt": et.get("createdAt") if isinstance(et, dict) else getattr(et, "createdAt", None),
        }
        if event_id not in by_event:
            by_event[event_id] = {
                "medicalEventId": event_id,
                "workerId": event.get("workerId") if isinstance(event, dict) else getattr(event, "workerId", None),
                "branchId": event.get("branchId") if isinstance(event, dict) else getattr(event, "branchId", None),
                "eventStatus": _normalize_status(event.get("status") if isinstance(event, dict) else getattr(event, "status", None)),
                "eventCreatedAt": event.get("createdAt") if isinstance(event, dict) else getattr(event, "createdAt", None),
                "intakeCreatedByUserId": event.get("intakeCreatedByUserId") if isinstance(event, dict) else getattr(event, "intakeCreatedByUserId", None),
                "_worker": None,
                "_intakeUser": None,
                "_branch": None,
                "eventTests": [],
            }
        by_event[event_id]["eventTests"].append(et_dict)

    # 5) Hidratar worker, intake user y branch
    rows: List[Dict[str, Any]] = []
    for event_id, group in by_event.items():
        worker_id = group["workerId"]
        worker = None
        if worker_id:
            worker = await prisma.worker.find_unique(
                where={"id": worker_id},
                include={"company": True},
            )
        company_name = None
        if worker:
            if isinstance(worker, dict):
                comp = worker.get("company")
                if isinstance(comp, dict):
                    company_name = comp.get("name")
            else:
                comp = getattr(worker, "company", None)
                if comp is not None:
                    company_name = getattr(comp, "name", None)
        intake_user_id = group.get("intakeCreatedByUserId")
        intake_user = None
        if intake_user_id:
            intake_user = await prisma.user.find_unique(where={"id": intake_user_id})
        branch_id_val = group.get("branchId")
        branch = None
        if branch_id_val:
            try:
                branch = await prisma.branch.find_unique(where={"id": branch_id_val})
            except Exception:
                branch = None

        worker_dict = _serialize(worker) if worker else {}

        worker_name = (
            f"{worker_dict.get('firstName', '')} {worker_dict.get('lastName', '')}".strip()
            if worker_dict
            else "—"
        )
        worker_code = worker_dict.get("universalId", "") or ""

        doctor_name = "Por asignar"
        if intake_user:
            full = (
                intake_user.get("fullName")
                if isinstance(intake_user, dict)
                else getattr(intake_user, "fullName", None)
            )
            if full:
                doctor_name = full

        branch_name = None
        if branch:
            branch_name = (
                branch.get("name") if isinstance(branch, dict) else getattr(branch, "name", None)
            )

        rows.append({
            "medicalEventId": event_id,
            "folio": event_id[:8],
            "workerId": worker_id,
            "workerName": worker_name,
            "workerCode": worker_code,
            "companyName": company_name,
            "doctorName": doctor_name,
            "intakeCreatedByUserId": intake_user_id,
            "branchId": branch_id_val,
            "branchName": branch_name,
            "eventStatus": group["eventStatus"],
            "eventCreatedAt": group["eventCreatedAt"],
            "eventTests": group["eventTests"],
            "existingDraftLabOrderId": None,
            "existingDraftLabOrderFolio": None,
        })

    # Ordenar por fecha de evento desc
    rows.sort(key=lambda r: r["eventCreatedAt"] or "", reverse=True)
    return {"total": len(rows), "rows": rows}


# ---------------------------------------------------------------------------
# Trigger al SAMPLE_TAKEN
# ---------------------------------------------------------------------------
async def auto_generate_lab_order_from_event(
    medical_event_id: str,
    current_user: Dict[str, str],
    prisma: Any,
) -> Dict[str, Any]:
    """Crea LabOrder DRAFT desde un MedicalEvent con sus EventTest SAMPLE_TAKEN
    de cat=Laboratorio. Si ya existe un LabOrder DRAFT que contenga TODOS esos
    eventTestIds, devuelve ese mismo (idempotente)."""
    user_id = current_user.get("id") if isinstance(current_user, dict) else None
    if not user_id:
        raise ValueError("current_user.id es obligatorio")

    # 1) Cargar MedicalEvent
    event = await prisma.medicalevent.find_unique(
        where={"id": medical_event_id},
        include={"worker": {"include": {"company": True}}},
    )
    if event is None:
        raise LookupError(f"MedicalEvent {medical_event_id} no existe")

    worker = (
        event.get("worker") if isinstance(event, dict) else getattr(event, "worker", None)
    )
    if worker is None:
        raise ValueError(f"MedicalEvent {medical_event_id} no tiene worker asociado")

    worker_id = (
        worker.get("id") if isinstance(worker, dict) else getattr(worker, "id", None)
    )
    company_id = (
        worker.get("companyId")
        if isinstance(worker, dict)
        else getattr(worker, "companyId", None)
    )

    intake_user_id = (
        event.get("intakeCreatedByUserId")
        if isinstance(event, dict)
        else getattr(event, "intakeCreatedByUserId", None)
    )
    doctor_name = "Por asignar"
    if intake_user_id:
        try:
            intake_user = await prisma.user.find_unique(where={"id": intake_user_id})
            full = (
                intake_user.get("fullName")
                if isinstance(intake_user, dict)
                else getattr(intake_user, "fullName", None)
            )
            if full:
                doctor_name = full
        except Exception:
            pass

    # 2) Encontrar EventTest SAMPLE_TAKEN de cat=Laboratorio
    ets = await prisma.eventtest.find_many(
        where={"eventId": medical_event_id, "status": "SAMPLE_TAKEN"},
        include={"test": True},
    )

    matching_ets: List[Any] = []
    for et in ets:
        test = et.get("test") if isinstance(et, dict) else getattr(et, "test", None)
        if test is None:
            continue
        cat_id = (
            test.get("categoryId")
            if isinstance(test, dict)
            else getattr(test, "categoryId", None)
        )
        if cat_id == LAB_CATEGORY_ID:
            matching_ets.append(et)

    if not matching_ets:
        return {
            "medicalEventId": medical_event_id,
            "labOrderId": "",
            "folio": None,
            "status": "DRAFT",
            "itemsCount": 0,
            "alreadyExisted": False,
        }

    matching_et_ids: List[str] = [
        et.get("id") if isinstance(et, dict) else getattr(et, "id", None)
        for et in matching_ets
    ]
    matching_et_ids = [e for e in matching_et_ids if e]

    # 3) Buscar LabOrder DRAFT existente para esta papeleta que contenga
    #    todos estos eventTestIds (idempotencia)
    existing_items = await prisma.laborderitem.find_many(
        where={"eventTestId": {"in": matching_et_ids}},
        include={"labOrder": True},
    )
    existing_order_ids: Set[str] = set()
    et_to_order: Dict[str, str] = {}
    for item in existing_items:
        item_et = (
            item.get("eventTestId")
            if isinstance(item, dict)
            else getattr(item, "eventTestId", None)
        )
        order = (
            item.get("labOrder") if isinstance(item, dict) else getattr(item, "labOrder", None)
        )
        if order is None:
            continue
        order_id = order.get("id") if isinstance(order, dict) else getattr(order, "id", None)
        order_status = (
            order.get("status") if isinstance(order, dict) else getattr(order, "status", None)
        )
        if order_status == "DRAFT" and order_id and item_et:
            existing_order_ids.add(order_id)
            et_to_order[item_et] = order_id

    if existing_order_ids:
        # Si hay un único LabOrder DRAFT que cubre todos los eventTestIds, retornar
        if len(existing_order_ids) == 1:
            order_id = next(iter(existing_order_ids))
            existing_order = await prisma.laborder.find_unique(where={"id": order_id})
            folio = (
                existing_order.get("folio")
                if isinstance(existing_order, dict)
                else getattr(existing_order, "folio", None)
            )
            return {
                "medicalEventId": medical_event_id,
                "labOrderId": order_id,
                "folio": folio,
                "status": "DRAFT",
                "itemsCount": len(matching_et_ids),
                "alreadyExisted": True,
            }

    # 4) Generar folio único
    folio = await _generate_unique_folio(prisma)

    # 5) Crear LabOrder DRAFT
    now = _now()
    order = await prisma.laborder.create(
        data={
            "folio": folio,
            "branch": "MATRIZ",
            "workerId": worker_id,
            "medicalEventId": medical_event_id,
            "companyId": company_id,
            "doctorName": doctor_name,
            "status": "DRAFT",
            "createdById": user_id,
            "createdAt": now,
            "updatedAt": now,
        }
    )
    order_id = order.get("id") if isinstance(order, dict) else getattr(order, "id", None)

    # 6) Crear LabOrderItem por cada EventTest (precios en 0 — recepcionista los confirma)
    items_count = 0
    for et in matching_ets:
        et_id = et.get("id") if isinstance(et, dict) else getattr(et, "id", None)
        test = et.get("test") if isinstance(et, dict) else getattr(et, "test", None)
        if et_id is None or test is None:
            continue
        medical_test_id = test.get("id") if isinstance(test, dict) else getattr(test, "id", None)
        if not medical_test_id:
            continue
        await prisma.laborderitem.create(
            data={
                "labOrderId": order_id,
                "medicalTestId": medical_test_id,
                "price": 0,
                "discountAmount": 0,
                "discountPct": 0,
                "amount": 0,
                "resultStatus": "P",
                "eventTestId": et_id,
                "createdAt": now,
                "updatedAt": now,
            }
        )
        items_count += 1

    # 7) Audit
    try:
        audit = getattr(prisma, "auditlog", None)
        if audit is not None:
            await audit.create(
                data={
                    "userId": user_id,
                    "action": "AUTO_GENERATE_LAB_ORDER_FROM_EVENT",
                    "entity": "LabOrder",
                    "entityId": order_id,
                    "details": {
                        "before": None,
                        "after": {
                            "id": order_id,
                            "folio": folio,
                            "medicalEventId": medical_event_id,
                            "itemsCount": items_count,
                        },
                    },
                }
            )
    except Exception:
        # audit no debe romper el flujo
        pass

    return {
        "medicalEventId": medical_event_id,
        "labOrderId": order_id,
        "folio": folio,
        "status": "DRAFT",
        "itemsCount": items_count,
        "alreadyExisted": False,
    }


async def _generate_unique_folio(prisma: Any, start: int = 1) -> int:
    """Encuentra el siguiente folio libre (loop)."""
    n = start
    while True:
        existing = await prisma.laborder.find_unique(where={"folio": n})
        if existing is None:
            return n
        n += 1
        if n > 10_000_000:
            raise RuntimeError("folio overflow")


# ---------------------------------------------------------------------------
# Marcar EventTest como SAMPLE_TAKEN
# ---------------------------------------------------------------------------
async def mark_event_test_sample_taken(
    event_test_id: str,
    current_user: Dict[str, str],
    prisma: Any,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Cambia status a SAMPLE_TAKEN y (opcionalmente) triggera la creación
    automática de LabOrder DRAFT si el EventTest es de categoría Laboratorio."""
    user_id = current_user.get("id") if isinstance(current_user, dict) else None
    if not user_id:
        raise ValueError("current_user.id es obligatorio")

    et = await prisma.eventtest.find_unique(
        where={"id": event_test_id},
        include={"test": True},
    )
    if et is None:
        raise LookupError(f"EventTest {event_test_id} no existe")

    current_status = _normalize_status(
        et.get("status") if isinstance(et, dict) else getattr(et, "status", None)
    )
    if current_status == "SAMPLE_TAKEN":
        # idempotente — no duplicar
        return {
            "eventTestId": event_test_id,
            "status": "SAMPLE_TAKEN",
            "triggeredLabOrder": None,
            "alreadyTaken": True,
        }

    if current_status in ("CANCELLED", "SKIPPED", "COMPLETED"):
        raise ValueError(
            f"No se puede cambiar status de EventTest en estado {current_status}"
        )

    # Cambiar status
    update_data: Dict[str, Any] = {"status": "SAMPLE_TAKEN", "updatedAt": _now()}
    if notes:
        update_data["resultNotes"] = notes
    updated = await prisma.eventtest.update(
        where={"id": event_test_id},
        data=update_data,
    )

    # Audit
    try:
        audit = getattr(prisma, "auditlog", None)
        if audit is not None:
            await audit.create(
                data={
                    "userId": user_id,
                    "action": "MARK_SAMPLE_TAKEN",
                    "entity": "EventTest",
                    "entityId": event_test_id,
                    "details": {
                        "before": {"status": current_status},
                        "after": {"status": "SAMPLE_TAKEN"},
                    },
                }
            )
    except Exception:
        pass

    # Trigger si es Laboratorio
    triggered: Optional[Dict[str, Any]] = None
    test = et.get("test") if isinstance(et, dict) else getattr(et, "test", None)
    if test is not None:
        cat_id = (
            test.get("categoryId")
            if isinstance(test, dict)
            else getattr(test, "categoryId", None)
        )
        if cat_id == LAB_CATEGORY_ID:
            event_id = (
                et.get("eventId") if isinstance(et, dict) else getattr(et, "eventId", None)
            )
            if event_id:
                triggered = await auto_generate_lab_order_from_event(
                    medical_event_id=event_id,
                    current_user={"id": user_id, "role": current_user.get("role", "ADMIN")},
                    prisma=prisma,
                )

    return {
        "eventTestId": event_test_id,
        "status": "SAMPLE_TAKEN",
        "triggeredLabOrder": triggered,
        "alreadyTaken": False,
    }