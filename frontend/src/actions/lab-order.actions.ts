/**
 * @file Server Actions para LabOrder (Slice B NOVA absorción).
 * @id IMPL-20260701-03 — Slice B Recepción (ARCH-20260701-03).
 * @backup context/SPECs/SPEC_IMPL-20260701-SLICE-B-RECEPCION.md
 *
 * HOTFIX IMPL-20260706-11: server actions usan Prisma directo.
 *
 * Histórico de hotfixes anteriores (descartados):
 * - IMPL-20260701-07: bypass FastAPI (bug Prisma JS→Python).
 * - IMPL-20260706-10: reenviar cookies en _localFetch.
 *
 * Ambos quedaron descartados por problemas conocidos de enrutamiento
 * de fetch desde server actions hacia rutas del mismo server Next.js
 * (Vercel respondía con HTML 404/login redirect → "Unexpected token '<'").
 *
 * Solución definitiva (este hotfix): el server action importa Prisma
 * directamente. La API route se conserva intacta para uso de clientes
 * externos en el futuro.
 *
 * Patrón: idéntico a lab-catalog.actions.ts.
 * - Validación Zod server-side
 * - Rol permitido: ADMIN (LAB_RECEPTIONIST pendiente)
 * - revalidatePath('/lab/reception') tras cada mutación
 */
"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import prisma from "@/lib/prisma";
import { calculateTotals } from "@/lib/lab-order-totals";
import {
  cancelLabOrderSchema,
  createLabOrderSchema,
  labOrderItemInputSchema,
  updateLabOrderSchema,
  type CompanySearchResult,
  type DoctorSearchResult,
  type LabTestSearchResult,
  type WorkerSearchResult,
} from "@/lib/validations/lab-order";
// IMPL-20260707-18: Fase 2 — D Trazabilidad (auto-record SAMPLE_RECEIVED al confirmar)
import { autoRecordLabTraceEventAction } from "@/actions/lab-trace.actions";

// ---------------------------------------------------------------------------
// Tipos de retorno y errores
// ---------------------------------------------------------------------------
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------
async function _requireReception(): Promise<{ userId: string; role: string } | null> {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    const userId = session?.user?.id;
    if (!session?.user || !userId) return null;
    // ADM-20260701-01: roles permitidos LabOrder = ADMIN (LAB_RECEPTIONIST
    // pendiente de incorporarse al enum de roles de NextAuth).
    if (role !== "ADMIN") return null;
    return { userId, role: role as string };
  } catch (err) {
    // IMPL-20260706-11: si NextAuth falla, no devolver 500 HTML.
    console.error("[_requireReception] session error:", err);
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
// 1) CREATE — POST /api/v1/lab/orders
// ---------------------------------------------------------------------------
export async function createLabOrderAction(
  input: unknown
): Promise<ActionResult<{ id: string; order: Record<string, unknown> }>> {
  const guard = await _requireReception();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  const parsed = createLabOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Validación Zod: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
      code: "VALIDATION",
    };
  }
  try {
    // Calcular folio: max(folio) + 1
    const last = await prisma.labOrder.findFirst({
      orderBy: { folio: "desc" },
      select: { folio: true },
    });
    const nextFolio = (last?.folio ?? 0) + 1;

    // IMPL-20260701-07: MedicalTest no tiene columna `price` en el schema.
    // El precio viaja explícito en cada item.
    const itemsForTotal = parsed.data.items.map((i) => ({
      price: i.price ?? 0,
      discountAmount: i.discountAmount ?? 0,
      discountPct: i.discountPct ?? 0,
    }));
    const totals = calculateTotals(itemsForTotal, 16);

    const created = await prisma.labOrder.create({
      data: {
        folio: nextFolio,
        branch: "MATRIZ",
        workerId: parsed.data.workerId,
        medicalEventId: parsed.data.medicalEventId ?? null,
        companyId: parsed.data.companyId ?? null,
        classificationId: parsed.data.classificationId ?? null,
        doctorName: parsed.data.doctorName,
        doctorClave: parsed.data.doctorClave ?? null,
        patientDiscountPct: parsed.data.patientDiscountPct ?? 0,
        doctorDiscountPct: parsed.data.doctorDiscountPct ?? 0,
        doctorCommissionPct: parsed.data.doctorCommissionPct ?? 0,
        companyDiscountPct: parsed.data.companyDiscountPct ?? 0,
        urgency: parsed.data.urgency ?? "NORMAL",
        confidentiality: parsed.data.confidentiality ?? "NORMAL",
        homeSample: parsed.data.homeSample ?? false,
        sendResultsByEmail: parsed.data.sendResultsByEmail ?? false,
        generateInvoice: parsed.data.generateInvoice ?? false,
        language: parsed.data.language ?? "es",
        deliveryDate: parsed.data.deliveryDate
          ? new Date(parsed.data.deliveryDate)
          : null,
        deliveryTime: parsed.data.deliveryTime ?? null,
        status: "DRAFT",
        isCourtesy: parsed.data.isCourtesy ?? false,
        courtesyType: parsed.data.courtesyType ?? null,
        subtotal: totals.subtotal,
        ivaPct: 16,
        iva: totals.iva,
        total: totals.total,
        observations: parsed.data.observations ?? null,
        createdById: guard.userId,
        items: {
          create: parsed.data.items.map((i) => {
            const basePrice = i.price ?? 0;
            const amount =
              basePrice -
              (i.discountAmount ?? 0) -
              (basePrice * (i.discountPct ?? 0)) / 100;
            return {
              medicalTestId: i.medicalTestId,
              price: basePrice,
              discountAmount: i.discountAmount ?? 0,
              discountPct: i.discountPct ?? 0,
              amount: Math.max(0, Number(amount.toFixed(2))),
              resultStatus: "P",
            };
          }),
        },
      },
      include: { items: true },
    });

    revalidatePath("/lab/reception");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { ok: true, data: { id: created.id, order: created as any } };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 2) UPDATE — PATCH /api/v1/lab/orders/{id}
// ---------------------------------------------------------------------------
export async function updateLabOrderAction(
  orderId: string,
  input: unknown
): Promise<ActionResult<{ order: Record<string, unknown> }>> {
  const guard = await _requireReception();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  const parsed = updateLabOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Validación Zod: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
      code: "VALIDATION",
    };
  }
  try {
    const existing = await prisma.labOrder.findUnique({ where: { id: orderId } });
    if (!existing) {
      return { ok: false, error: `LabOrder ${orderId} no existe`, code: "NOT_FOUND" };
    }
    if (existing.status === "CANCELLED") {
      return {
        ok: false,
        error: "No se puede modificar una orden cancelada",
        code: "CONFLICT",
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = { ...parsed.data };
    if (data.deliveryDate) {
      data.deliveryDate = new Date(data.deliveryDate);
    }
    // No se actualizan items por aquí — se gestiona via /items endpoints.
    delete data.items;

    const updated = await prisma.labOrder.update({
      where: { id: orderId },
      data,
      include: { items: true },
    });
    revalidatePath("/lab/reception");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { ok: true, data: { order: updated as any } };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 3) GET FULL — GET /api/v1/lab/orders/{id}
// ---------------------------------------------------------------------------
export async function getLabOrderAction(
  orderId: string
): Promise<ActionResult<{ order: Record<string, unknown> }>> {
  const guard = await _requireReception();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  try {
    const order = await prisma.labOrder.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { medicalTest: true } },
        worker: true,
        company: true,
        classification: true,
      },
    });
    if (!order) {
      return { ok: false, error: `LabOrder ${orderId} no existe`, code: "NOT_FOUND" };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { ok: true, data: { order: order as any } };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 4) CANCEL — DELETE /api/v1/lab/orders/{id}?motivo=
// ---------------------------------------------------------------------------
export async function cancelLabOrderAction(
  orderId: string,
  motivo: string
): Promise<ActionResult<{ order: Record<string, unknown> }>> {
  const guard = await _requireReception();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  const parsed = cancelLabOrderSchema.safeParse({ motivo });
  if (!parsed.success) {
    return { ok: false, error: "Motivo inválido (min 3 caracteres)", code: "VALIDATION" };
  }
  try {
    const existing = await prisma.labOrder.findUnique({ where: { id: orderId } });
    if (!existing) {
      return { ok: false, error: `LabOrder ${orderId} no existe`, code: "NOT_FOUND" };
    }

    const cancelled = await prisma.labOrder.update({
      where: { id: orderId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledById: guard.userId,
        observations:
          (existing.observations ?? "") +
          `\n[CANCELADO ${new Date().toISOString()}] ${parsed.data.motivo}`,
      },
    });
    revalidatePath("/lab/reception");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { ok: true, data: { order: cancelled as any } };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 5) CONFIRM — POST /api/v1/lab/orders/{id}/confirm
// ---------------------------------------------------------------------------
export async function confirmLabOrderAction(
  orderId: string
): Promise<ActionResult<{ order: Record<string, unknown> }>> {
  const guard = await _requireReception();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  try {
    const existing = await prisma.labOrder.findUnique({
      where: { id: orderId },
      include: { _count: { select: { items: true } } },
    });
    if (!existing) {
      return { ok: false, error: `LabOrder ${orderId} no existe`, code: "NOT_FOUND" };
    }
    if (existing.status !== "DRAFT") {
      return {
        ok: false,
        error: `Solo se confirman órdenes en DRAFT (actual: ${existing.status})`,
        code: "CONFLICT",
      };
    }
    if (existing._count.items === 0) {
      return {
        ok: false,
        error: "La orden no tiene estudios",
        code: "UNPROCESSABLE",
      };
    }

    const updated = await prisma.labOrder.update({
      where: { id: orderId },
      data: { status: "SAVED", confirmedAt: new Date() },
      include: { items: true },
    });
    // IMPL-20260707-18: Fase 2 — D Trazabilidad (auto-record SAMPLE_RECEIVED)
    try {
      await autoRecordLabTraceEventAction(
        orderId,
        "SAMPLE_RECEIVED",
        `Orden confirmada (${updated.folio ?? "s/folio"})`
      );
    } catch {
      // nunca romper el flujo principal
    }
    revalidatePath("/lab/reception");
    revalidatePath(`/lab/results/${orderId}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { ok: true, data: { order: updated as any } };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 6) ADD ITEM — POST /api/v1/lab/orders/{id}/items
// ---------------------------------------------------------------------------
export async function addLabOrderItemAction(
  orderId: string,
  item: unknown
): Promise<ActionResult<{ item: Record<string, unknown> }>> {
  const guard = await _requireReception();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  try {
    const parsed = labOrderItemInputSchema.safeParse(item);
    if (!parsed.success) {
      return {
        ok: false,
        error: `Validación Zod: ${parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
        code: "VALIDATION",
      };
    }

    const order = await prisma.labOrder.findUnique({ where: { id: orderId } });
    if (!order) {
      return { ok: false, error: `LabOrder ${orderId} no existe`, code: "NOT_FOUND" };
    }
    if (order.status === "CANCELLED") {
      return { ok: false, error: "Orden cancelada", code: "CONFLICT" };
    }

    // IMPL-20260701-07: MedicalTest no tiene columna `price`; el precio
    // viaja en el body del item. Si llega 0, lo aceptamos.
    const basePrice = parsed.data.price ?? 0;
    const discountAmount = parsed.data.discountAmount ?? 0;
    const discountPct = parsed.data.discountPct ?? 0;
    const amount = Math.max(
      0,
      Number((basePrice - discountAmount - (basePrice * discountPct) / 100).toFixed(2))
    );

    const created = await prisma.labOrderItem.create({
      data: {
        labOrderId: orderId,
        medicalTestId: parsed.data.medicalTestId,
        price: basePrice,
        discountAmount,
        discountPct,
        amount,
        resultStatus: "P",
      },
    });
    revalidatePath("/lab/reception");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { ok: true, data: { item: created as any } };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 7) REMOVE ITEM — DELETE /api/v1/lab/orders/{id}/items/{itemId}
// ---------------------------------------------------------------------------
export async function removeLabOrderItemAction(
  orderId: string,
  itemId: string
): Promise<ActionResult<{ ok: boolean }>> {
  const guard = await _requireReception();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  try {
    const item = await prisma.labOrderItem.findUnique({
      where: { id: itemId },
      select: { labOrderId: true },
    });
    if (!item) {
      return { ok: false, error: `LabOrderItem ${itemId} no existe`, code: "NOT_FOUND" };
    }
    if (item.labOrderId !== orderId) {
      return { ok: false, error: "El item no pertenece a esta orden", code: "CONFLICT" };
    }

    await prisma.labOrderItem.delete({ where: { id: itemId } });
    revalidatePath("/lab/reception");
    return { ok: true, data: { ok: true } };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 8) LIST — GET /api/v1/lab/orders (DataTables)
// ---------------------------------------------------------------------------
export async function listLabOrdersAction(
  filters: {
    draw: number;
    start: number;
    length: number;
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<
  ActionResult<{
    draw: number;
    recordsTotal: number;
    recordsFiltered: number;
    data: Record<string, unknown>[];
  }>
> {
  const guard = await _requireReception();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  try {
    const draw = filters.draw ?? 1;
    const start = filters.start ?? 0;
    const length = filters.length ?? 25;
    const searchValue = filters.search ?? "";
    const status = filters.status ?? "";
    const dateFrom = filters.dateFrom ?? "";
    const dateTo = filters.dateTo ?? "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }
    if (searchValue.trim()) {
      where.OR = [
        { folio: { equals: isNaN(Number(searchValue)) ? -1 : Number(searchValue) } },
        { doctorName: { contains: searchValue, mode: "insensitive" } },
        { novaFolio: { contains: searchValue, mode: "insensitive" } },
      ];
    }

    const [recordsTotal, recordsFiltered, data] = await Promise.all([
      prisma.labOrder.count(),
      prisma.labOrder.count({ where }),
      prisma.labOrder.findMany({
        where,
        skip: start,
        take: length,
        orderBy: { createdAt: "desc" },
        include: {
          worker: { select: { firstName: true, lastName: true, universalId: true } },
          company: { select: { name: true } },
          _count: { select: { items: true } },
        },
      }),
    ]);

    return {
      ok: true,
      data: {
        draw,
        recordsTotal,
        recordsFiltered,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: data as any[],
      },
    };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 9-12) SEARCH — autocomplete admisión
// ---------------------------------------------------------------------------
export async function searchWorkersAction(q: string): Promise<WorkerSearchResult[]> {
  const guard = await _requireReception();
  if (!guard) return [];
  try {
    const trimmed = q.trim();
    const where = trimmed
      ? {
          OR: [
            { firstName: { contains: trimmed, mode: "insensitive" as const } },
            { lastName: { contains: trimmed, mode: "insensitive" as const } },
            { universalId: { contains: trimmed, mode: "insensitive" as const } },
          ],
        }
      : {};
    const list = await prisma.worker.findMany({
      where,
      take: 25,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: { company: { select: { name: true } } },
    });
    const today = new Date();
    return list.map((w) => {
      const age =
        w.dob
          ? Math.floor(
              (today.getTime() - new Date(w.dob).getTime()) /
                (365.25 * 24 * 60 * 60 * 1000)
            )
          : null;
      return {
        id: w.id,
        fullName: `${w.firstName} ${w.lastName}`.trim(),
        code: w.universalId,
        age,
        companyName: w.company?.name ?? null,
      };
    });
  } catch {
    return [];
  }
}

export async function searchDoctorsAction(q: string): Promise<DoctorSearchResult[]> {
  const guard = await _requireReception();
  if (!guard) return [];
  try {
    const trimmed = q.trim();
    const where = trimmed
      ? {
          AND: [
            { labRole: { not: null } },
            { fullName: { contains: trimmed, mode: "insensitive" as const } },
          ],
        }
      : { labRole: { not: null } };
    const list = await prisma.user.findMany({
      where,
      take: 25,
      orderBy: { fullName: "asc" },
      select: { fullName: true, novaMedicoClave: true },
    });
    return list.map((u) => ({
      name: u.fullName,
      clave: u.novaMedicoClave ?? null,
    }));
  } catch {
    return [];
  }
}

export async function searchCompaniesAction(q: string): Promise<CompanySearchResult[]> {
  const guard = await _requireReception();
  if (!guard) return [];
  try {
    const trimmed = q.trim();
    const where = trimmed
      ? {
          OR: [
            { name: { contains: trimmed, mode: "insensitive" as const } },
            { rfc: { contains: trimmed, mode: "insensitive" as const } },
          ],
        }
      : {};
    const list = await prisma.company.findMany({
      where,
      take: 25,
      orderBy: { name: "asc" },
      select: { id: true, name: true, rfc: true },
    });
    return list.map((c) => ({
      id: c.id,
      name: c.name,
      rfc: c.rfc ?? null,
    }));
  } catch {
    return [];
  }
}

export async function searchLabTestsAction(q: string): Promise<LabTestSearchResult[]> {
  const guard = await _requireReception();
  if (!guard) return [];
  try {
    const trimmed = q.trim();
    const where = trimmed
      ? {
          OR: [
            { code: { contains: trimmed, mode: "insensitive" as const } },
            { name: { contains: trimmed, mode: "insensitive" as const } },
          ],
        }
      : {};
    // IMPL-20260701-07: MedicalTest no tiene columna `price`; extraemos
    // desde `options` (Json) si existe `price`/`basePrice`, si no 0.
    const list = await prisma.medicalTest.findMany({
      where,
      take: 25,
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, options: true },
    });
    return list.map((t) => {
      const opts = (t.options ?? {}) as Record<string, unknown>;
      const rawPrice =
        typeof opts.price === "number"
          ? opts.price
          : typeof opts.basePrice === "number"
            ? opts.basePrice
            : 0;
      return {
        id: t.id,
        code: t.code,
        alternateCode:
          typeof opts.alternateCode === "string"
            ? opts.alternateCode
            : typeof opts.alternate_code === "string"
              ? opts.alternate_code
              : null,
        name: t.name,
        price: Number(rawPrice) || 0,
      };
    });
  } catch {
    return [];
  }
}