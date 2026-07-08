/**
 * @file Server Actions para Fase 1 — B-v2 bandeja de papeletas + trigger SAMPLE_TAKEN.
 * @id IMPL-20260707-17 — Fase 1 NOVA absorción (ARCH-20260707-17).
 *
 * Patrón: mismo que lab-order.actions.ts — server actions usan Prisma directo
 * (en lugar de fetch a FastAPI) para evitar el problema de enrutamiento desde
 * server actions hacia rutas del mismo server Next.js.
 *
 * Permisos: ADMIN y LAB_RECEPTIONIST.
 */
"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import prisma from "@/lib/prisma";
import {
  autoGenerateLabOrderSchema,
  type AutoGenerateLabOrderResponse,
  LAB_CATEGORY_ID,
  markSampleTakenSchema,
  type MarkSampleTakenResponse,
  type PendingOrderRow,
  type PendingOrdersResponse,
} from "@/lib/validations/study";

export type { PendingOrderRow, PendingOrdersResponse } from "@/lib/validations/study";

// ---------------------------------------------------------------------------
// Tipos de retorno
// ---------------------------------------------------------------------------
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function _requireReception(): Promise<{ userId: string; role: string } | null> {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    const userId = session?.user?.id;
    if (!session?.user || !userId) return null;
    const allowed = ["ADMIN", "LAB_RECEPTIONIST", "DOCTOR_GENERAL", "DOCTOR_VALIDATOR"];
    if (!allowed.includes(role ?? "")) return null;
    return { userId, role: role ?? "ADMIN" };
  } catch {
    return null;
  }
}

function _normalizeStatus(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  // Prisma enums serializan como { value: "..." }
  if (typeof value === "object" && value !== null && "value" in (value as Record<string, unknown>)) {
    return String((value as { value: unknown }).value);
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// 1) GET — Bandeja de papeletas
// ---------------------------------------------------------------------------
export async function getPendingLabOrdersAction(
  branchId?: string | null
): Promise<ActionResult<PendingOrdersResponse>> {
  const guard = await _requireReception();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  try {
    // Buscar EventTests SAMPLE_TAKEN de la categoría Laboratorio
    const eventTests = await prisma.eventTest.findMany({
      where: { status: "SAMPLE_TAKEN" },
      include: {
        test: true,
        event: {
          include: {
            worker: { include: { company: true } },
            branch: true,
            intakeCreatedByUser: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // Filtrar por categoría Laboratorio y branchId (post-filtrado en memoria)
    const matching: typeof eventTests = [];
    for (const et of eventTests) {
      if (!et.test) continue;
      if (et.test.categoryId !== LAB_CATEGORY_ID) continue;
      if (branchId && et.event?.branchId !== branchId) continue;
      matching.push(et);
    }

    // Excluir los que ya tienen LabOrderItem.eventTestId apuntando (y orden DRAFT)
    const etIds = matching.map((et) => et.id);
    const linkedItems = etIds.length
      ? await prisma.labOrderItem.findMany({
          where: { eventTestId: { in: etIds } },
          select: {
            eventTestId: true,
            labOrder: { select: { id: true, status: true, folio: true } },
          },
        })
      : [];
    const etToDraft = new Map<string, { id: string; folio: number | null }>();
    for (const li of linkedItems) {
      if (!li.eventTestId) continue;
      if (li.labOrder?.status === "DRAFT") {
        etToDraft.set(li.eventTestId, {
          id: li.labOrder.id,
          folio: li.labOrder.folio ?? null,
        });
      }
    }

    // Agrupar por MedicalEvent
    const byEvent = new Map<
      string,
      {
        event: typeof eventTests[0]["event"];
        eventTests: typeof eventTests;
      }
    >();
    for (const et of matching) {
      if (etToDraft.has(et.id)) continue; // ya tiene LabOrder DRAFT → fuera de la bandeja
      if (!et.event) continue;
      const eventId = et.event.id;
      const existing = byEvent.get(eventId);
      if (existing) {
        existing.eventTests.push(et);
      } else {
        byEvent.set(eventId, { event: et.event, eventTests: [et] });
      }
    }

    const rows = Array.from(byEvent.values()).map(({ event, eventTests: ets }) => {
      const worker = event.worker;
      const intakeUser = event.intakeCreatedByUser;
      const branch = event.branch;
      const workerName = worker
        ? `${worker.firstName ?? ""} ${worker.lastName ?? ""}`.trim() || "—"
        : "—";
      return {
        medicalEventId: event.id,
        folio: event.id.slice(0, 8),
        workerId: worker?.id ?? "",
        workerName,
        workerCode: worker?.universalId ?? "",
        companyName: worker?.company?.name ?? null,
        doctorName: intakeUser?.fullName ?? "Por asignar",
        intakeCreatedByUserId: event.intakeCreatedByUserId ?? null,
        branchId: event.branchId ?? null,
        branchName: branch?.name ?? null,
        eventStatus: _normalizeStatus(event.status),
        eventCreatedAt: event.createdAt?.toISOString?.() ?? null,
        eventTests: ets.map((et) => ({
          id: et.id,
          testNameSnapshot: et.testNameSnapshot,
          medicalTestId: et.testId ?? null,
          medicalTestCode: et.test?.code ?? null,
          status: _normalizeStatus(et.status),
          selectedOption: et.selectedOption ?? null,
          createdAt: et.createdAt?.toISOString?.() ?? null,
        })),
        existingDraftLabOrderId: null,
        existingDraftLabOrderFolio: null,
      };
    });

    rows.sort((a, b) =>
      (b.eventCreatedAt ?? "").localeCompare(a.eventCreatedAt ?? "")
    );

    return {
      ok: true,
      data: {
        branchId: branchId ?? null,
        categoryId: LAB_CATEGORY_ID,
        total: rows.length,
        rows,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
      code: "INTERNAL",
    };
  }
}

// ---------------------------------------------------------------------------
// 2) POST — Trigger automático (crea LabOrder DRAFT desde un MedicalEvent)
// ---------------------------------------------------------------------------
export async function autoGenerateLabOrderAction(
  input: unknown
): Promise<ActionResult<AutoGenerateLabOrderResponse>> {
  const guard = await _requireReception();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  const parsed = autoGenerateLabOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Validación: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      code: "VALIDATION",
    };
  }
  const { medicalEventId } = parsed.data;
  try {
    const event = await prisma.medicalEvent.findUnique({
      where: { id: medicalEventId },
      include: { worker: { include: { company: true } }, intakeCreatedByUser: true },
    });
    if (!event) {
      return { ok: false, error: `MedicalEvent ${medicalEventId} no existe`, code: "NOT_FOUND" };
    }
    if (!event.worker) {
      return { ok: false, error: "MedicalEvent sin worker asociado", code: "INVALID" };
    }

    const doctorName = event.intakeCreatedByUser?.fullName ?? "Por asignar";

    // Encontrar EventTests SAMPLE_TAKEN de la categoría Laboratorio
    const ets = await prisma.eventTest.findMany({
      where: { eventId: medicalEventId, status: "SAMPLE_TAKEN" },
      include: { test: true },
    });
    const matching = ets.filter((et) => et.test?.categoryId === LAB_CATEGORY_ID);

    if (matching.length === 0) {
      return {
        ok: true,
        data: {
          medicalEventId,
          labOrderId: "",
          folio: null,
          status: "DRAFT",
          itemsCount: 0,
          alreadyExisted: false,
        },
      };
    }

    const matchingIds = matching.map((et) => et.id);

    // Idempotencia: si ya existe LabOrder DRAFT con estos eventTestIds, retornar
    const linkedItems = await prisma.labOrderItem.findMany({
      where: { eventTestId: { in: matchingIds } },
      include: { labOrder: true },
    });
    const draftOrderIds = new Set<string>();
    for (const li of linkedItems) {
      if (li.labOrder?.status === "DRAFT" && li.labOrder.id) {
        draftOrderIds.add(li.labOrder.id);
      }
    }
    if (draftOrderIds.size === 1) {
      const orderId = Array.from(draftOrderIds)[0];
      const existing = await prisma.labOrder.findUnique({ where: { id: orderId } });
      return {
        ok: true,
        data: {
          medicalEventId,
          labOrderId: orderId,
          folio: existing?.folio ?? null,
          status: "DRAFT",
          itemsCount: matching.length,
          alreadyExisted: true,
        },
      };
    }

    // Calcular folio
    const last = await prisma.labOrder.findFirst({
      orderBy: { folio: "desc" },
      select: { folio: true },
    });
    const nextFolio = (last?.folio ?? 0) + 1;

    // Crear LabOrder DRAFT con sus items
    const created = await prisma.labOrder.create({
      data: {
        folio: nextFolio,
        branch: "MATRIZ",
        workerId: event.worker.id,
        medicalEventId,
        companyId: event.worker.companyId ?? null,
        doctorName,
        status: "DRAFT",
        createdById: guard.userId,
        items: {
          create: matching
            .filter((et) => et.testId)
            .map((et) => ({
              medicalTestId: et.testId as string,
              price: 0,
              discountAmount: 0,
              discountPct: 0,
              amount: 0,
              resultStatus: "P",
              eventTestId: et.id,
            })),
        },
      },
      include: { items: true },
    });

    revalidatePath("/lab/reception");
    revalidatePath(`/events/${medicalEventId}`);

    return {
      ok: true,
      data: {
        medicalEventId,
        labOrderId: created.id,
        folio: created.folio,
        status: created.status,
        itemsCount: created.items.length,
        alreadyExisted: false,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
      code: "INTERNAL",
    };
  }
}

// ---------------------------------------------------------------------------
// 3) POST — Marcar EventTest como SAMPLE_TAKEN (con trigger automático)
// ---------------------------------------------------------------------------
export async function markSampleTakenAction(
  eventTestId: string,
  input?: { notes?: string | null }
): Promise<ActionResult<MarkSampleTakenResponse>> {
  const guard = await _requireReception();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  const parsed = markSampleTakenSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      error: `Validación: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      code: "VALIDATION",
    };
  }
  try {
    const et = await prisma.eventTest.findUnique({
      where: { id: eventTestId },
      include: { test: true },
    });
    if (!et) {
      return { ok: false, error: `EventTest ${eventTestId} no existe`, code: "NOT_FOUND" };
    }
    const currentStatus = _normalizeStatus(et.status);
    if (currentStatus === "SAMPLE_TAKEN") {
      return {
        ok: true,
        data: {
          eventTestId,
          status: "SAMPLE_TAKEN",
          triggeredLabOrder: null,
          alreadyTaken: true,
        },
      };
    }
    if (currentStatus === "CANCELLED" || currentStatus === "SKIPPED" || currentStatus === "COMPLETED") {
      return {
        ok: false,
        error: `No se puede cambiar status de EventTest en estado ${currentStatus}`,
        code: "INVALID",
      };
    }

    // Cambiar status
    await prisma.eventTest.update({
      where: { id: eventTestId },
      data: {
        status: "SAMPLE_TAKEN",
        ...(parsed.data.notes ? { resultNotes: parsed.data.notes } : {}),
      },
    });

    // Trigger si es de Laboratorio
    let triggered: AutoGenerateLabOrderResponse | null = null;
    if (et.test?.categoryId === LAB_CATEGORY_ID) {
      const triggerRes = await autoGenerateLabOrderAction({ medicalEventId: et.eventId });
      if (triggerRes.ok) {
        triggered = triggerRes.data;
      }
    }

    revalidatePath(`/events/${et.eventId}`);
    revalidatePath("/lab/reception");

    return {
      ok: true,
      data: {
        eventTestId,
        status: "SAMPLE_TAKEN",
        triggeredLabOrder: triggered,
        alreadyTaken: false,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
      code: "INTERNAL",
    };
  }
}

// ---------------------------------------------------------------------------
// 4) Helper — obtener datos resumidos de un MedicalEvent para admisión auto
// ---------------------------------------------------------------------------
export async function getMedicalEventForLabAdmissionAction(
  medicalEventId: string
): Promise<
  ActionResult<{
    medicalEventId: string;
    workerId: string;
    workerName: string;
    workerCode: string;
    companyId: string | null;
    companyName: string | null;
    branchId: string | null;
    branchName: string | null;
    doctorName: string;
    intakeCreatedByUserId: string | null;
    eventTests: Array<{
      id: string;
      testNameSnapshot: string;
      medicalTestId: string | null;
      medicalTestCode: string | null;
    }>;
  }>
> {
  const guard = await _requireReception();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  try {
    const event = await prisma.medicalEvent.findUnique({
      where: { id: medicalEventId },
      include: {
        worker: { include: { company: true } },
        branch: true,
        intakeCreatedByUser: true,
        eventTests: {
          where: {
            status: "SAMPLE_TAKEN",
            test: { categoryId: LAB_CATEGORY_ID },
          },
          include: { test: true },
        },
      },
    });
    if (!event) {
      return { ok: false, error: "MedicalEvent no existe", code: "NOT_FOUND" };
    }
    return {
      ok: true,
      data: {
        medicalEventId: event.id,
        workerId: event.workerId,
        workerName: event.worker
          ? `${event.worker.firstName ?? ""} ${event.worker.lastName ?? ""}`.trim() || "—"
          : "—",
        workerCode: event.worker?.universalId ?? "",
        companyId: event.worker?.companyId ?? null,
        companyName: event.worker?.company?.name ?? null,
        branchId: event.branchId ?? null,
        branchName: event.branch?.name ?? null,
        doctorName: event.intakeCreatedByUser?.fullName ?? "Por asignar",
        intakeCreatedByUserId: event.intakeCreatedByUserId ?? null,
        eventTests: event.eventTests.map((et) => ({
          id: et.id,
          testNameSnapshot: et.testNameSnapshot,
          medicalTestId: et.testId ?? null,
          medicalTestCode: et.test?.code ?? null,
        })),
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
      code: "INTERNAL",
    };
  }
}