/**
 * @file Server Actions para gestión runtime de API Keys IA.
 * @id IMPL-20260809-06 — ARCH-20260809-03
 * @spec context/SPECs/SPEC_ARCH-20260809-03-MANAGE-AI-API-KEYS.md
 *
 * Guard real: sesión NextAuth + isSuperAdmin / isAdminLike (roles.ts).
 * El header `x-ami-role` que enviamos al backend es defense-in-depth al
 * estilo de maintenance.py:22 y mobile_units.py:23 (frontera de confianza
 * Vercel→Railway).
 */
'use server'

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
  AI_PROVIDERS,
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