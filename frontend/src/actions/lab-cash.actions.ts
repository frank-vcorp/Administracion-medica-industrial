/**
 * @file Server Actions para Fase 3 NOVA — G Caja, Cortesías y corte de caja.
 * @id IMPL-20260708-19
 * @backup context/SPECs/SPEC_IMPL-20260707-SLICES-D-G-FINAL.md §2 (FASE 3)
 *
 * Mismo patrón que lab-trace.actions.ts:
 *  - Validación Zod server-side
 *  - Rol permitido: ADMIN, RECEPTIONIST, CAPTURIST
 *  - revalidatePath tras mutaciones
 *  - Prisma directo (no fetch al backend FastAPI)
 */
"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import prisma from "@/lib/prisma";
import {
  markCourtesySchema,
  registerPaymentSchema,
  cashClosingQuerySchema,
  type RegisterPaymentInput,
  type MarkCourtesyInput,
  type PaymentMethod,
} from "@/lib/validations/lab-cash";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export interface CashPaymentRow {
  id: string;
  labOrderId: string;
  amount: number;
  method: PaymentMethod | string;
  reference: string | null;
  currency: string;
  userId: string;
  userFullName: string | null;
  createdAt: string;
}

export interface CashPaymentsSummary {
  labOrderId: string;
  total: number;
  rows: CashPaymentRow[];
  paidTotal: number;
  orderTotal: number;
  balance: number;
}

export interface CourtesyRow {
  id: string;
  labOrderId: string;
  reason: string;
  approvedById: string;
  approvedByFullName: string | null;
  createdAt: string;
}

export interface CashClosingMethodTotal {
  method: PaymentMethod;
  count: number;
  total: number;
}

export interface CashClosingReport {
  dateFrom: string;
  dateTo: string;
  totalOrders: number;
  courtesyOrders: number;
  billedOrders: number;
  totalBilled: number;
  totalCollected: number;
  balancePending: number;
  byMethod: CashClosingMethodTotal[];
  paymentsCount: number;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function _requireStaff(): Promise<{ userId: string } | null> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return null;
    const role = session.user.role;
    if (!["ADMIN", "RECEPTIONIST", "CAPTURIST"].includes(role)) return null;
    return { userId: session.user.id };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[lab-cash actions] session error:", err);
    return null;
  }
}

function _err(error: unknown): ActionResult<never> {
  return {
    ok: false,
    error: error instanceof Error ? error.message : "Error desconocido",
  };
}

// ---------------------------------------------------------------------------
// 1) Registrar pago (POST /lab/orders/{id}/payments)
// ---------------------------------------------------------------------------
export async function registerLabPaymentAction(
  orderId: string,
  input: RegisterPaymentInput
): Promise<ActionResult<CashPaymentRow>> {
  const guard = await _requireStaff();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  if (!orderId) return { ok: false, error: "orderId obligatorio", code: "VALIDATION" };

  const parsed = registerPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Validación Zod: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      code: "VALIDATION",
    };
  }

  try {
    const order = await prisma.labOrder.findUnique({ where: { id: orderId }, select: { id: true } });
    if (!order) return { ok: false, error: `LabOrder ${orderId} no existe`, code: "NOT_FOUND" };

    const created = await prisma.labCashMovement.create({
      data: {
        labOrderId: orderId,
        amount: parsed.data.amount,
        method: parsed.data.method,
        reference: parsed.data.reference ?? null,
        currency: parsed.data.currency ?? "MXN",
        userId: guard.userId,
      },
      include: { user: { select: { fullName: true } } },
    });

    revalidatePath(`/lab/results/${orderId}`);
    revalidatePath("/lab/cash");
    revalidatePath("/lab/cash-closing");

    return {
      ok: true,
      data: {
        id: created.id,
        labOrderId: created.labOrderId,
        amount: Number(created.amount),
        method: created.method as PaymentMethod,
        reference: created.reference,
        currency: created.currency,
        userId: created.userId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        userFullName: (created as any).user?.fullName ?? null,
        createdAt:
          created.createdAt instanceof Date
            ? created.createdAt.toISOString()
            : String(created.createdAt),
      },
    };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 2) Listar pagos de una orden (GET /lab/orders/{id}/payments)
// ---------------------------------------------------------------------------
export async function getLabPaymentsAction(
  orderId: string
): Promise<ActionResult<CashPaymentsSummary>> {
  const guard = await _requireStaff();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  if (!orderId) return { ok: false, error: "orderId obligatorio", code: "VALIDATION" };

  try {
    const order = await prisma.labOrder.findUnique({
      where: { id: orderId },
      select: { id: true, total: true },
    });
    if (!order) return { ok: false, error: `LabOrder ${orderId} no existe`, code: "NOT_FOUND" };

    const rows = await prisma.labCashMovement.findMany({
      where: { labOrderId: orderId },
      include: { user: { select: { fullName: true } } },
      orderBy: { createdAt: "asc" },
    });

    const cashRows: CashPaymentRow[] = rows.map((r) => ({
      id: r.id,
      labOrderId: r.labOrderId,
      amount: Number(r.amount),
      method: r.method as PaymentMethod,
      reference: r.reference,
      currency: r.currency,
      userId: r.userId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      userFullName: (r as any).user?.fullName ?? null,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    }));
    const paidTotal = cashRows.reduce((sum, r) => sum + r.amount, 0);
    const orderTotal = Number(order.total);
    return {
      ok: true,
      data: {
        labOrderId: orderId,
        total: cashRows.length,
        rows: cashRows,
        paidTotal: Math.round(paidTotal * 100) / 100,
        orderTotal: Math.round(orderTotal * 100) / 100,
        balance: Math.round(Math.max(0, orderTotal - paidTotal) * 100) / 100,
      },
    };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 3) Marcar como cortesía (POST /lab/orders/{id}/courtesy)
// ---------------------------------------------------------------------------
export async function markLabCourtesyAction(
  orderId: string,
  input: MarkCourtesyInput
): Promise<ActionResult<CourtesyRow>> {
  const guard = await _requireStaff();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  if (!orderId) return { ok: false, error: "orderId obligatorio", code: "VALIDATION" };

  const parsed = markCourtesySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Validación Zod: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      code: "VALIDATION",
    };
  }

  try {
    const order = await prisma.labOrder.findUnique({ where: { id: orderId }, select: { id: true } });
    if (!order) return { ok: false, error: `LabOrder ${orderId} no existe`, code: "NOT_FOUND" };

    // Idempotente
    const existing = await prisma.courtesy.findUnique({ where: { labOrderId: orderId } });
    if (existing) {
      return {
        ok: true,
        data: {
          id: existing.id,
          labOrderId: existing.labOrderId,
          reason: existing.reason,
          approvedById: existing.approvedById,
          approvedByFullName: null,
          createdAt:
            existing.createdAt instanceof Date
              ? existing.createdAt.toISOString()
              : String(existing.createdAt),
        },
      };
    }

    const created = await prisma.courtesy.create({
      data: {
        labOrderId: orderId,
        reason: parsed.data.reason,
        approvedById: guard.userId,
      },
      include: { approvedBy: { select: { fullName: true } } },
    });

    // Marcar la LabOrder como cortesía (no borramos cashMovements)
    try {
      await prisma.labOrder.update({
        where: { id: orderId },
        data: { isCourtesy: true, courtesyType: parsed.data.reason.slice(0, 200) },
      });
    } catch {
      // No romper el flujo principal
    }

    revalidatePath(`/lab/results/${orderId}`);
    revalidatePath("/lab/cash");
    revalidatePath("/lab/cash-closing");

    return {
      ok: true,
      data: {
        id: created.id,
        labOrderId: created.labOrderId,
        reason: created.reason,
        approvedById: created.approvedById,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        approvedByFullName: (created as any).approvedBy?.fullName ?? null,
        createdAt:
          created.createdAt instanceof Date
            ? created.createdAt.toISOString()
            : String(created.createdAt),
      },
    };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 4) Quitar cortesía (DELETE /lab/orders/{id}/courtesy)
// ---------------------------------------------------------------------------
export async function clearLabCourtesyAction(
  orderId: string
): Promise<ActionResult<{ removed: boolean }>> {
  const guard = await _requireStaff();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  if (!orderId) return { ok: false, error: "orderId obligatorio", code: "VALIDATION" };

  try {
    const existing = await prisma.courtesy.findUnique({ where: { labOrderId: orderId } });
    if (!existing) {
      return { ok: true, data: { removed: false } };
    }
    await prisma.courtesy.delete({ where: { id: existing.id } });
    try {
      await prisma.labOrder.update({
        where: { id: orderId },
        data: { isCourtesy: false, courtesyType: null },
      });
    } catch {
      // No romper el flujo
    }
    revalidatePath(`/lab/results/${orderId}`);
    revalidatePath("/lab/cash");
    revalidatePath("/lab/cash-closing");
    return { ok: true, data: { removed: true } };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 5) Obtener cortesía actual
// ---------------------------------------------------------------------------
export async function getLabCourtesyAction(
  orderId: string
): Promise<ActionResult<CourtesyRow | null>> {
  const guard = await _requireStaff();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  if (!orderId) return { ok: false, error: "orderId obligatorio", code: "VALIDATION" };

  try {
    const c = await prisma.courtesy.findUnique({
      where: { labOrderId: orderId },
      include: { approvedBy: { select: { fullName: true } } },
    });
    if (!c) return { ok: true, data: null };
    return {
      ok: true,
      data: {
        id: c.id,
        labOrderId: c.labOrderId,
        reason: c.reason,
        approvedById: c.approvedById,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        approvedByFullName: (c as any).approvedBy?.fullName ?? null,
        createdAt:
          c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
      },
    };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 6) Reporte de corte de caja
// ---------------------------------------------------------------------------
export async function getCashClosingAction(
  input: { dateFrom?: string | null; dateTo?: string | null } = {}
): Promise<ActionResult<CashClosingReport>> {
  const guard = await _requireStaff();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };

  const parsed = cashClosingQuerySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Validación Zod: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      code: "VALIDATION",
    };
  }

  try {
    // Construir rango de fechas
    const now = new Date();
    const end = parsed.data.dateTo
      ? new Date(parsed.data.dateTo)
      : now;
    const start = parsed.data.dateFrom
      ? new Date(parsed.data.dateFrom)
      : new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const payments = await prisma.labCashMovement.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      include: { labOrder: { select: { id: true, isCourtesy: true, total: true } } },
    });

    const seenOrderIds = new Set<string>();
    const courtesyOrders = new Set<string>();
    const billedOrders = new Set<string>();
    let totalBilled = 0;
    let totalCollected = 0;
    const byMethod: Record<string, { count: number; total: number }> = {};

    for (const p of payments) {
      const method = String(p.method);
      byMethod[method] = byMethod[method] ?? { count: 0, total: 0 };
      byMethod[method].count += 1;
      byMethod[method].total += Number(p.amount);
      totalCollected += Number(p.amount);

      const order = p.labOrder;
      if (order) {
        seenOrderIds.add(order.id);
        if (order.isCourtesy) {
          courtesyOrders.add(order.id);
        } else if (!billedOrders.has(order.id)) {
          billedOrders.add(order.id);
          totalBilled += Number(order.total);
        }
      }
    }

    const byMethodRows: CashClosingMethodTotal[] = [];
    for (const m of ["CASH", "CARD", "TRANSFER", "CHECK", "OTHER"]) {
      if (byMethod[m]) {
        byMethodRows.push({
          method: m as PaymentMethod,
          count: byMethod[m].count,
          total: Math.round(byMethod[m].total * 100) / 100,
        });
      }
    }

    return {
      ok: true,
      data: {
        dateFrom: start.toISOString(),
        dateTo: end.toISOString(),
        totalOrders: seenOrderIds.size,
        courtesyOrders: courtesyOrders.size,
        billedOrders: billedOrders.size,
        totalBilled: Math.round(totalBilled * 100) / 100,
        totalCollected: Math.round(totalCollected * 100) / 100,
        balancePending: Math.round(Math.max(0, totalBilled - totalCollected) * 100) / 100,
        byMethod: byMethodRows,
        paymentsCount: payments.length,
        generatedAt: now.toISOString(),
      },
    };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 7) Lista de órdenes pendientes de pago (para /lab/cash)
// ---------------------------------------------------------------------------
export async function getPendingCashOrdersAction(): Promise<
  ActionResult<
    Array<{
      id: string;
      folio: number | null;
      status: string;
      patientName: string;
      patientCode: string;
      companyName: string | null;
      total: number;
      paidTotal: number;
      balance: number;
      isCourtesy: boolean;
      createdAt: string;
    }>
  >
> {
  const guard = await _requireStaff();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  try {
    const orders = await prisma.labOrder.findMany({
      where: {
        status: { in: ["SAVED", "SAMPLE_TAKEN", "IN_PROCESS", "COMPLETED"] },
        cancelledAt: null,
      },
      include: {
        worker: { select: { firstName: true, lastName: true, universalId: true } },
        company: { select: { name: true } },
        cashMovements: { select: { amount: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const result = orders.map((o) => {
      const paidTotal = o.cashMovements.reduce((s, m) => s + Number(m.amount), 0);
      const total = Number(o.total);
      return {
        id: o.id,
        folio: o.folio,
        status: o.status,
        patientName: `${o.worker?.firstName ?? ""} ${o.worker?.lastName ?? ""}`.trim() || "—",
        patientCode: o.worker?.universalId ?? "—",
        companyName: o.company?.name ?? null,
        total,
        paidTotal: Math.round(paidTotal * 100) / 100,
        balance: Math.round(Math.max(0, total - paidTotal) * 100) / 100,
        isCourtesy: o.isCourtesy,
        createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt),
      };
    });
    return { ok: true, data: result };
  } catch (err) {
    return _err(err);
  }
}