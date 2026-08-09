/**
 * @file Tests para server actions de AI Provider Keys.
 * @id IMPL-20260809-06 — ARCH-20260809-03
 * @spec context/SPECs/SPEC_ARCH-20260809-03-MANAGE-AI-API-KEYS.md
 *
 * Mockea next-auth/next (getServerSession) y fetch global.
 * Verifica:
 *  - listAIProviderKeys: ADMIN/SUPERADMIN pasan; DOCTOR → error.
 *  - updateAIProviderKey: solo SUPERADMIN; no se acepta apiKey vacío; provider inválido.
 *  - deleteAIProviderKey: solo SUPERADMIN; 404 se reporta.
 *  - NUNCA se expone la key completa en respuestas (defensa en profundidad en la action).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next-auth/next antes de importar las actions
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import {
  listAIProviderKeys,
  updateAIProviderKey,
  deleteAIProviderKey,
  probeAIProviderKey,
  getExtractionDefaultProvider,
  setExtractionDefaultProvider,
} from '@/actions/ai-keys.actions'
import { getServerSession } from 'next-auth/next'

const BACKEND = 'http://test-backend'

function setSession(role: string | null) {
  if (role === null) {
    ;(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    return
  }
  ;(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: 'user-1', role },
  })
}

function setBackendUrl(value: string | undefined) {
  if (value === undefined) {
    delete process.env.NEXT_PUBLIC_BACKEND_URL
    delete process.env.BACKEND_URL
  } else {
    process.env.NEXT_PUBLIC_BACKEND_URL = value
  }
}

function setFetchResponse(status: number, body: unknown) {
  globalThis.fetch = vi.fn(
    async (_url: unknown, _init?: unknown) => {
      return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => JSON.stringify(body),
        json: async () => body,
        headers: new Headers(),
      } as unknown as Response
    }
  ) as unknown as typeof fetch
}

beforeEach(() => {
  vi.clearAllMocks()
  setBackendUrl(BACKEND)
  // fetch default: 200 OK con body vacío
  setFetchResponse(200, { providers: [] })
})

describe('listAIProviderKeys', () => {
  it('returns error when not authenticated', async () => {
    setSession(null)
    const result = await listAIProviderKeys()
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/No autenticado/)
  })

  it('returns error for DOCTOR role', async () => {
    setSession('DOCTOR_GENERAL')
    const result = await listAIProviderKeys()
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/ADMIN/)
  })

  it('returns providers for ADMIN role', async () => {
    setSession('ADMIN')
    setFetchResponse(200, {
      providers: [
        { provider: 'gemini', present: false, keySuffix: null, baseUrl: null, defaultModel: null, enabled: false, updatedAt: null, updatedBy: null, source: 'env' },
        { provider: 'm3', present: true, keySuffix: 'abcd', baseUrl: 'https://api.example.com', defaultModel: 'M', enabled: true, updatedAt: '2026-08-09T18:00:00Z', updatedBy: 'u', source: 'db' },
        { provider: 'dr7', present: false, keySuffix: null, baseUrl: null, defaultModel: null, enabled: false, updatedAt: null, updatedBy: null, source: 'env' },
      ],
    })
    const result = await listAIProviderKeys()
    expect(result.ok).toBe(true)
    expect(result.providers).toHaveLength(3)
  })

  it('forwards 403 error from backend', async () => {
    setSession('ADMIN')
    setFetchResponse(403, { detail: 'forbidden' })
    const result = await listAIProviderKeys()
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/denegado/)
  })

  it('truncates keySuffix to last 4 chars (defense in depth)', async () => {
    setSession('ADMIN')
    setFetchResponse(200, {
      providers: [
        { provider: 'm3', present: true, keySuffix: 'TOO-MANY-CHARS-EXPOSED', baseUrl: null, defaultModel: null, enabled: true, updatedAt: null, updatedBy: null, source: 'db' },
      ],
    })
    const result = await listAIProviderKeys()
    expect(result.ok).toBe(true)
    expect(result.providers![0].keySuffix).toBe('OSED')
    expect(result.providers![0].keySuffix!.length).toBe(4)
  })

  it('returns error when backend URL not configured', async () => {
    setSession('ADMIN')
    setBackendUrl(undefined)
    const result = await listAIProviderKeys()
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/BACKEND_URL/)
  })
})

describe('updateAIProviderKey', () => {
  it('rejects ADMIN role', async () => {
    setSession('ADMIN')
    const result = await updateAIProviderKey({ provider: 'm3', apiKey: 'sk-x' })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/SUPERADMIN/)
  })

  it('rejects empty apiKey', async () => {
    setSession('SUPERADMIN')
    const result = await updateAIProviderKey({ provider: 'm3', apiKey: '' })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/vacío/)
  })

  it('rejects unknown provider', async () => {
    setSession('SUPERADMIN')
    const result = await updateAIProviderKey({ provider: 'openai' as never, apiKey: 'sk-x' })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/inválido/)
  })

  it('reports 503 from backend (ENCRYPTION_KEY ausente)', async () => {
    setSession('SUPERADMIN')
    setFetchResponse(503, { detail: 'ENCRYPTION_KEY no configurada' })
    const result = await updateAIProviderKey({ provider: 'm3', apiKey: 'sk-x' })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/ENCRYPTION_KEY/)
  })

  it('reports 409 conflict from backend', async () => {
    setSession('SUPERADMIN')
    setFetchResponse(409, { detail: 'conflict' })
    const result = await updateAIProviderKey({ provider: 'm3', apiKey: 'sk-x' })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Conflicto/)
  })

  it('returns ok with rotated result on success', async () => {
    setSession('SUPERADMIN')
    setFetchResponse(200, {
      provider: 'm3', present: true, keySuffix: '9999',
      baseUrl: null, defaultModel: null, enabled: true,
      updatedAt: '2026-08-09T18:00:00Z', source: 'db',
    })
    const result = await updateAIProviderKey({ provider: 'm3', apiKey: 'sk-rotated' })
    expect(result.ok).toBe(true)
    expect(result.result?.provider).toBe('m3')
    expect(result.result?.keySuffix).toBe('9999')
  })
})

describe('deleteAIProviderKey', () => {
  it('rejects ADMIN role', async () => {
    setSession('ADMIN')
    const result = await deleteAIProviderKey('m3')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/SUPERADMIN/)
  })

  it('reports 404 from backend', async () => {
    setSession('SUPERADMIN')
    setFetchResponse(404, { detail: 'no existe' })
    const result = await deleteAIProviderKey('dr7')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/No existe/)
  })

  it('returns ok on success', async () => {
    setSession('SUPERADMIN')
    setFetchResponse(200, { provider: 'm3', present: false, source: 'env' })
    const result = await deleteAIProviderKey('m3')
    expect(result.ok).toBe(true)
    expect(result.result?.source).toBe('env')
  })

  it('rejects unknown provider', async () => {
    setSession('SUPERADMIN')
    const result = await deleteAIProviderKey('openai' as never)
    expect(result.ok).toBe(false)
  })
})

// ===========================================================================
// IMPL-20260809-09 — ARCH-20260809-05
// Tests para probeAIProviderKey, getExtractionDefaultProvider,
// setExtractionDefaultProvider.
// ===========================================================================

describe('probeAIProviderKey', () => {
  it('returns not-authenticated error when no session', async () => {
    setSession(null)
    const result = await probeAIProviderKey({ provider: 'm3' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.provider).toBe('m3')
      expect(result.errorKind).toBe('unknown')
      expect(result.message).toMatch(/No autenticado/)
    }
  })

  it('returns error for ADMIN role (only SUPERADMIN allowed)', async () => {
    setSession('ADMIN')
    const result = await probeAIProviderKey({ provider: 'gemini' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorKind).toBe('unknown')
      expect(result.message).toMatch(/SUPERADMIN/)
    }
  })

  it('returns error when BACKEND_URL missing', async () => {
    setSession('SUPERADMIN')
    setBackendUrl(undefined)
    const result = await probeAIProviderKey({ provider: 'm3' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorKind).toBe('unknown')
      expect(result.message).toMatch(/Backend/)
    }
  })

  it('maps 403 from backend to errorKind=unknown with SUPERADMIN message', async () => {
    setSession('SUPERADMIN')
    setFetchResponse(403, { detail: 'forbidden' })
    const result = await probeAIProviderKey({ provider: 'dr7' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorKind).toBe('unknown')
      expect(result.message).toMatch(/SUPERADMIN/)
    }
  })

  it('maps 429 from backend to errorKind=rate_limited with retryAfterSec', async () => {
    setSession('SUPERADMIN')
    setFetchResponse(429, { retryAfterSec: 17 })
    const result = await probeAIProviderKey({ provider: 'm3' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorKind).toBe('rate_limited')
      expect(result.rateLimited).toBe(true)
      expect(result.retryAfterSec).toBe(17)
    }
  })

  it('maps 503 from backend to errorKind=not_configured', async () => {
    setSession('SUPERADMIN')
    setFetchResponse(503, { detail: { code: 'not_configured', message: 'Sin API key' } })
    const result = await probeAIProviderKey({ provider: 'm3' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorKind).toBe('not_configured')
      expect(result.message).toMatch(/Sin API key/)
    }
  })

  it('returns ok:true on 200 with provider response', async () => {
    setSession('SUPERADMIN')
    setFetchResponse(200, {
      ok: true,
      provider: 'm3',
      latencyMs: 234,
      httpStatus: 200,
      message: 'Hola!!',
    })
    const result = await probeAIProviderKey({ provider: 'm3' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.provider).toBe('m3')
      expect(result.latencyMs).toBe(234)
      expect(result.message).toBe('Hola!!')
    }
  })

  it('returns ok:false with errorKind=auth on 401', async () => {
    setSession('SUPERADMIN')
    setFetchResponse(200, {
      ok: false,
      provider: 'm3',
      errorKind: 'auth',
      httpStatus: 401,
      message: 'No autorizado (401)',
    })
    const result = await probeAIProviderKey({ provider: 'm3' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorKind).toBe('auth')
      expect(result.httpStatus).toBe(401)
    }
  })

  it('rejects when response body contains apiKey (defense-in-depth)', async () => {
    setSession('SUPERADMIN')
    setFetchResponse(200, {
      ok: true,
      provider: 'm3',
      latencyMs: 100,
      httpStatus: 200,
      message: 'Hola',
      apiKey: 'sk-leaked-key',
    })
    const result = await probeAIProviderKey({ provider: 'm3' })
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/filtrada/)
  })
})

describe('getExtractionDefaultProvider', () => {
  it('returns not-authenticated error when no session', async () => {
    setSession(null)
    const result = await getExtractionDefaultProvider()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/No autenticado/)
    }
  })

  it('returns error for DOCTOR role', async () => {
    setSession('DOCTOR_GENERAL')
    const result = await getExtractionDefaultProvider()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/ADMIN/)
    }
  })

  it('returns provider for ADMIN', async () => {
    setSession('ADMIN')
    setFetchResponse(200, { provider: 'gemini', source: 'default', updatedAt: null })
    const result = await getExtractionDefaultProvider()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.provider).toBe('gemini')
      expect(result.source).toBe('default')
    }
  })

  it('returns provider for SUPERADMIN', async () => {
    setSession('SUPERADMIN')
    setFetchResponse(200, { provider: 'm3', source: 'db', updatedAt: '2026-08-09T12:00:00Z' })
    const result = await getExtractionDefaultProvider()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.provider).toBe('m3')
      expect(result.source).toBe('db')
      expect(result.updatedAt).toBe('2026-08-09T12:00:00Z')
    }
  })

  it('rejects when backend returns invalid provider (defense-in-depth)', async () => {
    setSession('ADMIN')
    setFetchResponse(200, { provider: 'dr7', source: 'db', updatedAt: null })
    const result = await getExtractionDefaultProvider()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/provider inválido/)
    }
  })
})

describe('setExtractionDefaultProvider', () => {
  it('returns not-authenticated error when no session', async () => {
    setSession(null)
    const result = await setExtractionDefaultProvider({ provider: 'm3' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/No autenticado/)
    }
  })

  it('returns error for ADMIN role (only SUPERADMIN allowed)', async () => {
    setSession('ADMIN')
    const result = await setExtractionDefaultProvider({ provider: 'm3' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/SUPERADMIN/)
    }
  })

  it('rejects invalid provider via Zod', async () => {
    setSession('SUPERADMIN')
    // Bypass Zod type check via `as never`.
    const result = await setExtractionDefaultProvider({ provider: 'dr7' as never })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/input inválido/)
    }
  })

  it('maps 409 to conflict error message', async () => {
    setSession('SUPERADMIN')
    setFetchResponse(409, {
      detail: { code: 'conflict', message: 'conflicto', currentUpdatedAt: 'x' },
    })
    const result = await setExtractionDefaultProvider({ provider: 'm3' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/Conflicto/)
    }
  })

  it('returns ok on successful set', async () => {
    setSession('SUPERADMIN')
    setFetchResponse(200, {
      provider: 'm3',
      source: 'db',
      updatedAt: '2026-08-09T13:00:00Z',
    })
    const result = await setExtractionDefaultProvider({ provider: 'm3' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.provider).toBe('m3')
      expect(result.updatedAt).toBe('2026-08-09T13:00:00Z')
    }
  })
})