/**
 * @file API routes para los 8 catálogos LIS (Slice A NOVA absorción).
 * @id IMPL-20260701-07 — Bypass FastAPI por bug Prisma JS→Python naming.
 * @backup context/SPECs/SPEC_ARCH-20260630-02-DEMO-NOVA-ABSORBIDO.md
 *
 * Hotfix: el backend FastAPI retorna 500 porque los routers usan
 * `prisma.labUnit.find_*()` (camelCase JS) pero Prisma Python espera
 * snake_case. Bypass: Next.js API routes usan Prisma JS directo.
 *
 * Cuatro métodos en este único archivo:
 *   GET    /api/lab/catalogs/[mod]   → list paginado DataTables
 *   POST   /api/lab/catalogs/[mod]   → create
 *   PATCH  /api/lab/catalogs/[mod]   → update por id en body
 *   DELETE /api/lab/catalogs/[mod]   → soft delete (active=false) por id en body
 *
 * Autenticación: requiere sesión ADMIN (mismo gate que los server actions).
 *
 * IMPORTANTE: usa `lib/prisma.ts` (cliente Prisma JS ya configurado para
 * User, Worker, Company, etc.). NUNCA importar nada del backend FastAPI.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { authOptions } from "@/auth";
import prisma from "@/lib/prisma";
import {
  LAB_CATALOG_MODS,
  LAB_SCHEMA_BY_MOD,
  type LabCatalogMod,
  isValidLabMod,
} from "@/lib/validations/lab-catalog";

// ---------------------------------------------------------------------------
// Mapa: mod (URL) → nombre del modelo Prisma JS
// ---------------------------------------------------------------------------
const MOD_TO_MODEL: Record<LabCatalogMod, string> = {
  unidades: "labUnit",
  muestras: "labSample",
  recipientes: "labContainer",
  metodologias: "labMethod",
  lugares_proceso: "labProcessArea",
  clasificaciones: "labClassification",
  indicaciones: "labIndication",
  departamentos: "labDepartment",
};

// Forzar runtime Node (Prisma no funciona en Edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Gate de auth: solo ADMIN puede tocar catálogos. */
async function _requireAdmin(): Promise<{ userId: string } | null> {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const id = session?.user?.id;
  if (!session?.user || !id) return null;
  if (role !== "ADMIN") return null;
  return { userId: id };
}

function _pickModel(mod: LabCatalogMod): string {
  return MOD_TO_MODEL[mod];
}

/** Acceso dinámico al modelo Prisma (TS no lo expone). */
function _modelFor(modelName: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any)[modelName];
}

// ---------------------------------------------------------------------------
// GET — list paginado server-side (DataTables-compatible)
// ---------------------------------------------------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ mod: string }> }
) {
  const guard = await _requireAdmin();
  if (!guard) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { mod: rawMod } = await params;
  if (!isValidLabMod(rawMod)) {
    return NextResponse.json(
      {
        error: `mod inválido: ${rawMod}. Permitidos: ${LAB_CATALOG_MODS.join(", ")}`,
      },
      { status: 400 }
    );
  }
  const mod = rawMod as LabCatalogMod;

  const url = new URL(req.url);
  const draw = parseInt(url.searchParams.get("draw") || "1", 10);
  const start = parseInt(url.searchParams.get("start") || "0", 10);
  const length = parseInt(url.searchParams.get("length") || "25", 10);
  const searchValue =
    url.searchParams.get("search[value]") ||
    url.searchParams.get("search") ||
    "";
  const orderCol = parseInt(
    url.searchParams.get("order[0][column]") || "0",
    10
  );
  const orderDir =
    (url.searchParams.get("order[0][dir]") || "asc").toLowerCase() === "desc"
      ? "desc"
      : "asc";
  const onlyActive =
    (url.searchParams.get("onlyActive") || "false").toLowerCase() === "true";

  const modelName = _pickModel(mod);
  const model = _modelFor(modelName);
  if (!model) {
    return NextResponse.json(
      { error: `Modelo ${modelName} no disponible` },
      { status: 500 }
    );
  }

  try {
    // Search + onlyActive where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (searchValue.trim()) {
      // Búsqueda case-insensitive por code + name (o text para indicaciones)
      const textField = mod === "indicaciones" ? "text" : "name";
      where.OR = [
        { code: { contains: searchValue, mode: "insensitive" } },
        { [textField]: { contains: searchValue, mode: "insensitive" } },
      ];
    }
    if (onlyActive) {
      where.active = true;
    }

    // Orden: en este slice simple usamos symbol/code/name según columna
    const orderByCol = ["symbol", "code", "name"][orderCol] || "code";

    const [recordsTotal, recordsFiltered, data] = await Promise.all([
      model.count(),
      model.count({ where }),
      model.findMany({
        where,
        skip: start,
        take: length,
        orderBy: { [orderByCol]: orderDir },
      }),
    ]);

    return NextResponse.json({
      draw,
      recordsTotal,
      recordsFiltered,
      data: data as unknown[],
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — create
// ---------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ mod: string }> }
) {
  const guard = await _requireAdmin();
  if (!guard) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { mod: rawMod } = await params;
  if (!isValidLabMod(rawMod)) {
    return NextResponse.json(
      { error: `mod inválido: ${rawMod}` },
      { status: 400 }
    );
  }
  const mod = rawMod as LabCatalogMod;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const schema: z.ZodTypeAny = LAB_SCHEMA_BY_MOD[mod];
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "VALIDATION",
        details: parsed.error.format(),
      },
      { status: 400 }
    );
  }

  const modelName = _pickModel(mod);
  const model = _modelFor(modelName);
  if (!model) {
    return NextResponse.json(
      { error: `Modelo ${modelName} no disponible` },
      { status: 500 }
    );
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created = await model.create({
      data: {
        ...(parsed.data as Record<string, unknown>),
        createdById: guard.userId,
      },
    });
    return NextResponse.json(
      { id: (created as { id: string }).id, item: created },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH — update por id (en body: { id, ...values })
// ---------------------------------------------------------------------------
const patchBodySchema = z.object({ id: z.string().min(1) }).passthrough();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ mod: string }> }
) {
  const guard = await _requireAdmin();
  if (!guard) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { mod: rawMod } = await params;
  if (!isValidLabMod(rawMod)) {
    return NextResponse.json(
      { error: `mod inválido: ${rawMod}` },
      { status: 400 }
    );
  }
  const mod = rawMod as LabCatalogMod;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const id = body.id as string | undefined;
  if (!id) {
    return NextResponse.json({ error: "id obligatorio" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _idParsed = patchBodySchema.safeParse(body);
  if (!_idParsed.success) {
    return NextResponse.json({ error: "id obligatorio" }, { status: 400 });
  }

  const schema: z.ZodTypeAny = LAB_SCHEMA_BY_MOD[mod];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const partialSchema =
    typeof (schema as any).partial === "function"
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (schema as any).partial()
      : schema;
  const parsed = partialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const modelName = _pickModel(mod);
  const model = _modelFor(modelName);
  if (!model) {
    return NextResponse.json(
      { error: `Modelo ${modelName} no disponible` },
      { status: 500 }
    );
  }

  try {
    const updated = await model.update({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: parsed.data as any,
    });
    return NextResponse.json({ item: updated });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — soft delete (active=false) por id en body
// ---------------------------------------------------------------------------
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ mod: string }> }
) {
  const guard = await _requireAdmin();
  if (!guard) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { mod: rawMod } = await params;
  if (!isValidLabMod(rawMod)) {
    return NextResponse.json(
      { error: `mod inválido: ${rawMod}` },
      { status: 400 }
    );
  }
  const mod = rawMod as LabCatalogMod;

  let body: { id?: string };
  try {
    body = (await req.json()) as { id?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: "id obligatorio" }, { status: 400 });
  }

  const modelName = _pickModel(mod);
  const model = _modelFor(modelName);
  if (!model) {
    return NextResponse.json(
      { error: `Modelo ${modelName} no disponible` },
      { status: 500 }
    );
  }

  try {
    const updated = await model.update({
      where: { id: body.id },
      data: { active: false },
    });
    return NextResponse.json({ item: updated });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
