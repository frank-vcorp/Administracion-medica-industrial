/**
 * @file Server Actions para los 8 mods de catálogos LIS.
 * @id IMPL-20260630-06 — Slice A NOVA absorción (ARCH-20260630-02).
 * @backup context/SPECs/SPEC_ARCH-20260630-02-DEMO-NOVA-ABSORBIDO.md
 *
 * Todas las actions validan server-side con Zod (incluso aunque el cliente
 * ya valide) y restringen por rol ADMIN. Reusan `BACKEND_URL` según el
 * patrón de project-reports.actions.ts.
 */
"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import {
  LAB_CATALOG_MODS,
  LAB_SCHEMA_BY_MOD,
  type DataTablesResponse,
  type LabCatalogMod,
  isValidLabMod,
} from "@/lib/validations/lab-catalog";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

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

async function _backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = new URL(path, BACKEND_URL);
  return fetch(url.toString(), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-AMI-UserId": (await _requireAdmin())?.userId ?? "",
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
    const url = new URL("/api/v1/lab/catalogs", BACKEND_URL);
    url.searchParams.set("mod", modCheck.mod);
    url.searchParams.set("draw", String(params.draw ?? 1));
    url.searchParams.set("start", String(params.start ?? 0));
    url.searchParams.set("length", String(params.length ?? 25));
    if (params.search) url.searchParams.set("search[value]", params.search);
    url.searchParams.set("onlyActive", String(params.onlyActive ?? false));
    url.searchParams.set("order[0][column]", String(params.orderColumn ?? 0));
    url.searchParams.set("order[0][dir]", params.orderDir ?? "asc");

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-AMI-UserId": guard.userId,
      },
      cache: "no-store",
    });
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
    const url = new URL("/api/v1/lab/catalogs", BACKEND_URL);
    url.searchParams.set("mod", modCheck.mod);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AMI-UserId": guard.userId,
      },
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

    const url = new URL(`/api/v1/lab/catalogs/${modCheck.mod}/${params.id}`, BACKEND_URL);
    const res = await fetch(url.toString(), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-AMI-UserId": guard.userId,
      },
      body: JSON.stringify(parsed.data),
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
    const url = new URL(`/api/v1/lab/catalogs/${modCheck.mod}/${params.id}`, BACKEND_URL);
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: {
        "X-AMI-UserId": guard.userId,
      },
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