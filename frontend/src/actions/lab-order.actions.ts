/**
 * @file Server Actions para LabOrder (Slice B NOVA absorción).
 * @id IMPL-20260701-03 — Slice B Recepción (ARCH-20260701-03).
 * @backup context/SPECs/SPEC_IMPL-20260701-SLICE-B-RECEPCION.md
 *
 * Patrón: idéntico a lab-catalog.actions.ts.
 * - Validación Zod server-side
 * - Rol permitido: ADMIN o LAB_RECEPTIONIST
 * - Header X-AMI-UserId para autenticación placeholder FastAPI
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

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

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
  // pendiente de incorporarse al enum de roles de NextAuth). FastAPI no
  // valida roles aún (header placeholder), pero el gate cliente evita que
  // COMPANY_CLIENT u OPERATOR lleguen a tocar admisión.
  if (role !== "ADMIN") return null;
  return { userId, role: role as string };
}

async function _backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = new URL(path, BACKEND_URL);
  return fetch(url.toString(), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-AMI-UserId": (await _requireReception())?.userId ?? "",
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
    const res = await _backendFetch("/api/v1/lab/orders", {
      method: "POST",
      headers: { "X-AMI-UserId": guard.userId },
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
    const res = await _backendFetch(`/api/v1/lab/orders/${orderId}`, {
      method: "PATCH",
      headers: { "X-AMI-UserId": guard.userId },
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
    const res = await _backendFetch(`/api/v1/lab/orders/${orderId}`, {
      method: "GET",
      headers: { "X-AMI-UserId": guard.userId },
    });
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
    const url = new URL(`/api/v1/lab/orders/${orderId}`, BACKEND_URL);
    url.searchParams.set("motivo", parsed.data.motivo);
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: { "X-AMI-UserId": guard.userId },
      cache: "no-store",
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
    const res = await _backendFetch(`/api/v1/lab/orders/${orderId}/confirm`, {
      method: "POST",
      headers: { "X-AMI-UserId": guard.userId },
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
    const res = await _backendFetch(`/api/v1/lab/orders/${orderId}/items`, {
      method: "POST",
      headers: { "X-AMI-UserId": guard.userId },
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
    const res = await _backendFetch(
      `/api/v1/lab/orders/${orderId}/items/${itemId}`,
      {
        method: "DELETE",
        headers: { "X-AMI-UserId": guard.userId },
      }
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
    const url = new URL("/api/v1/lab/orders", BACKEND_URL);
    url.searchParams.set("draw", String(filters.draw ?? 1));
    url.searchParams.set("start", String(filters.start ?? 0));
    url.searchParams.set("length", String(filters.length ?? 25));
    if (filters.search) url.searchParams.set("search[value]", filters.search);
    if (filters.status) url.searchParams.set("status", filters.status);
    if (filters.dateFrom) url.searchParams.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) url.searchParams.set("dateTo", filters.dateTo);
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { "X-AMI-UserId": guard.userId },
      cache: "no-store",
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
  guardUserId: string
): Promise<Response> {
  const url = new URL(path, BACKEND_URL);
  if (q.trim()) url.searchParams.set("q", q.trim());
  return fetch(url.toString(), {
    method: "GET",
    headers: { "X-AMI-UserId": guardUserId },
    cache: "no-store",
  });
}

export async function searchWorkersAction(q: string): Promise<WorkerSearchResult[]> {
  const guard = await _requireReception();
  if (!guard) return [];
  try {
    const res = await _search("/api/v1/lab/search/workers", q, guard.userId);
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
    const res = await _search("/api/v1/lab/search/doctors", q, guard.userId);
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
    const res = await _search("/api/v1/lab/search/companies", q, guard.userId);
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
    const res = await _search("/api/v1/lab/search/tests", q, guard.userId);
    if (!res.ok) return [];
    return (await res.json()) as LabTestSearchResult[];
  } catch {
    return [];
  }
}
