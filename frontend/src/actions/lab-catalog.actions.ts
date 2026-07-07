/**
 * @file Server Actions para los 8 mods de catálogos LIS.
 * @id IMPL-20260630-06 — Slice A NOVA absorción (ARCH-20260630-02).
 * @backup context/SPECs/SPEC_ARCH-20260630-02-DEMO-NOVA-ABSORBIDO.md
 *
 * HOTFIX IMPL-20260706-11: server actions usan Prisma directo.
 *
 * Histórico de hotfixes anteriores (descartados):
 * - IMPL-20260701-07: bypass FastAPI (bug Prisma JS→Python).
 * - IMPL-20260706-10: reenviar cookies en _localFetch.
 *
 * Ambos quedaron descartados porque Next.js server actions haciendo
 * fetch a rutas del mismo server tienen problemas conocidos de
 * enrutamiento (Vercel responde con HTML 404/login redirect, lo que
 * generaba el error "Unexpected token '<'" en el cliente).
 *
 * Solución definitiva (este hotfix): el server action importa Prisma
 * directamente y hace la query, igual que la API route. La API route
 * se conserva intacta para uso de clientes externos en el futuro.
 *
 * Todas las actions validan server-side con Zod (incluso aunque el
 * cliente ya valide) y restringen por rol ADMIN.
 */
"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import prisma from "@/lib/prisma";
import {
  LAB_CATALOG_MODS,
  LAB_SCHEMA_BY_MOD,
  type DataTablesResponse,
  type LabCatalogMod,
  isValidLabMod,
} from "@/lib/validations/lab-catalog";

// ---------------------------------------------------------------------------
// Mapa: mod (URL) → nombre del modelo Prisma JS
// (Réplica del API route; mantener sincronizado.)
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

async function _requireAdmin(): Promise<{ id: string; userId: string } | null> {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    const id = session?.user?.id;
    if (!session?.user || !id) return null;
    if (role !== "ADMIN") return null;
    return { id, userId: id };
  } catch (err) {
    // IMPL-20260706-11: si NextAuth falla (ej. NEXTAUTH_SECRET faltante),
    // no queremos 500 HTML — retornamos null para que la action devuelva
    // UNAUTHORIZED con JSON parseable por el cliente.
    // eslint-disable-next-line no-console
    console.error("[_requireAdmin] session error:", err);
    return null;
  }
}

function _validateMod(mod: string): { ok: true; mod: LabCatalogMod } | { ok: false; error: string } {
  if (!isValidLabMod(mod)) {
    return { ok: false, error: `mod inválido: ${mod}. Permitidos: ${LAB_CATALOG_MODS.join(", ")}` };
  }
  return { ok: true, mod: mod as LabCatalogMod };
}

// Acceso dinámico al modelo Prisma.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function _modelFor(modelName: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any)[modelName];
}

// ---------------------------------------------------------------------------
// LISTAR — paginado server-side DataTables-compatible
// ---------------------------------------------------------------------------
export async function listLabCatalogAction(params: {
  mod: string;
  draw?: number;
  start?: number;
  length?: number;
  search?: string;
  onlyActive?: boolean;
  orderColumn?: number;
  orderDir?: "asc" | "desc";
}): Promise<ActionResult<DataTablesResponse>> {
  const guard = await _requireAdmin();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  const modCheck = _validateMod(params.mod);
  if (!modCheck.ok) return { ok: false, error: modCheck.error };

  try {
    const draw = params.draw ?? 1;
    const start = params.start ?? 0;
    const length = params.length ?? 25;
    const searchValue = params.search ?? "";
    const orderCol = params.orderColumn ?? 0;
    const orderDir = (params.orderDir ?? "asc").toLowerCase() === "desc" ? "desc" : "asc";
    const onlyActive = params.onlyActive ?? false;

    const modelName = MOD_TO_MODEL[modCheck.mod];
    const model = _modelFor(modelName);
    if (!model) {
      return { ok: false, error: `Modelo ${modelName} no disponible` };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (searchValue.trim()) {
      // Búsqueda case-insensitive por code + name (o text para indicaciones)
      const textField = modCheck.mod === "indicaciones" ? "text" : "name";
      where.OR = [
        { code: { contains: searchValue, mode: "insensitive" } },
        { [textField]: { contains: searchValue, mode: "insensitive" } },
      ];
    }
    if (onlyActive) {
      where.active = true;
    }

    // Orden: symbol/code/name según columna (mismo criterio que API route)
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
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}

// ---------------------------------------------------------------------------
// CREAR
// ---------------------------------------------------------------------------
export async function createLabCatalogAction(params: {
  mod: string;
  values: Record<string, unknown>;
}): Promise<ActionResult<{ id: string; item: Record<string, unknown> }>> {
  const guard = await _requireAdmin();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  const modCheck = _validateMod(params.mod);
  if (!modCheck.ok) return { ok: false, error: modCheck.error };

  const schema = LAB_SCHEMA_BY_MOD[modCheck.mod];
  const parsed = schema.safeParse(params.values);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Validación Zod: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      code: "VALIDATION",
    };
  }

  try {
    const modelName = MOD_TO_MODEL[modCheck.mod];
    const model = _modelFor(modelName);
    if (!model) {
      return { ok: false, error: `Modelo ${modelName} no disponible` };
    }

    const created = await model.create({
      data: {
        ...(parsed.data as Record<string, unknown>),
        createdById: guard.userId,
      },
    });

    revalidatePath("/admin/lab/catalogs");
    return {
      ok: true,
      data: {
        id: (created as { id: string }).id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        item: created as Record<string, unknown>,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}

// ---------------------------------------------------------------------------
// EDITAR (PATCH parcial)
// ---------------------------------------------------------------------------
export async function updateLabCatalogAction(params: {
  mod: string;
  id: string;
  values: Record<string, unknown>;
}): Promise<ActionResult<{ item: Record<string, unknown> }>> {
  const guard = await _requireAdmin();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  const modCheck = _validateMod(params.mod);
  if (!modCheck.ok) return { ok: false, error: modCheck.error };

  // Para PATCH permitimos campos parciales; validamos lo que venga.
  try {
    const schema = LAB_SCHEMA_BY_MOD[modCheck.mod];
    // partial(): cualquier subcampo es opcional para update.
    // En Zod 4 z.ZodTypeAny no expone .partial(); los schemas en LAB_SCHEMA_BY_MOD
    // son z.ZodObject en runtime, así que casteamos de forma controlada.
    const partialSchema =
      typeof (schema as { partial?: () => unknown }).partial === "function"
        ? (schema as unknown as { partial: () => typeof schema }).partial()
        : schema;
    // El id viene junto con los values en el body del cliente.
    const bodyForParse = { id: params.id, ...params.values };
    const parsed = partialSchema.safeParse(bodyForParse);
    if (!parsed.success) {
      return {
        ok: false,
        error: `Validación Zod: ${parsed.error.issues
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((i: any) => `${(i.path as Array<string | number>).join(".")}: ${i.message as string}`)
          .join("; ")}`,
        code: "VALIDATION",
      };
    }

    const modelName = MOD_TO_MODEL[modCheck.mod];
    const model = _modelFor(modelName);
    if (!model) {
      return { ok: false, error: `Modelo ${modelName} no disponible` };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataForUpdate: any = { ...(parsed.data as Record<string, unknown>) };
    delete dataForUpdate.id; // el id va en where

    const updated = await model.update({
      where: { id: params.id },
      data: dataForUpdate,
    });

    revalidatePath("/admin/lab/catalogs");
    return {
      ok: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { item: updated as Record<string, unknown> },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}

// ---------------------------------------------------------------------------
// ELIMINAR (soft delete)
// ---------------------------------------------------------------------------
export async function deleteLabCatalogAction(params: {
  mod: string;
  id: string;
}): Promise<ActionResult<{ item: Record<string, unknown> }>> {
  const guard = await _requireAdmin();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  const modCheck = _validateMod(params.mod);
  if (!modCheck.ok) return { ok: false, error: modCheck.error };

  try {
    const modelName = MOD_TO_MODEL[modCheck.mod];
    const model = _modelFor(modelName);
    if (!model) {
      return { ok: false, error: `Modelo ${modelName} no disponible` };
    }

    const updated = await model.update({
      where: { id: params.id },
      data: { active: false },
    });

    revalidatePath("/admin/lab/catalogs");
    return {
      ok: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { item: updated as Record<string, unknown> },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}