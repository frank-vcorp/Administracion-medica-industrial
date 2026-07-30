/**
 * @file /api/lab/orders/[id]/confirm — DRAFT → SAVED.
 * @id IMPL-20260701-07 — Bypass FastAPI.
 * IMPL-20260701-07 (hotfix): handler envuelto en `withApiErrors`.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/auth";
import prisma from "@/lib/prisma";
import { isAdminLike } from "@/lib/auth/roles";
import { withApiErrors } from "@/lib/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function _getAdminSession(): Promise<{ userId: string } | null> {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    const userId = session?.user?.id;
    if (!session?.user || !userId || !isAdminLike(role)) return null;
    return { userId };
  } catch (err) {
     
    console.error("[confirm] session error:", err);
    return null;
  }
}

export const POST = withApiErrors(
  "POST /api/lab/orders/[id]/confirm",
  async (
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const guard = await _getAdminSession();
    if (!guard) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id } = await params;
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
  }
);
