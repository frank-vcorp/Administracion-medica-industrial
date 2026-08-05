/**
 * @file Tests unitarios para utilidades de draft autosave.
 * @id FIX-20260805-04
 * @spec context/SPECs/SPEC_FIX-20260805-04-DRAFT-AUTOSAVE-SELF-REGISTRATION.md
 *
 * Cubre los edge cases de §7 de la SPEC: TTL, version, scope, serialización,
 * corrupción, quota, keys separadas.
 *
 * No usamos localStorage real del navegador: Vitest está en environment 'node'.
 * Stubeamos localStorage con un Map-backed shim mediante vi.stubGlobal.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DRAFT_SCHEMA_VERSION,
  DRAFT_TTL_MS,
  buildDraftKey,
  clearDraft,
  loadDraft,
  saveDraft,
  type SelfRegDraft,
} from '../self-reg-draft'

function makeShimStorage() {
  const data = new Map<string, string>()
  return {
    getItem: vi.fn((k: string) => (data.has(k) ? data.get(k)! : null)),
    setItem: vi.fn((k: string, v: string) => {
      // Simular QuotaExceededError si se setea una flag.
      const o = (globalThis as unknown as { __quota?: boolean }).__quota
      if (o) {
        const e = new Error('QuotaExceededError') as Error & { name: string }
        e.name = 'QuotaExceededError'
        throw e
      }
      data.set(k, v)
    }),
    removeItem: vi.fn((k: string) => {
      data.delete(k)
    }),
    clear: vi.fn(() => {
      data.clear()
    }),
    key: vi.fn((i: number) => Array.from(data.keys())[i] ?? null),
    get length() {
      return data.size
    },
  }
}

function validDraft(overrides: Partial<SelfRegDraft> = {}): SelfRegDraft {
  return {
    version: 1,
    savedAt: Date.now(),
    source: 'TOKEN',
    scope: 'a1b2c3d4',
    form: { razonSocial: 'ACME SA' },
    uploads: null,
    ...overrides,
  }
}

describe('self-reg-draft', () => {
  let shim: ReturnType<typeof makeShimStorage>

  beforeEach(() => {
    vi.useFakeTimers()
    shim = makeShimStorage()
    vi.stubGlobal('localStorage', shim as unknown as Storage)
    ;(globalThis as unknown as { __quota?: boolean }).__quota = false
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    delete (globalThis as unknown as { __quota?: boolean }).__quota
  })

  describe('buildDraftKey', () => {
    it('genera key compuesta por source + scope con prefijo versionado', () => {
      expect(buildDraftKey('TOKEN', 'a1b2c3d4')).toBe(`ami:selfreg:draft:v${DRAFT_SCHEMA_VERSION}:TOKEN:a1b2c3d4`)
      expect(buildDraftKey('PUBLIC', 'e5f6g7h8')).toBe(`ami:selfreg:draft:v${DRAFT_SCHEMA_VERSION}:PUBLIC:e5f6g7h8`)
    })

    it('keys para TOKEN y PUBLIC son distintas', () => {
      const t = buildDraftKey('TOKEN', 'x')
      const p = buildDraftKey('PUBLIC', 'x')
      expect(t).not.toBe(p)
    })

    it('scope idéntico con mismo source genera misma key', () => {
      expect(buildDraftKey('TOKEN', 'abc')).toBe(buildDraftKey('TOKEN', 'abc'))
    })
  })

  describe('saveDraft + loadDraft (round-trip)', () => {
    it('saveDraft persiste y loadDraft recupera el mismo objeto', () => {
      const key = buildDraftKey('TOKEN', 'scope1')
      const d = validDraft({ scope: 'scope1', form: { x: 1, y: 'foo' } })
      expect(saveDraft(key, d)).toBe(true)
      const loaded = loadDraft(key)
      expect(loaded).toEqual(d)
    })

    it('saveDraft llama a localStorage.setItem con JSON string', () => {
      const key = buildDraftKey('TOKEN', 'scope1')
      saveDraft(key, validDraft())
      expect(shim.setItem).toHaveBeenCalledWith(key, expect.any(String))
      const json = (shim.setItem.mock.calls[0]?.[1] ?? '') as string
      expect(() => JSON.parse(json)).not.toThrow()
    })
  })

  describe('TTL expirado (edge #7)', () => {
    it('descarta silenciosamente y limpia la entry', () => {
      const key = buildDraftKey('TOKEN', 'old')
      const d = validDraft({ savedAt: Date.now() - DRAFT_TTL_MS - 1000, scope: 'old' })
      // Persistir sin validar TTL (saveDraft no chequea TTL).
      shim.setItem(key, JSON.stringify(d))
      const loaded = loadDraft(key)
      expect(loaded).toBeNull()
      expect(shim.removeItem).toHaveBeenCalledWith(key)
    })

    it('dentro del TTL recupera el draft', () => {
      const key = buildDraftKey('TOKEN', 'fresh')
      const d = validDraft({ savedAt: Date.now() - 1000, scope: 'fresh' })
      shim.setItem(key, JSON.stringify(d))
      expect(loadDraft(key)).not.toBeNull()
    })
  })

  describe('version mismatch (edge #6, criterio #8)', () => {
    it('descarta silenciosamente sin eliminar entry (mantiene evidencia)', () => {
      const key = buildDraftKey('TOKEN', 'oldver')
      const d = { ...validDraft({ scope: 'oldver' }), version: 99 as unknown as 1 }
      shim.setItem(key, JSON.stringify(d))
      expect(loadDraft(key)).toBeNull()
    })
  })

  describe('JSON corrupto (edge #5, criterio #12)', () => {
    it('retorna null y limpia la entry', () => {
      const key = buildDraftKey('TOKEN', 'corrupt')
      shim.setItem(key, '{esto no es json valido')
      expect(loadDraft(key)).toBeNull()
      expect(shim.removeItem).toHaveBeenCalledWith(key)
    })

    it('JSON válido pero no-objeto retorna null', () => {
      const key = buildDraftKey('TOKEN', 'number')
      shim.setItem(key, '42')
      expect(loadDraft(key)).toBeNull()
    })
  })

  describe('QuotaExceededError (edge #4, criterio #11)', () => {
    it('saveDraft retorna false y no throw', () => {
      ;(globalThis as unknown as { __quota?: boolean }).__quota = true
      const ok = saveDraft(buildDraftKey('TOKEN', 'q'), validDraft())
      expect(ok).toBe(false)
    })
  })

  describe('source/scope mismatch al restore (edge #7)', () => {
    it('descarta si source no coincide con expected', () => {
      const key = buildDraftKey('TOKEN', 's1')
      shim.setItem(key, JSON.stringify(validDraft({ source: 'TOKEN', scope: 's1' })))
      // Mismatch de source → descarta + removeItem.
      expect(loadDraft(key, { source: 'PUBLIC', scope: 's1' })).toBeNull()
      expect(shim.removeItem).toHaveBeenCalledWith(key)
    })

    it('descarta si scope no coincide con expected', () => {
      const key = buildDraftKey('TOKEN', 's1')
      shim.setItem(key, JSON.stringify(validDraft({ source: 'TOKEN', scope: 's1' })))
      expect(loadDraft(key, { source: 'TOKEN', scope: 'other' })).toBeNull()
      expect(shim.removeItem).toHaveBeenCalledWith(key)
    })

    it('recupera si source y scope coinciden', () => {
      const key = buildDraftKey('TOKEN', 's1')
      shim.setItem(key, JSON.stringify(validDraft({ source: 'TOKEN', scope: 's1' })))
      expect(loadDraft(key, { source: 'TOKEN', scope: 's1' })).not.toBeNull()
    })
  })

  describe('clearDraft', () => {
    it('elimina la entry (submit exitoso, edge #9 / criterio #5)', () => {
      const key = buildDraftKey('TOKEN', 'c')
      saveDraft(key, validDraft({ scope: 'c' }))
      expect(loadDraft(key)).not.toBeNull()
      clearDraft(key)
      expect(loadDraft(key)).toBeNull()
    })

    it('clearDraft sobre key inexistente no throw (idempotente)', () => {
      expect(() => clearDraft('does-not-exist')).not.toThrow()
    })
  })

  describe('edge cases varios', () => {
    it('loadDraft sobre key inexistente retorna null', () => {
      expect(loadDraft(buildDraftKey('TOKEN', 'nope'))).toBeNull()
    })

    it('parse edge: savedAt no numérico → null + removeItem', () => {
      const key = buildDraftKey('TOKEN', 'badts')
      const d = { version: 1, savedAt: 'no-numero', source: 'TOKEN', scope: 'badts', form: {}, uploads: null }
      shim.setItem(key, JSON.stringify(d))
      expect(loadDraft(key)).toBeNull()
      expect(shim.removeItem).toHaveBeenCalledWith(key)
    })
  })
})