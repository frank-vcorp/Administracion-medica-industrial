/**
 * @file Server Actions para gestión runtime de API Keys IA.
 * @id IMPL-20260809-06 — ARCH-20260809-03
 * @spec context/SPECs/SPEC_ARCH-20260809-03-MANAGE-AI-API-KEYS.md
 *
 * Guard real: sesión NextAuth + isSuperAdmin / isAdminLike (roles.ts).
 * El header `x-ami-role` que enviamos al backend es defense-in-depth al
 * estilo de maintenance.py:22 y mobile_units.py:23 (frontera de confianza
 * Vercel→Railway).
 *
 * IMPL-20260809-09 — ARCH-20260809-05: añade `probeAIProviderKey`,
 * `getExtractionDefaultProvider` y `setExtractionDefaultProvider` para la
 * feature "Probar conexión + Default de extracción global vía UI".
 */
'use server'

import { z } from 'zod'
import { getServerSession } from 'next-auth/next'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/auth'
import { isAdminLike, isSuperAdmin } from '@/lib/auth/roles'
import {
  type AIKeyPublic,
  type AIKeyUpsertRequest,
  type AIKeyUpsertResponse,
  type AIKeyDeleteResponse,
  type AIKeysListResponse,
  type AIProvider,
  type ProbeResult,
  type GetDefaultResult,
  type SetDefaultResult,
  type ExtractionProvider,
  AI_PROVIDERS,
  EXTRACTION_PROVIDERS,
} from '@/types/ai-keys'

function _backendBase(): string {
  return (
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    ''
  )
}

/**
 * GET /api/v2/admin/ai-keys — ADMIN o SUPERADMIN.
 * Lista los 3 proveedores canónicos con su estado mascareado.
 * NUNCA retorna la key completa (backend sólo expone `keySuffix`).
 */
export async function listAIProviderKeys(): Promise<{
  ok: boolean
  providers?: AIKeyPublic[]
  error?: string
}> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { ok: false, error: 'No autenticado' }
  }
  const role = session.user.role
  if (!isAdminLike(role)) {
    return { ok: false, error: 'Se requiere rol ADMIN o SUPERADMIN' }
  }

  const base = _backendBase()
  if (!base) {
    return { ok: false, error: 'Backend no configurado (BACKEND_URL faltante)' }
  }

  try {
    const res = await fetch(`${base}/api/v2/admin/ai-keys`, {
      method: 'GET',
      headers: {
        'x-ami-role': role as string,
        'x-ami-userid': session.user.id as string,
      },
      cache: 'no-store',
    })
    if (res.status === 403) {
      return { ok: false, error: 'Acceso denegado por el backend (rol insuficiente)' }
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return {
        ok: false,
        error: `Backend error ${res.status}: ${detail.slice(0, 200)}`,
      }
    }
    const json = (await res.json()) as AIKeysListResponse
    // Sanity check: ninguna key completa debe filtrarse al cliente.
    for (const p of json.providers) {
      if (p.keySuffix && p.keySuffix.length > 4) {
        // Si el backend intenta exponer más de 4 chars, descartar (defense-in-depth).
        p.keySuffix = p.keySuffix.slice(-4)
      }
    }
    return { ok: true, providers: json.providers }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `Error de red: ${msg.slice(0, 200)}` }
  }
}

/**
 * PUT /api/v2/admin/ai-keys/{provider} — solo SUPERADMIN.
 * Cifra apiKey con AES-256-GCM en backend (el frontend nunca ve el ciphertext).
 */
export async function updateAIProviderKey(input: {
  provider: AIProvider
  apiKey: string
  baseUrl?: string | null
  defaultModel?: string | null
  expectedUpdatedAt?: string | null
}): Promise<{
  ok: boolean
  result?: AIKeyUpsertResponse
  error?: string
}> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { ok: false, error: 'No autenticado' }
  }
  if (!isSuperAdmin(session.user.role)) {
    return { ok: false, error: 'Se requiere rol SUPERADMIN' }
  }
  if (!AI_PROVIDERS.includes(input.provider)) {
    return { ok: false, error: `provider inválido: ${input.provider}` }
  }
  if (!input.apiKey || input.apiKey.trim().length === 0) {
    return { ok: false, error: 'apiKey no puede estar vacío' }
  }

  const base = _backendBase()
  if (!base) {
    return { ok: false, error: 'Backend no configurado (BACKEND_URL faltante)' }
  }

  const body: AIKeyUpsertRequest = {
    apiKey: input.apiKey,
    baseUrl: input.baseUrl ?? null,
    defaultModel: input.defaultModel ?? null,
    expectedUpdatedAt: input.expectedUpdatedAt ?? null,
  }

  try {
    const res = await fetch(
      `${base}/api/v2/admin/ai-keys/${input.provider}`,
      {
        method: 'PUT',
        headers: {
          'x-ami-role': session.user.role as string,
          'x-ami-userid': session.user.id as string,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        cache: 'no-store',
      },
    )
    if (res.status === 403) {
      return { ok: false, error: 'Acceso denegado (solo SUPERADMIN)' }
    }
    if (res.status === 503) {
      const detail = await res.text().catch(() => '')
      return { ok: false, error: `ENCRYPTION_KEY no configurada en backend: ${detail.slice(0, 200)}` }
    }
    if (res.status === 409) {
      return { ok: false, error: 'Conflicto: la fila fue modificada por otro usuario. Recarga y reintenta.' }
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return {
        ok: false,
        error: `Backend error ${res.status}: ${detail.slice(0, 200)}`,
      }
    }
    const json = (await res.json()) as AIKeyUpsertResponse
    revalidatePath('/admin/ai-keys')
    return { ok: true, result: json }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `Error de red: ${msg.slice(0, 200)}` }
  }
}

/**
 * DELETE /api/v2/admin/ai-keys/{provider} — solo SUPERADMIN.
 * La siguiente `resolve` en backend cae a env var (no se elimina la env var).
 */
export async function deleteAIProviderKey(provider: AIProvider): Promise<{
  ok: boolean
  result?: AIKeyDeleteResponse
  error?: string
}> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { ok: false, error: 'No autenticado' }
  }
  if (!isSuperAdmin(session.user.role)) {
    return { ok: false, error: 'Se requiere rol SUPERADMIN' }
  }
  if (!AI_PROVIDERS.includes(provider)) {
    return { ok: false, error: `provider inválido: ${provider}` }
  }

  const base = _backendBase()
  if (!base) {
    return { ok: false, error: 'Backend no configurado (BACKEND_URL faltante)' }
  }

  try {
    const res = await fetch(
      `${base}/api/v2/admin/ai-keys/${provider}`,
      {
        method: 'DELETE',
        headers: {
          'x-ami-role': session.user.role as string,
          'x-ami-userid': session.user.id as string,
        },
        cache: 'no-store',
      },
    )
    if (res.status === 403) {
      return { ok: false, error: 'Acceso denegado (solo SUPERADMIN)' }
    }
    if (res.status === 404) {
      return { ok: false, error: `No existe key en BD para ${provider}` }
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return {
        ok: false,
        error: `Backend error ${res.status}: ${detail.slice(0, 200)}`,
      }
    }
    const json = (await res.json()) as AIKeyDeleteResponse
    revalidatePath('/admin/ai-keys')
    return { ok: true, result: json }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `Error de red: ${msg.slice(0, 200)}` }
  }
}

// ===========================================================================
// IMPL-20260809-09 — ARCH-20260809-05
// "Probar conexión" + selector de proveedor de extracción predeterminado.
// ===========================================================================

// Zod schemas reutilizables (definidos a nivel de módulo para que los tests
// puedan importarlos si lo desean).
const _ProbeInputSchema = z.object({
  provider: z.enum(['gemini', 'm3', 'dr7']),
})

const _SetDefaultInputSchema = z.object({
  provider: z.enum(['gemini', 'm3']),
  expectedUpdatedAt: z.string().nullable().optional(),
})

/**
 * POST /api/v2/admin/ai-keys/{provider}/probe — solo SUPERADMIN.
 * Llama al endpoint real del proveedor con prompt trivial "Hola" + max_tokens=16.
 * Reutiliza la misma key efectiva que producción (KeyResolver).
 * Rate limit interno: 1/30s por proveedor (429 con retryAfterSec).
 */
export async function probeAIProviderKey(input: {
  provider: AIProvider
}): Promise<ProbeResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return {
      ok: false,
      provider: input.provider,
      errorKind: 'unknown',
      message: 'No autenticado',
    }
  }
  if (!isSuperAdmin(session.user.role)) {
    return {
      ok: false,
      provider: input.provider,
      errorKind: 'unknown',
      message: 'Acceso denegado (solo SUPERADMIN)',
    }
  }

  // Zod: input validation
  const parsed = _ProbeInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      provider: input.provider,
      errorKind: 'unknown',
      message: 'provider inválido',
    }
  }

  const base = _backendBase()
  if (!base) {
    return {
      ok: false,
      provider: input.provider,
      errorKind: 'unknown',
      message: 'Backend no configurado (BACKEND_URL faltante)',
    }
  }

  // AbortController para timeout client-side (15s, ligeramente > 12s backend).
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15_000)

  try {
    const res = await fetch(
      `${base}/api/v2/admin/ai-keys/${input.provider}/probe`,
      {
        method: 'POST',
        headers: {
          'x-ami-role': session.user.role as string,
          'x-ami-userid': session.user.id as string,
        },
        cache: 'no-store',
        signal: controller.signal,
      },
    )

    clearTimeout(timeoutId)

    if (res.status === 403) {
      return {
        ok: false,
        provider: input.provider,
        errorKind: 'unknown',
        message: 'Acceso denegado (solo SUPERADMIN)',
      }
    }
    if (res.status === 429) {
      // Rate limit interno: parsear retryAfterSec si está disponible.
      let retry = 30
      try {
        const detail = (await res.json()) as { retryAfterSec?: number }
        if (typeof detail?.retryAfterSec === 'number') retry = detail.retryAfterSec
      } catch {
        /* swallow */
      }
      return {
        ok: false,
        provider: input.provider,
        errorKind: 'rate_limited',
        message: `Rate limit interno. Reintentar en ${retry}s.`,
        rateLimited: true,
        retryAfterSec: retry,
      }
    }
    if (res.status === 503) {
      let msg = 'Proveedor no configurado'
      try {
        const detail = (await res.json()) as unknown
        if (typeof detail === 'string') {
          msg = detail.slice(0, 200)
        } else if (
          detail &&
          typeof detail === 'object' &&
          'detail' in detail &&
          (detail as { detail: unknown }).detail &&
          typeof (detail as { detail: unknown }).detail === 'object' &&
          'message' in ((detail as { detail: unknown }).detail as object)
        ) {
          const d = (detail as { detail: { message: unknown } }).detail
          msg = String(d.message).slice(0, 200)
        }
      } catch {
        /* swallow */
      }
      return {
        ok: false,
        provider: input.provider,
        errorKind: 'not_configured',
        message: msg,
      }
    }
    if (!res.ok) {
      // Otros errores HTTP del backend.
      let detail = ''
      try {
        detail = (await res.text()).slice(0, 200)
      } catch {
        /* swallow */
      }
      return {
        ok: false,
        provider: input.provider,
        errorKind: 'unknown',
        message: `Backend error ${res.status}: ${detail}`,
        httpStatus: res.status,
      }
    }

    const json = (await res.json()) as ProbeResult
    // Sanity check defensivo: el JSON no debe contener keys en claro.
    // (El backend ya garantiza esto; aquí es defense-in-depth.)
    const raw = JSON.stringify(json)
    if (raw.includes('"apiKey"') || raw.includes('"keyCiphertext"')) {
      // Si el backend filtrara algo, fallamos cerrados.
      return {
        ok: false,
        provider: input.provider,
        errorKind: 'unknown',
        message: 'Respuesta sospechosa filtrada (defense-in-depth)',
      }
    }
    return json
  } catch (e: unknown) {
    clearTimeout(timeoutId)
    const isAbort = e instanceof Error && e.name === 'AbortError'
    return {
      ok: false,
      provider: input.provider,
      errorKind: isAbort ? 'timeout' : 'network',
      message: isAbort
        ? 'Timeout client-side (15s)'
        : `Error de red: ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}`,
    }
  }
}

/**
 * GET /api/v2/admin/app-config/extraction-default-provider — ADMIN o SUPERADMIN.
 * Lee el default persistido en AppConfig (con fallback "gemini" si ausente).
 */
export async function getExtractionDefaultProvider(): Promise<GetDefaultResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { ok: false, error: 'No autenticado' }
  }
  if (!isAdminLike(session.user.role)) {
    return { ok: false, error: 'Se requiere rol ADMIN o SUPERADMIN' }
  }

  const base = _backendBase()
  if (!base) {
    return { ok: false, error: 'Backend no configurado (BACKEND_URL faltante)' }
  }

  try {
    const res = await fetch(
      `${base}/api/v2/admin/app-config/extraction-default-provider`,
      {
        method: 'GET',
        headers: {
          'x-ami-role': session.user.role as string,
          'x-ami-userid': session.user.id as string,
        },
        cache: 'no-store',
      },
    )
    if (res.status === 403) {
      return {
        ok: false,
        error: 'Acceso denegado por el backend (rol insuficiente)',
      }
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return {
        ok: false,
        error: `Backend error ${res.status}: ${detail.slice(0, 200)}`,
      }
    }
    const json = (await res.json()) as {
      provider: ExtractionProvider
      source: 'db' | 'default'
      updatedAt: string | null
    }
    // Validar provider (defense-in-depth).
    if (!EXTRACTION_PROVIDERS.includes(json.provider)) {
      return { ok: false, error: 'provider inválido en respuesta' }
    }
    return { ok: true, ...json }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `Error de red: ${msg.slice(0, 200)}` }
  }
}

/**
 * PUT /api/v2/admin/app-config/extraction-default-provider — solo SUPERADMIN.
 * Setea el default persistido. Optimistic locking vía `expectedUpdatedAt`.
 */
export async function setExtractionDefaultProvider(input: {
  provider: ExtractionProvider
  expectedUpdatedAt?: string | null
}): Promise<SetDefaultResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { ok: false, error: 'No autenticado' }
  }
  if (!isSuperAdmin(session.user.role)) {
    return { ok: false, error: 'Se requiere rol SUPERADMIN' }
  }

  // Zod input validation
  const parsed = _SetDefaultInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: `input inválido: ${parsed.error.message.slice(0, 200)}`,
    }
  }

  const base = _backendBase()
  if (!base) {
    return { ok: false, error: 'Backend no configurado (BACKEND_URL faltante)' }
  }

  try {
    const res = await fetch(
      `${base}/api/v2/admin/app-config/extraction-default-provider`,
      {
        method: 'PUT',
        headers: {
          'x-ami-role': session.user.role as string,
          'x-ami-userid': session.user.id as string,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: parsed.data.provider,
          expectedUpdatedAt: parsed.data.expectedUpdatedAt ?? null,
        }),
        cache: 'no-store',
      },
    )
    if (res.status === 403) {
      return { ok: false, error: 'Acceso denegado (solo SUPERADMIN)' }
    }
    if (res.status === 409) {
      return {
        ok: false,
        error:
          'Conflicto: la config fue modificada por otro usuario. Recarga y reintenta.',
      }
    }
    if (res.status === 400) {
      const detail = await res.text().catch(() => '')
      return {
        ok: false,
        error: `Validación: ${detail.slice(0, 200)}`,
      }
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return {
        ok: false,
        error: `Backend error ${res.status}: ${detail.slice(0, 200)}`,
      }
    }
    const json = (await res.json()) as {
      provider: ExtractionProvider
      source: 'db'
      updatedAt: string
    }
    if (!EXTRACTION_PROVIDERS.includes(json.provider)) {
      return { ok: false, error: 'provider inválido en respuesta' }
    }
    if (!json.updatedAt) {
      return { ok: false, error: 'updatedAt ausente en respuesta' }
    }
    revalidatePath('/admin/ai-keys')
    return { ok: true, ...json }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `Error de red: ${msg.slice(0, 200)}` }
  }
}