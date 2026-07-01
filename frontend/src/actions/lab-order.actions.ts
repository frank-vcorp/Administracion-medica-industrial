/**
 * @file Server Actions para LabOrder (Slice B NOVA absorción).
 * @id IMPL-20260701-03 — Slice B Recepción (ARCH-20260701-03).
 * @backup context/SPECs/SPEC_IMPL-20260701-SLICE-B-RECEPCION.md
 *
 * HOTFIX IMPL-20260701-07: bypass de FastAPI (bug Prisma JS→Python).
 * Las actions ahora llaman a las Next.js API routes internas en
 * `/api/lab/orders/...` que usan Prisma JS directo.
 *
 * Patrón: idéntico a lab-catalog.actions.ts.
 * - Validación Zod server-side
 * - Rol permitido: ADMIN (LAB_RECEPTIONIST pendiente)
 * - revalidatePath('/lab/reception') tras cada mutación
 */
"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import {
  cancelLabOrderSchema,
  createLabOrderSchema,
  updateLabOrderSchema,
  type CompanySearchResult,
  type DoctorSearchResult,
  type LabTestSearchResult,
  type WorkerSearchResult,
} from "@/lib/validations/lab-order";

// BACKEND_URL conservado por compatibilidad, ya no se usa.
// IMPL-20260701-07: usamos Next.js API routes locales.
const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

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
// Tipos de retorno y errores
// ---------------------------------------------------------------------------
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------
async function _requireReception(): Promise<{ userId: string; role: string } | null> {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const userId = session?.user?.id;
  if (!session?.user || !userId) return null;
  // ADM-20260701-01: roles permitidos LabOrder = ADMIN (LAB_RECEPTIONIST
  // pendiente de incorporarse al enum de roles de NextAuth).
  if (role !== "ADMIN") return null;
  return { userId, role: role as string };
}

async function _localFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const base = _localBase();
  const url = path.startsWith("http") ? path : `${base}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
}

function _err(error: unknown): ActionResult<never> {
  return {
    ok: false,
    error: error instanceof Error ? error.message : "Error desconocido",
  };
}

// ---------------------------------------------------------------------------
// 1) CREATE — POST /api/v1/lab/orders
// ---------------------------------------------------------------------------
export async function createLabOrderAction(
  input: unknown
): Promise<ActionResult<{ id: string; order: Record<string, unknown> }>> {
  const guard = await _requireReception();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  const parsed = createLabOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Validación Zod: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
      code: "VALIDATION",
    };
  }
  try {
    // IMPL-20260701-07: ruta Next.js API local.
    const res = await _localFetch("/api/lab/orders", {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Backend ${res.status}: ${detail || res.statusText}` };
    }
    const body = (await res.json()) as { id: string; order: Record<string, unknown> };
    revalidatePath("/lab/reception");
    return { ok: true, data: { id: body.id, order: body.order } };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 2) UPDATE — PATCH /api/v1/lab/orders/{id}
// ---------------------------------------------------------------------------
export async function updateLabOrderAction(
  orderId: string,
  input: unknown
): Promise<ActionResult<{ order: Record<string, unknown> }>> {
  const guard = await _requireReception();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  const parsed = updateLabOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Validación Zod: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
      code: "VALIDATION",
    };
  }
  try {
    // IMPL-20260701-07: ruta Next.js API local.
    const res = await _localFetch(`/api/lab/orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify(parsed.data),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Backend ${res.status}: ${detail || res.statusText}` };
    }
    const body = (await res.json()) as { order: Record<string, unknown> };
    revalidatePath("/lab/reception");
    return { ok: true, data: { order: body.order } };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 3) GET FULL — GET /api/v1/lab/orders/{id}
// ---------------------------------------------------------------------------
export async function getLabOrderAction(
  orderId: string
): Promise<ActionResult<{ order: Record<string, unknown> }>> {
  const guard = await _requireReception();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  try {
    // IMPL-20260701-07: ruta Next.js API local.
    const res = await _localFetch(`/api/lab/orders/${orderId}`, { method: "GET" });
    if (res.status === 404) {
      return { ok: false, error: `LabOrder ${orderId} no existe`, code: "NOT_FOUND" };
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Backend ${res.status}: ${detail || res.statusText}` };
    }
    const body = (await res.json()) as Record<string, unknown>;
    return { ok: true, data: { order: body } };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 4) CANCEL — DELETE /api/v1/lab/orders/{id}?motivo=
// ---------------------------------------------------------------------------
export async function cancelLabOrderAction(
  orderId: string,
  motivo: string
): Promise<ActionResult<{ order: Record<string, unknown> }>> {
  const guard = await _requireReception();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  const parsed = cancelLabOrderSchema.safeParse({ motivo });
  if (!parsed.success) {
    return { ok: false, error: "Motivo inválido (min 3 caracteres)", code: "VALIDATION" };
  }
  try {
    // IMPL-20260701-07: ruta Next.js API local (?motivo=… ).
    const qs = new URLSearchParams({ motivo: parsed.data.motivo });
    const res = await _localFetch(`/api/lab/orders/${orderId}?${qs.toString()}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Backend ${res.status}: ${detail || res.statusText}` };
    }
    const body = (await res.json()) as { order: Record<string, unknown> };
    revalidatePath("/lab/reception");
    return { ok: true, data: { order: body.order } };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 5) CONFIRM — POST /api/v1/lab/orders/{id}/confirm
// ---------------------------------------------------------------------------
export async function confirmLabOrderAction(
  orderId: string
): Promise<ActionResult<{ order: Record<string, unknown> }>> {
  const guard = await _requireReception();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  try {
    // IMPL-20260701-07: ruta Next.js API local.
    const res = await _localFetch(`/api/lab/orders/${orderId}/confirm`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Backend ${res.status}: ${detail || res.statusText}` };
    }
    const body = (await res.json()) as { order: Record<string, unknown> };
    revalidatePath("/lab/reception");
    return { ok: true, data: { order: body.order } };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 6) ADD ITEM — POST /api/v1/lab/orders/{id}/items
// ---------------------------------------------------------------------------
export async function addLabOrderItemAction(
  orderId: string,
  item: unknown
): Promise<ActionResult<{ item: Record<string, unknown> }>> {
  const guard = await _requireReception();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  try {
    // IMPL-20260701-07: ruta Next.js API local.
    const res = await _localFetch(`/api/lab/orders/${orderId}/items`, {
      method: "POST",
      body: JSON.stringify(item),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Backend ${res.status}: ${detail || res.statusText}` };
    }
    const body = (await res.json()) as { item: Record<string, unknown> };
    revalidatePath("/lab/reception");
    return { ok: true, data: { item: body.item } };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 7) REMOVE ITEM — DELETE /api/v1/lab/orders/{id}/items/{itemId}
// ---------------------------------------------------------------------------
export async function removeLabOrderItemAction(
  orderId: string,
  itemId: string
): Promise<ActionResult<{ ok: boolean }>> {
  const guard = await _requireReception();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  try {
    // IMPL-20260701-07: ruta Next.js API local.
    const res = await _localFetch(
      `/api/lab/orders/${orderId}/items/${itemId}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Backend ${res.status}: ${detail || res.statusText}` };
    }
    revalidatePath("/lab/reception");
    return { ok: true, data: { ok: true } };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 8) LIST — GET /api/v1/lab/orders (DataTables)
// ---------------------------------------------------------------------------
export async function listLabOrdersAction(
  filters: {
    draw: number;
    start: number;
    length: number;
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<
  ActionResult<{
    draw: number;
    recordsTotal: number;
    recordsFiltered: number;
    data: Record<string, unknown>[];
  }>
> {
  const guard = await _requireReception();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  try {
    // IMPL-20260701-07: ruta Next.js API local.
    const qs = new URLSearchParams();
    qs.set("draw", String(filters.draw ?? 1));
    qs.set("start", String(filters.start ?? 0));
    qs.set("length", String(filters.length ?? 25));
    if (filters.search) qs.set("search[value]", filters.search);
    if (filters.status) qs.set("status", filters.status);
    if (filters.dateFrom) qs.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) qs.set("dateTo", filters.dateTo);
    const res = await _localFetch(`/api/lab/orders?${qs.toString()}`, {
      method: "GET",
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Backend ${res.status}: ${detail || res.statusText}` };
    }
    const body = (await res.json()) as {
      draw: number;
      recordsTotal: number;
      recordsFiltered: number;
      data: Record<string, unknown>[];
    };
    return { ok: true, data: body };
  } catch (err) {
    return _err(err);
  }
}

// ---------------------------------------------------------------------------
// 9-12) SEARCH — autocomplete admisión
// ---------------------------------------------------------------------------
async function _search(
  path: string,
  q: string,
  _guardUserId: string
): Promise<Response> {
  // IMPL-20260701-07: ruta Next.js API local.
  const qs = new URLSearchParams();
  if (q.trim()) qs.set("q", q.trim());
  return _localFetch(`${path}?${qs.toString()}`, { method: "GET" });
}

export async function searchWorkersAction(q: string): Promise<WorkerSearchResult[]> {
  const guard = await _requireReception();
  if (!guard) return [];
  try {
    const res = await _search("/api/lab/search/workers", q, guard.userId);
    if (!res.ok) return [];
    return (await res.json()) as WorkerSearchResult[];
  } catch {
    return [];
  }
}

export async function searchDoctorsAction(q: string): Promise<DoctorSearchResult[]> {
  const guard = await _requireReception();
  if (!guard) return [];
  try {
    const res = await _search("/api/lab/search/doctors", q, guard.userId);
    if (!res.ok) return [];
    return (await res.json()) as DoctorSearchResult[];
  } catch {
    return [];
  }
}

export async function searchCompaniesAction(q: string): Promise<CompanySearchResult[]> {
  const guard = await _requireReception();
  if (!guard) return [];
  try {
    const res = await _search("/api/lab/search/companies", q, guard.userId);
    if (!res.ok) return [];
    return (await res.json()) as CompanySearchResult[];
  } catch {
    return [];
  }
}

export async function searchLabTestsAction(q: string): Promise<LabTestSearchResult[]> {
  const guard = await _requireReception();
  if (!guard) return [];
  try {
    const res = await _search("/api/lab/search/tests", q, guard.userId);
    if (!res.ok) return [];
    return (await res.json()) as LabTestSearchResult[];
  } catch {
    return [];
  }
}
