/**
 * @file Server Actions para LabResult (Slice C NOVA absorción).
 * @id IMPL-20260707-16 — Slice C Resultados.
 * @backup context/SPECs/SPEC_IMPL-20260707-SLICE-C-RESULTADOS.md
 *
 * Patrón: idéntico a lab-catalog.actions.ts / lab-order.actions.ts.
 * - Validación Zod server-side.
 * - Rol permitido: ADMIN (LAB_ANALYST/LAB_VALIDATOR pendientes).
 * - revalidatePath tras mutaciones.
 *
 * NOTA: Slice C no requiere llamar al backend FastAPI — el server action
 * importa Prisma directamente. La API REST (/api/v1/lab/results) se conserva
 * para clientes externos / uso futuro desde otros slices.
 */
"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import prisma from "@/lib/prisma";
import {
  bulkCreateLabResultSchema,
  linkLabOrderItemEventTestSchema,
  transitionLabResultSchema,
  updateLabResultSchema,
  type CreateLabResultItemInput,
  type TransitionLabResultInput,
  type UpdateLabResultInput,
} from "@/lib/validations/lab-result";
import { validateValueAgainstRange } from "@/lib/lab-result-utils";
import { isAdminLike } from "@/lib/auth/roles";
// IMPL-20260707-18: Fase 2 — D Trazabilidad (auto-record VALIDATED)
import { autoRecordLabTraceEventAction } from "@/actions/lab-trace.actions";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

interface LabResultAuditItem {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  userId: string;
  createdAt: string | Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function _requireAdmin(): Promise<{ userId: string } | null> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return null;
    if (!isAdminLike(session.user.role)) return null;
    return { userId: session.user.id };
  } catch (err) {
    console.error("[lab-result actions] session error:", err);
    return null;
  }
}

function _err(error: unknown): ActionResult<never> {
  return {
    ok: false,
    error: error instanceof Error ? error.message : "Error desconocido",
  };
}

async function _recordAudit(
  resultId: string,
  action: string,
  fromStatus: string | null,
  toStatus: string | null,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  reason: string | null,
  userId: string
): Promise<void> {
  try {
    await prisma.labResultAudit.create({
      data: {
        resultId,
        action,
        fromStatus: fromStatus as never,
        toStatus: toStatus as never,
        before: before as never,
        after: after as never,
        reason,
        userId,
      },
    });
  } catch {
    // Audit nunca rompe el flujo principal.
  }
}

async function _resolveRange(
  analyteId: string,
  sex: string | null = null,
  ageMonths: number | null = null
): Promise<{
  valueMin: number | null;
  valueMax: number | null;
  criticalLow: number | null;
  criticalHigh: number | null;
  textValue: string | null;
} | null> {
  const ranges = await prisma.labReferenceRange.findMany({
    where: { analyteId },
  });
  // Filtra por sex (A siempre incluido) + edad
  const candidates = ranges.filter((r) => {
    if (r.sex !== "A" && sex && r.sex !== sex) return false;
    if (ageMonths !== null) {
      if (r.ageMinMonths !== null && ageMonths < r.ageMinMonths) return false;
      if (r.ageMaxMonths !== null && ageMonths > r.ageMaxMonths) return false;
    }
    return true;
  });
  if (candidates.length === 0) return null;
  // Prioriza M/F sobre A
  candidates.sort((a, b) =>
    a.sex === "A" ? 1 : b.sex === "A" ? -1 : 0
  );
  const picked = candidates[0];
  return {
    valueMin: picked.valueMin,
    valueMax: picked.valueMax,
    criticalLow: picked.criticalLow,
    criticalHigh: picked.criticalHigh,
    textValue: picked.textValue,
  };
}

// ---------------------------------------------------------------------------
// 1) LIST — paginado DataTables
// ---------------------------------------------------------------------------
export async function getLabResultsAction(
  filters: {
    draw: number;
    start: number;
    length: number;
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    orderId?: string;
    workerId?: string;
  }
): Promise<
  ActionResult<{
    draw: number;
    recordsTotal: number;
    recordsFiltered: number;
    data: Record<string, unknown>[];
  }>
> {
  const guard = await _requireAdmin();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };

  try {
    const draw = filters.draw ?? 1;
    const start = filters.start ?? 0;
    const length = filters.length ?? 25;
    const status = filters.status ?? "";
    const orderId = filters.orderId ?? "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (status) where.status = status;
    if (orderId) where.labOrderItem = { labOrderId: orderId };
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) {
        const end = new Date(filters.dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [recordsTotal, recordsFiltered, data] = await Promise.all([
      prisma.labResult.count(),
      prisma.labResult.count({ where }),
      prisma.labResult.findMany({
        where,
        skip: start,
        take: length,
        orderBy: { createdAt: "desc" },
        include: {
          analyte: { select: { code: true, name: true, dataType: true } },
          unit: { select: { symbol: true } },
        },
      }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { ok: true, data: { draw, recordsTotal, recordsFiltered, data: data as any } };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 2) GET one — con audit log
// ---------------------------------------------------------------------------
export async function getLabResultAction(
  resultId: string
): Promise<ActionResult<{ result: Record<string, unknown>; auditEvents: LabResultAuditItem[] }>> {
  const guard = await _requireAdmin();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  try {
    const result = await prisma.labResult.findUnique({
      where: { id: resultId },
      include: {
        analyte: { select: { code: true, name: true, dataType: true } },
        unit: { select: { symbol: true } },
      },
    });
    if (!result) {
      return { ok: false, error: `LabResult ${resultId} no existe`, code: "NOT_FOUND" };
    }
    const auditEvents = await prisma.labResultAudit.findMany({
      where: { resultId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { ok: true, data: { result: result as Record<string, unknown>, auditEvents } };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 3) BULK CREATE
// ---------------------------------------------------------------------------
export async function bulkCreateLabResultsAction(
  input: unknown
): Promise<ActionResult<{ ids: string[]; created: number; errors: string[] }>> {
  const guard = await _requireAdmin();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  const parsed = bulkCreateLabResultSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Validación Zod: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      code: "VALIDATION",
    };
  }

  try {
    const ids: string[] = [];
    const errors: string[] = [];
    for (const item of parsed.data.items as CreateLabResultItemInput[]) {
      try {
        const range = await _resolveRange(item.analyteId);
        const flags = validateValueAgainstRange(
          item.valueNumber ?? null,
          item.valueText ?? null,
          range ?? {}
        );
        const created = await prisma.labResult.create({
          data: {
            labOrderItemId: item.labOrderItemId,
            analyteId: item.analyteId,
            eventTestId: item.eventTestId ?? null,
            valueText: item.valueText ?? null,
            valueNumber: item.valueNumber ?? null,
            unitId: item.unitId ?? null,
            status: "PENDING",
            capturedById: guard.userId,
            capturedAt: new Date(),
            isOutOfRange: flags.isOutOfRange,
            isCritical: flags.isCritical,
            isAbnormal: item.isAbnormal ?? false,
            observations: item.observations ?? null,
          },
        });
        ids.push(created.id);
        await _recordAudit(
          created.id,
          "CREATE",
          null,
          "PENDING",
          null,
          { id: created.id, status: "PENDING" },
          null,
          guard.userId
        );
        if (flags.isOutOfRange || flags.isCritical) {
          await _recordAudit(
            created.id,
            "OUT_OF_RANGE_DETECTED",
            "PENDING",
            "PENDING",
            null,
            { isOutOfRange: flags.isOutOfRange, isCritical: flags.isCritical },
            null,
            guard.userId
          );
        }
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    revalidatePath("/lab/results");
    return { ok: true, data: { ids, created: ids.length, errors } };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 4) UPDATE — actualiza valor + recalcula out-of-range
// ---------------------------------------------------------------------------
export async function updateLabResultAction(
  resultId: string,
  input: UpdateLabResultInput
): Promise<ActionResult<{ result: Record<string, unknown> }>> {
  const guard = await _requireAdmin();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  const parsed = updateLabResultSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Validación Zod: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      code: "VALIDATION",
    };
  }
  try {
    const existing = await prisma.labResult.findUnique({ where: { id: resultId } });
    if (!existing) {
      return { ok: false, error: `LabResult ${resultId} no existe`, code: "NOT_FOUND" };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = { ...parsed.data };
    if ("valueNumber" in data || "valueText" in data) {
      const range = await _resolveRange(existing.analyteId);
      const flags = validateValueAgainstRange(
        data.valueNumber ?? existing.valueNumber,
        data.valueText ?? existing.valueText,
        range ?? {}
      );
      data.isOutOfRange = flags.isOutOfRange;
      data.isCritical = flags.isCritical;
    }
    const updated = await prisma.labResult.update({
      where: { id: resultId },
      data,
    });
    await _recordAudit(
      resultId,
      "UPDATE_VALUE",
      existing.status,
      updated.status,
      existing as Record<string, unknown>,
      updated as Record<string, unknown>,
      null,
      guard.userId
    );
    revalidatePath("/lab/results");
    revalidatePath(`/lab/results/[orderId]`, "page");
    return { ok: true, data: { result: updated as Record<string, unknown> } };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 5) TRANSITION — P/R/A/V/X
// ---------------------------------------------------------------------------
const LEGAL_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["REPORTED", "INVALIDATED"],
  REPORTED: ["AUTHORIZED", "INVALIDATED"],
  AUTHORIZED: ["VALIDATED", "INVALIDATED"],
  VALIDATED: ["INVALIDATED"],
  INVALIDATED: [],
};

const TRANSITION_USER_FIELDS: Record<string, { id: string; at: string }> = {
  REPORT: { id: "reportedById", at: "reportedAt" },
  AUTHORIZE: { id: "authorizedById", at: "authorizedAt" },
  VALIDATE: { id: "validatedById", at: "validatedAt" },
  INVALIDATE: { id: "invalidatedById", at: "invalidatedAt" },
};

const ACTION_TO_STATUS: Record<string, string> = {
  report: "REPORTED",
  authorize: "AUTHORIZED",
  validate: "VALIDATED",
  invalidate: "INVALIDATED",
};

export async function transitionLabResultAction(
  resultId: string,
  input: TransitionLabResultInput
): Promise<ActionResult<{ newStatus: string; result: Record<string, unknown> }>> {
  const guard = await _requireAdmin();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  const parsed = transitionLabResultSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Validación Zod: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      code: "VALIDATION",
    };
  }

  try {
    const existing = await prisma.labResult.findUnique({ where: { id: resultId } });
    if (!existing) {
      return { ok: false, error: `LabResult ${resultId} no existe`, code: "NOT_FOUND" };
    }
    const fromStatus = existing.status;
    const target = ACTION_TO_STATUS[parsed.data.action];
    const legal = LEGAL_TRANSITIONS[fromStatus] ?? [];
    if (!legal.includes(target)) {
      return {
        ok: false,
        error: `Transición ilegal: ${fromStatus} → ${target}. Estados permitidos desde ${fromStatus}: ${legal.join(", ")}`,
        code: "CONFLICT",
      };
    }
    if (parsed.data.action === "report") {
      if (existing.valueNumber === null && existing.valueText === null) {
        return {
          ok: false,
          error: "Para REPORTED se requiere capturar valor (valueText o valueNumber)",
          code: "VALIDATION",
        };
      }
    }
    if (parsed.data.action === "invalidate") {
      if (!parsed.data.reason || parsed.data.reason.length < 5) {
        return {
          ok: false,
          error: "INVALIDATE requiere motivo de al menos 5 caracteres",
          code: "VALIDATION",
        };
      }
    }

    const field = TRANSITION_USER_FIELDS[parsed.data.action.toUpperCase()];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {
      status: target,
      [field.id]: guard.userId,
      [field.at]: new Date(),
    };
    if (parsed.data.action === "invalidate") {
      data.invalidateReason = parsed.data.reason;
    }
    const updated = await prisma.labResult.update({
      where: { id: resultId },
      data,
    });
    await _recordAudit(
      resultId,
      parsed.data.action.toUpperCase(),
      fromStatus,
      target,
      existing as Record<string, unknown>,
      updated as Record<string, unknown>,
      parsed.data.reason ?? null,
      guard.userId
    );
    // IMPL-20260707-18: Fase 2 — D Trazabilidad (auto-record VALIDATED en LabOrder)
    if (target === "VALIDATED") {
      try {
        const item = await prisma.labOrderItem.findUnique({
          where: { id: updated.labOrderItemId },
          select: { labOrderId: true },
        });
        if (item?.labOrderId) {
          await autoRecordLabTraceEventAction(
            item.labOrderId,
            "VALIDATED",
            `LabResult ${resultId.slice(0, 8)}… validado`
          );
        }
      } catch {
        // nunca romper el flujo principal
      }
    }
    revalidatePath("/lab/results");
    revalidatePath(`/lab/results/[orderId]`, "page");
    return { ok: true, data: { newStatus: target, result: updated as Record<string, unknown> } };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 6) WORKLIST — hoja de trabajo con analitos esperados
// ---------------------------------------------------------------------------
export async function getWorklistAction(orderId: string): Promise<
  ActionResult<{
    orderId: string;
    folio: number | null;
    orderStatus: string;
    items: Array<{
      labOrderItemId: string;
      medicalTestId: string;
      medicalTestCode: string;
      medicalTestName: string;
      analytes: Array<{
        analyteId: string;
        code: string;
        name: string;
        dataType: string;
        orderIndex: number;
        defaultUnitId: string | null;
        defaultUnitSymbol: string | null;
        rangeMin: number | null;
        rangeMax: number | null;
        rangeText: string | null;
        criticalLow: number | null;
        criticalHigh: number | null;
        existingResultId: string | null;
        existingValueText: string | null;
        existingValueNumber: number | null;
        existingStatus: string | null;
      }>;
    }>;
  }>
> {
  const guard = await _requireAdmin();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  try {
    const order = await prisma.labOrder.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            medicalTest: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    if (!order) {
      return { ok: false, error: `LabOrder ${orderId} no existe`, code: "NOT_FOUND" };
    }
    const items: Array<{
      labOrderItemId: string;
      medicalTestId: string;
      medicalTestCode: string;
      medicalTestName: string;
      analytes: Array<{
        analyteId: string;
        code: string;
        name: string;
        dataType: string;
        orderIndex: number;
        defaultUnitId: string | null;
        defaultUnitSymbol: string | null;
        rangeMin: number | null;
        rangeMax: number | null;
        rangeText: string | null;
        criticalLow: number | null;
        criticalHigh: number | null;
        existingResultId: string | null;
        existingValueText: string | null;
        existingValueNumber: number | null;
        existingStatus: string | null;
      }>;
    }> = [];
    for (const it of order.items) {
      const analytes = await prisma.labAnalyte.findMany({
        where: { medicalTestId: it.medicalTestId, active: true },
        orderBy: { orderIndex: "asc" },
        include: { defaultUnit: { select: { symbol: true } } },
      });
      const existingResults = await prisma.labResult.findMany({
        where: { labOrderItemId: it.id },
      });
      const existingByAnalyte = new Map(existingResults.map((r) => [r.analyteId, r]));
      const expected = analytes.map((a) => {
        const ranges = [] as unknown[]; // synchronous fetch happens below
        return {
          analyteId: a.id,
          code: a.code,
          name: a.name,
          dataType: a.dataType,
          orderIndex: a.orderIndex,
          defaultUnitId: a.defaultUnitId,
          defaultUnitSymbol: a.defaultUnit?.symbol ?? null,
          rangeMin: null as number | null,
          rangeMax: null as number | null,
          rangeText: null as string | null,
          criticalLow: null as number | null,
          criticalHigh: null as number | null,
          existingResultId: existingByAnalyte.get(a.id)?.id ?? null,
          existingValueText: existingByAnalyte.get(a.id)?.valueText ?? null,
          existingValueNumber: existingByAnalyte.get(a.id)?.valueNumber ?? null,
          existingStatus: existingByAnalyte.get(a.id)?.status ?? null,
          _ranges: ranges,
        };
      });
      // Resolver rango por analito
      for (const e of expected) {
        const ranges = await prisma.labReferenceRange.findMany({
          where: { analyteId: e.analyteId },
        });
        // Pick el primero con sex=A o sin restricción
        const picked = ranges.find((r) => r.sex === "A") ?? ranges[0];
        if (picked) {
          e.rangeMin = picked.valueMin;
          e.rangeMax = picked.valueMax;
          e.rangeText = picked.textValue;
          e.criticalLow = picked.criticalLow;
          e.criticalHigh = picked.criticalHigh;
        }
      }
      items.push({
        labOrderItemId: it.id,
        medicalTestId: it.medicalTestId,
        medicalTestCode: it.medicalTest.code,
        medicalTestName: it.medicalTest.name,
        analytes: expected.map((e) => ({
          analyteId: e.analyteId,
          code: e.code,
          name: e.name,
          dataType: e.dataType,
          orderIndex: e.orderIndex,
          defaultUnitId: e.defaultUnitId,
          defaultUnitSymbol: e.defaultUnitSymbol,
          rangeMin: e.rangeMin,
          rangeMax: e.rangeMax,
          rangeText: e.rangeText,
          criticalLow: e.criticalLow,
          criticalHigh: e.criticalHigh,
          existingResultId: e.existingResultId,
          existingValueText: e.existingValueText,
          existingValueNumber: e.existingValueNumber,
          existingStatus: e.existingStatus,
        })),
      });
    }
    return {
      ok: true,
      data: {
        orderId,
        folio: order.folio,
        orderStatus: order.status,
        items,
      },
    };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 7) LINK — LabOrderItem ↔ EventTest
// ---------------------------------------------------------------------------
export async function linkLabOrderItemToEventTestAction(
  input: unknown
): Promise<ActionResult<{ itemId: string; eventTestId: string | null }>> {
  const guard = await _requireAdmin();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  const parsed = linkLabOrderItemEventTestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Validación Zod: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      code: "VALIDATION",
    };
  }
  try {
    const item = await prisma.labOrderItem.findUnique({ where: { id: parsed.data.itemId } });
    if (!item) {
      return { ok: false, error: `LabOrderItem ${parsed.data.itemId} no existe`, code: "NOT_FOUND" };
    }
    await prisma.labOrderItem.update({
      where: { id: parsed.data.itemId },
      data: { eventTestId: parsed.data.eventTestId ?? null },
    });
    revalidatePath("/lab/reception");
    revalidatePath(`/lab/results/[orderId]`, "page");
    return { ok: true, data: { itemId: parsed.data.itemId, eventTestId: parsed.data.eventTestId ?? null } };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 8) getLabResultsForEventTestAction — Fase 2 — C-update
// Lista todos los LabResults vinculados a un EventTest específico
// (vía LabResult.eventTestId). Usado por el componente LabResultsSummary
// en /events/[id] para mostrar el valor del analito capturado por cada
// EventTest de categoría Laboratorio.
// ---------------------------------------------------------------------------
export interface LabResultForEventTest {
  id: string;
  labOrderItemId: string;
  labOrderId: string | null;
  labOrderFolio: number | null;
  analyteCode: string;
  analyteName: string;
  valueText: string | null;
  valueNumber: number | null;
  unitSymbol: string | null;
  status: string;
  isOutOfRange: boolean;
  isCritical: boolean;
  createdAt: string;
}

export async function getLabResultsForEventTestAction(
  eventTestId: string
): Promise<ActionResult<{ rows: LabResultForEventTest[]; total: number }>> {
  const guard = await _requireAdmin();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  if (!eventTestId) {
    return { ok: false, error: "eventTestId obligatorio", code: "VALIDATION" };
  }
  try {
    const et = await prisma.eventTest.findUnique({
      where: { id: eventTestId },
      select: { id: true },
    });
    if (!et) {
      return { ok: false, error: `EventTest ${eventTestId} no existe`, code: "NOT_FOUND" };
    }
    const rows = await prisma.labResult.findMany({
      where: { eventTestId },
      orderBy: { createdAt: "desc" },
      include: {
        analyte: { select: { code: true, name: true } },
        unit: { select: { symbol: true } },
        labOrderItem: {
          select: {
            id: true,
            labOrder: { select: { id: true, folio: true } },
          },
        },
      },
    });
    const mapped: LabResultForEventTest[] = rows.map((r) => ({
      id: r.id,
      labOrderItemId: r.labOrderItemId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      labOrderId: (r as any).labOrderItem?.labOrder?.id ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      labOrderFolio: (r as any).labOrderItem?.labOrder?.folio ?? null,
      analyteCode: r.analyte?.code ?? "—",
      analyteName: r.analyte?.name ?? "",
      valueText: r.valueText,
      valueNumber: r.valueNumber,
      unitSymbol: r.unit?.symbol ?? null,
      status: String(r.status),
      isOutOfRange: r.isOutOfRange,
      isCritical: r.isCritical,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    }));
    return { ok: true, data: { rows: mapped, total: mapped.length } };
  } catch (err) {
    return _err(err);
  }
}