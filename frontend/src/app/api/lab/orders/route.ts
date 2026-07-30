/**
 * @file API route /api/lab/orders — list (DataTables) + create.
 * @id IMPL-20260701-07 — Bypass FastAPI por bug Prisma JS→Python.
 * @backup context/SPECs/SPEC_IMPL-20260701-SLICE-B-RECEPCION.md
 *
 * Sustituye `GET /api/v1/lab/orders` y `POST /api/v1/lab/orders` del backend.
 * Usa Prisma JS directo (`prisma.labOrder`, `prisma.labOrderItem`, etc. —
 * nombres camelCase EXACTOS del schema.prisma).
 *
 * Auth: ADMIN o LAB_RECEPTIONIST (gate igual que lab-order.actions.ts).
 *
 * IMPL-20260701-07 (hotfix): handlers envueltos en `withApiErrors` para
 * garantizar JSON en errores (auth, Prisma, etc.) en vez de HTML 500.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/auth";
import prisma from "@/lib/prisma";
import { isAdminLike } from "@/lib/auth/roles";
import { withApiErrors } from "@/lib/api-handler";
import {
  createLabOrderSchema,
} from "@/lib/validations/lab-order";
import { calculateTotals } from "@/lib/lab-order-totals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function _requireReception(): Promise<{ userId: string } | null> {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    const userId = session?.user?.id;
    if (!session?.user || !userId) return null;
    // ADM-20260701-01: solo ADMIN (LAB_RECEPTIONIST pendiente de incorporarse).
    if (!isAdminLike(role)) return null;
    return { userId };
  } catch (err) {
     
    console.error("[_requireReception] session error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// GET — list paginado
// ---------------------------------------------------------------------------
export const GET = withApiErrors(
  "GET /api/lab/orders",
  async (req: NextRequest) => {
    const guard = await _requireReception();
    if (!guard) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const url = new URL(req.url);
    const draw = parseInt(url.searchParams.get("draw") || "1", 10);
    const start = parseInt(url.searchParams.get("start") || "0", 10);
    const length = parseInt(url.searchParams.get("length") || "25", 10);
    const searchValue =
      url.searchParams.get("search[value]") ||
      url.searchParams.get("search") ||
      "";
    const status = url.searchParams.get("status") || "";
    const dateFrom = url.searchParams.get("dateFrom") || "";
    const dateTo = url.searchParams.get("dateTo") || "";

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
    return NextResponse.json({
      draw,
      recordsTotal,
      recordsFiltered,
      data,
    });
  }
);

// ---------------------------------------------------------------------------
// POST — create (DRAFT)
// ---------------------------------------------------------------------------
export const POST = withApiErrors(
  "POST /api/lab/orders",
  async (req: NextRequest) => {
    const guard = await _requireReception();
    if (!guard) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const parsed = createLabOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION",
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    // Calcular folio: max(folio) + 1 (atómico a nivel de transacción).
    const last = await prisma.labOrder.findFirst({
      orderBy: { folio: "desc" },
      select: { folio: true },
    });
    const nextFolio = (last?.folio ?? 0) + 1;

    // IMPL-20260701-07: MedicalTest no tiene columna `price` en el schema.
    // El precio viaja explícito en cada item (lo llena el form desde
    // searchLabTestsAction o el usuario lo edita manualmente en la tabla).
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

    return NextResponse.json(
      { id: created.id, order: created },
      { status: 201 }
    );
  }
);
