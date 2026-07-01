/**
 * @file /api/lab/orders/[id]/confirm — DRAFT → SAVED.
 * @id IMPL-20260701-07 — Bypass FastAPI.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const userId = session?.user?.id;
  if (!session?.user || !userId || role !== "ADMIN") {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const existing = await prisma.labOrder.findUnique({
      where: { id },
      include: { _count: { select: { items: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: `Solo se confirman órdenes en DRAFT (actual: ${existing.status})` },
        { status: 409 }
      );
    }
    if (existing._count.items === 0) {
      return NextResponse.json(
        { error: "La orden no tiene estudios" },
        { status: 422 }
      );
    }

    const updated = await prisma.labOrder.update({
      where: { id },
      data: { status: "SAVED", confirmedAt: new Date() },
      include: { items: true },
    });
    return NextResponse.json({ order: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
