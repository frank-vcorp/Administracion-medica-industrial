/**
 * @file /api/lab/orders/[id] — GET (full order) + PATCH (update) + DELETE (cancel).
 * @id IMPL-20260701-07 — Bypass FastAPI.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/auth";
import prisma from "@/lib/prisma";
import {
  updateLabOrderSchema,
  cancelLabOrderSchema,
} from "@/lib/validations/lab-order";

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

// ---------------------------------------------------------------------------
// GET — full order con items
// ---------------------------------------------------------------------------
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await _requireReception();
  if (!guard) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const order = await prisma.labOrder.findUnique({
      where: { id },
      include: {
        items: { include: { medicalTest: true } },
        worker: true,
        company: true,
        classification: true,
      },
    });
    if (!order) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json(order);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH — update (mismas reglas que updateLabOrderSchema)
// ---------------------------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await _requireReception();
  if (!guard) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = updateLabOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", details: parsed.error.format() },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.labOrder.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (existing.status === "CANCELLED") {
      return NextResponse.json(
        { error: "No se puede modificar una orden cancelada" },
        { status: 409 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = { ...parsed.data };
    if (data.deliveryDate) {
      data.deliveryDate = new Date(data.deliveryDate);
    }
    // No se actualizan items por aquí — se gestiona via /items endpoints.
    delete data.items;

    const updated = await prisma.labOrder.update({
      where: { id },
      data,
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

// ---------------------------------------------------------------------------
// DELETE — soft cancel (?motivo=…)
// ---------------------------------------------------------------------------
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await _requireReception();
  if (!guard) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;

  const url = new URL(req.url);
  const motivo = url.searchParams.get("motivo") || "";
  const parsed = cancelLabOrderSchema.safeParse({ motivo });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Motivo inválido (min 3 caracteres)" },
      { status: 400 }
    );
  }

  try {
    const cancelled = await prisma.labOrder.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledById: guard.userId,
        observations:
          (await prisma.labOrder.findUnique({ where: { id } }).then((o) => o?.observations ?? "")) +
          `\n[CANCELADO ${new Date().toISOString()}] ${parsed.data.motivo}`,
      },
    });
    return NextResponse.json({ order: cancelled });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
