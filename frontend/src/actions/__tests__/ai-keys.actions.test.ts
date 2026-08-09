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