/**
 * @file /api/lab/orders/[id]/items/[itemId] — DELETE item.
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
     
    console.error("[items DELETE] session error:", err);
    return null;
  }
}

export const DELETE = withApiErrors(
  "DELETE /api/lab/orders/[id]/items/[itemId]",
  async (
    _req: NextRequest,
    { params }: { params: Promise<{ id: string; itemId: string }> }
  ) => {
    const guard = await _getAdminSession();
    if (!guard) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const { id: orderId, itemId } = await params;
    const item = await prisma.labOrderItem.findUnique({
      where: { id: itemId },
      select: { labOrderId: true },
    });
    if (!item) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (item.labOrderId !== orderId) {
      return NextResponse.json({ error: "MISMATCH" }, { status: 409 });
    }
    await prisma.labOrderItem.delete({ where: { id: itemId } });
    return NextResponse.json({ ok: true });
  }
);
