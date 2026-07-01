/**
 * @file /api/lab/orders/[id]/items — POST add item.
 * @id IMPL-20260701-07 — Bypass FastAPI.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/auth";
import prisma from "@/lib/prisma";
import { labOrderItemInputSchema } from "@/lib/validations/lab-order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function _requireReception(): Promise<{ userId: string } | null> {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const userId = session?.user?.id;
  if (!session?.user || !userId) return null;
  if (role !== "ADMIN") return null;
  return { userId };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await _requireReception();
  if (!guard) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id: orderId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = labOrderItemInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", details: parsed.error.format() },
      { status: 400 }
    );
  }

  try {
    const order = await prisma.labOrder.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (order.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Orden cancelada" },
        { status: 409 }
      );
    }

    // IMPL-20260701-07: MedicalTest no tiene columna `price`; el precio
    // viaja en el body del item (lo llena el form). Si llega 0, lo aceptamos
    // y el usuario puede ajustarlo después desde la tabla de estudios.
    const basePrice = parsed.data.price ?? 0;
    const discountAmount = parsed.data.discountAmount ?? 0;
    const discountPct = parsed.data.discountPct ?? 0;
    const amount = Math.max(
      0,
      Number((basePrice - discountAmount - (basePrice * discountPct) / 100).toFixed(2))
    );

    const item = await prisma.labOrderItem.create({
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
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
