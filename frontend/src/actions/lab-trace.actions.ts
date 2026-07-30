/**
 * @file Server Actions para LabTraceEvent (Fase 2 NOVA absorción — D Trazabilidad).
 * @id IMPL-20260707-18
 * @backup context/SPECs/SPEC_IMPL-20260707-SLICES-D-G-FINAL.md §2 (FASE 2)
 *
 * Mismo patrón que el resto de la familia lab_*:
 *  - Validación Zod server-side
 *  - Rol permitido: ADMIN
 *  - revalidatePath tras mutaciones
 *  - Prisma directo (no fetch al backend FastAPI)
 */
"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import prisma from "@/lib/prisma";
import { isAdminLike } from "@/lib/auth/roles";
import { recordTraceEventSchema, type RecordTraceEventInput, type LabTraceEventType } from "@/lib/validations/lab-trace";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export interface LabTraceEventRow {
  id: string;
  labOrderId: string;
  event: LabTraceEventType | string;
  timestamp: string;
  userId: string | null;
  userFullName: string | null;
  notes: string | null;
  location: string | null;
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
    console.error("[lab-trace actions] session error:", err);
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
// 1) GET timeline de una LabOrder
// ---------------------------------------------------------------------------
export async function getLabTraceAction(
  orderId: string
): Promise<ActionResult<{ labOrderId: string; total: number; rows: LabTraceEventRow[] }>> {
  const guard = await _requireAdmin();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  if (!orderId) return { ok: false, error: "orderId obligatorio", code: "VALIDATION" };

  try {
    const order = await prisma.labOrder.findUnique({ where: { id: orderId }, select: { id: true } });
    if (!order) return { ok: false, error: `LabOrder ${orderId} no existe`, code: "NOT_FOUND" };

    const events = await prisma.labTraceEvent.findMany({
      where: { labOrderId: orderId },
      include: { user: { select: { fullName: true } } },
      orderBy: { timestamp: "asc" },
    });

    const rows: LabTraceEventRow[] = events.map((e) => ({
      id: e.id,
      labOrderId: e.labOrderId,
      event: e.event,
      timestamp: (e.timestamp instanceof Date ? e.timestamp.toISOString() : String(e.timestamp)),
      userId: e.userId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      userFullName: (e as any).user?.fullName ?? null,
      notes: e.notes,
      location: e.location,
    }));
    return { ok: true, data: { labOrderId: orderId, total: rows.length, rows } };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 2) POST evento manual
// ---------------------------------------------------------------------------
export async function recordLabTraceEventAction(
  orderId: string,
  input: RecordTraceEventInput
): Promise<ActionResult<LabTraceEventRow>> {
  const guard = await _requireAdmin();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  if (!orderId) return { ok: false, error: "orderId obligatorio", code: "VALIDATION" };

  const parsed = recordTraceEventSchema.safeParse(input);
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

    const created = await prisma.labTraceEvent.create({
      data: {
        labOrderId: orderId,
        event: parsed.data.event,
        notes: parsed.data.notes ?? null,
        location: parsed.data.location ?? null,
        userId: guard.userId,
      },
      include: { user: { select: { fullName: true } } },
    });

    revalidatePath(`/lab/results/${orderId}`);
    revalidatePath("/lab/results");

    return {
      ok: true,
      data: {
        id: created.id,
        labOrderId: created.labOrderId,
        event: created.event,
        timestamp:
          created.timestamp instanceof Date
            ? created.timestamp.toISOString()
            : String(created.timestamp),
        userId: created.userId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        userFullName: (created as any).user?.fullName ?? null,
        notes: created.notes,
        location: created.location,
      },
    };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 3) Auto-record lifecycle (idempotente, helper interno)
//    - SAMPLE_RECEIVED al confirmar LabOrder (DRAFT → SAVED)
//    - VALIDATED al pasar un LabResult a VALIDATED
//    No falla si ya existe un evento del mismo tipo (idempotente).
// ---------------------------------------------------------------------------
export async function autoRecordLabTraceEventAction(
  orderId: string,
  event: LabTraceEventType,
  notes?: string | null
): Promise<{ ok: boolean; created: boolean; reason?: string }> {
  if (!orderId || !event) return { ok: false, created: false, reason: "missing_args" };
  try {
    const order = await prisma.labOrder.findUnique({ where: { id: orderId }, select: { id: true } });
    if (!order) return { ok: false, created: false, reason: "order_not_found" };

    // Idempotencia: si ya hay un evento del mismo tipo para esta orden, no duplicar.
    const existing = await prisma.labTraceEvent.findFirst({
      where: { labOrderId: orderId, event },
    });
    if (existing) return { ok: true, created: false };

    // El userId lo dejamos null en auto-record para no asumir sesión; el caller
    // (server action que confirma la orden o valida un resultado) ya pasó por
    // la guarda de ADMIN y registra el userId explícito en el endpoint manual
    // cuando aplica. Aquí priorizamos robustez: que NUNCA rompa el flujo.
    await prisma.labTraceEvent.create({
      data: {
        labOrderId: orderId,
        event,
        notes: notes ?? null,
        location: null,
        userId: null,
      },
    });
    revalidatePath(`/lab/results/${orderId}`);
    return { ok: true, created: true };
  } catch (err) {
    // Nunca romper el flujo principal por un fallo en el trace
    console.error("[autoRecordLabTraceEventAction] error:", err);
    return { ok: false, created: false, reason: err instanceof Error ? err.message : "unknown" };
  }
}
