/**
 * @file /api/lab/orders/[id]/items/[itemId] — DELETE item.
 * @id IMPL-20260701-07 — Bypass FastAPI.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const userId = session?.user?.id;
  if (!session?.user || !userId || role !== "ADMIN") {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id: orderId, itemId } = await params;
  try {
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
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
