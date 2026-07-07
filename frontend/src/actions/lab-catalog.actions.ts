/**
 * @file Server Actions para los 8 mods de catálogos LIS.
 * @id IMPL-20260630-06 — Slice A NOVA absorción (ARCH-20260630-02).
 * @backup context/SPECs/SPEC_ARCH-20260630-02-DEMO-NOVA-ABSORBIDO.md
 *
 * HOTFIX IMPL-20260701-07: bypass de FastAPI (bug Prisma JS→Python).
 * Las actions ahora llaman a las Next.js API routes internas en
 * `/api/lab/catalogs/[mod]` que usan Prisma JS directo. BACKEND_URL se
 * conserva para referencia pero ya no se usa.
 *
 * HOTFIX IMPL-20260706-10: reenviar cookies del request actual en
 * `_localFetch`. Sin esto, las API routes validaban sesión con
 * `getServerSession()` y devolvían 401 (que Vercel convertía en HTML
 * de redirect a login) en lugar de los datos.
 *
 * Todas las actions validan server-side con Zod (incluso aunque el cliente
 * ya valide) y restringen por rol ADMIN.
 */
"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import {
  LAB_CATALOG_MODS,
  LAB_SCHEMA_BY_MOD,
  type DataTablesResponse,
  type LabCatalogMod,
  isValidLabMod,
} from "@/lib/validations/lab-catalog";

// BACKEND_URL conservado por compatibilidad/rollback, ya no se usa.
// IMPL-20260701-07: usamos Next.js API routes locales.
const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

/**
 * Base URL absoluta para fetch server-side a las API routes locales.
 * Resuelve el host según el entorno (Vercel → NEXT_PUBLIC_VERCEL_URL,
 * local → localhost:3000). Si NEXT_PUBLIC_APP_URL está definida se respeta.
 */
function _localBase(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return process.env.NEXT_PUBLIC_VERCEL_URL.startsWith("http")
      ? process.env.NEXT_PUBLIC_VERCEL_URL
      : `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

async function _requireAdmin(): Promise<{ id: string; userId: string } | null> {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const id = session?.user?.id;
  if (!session?.user || !id) return null;
  if (role !== "ADMIN") return null;
  return { id, userId: id };
}

async function _localFetch(path: string, init: RequestInit = {}): Promise<Response> {
  // IMPL-20260701-07: Next.js API routes locales.
  // IMPL-20260706-10: reenviar cookies del request actual para que las
  // API routes puedan validar sesión con getServerSession(). Sin esto,
  // la API retornaba 401 (que Vercel convierte en HTML de redirect a
  // login) en lugar de los datos esperados.
  const base = _localBase();
  const url = path.startsWith("http") ? path : `${base}${path}`;

  // Next.js 15+: cookies() retorna Promise.
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
}

function _validateMod(mod: string): { ok: true; mod: LabCatalogMod } | { ok: false; error: string } {
  if (!isValidLabMod(mod)) {
    return { ok: false, error: `mod inválido: ${mod}. Permitidos: ${LAB_CATALOG_MODS.join(", ")}` };
  }
  return { ok: true, mod: mod as LabCatalogMod };
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
    // IMPL-20260701-07: ruta Next.js API local.
    const path = `/api/lab/catalogs/${modCheck.mod}`;
    const qs = new URLSearchParams();
    qs.set("draw", String(params.draw ?? 1));
    qs.set("start", String(params.start ?? 0));
    qs.set("length", String(params.length ?? 25));
    if (params.search) qs.set("search[value]", params.search);
    qs.set("onlyActive", String(params.onlyActive ?? false));
    qs.set("order[0][column]", String(params.orderColumn ?? 0));
    qs.set("order[0][dir]", params.orderDir ?? "asc");

    const res = await _localFetch(`${path}?${qs.toString()}`, { method: "GET" });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Backend ${res.status}: ${detail || res.statusText}` };
    }
    const data = (await res.json()) as DataTablesResponse;
    return { ok: true, data };
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
    // IMPL-20260701-07: ruta Next.js API local.
    const path = `/api/lab/catalogs/${modCheck.mod}`;
    const res = await _localFetch(path, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Backend ${res.status}: ${detail || res.statusText}` };
    }
    const body = (await res.json()) as { id: string; item: Record<string, unknown>; ok: boolean };
    revalidatePath("/admin/lab/catalogs");
    return { ok: true, data: { id: body.id, item: body.item } };
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
    const parsed = partialSchema.safeParse(params.values);
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

    // IMPL-20260701-07: ruta Next.js API local.
    // El id viene como query o body; este route PATCH recibe id en body.
    const path = `/api/lab/catalogs/${modCheck.mod}`;
    const res = await _localFetch(path, {
      method: "PATCH",
      body: JSON.stringify({
        id: params.id,
        ...(parsed.data as Record<string, unknown>),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Backend ${res.status}: ${detail || res.statusText}` };
    }
    const body = (await res.json()) as { item: Record<string, unknown>; ok: boolean };
    revalidatePath("/admin/lab/catalogs");
    return { ok: true, data: { item: body.item } };
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
    // IMPL-20260701-07: ruta Next.js API local (id en body).
    const path = `/api/lab/catalogs/${modCheck.mod}`;
    const res = await _localFetch(path, {
      method: "DELETE",
      body: JSON.stringify({ id: params.id }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Backend ${res.status}: ${detail || res.statusText}` };
    }
    const body = (await res.json()) as { item: Record<string, unknown>; ok: boolean };
    revalidatePath("/admin/lab/catalogs");
    return { ok: true, data: { item: body.item } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}