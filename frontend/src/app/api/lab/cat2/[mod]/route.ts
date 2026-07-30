/**
 * API route v2 — creada con path distinto (cat2 en vez de catalogs) para
 * forzar a Vercel a re-bundle. IMPL-20260707-14.
 *
 * El server action `listLabCatalogActionV2` debería apuntar a este path.
 * Si Vercel no rebuildea la API route vieja, esta es la alternativa.
 */
import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/api-handler";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { isAdminLike } from "@/lib/auth/roles";

const MOD_TO_MODEL: Record<string, string> = {
  unidades: "labUnit",
  muestras: "labSample",
  recipientes: "labContainer",
  metodologias: "labMethod",
  lugares_proceso: "labProcessArea",
  clasificaciones: "labClassification",
  indicaciones: "labIndication",
  departamentos: "labDepartment",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function _requireAdmin() {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user && isAdminLike(session.user.role)) return session.user;
    return null;
  } catch {
    return null;
  }
}

export const GET = withApiErrors(
  "GET /api/lab/cat2/[mod]",
  async (req: NextRequest, { params }: { params: Promise<{ mod: string }> }) => {
    const guard = await _requireAdmin();
    if (!guard) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const { mod } = await params;
    const modelName = MOD_TO_MODEL[mod];
    if (!modelName) return NextResponse.json({ error: "mod inválido" }, { status: 400 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = (prisma as any)[modelName];
    if (!model) return NextResponse.json({ error: "modelo no disponible" }, { status: 500 });
    const url = new URL(req.url);
    const start = parseInt(url.searchParams.get("start") || "0", 10);
    const length = parseInt(url.searchParams.get("length") || "25", 10);
    const [total, data] = await Promise.all([
      model.count(),
      model.findMany({ skip: start, take: length, order: { createdAt: "desc" } }),
    ]);
    return NextResponse.json({ draw: 1, recordsTotal: total, recordsFiltered: total, data });
  }
);
