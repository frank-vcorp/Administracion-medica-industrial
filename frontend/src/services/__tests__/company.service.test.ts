/**
 * @file Tests unitarios puros: helpers CompanyService.
 * @id IMPL-20260623-03 / IMPL-20260624-02
 *
 * Cubre:
 *  - hashToken("test") retorna string hex de 64 chars
 *  - hashToken es determinístico
 *  - generateSelfRegToken genera pares plano/hash con hash determinístico
 *  - generateCompanySelfRegLink retorna URL con ?ref=<userId> cuando hay sesión (CA-6)
 *  - generateCompanySelfRegLink retorna URL sin ?ref= cuando createdByUserId es null (CA-7)
 *  - generateCompanySelfRegLink persiste createdByUserId en CompanySelfRegistration (CA-8)
 *  - generateCompanySelfRegLink usa getPublicBaseUrl() como base (no localhost hardcoded)
 *
 * Para los tests de generateCompanySelfRegLink se mockea @/lib/prisma y
 * @/lib/env/public-base-url para mantener determinismo sin tocar process.env.
 */
/// <reference types="vitest/globals" />

// Mock de prisma: intercepta companySelfRegistration.create.
vi.mock('@/lib/prisma', () => {
  const create = vi.fn()
  return {
    default: {
      companySelfRegistration: { create },
    },
  }
})

// Mock del helper de URL base: retorna un valor conocido y testeable.
vi.mock('@/lib/env/public-base-url', () => ({
  getPublicBaseUrl: vi.fn(() => 'https://test.vercel.app'),
}))

// vi, describe, it, expect, beforeEach están disponibles como globals
// gracias a vitest.config.ts (globals: true) + tsconfig.json (types: vitest/globals).

import prisma from '@/lib/prisma'
import { getPublicBaseUrl } from '@/lib/env/public-base-url'
import {
  hashToken,
  generateSelfRegToken,
  generateCompanySelfRegLink,
} from '@/services/company.service'

describe('hashToken (puro)', () => {
  it('retorna string de 64 caracteres hexadecimales', () => {
    const h = hashToken('test')
    expect(typeof h).toBe('string')
    expect(h).toHaveLength(64)
    expect(/^[0-9a-f]{64}$/.test(h)).toBe(true)
  })

  it('es determinístico: misma entrada → mismo hash', () => {
    expect(hashToken('test')).toBe(hashToken('test'))
    expect(hashToken('abc-123')).toBe(hashToken('abc-123'))
  })

  it('entradas distintas → hashes distintos', () => {
    expect(hashToken('a')).not.toBe(hashToken('b'))
  })

  it('produce SHA-256 esperado para "test" (vector canónico)', () => {
    // SHA-256("test") = 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
    expect(hashToken('test')).toBe(
      '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
    )
  })
})

describe('generateSelfRegToken (puro, no DB)', () => {
  it('genera plain distinto y hash determinístico derivado del plain', () => {
    const a = generateSelfRegToken()
    const b = generateSelfRegToken()
    expect(a.plain).not.toBe(b.plain)
    expect(a.hash).toBe(hashToken(a.plain))
    expect(b.hash).toBe(hashToken(b.plain))
  })

  it('plain tiene forma base64url sin padding (entropía operativa)', () => {
    const a = generateSelfRegToken()
    // base64url: 43 chars sin padding; randomBytes(32).toString('base64url') = 43 chars
    expect(a.plain.length).toBeGreaterThanOrEqual(40)
    expect(/^[A-Za-z0-9_-]+$/.test(a.plain)).toBe(true)
  })
})

/**
 * IMPL-20260624-02 (SPEC ARCH-20260624-02): tests del formato de URL
 * retornado por generateCompanySelfRegLink.
 * Se mockea prisma y getPublicBaseUrl para mantener determinismo.
 */
describe('generateCompanySelfRegLink — formato de URL (ARCH-20260624-02)', () => {
  const mockedCreate = vi.mocked(prisma.companySelfRegistration.create)
  const mockedGetBase = vi.mocked(getPublicBaseUrl)

  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetBase.mockReturnValue('https://test.vercel.app')
    mockedCreate.mockResolvedValue({
      id: 'reg_fake_id',
      // Otros campos del modelo no son leídos por generateCompanySelfRegLink.
    } as never)
  })

  it('CA-6: retorna URL con ?ref=<userId> cuando createdByUserId está presente', async () => {
    const result = await generateCompanySelfRegLink('user_abc123')
    expect(result.url).toMatch(
      /^https:\/\/test\.vercel\.app\/auto-alta\/[A-Za-z0-9_-]+\?ref=user_abc123$/
    )
  })

  it('CA-6b: encodea caracteres especiales del userId con encodeURIComponent', async () => {
    const result = await generateCompanySelfRegLink('user/with spaces&symbols')
    expect(result.url).toContain('?ref=user%2Fwith%20spaces%26symbols')
  })

  it('CA-7: retorna URL sin ?ref= cuando createdByUserId es null', async () => {
    const result = await generateCompanySelfRegLink(null)
    expect(result.url).toMatch(/^https:\/\/test\.vercel\.app\/auto-alta\/[A-Za-z0-9_-]+$/)
    expect(result.url).not.toContain('?ref=')
  })

  it('CA-7b: retorna URL sin ?ref= cuando createdByUserId es undefined', async () => {
    const result = await generateCompanySelfRegLink(undefined)
    expect(result.url).not.toContain('?ref=')
  })

  it('CA-8: persiste createdByUserId en CompanySelfRegistration (regresión)', async () => {
    await generateCompanySelfRegLink('user_abc123')
    expect(mockedCreate.mock.calls.length).toBe(1)
    const callArg = mockedCreate.mock.calls[0][0]
    expect(callArg.data.createdByUserId).toBe('user_abc123')
  })

  it('CA-8b: persiste createdByUserId como null cuando no se pasa', async () => {
    await generateCompanySelfRegLink(null)
    const callArg = mockedCreate.mock.calls[0][0]
    expect(callArg.data.createdByUserId).toBe(null)
  })

  it('usa getPublicBaseUrl() como base del URL (no localhost hardcoded)', async () => {
    mockedGetBase.mockReturnValue('https://otro-dominio.example.com')
    const result = await generateCompanySelfRegLink('user_abc')
    expect(result.url.startsWith('https://otro-dominio.example.com/auto-alta/')).toBe(true)
    expect(mockedGetBase.mock.calls.length).toBe(1)
  })
})
