/**
 * @file Tests unitarios puros: helpers CompanyService.
 * @id IMPL-20260623-03 / IMPL-20260624-02 / IMPL-20260624-03
 * @backup context/SPECs/SPEC_ARCH-20260624-03-EDICION-DATOS-COMPLETOS-EMPRESA.md
 *
 * Cubre:
 *  - hashToken("test") retorna string hex de 64 chars
 *  - hashToken es determinístico
 *  - generateSelfRegToken genera pares plano/hash con hash determinístico
 *  - generateCompanySelfRegLink retorna URL con ?ref=<userId> cuando hay sesión (CA-6)
 *  - generateCompanySelfRegLink retorna URL sin ?ref= cuando createdByUserId es null (CA-7)
 *  - generateCompanySelfRegLink persiste createdByUserId en CompanySelfRegistration (CA-8)
 *  - generateCompanySelfRegLink usa getPublicBaseUrl() como base (no localhost hardcoded)
 *  - generateCompanySelfRegLink con targetCompanyId (Sub-A):
 *    * persiste channel='COMPANY_UPDATE' y targetCompanyId
 *    * retorna channel y targetCompanyId
 *    * lanza TARGET_COMPANY_NOT_FOUND si la Company no existe
 *    * lanza TARGET_COMPANY_PENDING si la Company está en PENDIENTE_REVISION
 *  - computeChanges (helper de auditoría) detecta diffs y respeta ignoreKeys
 *
 * Para los tests de generateCompanySelfRegLink se mockea @/lib/prisma y
 * @/lib/env/public-base-url para mantener determinismo sin tocar process.env.
 */
/// <reference types="vitest/globals" />

// Mock de prisma: intercepta companySelfRegistration.create, company.findUnique, etc.
// FIX-20260730-01: generateCompanySelfRegLink ahora también usa prisma.user.findUnique
// para defender contra sesión huérfana — añadido al mock para que la búsqueda de
// usuario no lance TypeError.
vi.mock('@/lib/prisma', () => {
  const create = vi.fn()
  const findUnique = vi.fn()
  const userFindUnique = vi.fn().mockResolvedValue({ id: 'mock' }) // FIX-20260730-01: default → usuario existe
  return {
    default: {
      companySelfRegistration: { create },
      company: { findUnique },
      user: { findUnique: userFindUnique },
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
  computeChanges,
} from '@/services/company.service'
import { CompanyStatus } from '@prisma/client'

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

/**
 * IMPL-20260624-03 (ARCH-20260624-03) Sub-A: tests del nuevo path
 * "link externo para completar datos de empresa existente".
 *
 * Se mockea prisma.companySelfRegistration.create (que recibe channel y
 * targetCompanyId) y prisma.company.findUnique (que valida la Company target).
 */
describe('generateCompanySelfRegLink — targetCompanyId (ARCH-20260624-03 Sub-A)', () => {
  const mockedCreate = vi.mocked(prisma.companySelfRegistration.create)
  const mockedCompanyFindUnique = vi.mocked(prisma.company.findUnique)
  const mockedGetBase = vi.mocked(getPublicBaseUrl)

  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetBase.mockReturnValue('https://test.vercel.app')
    mockedCreate.mockResolvedValue({ id: 'reg_fake_id' } as never)
    mockedCompanyFindUnique.mockResolvedValue({
      id: 'company_123',
      estado: CompanyStatus.HABILITADO,
    } as never)
  })

  it('CA-A1: persiste channel=COMPANY_UPDATE y targetCompanyId cuando se pasan en options', async () => {
    const result = await generateCompanySelfRegLink('user_admin', {
      targetCompanyId: 'company_123',
      ttlHours: 168,
    })
    expect(mockedCreate.mock.calls.length).toBe(1)
    const callArg = mockedCreate.mock.calls[0][0]
    expect(callArg.data.channel).toBe('COMPANY_UPDATE')
    expect(callArg.data.targetCompanyId).toBe('company_123')
    expect(callArg.data.createdByUserId).toBe('user_admin')
    // Validar también la respuesta
    expect(result.channel).toBe('COMPANY_UPDATE')
    expect(result.targetCompanyId).toBe('company_123')
  })

  it('CA-A1b: URL resultante tiene ?ref=<userId> cuando createdByUserId está presente', async () => {
    const result = await generateCompanySelfRegLink('user_admin', {
      targetCompanyId: 'company_123',
    })
    expect(result.url).toMatch(/\?ref=user_admin$/)
  })

  it('CA-A1c: valida que la Company existe (findUnique llamado)', async () => {
    await generateCompanySelfRegLink('user_admin', { targetCompanyId: 'company_123' })
    expect(mockedCompanyFindUnique.mock.calls.length).toBe(1)
    expect(mockedCompanyFindUnique.mock.calls[0][0]).toEqual({
      where: { id: 'company_123' },
      select: { id: true, estado: true },
    })
  })

  it('CA-A2: rechaza con TARGET_COMPANY_NOT_FOUND si la Company no existe', async () => {
    mockedCompanyFindUnique.mockResolvedValueOnce(null)
    let caught: unknown = null
    try {
      await generateCompanySelfRegLink('user_admin', { targetCompanyId: 'company_fake' })
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toBe('TARGET_COMPANY_NOT_FOUND')
    // El create NO debe haberse llamado porque la validación falla primero.
    expect(mockedCreate.mock.calls.length).toBe(0)
  })

  it('CA-A2b: rechaza con TARGET_COMPANY_PENDING si la Company está en PENDIENTE_REVISION', async () => {
    mockedCompanyFindUnique.mockResolvedValueOnce({
      id: 'company_pend',
      estado: CompanyStatus.PENDIENTE_REVISION,
    } as never)
    let caught: unknown = null
    try {
      await generateCompanySelfRegLink('user_admin', { targetCompanyId: 'company_pend' })
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toBe('TARGET_COMPANY_PENDING')
    expect(mockedCreate.mock.calls.length).toBe(0)
  })

  it('compat: firma legacy (segundo arg = number) sigue funcionando como ttlHours', async () => {
    const result = await generateCompanySelfRegLink('user_admin', 48)
    expect(result.channel).toBe('VENDOR_LINK')
    expect(result.targetCompanyId).toBeUndefined()
    const callArg = mockedCreate.mock.calls[0][0]
    expect(callArg.data.channel).toBe('VENDOR_LINK')
    expect(callArg.data.targetCompanyId).toBe(null)
  })
})

/**
 * IMPL-20260624-03 (ARCH-20260624-03): tests del helper computeChanges.
 * Helper puro (sin DB) usado por updateCompanyFull y la rama UPDATE de
 * submitCompanySelfRegistrationCore para generar el diff before→after del AuditLog.
 */
describe('computeChanges (ARCH-20260624-03)', () => {
  it('detecta cambio simple de string', () => {
    const changes = computeChanges(
      { name: 'ACME', rfc: 'XAXX010101000' },
      { name: 'ACME SA DE CV', rfc: 'XAXX010101000' }
    )
    expect(changes).toHaveLength(1)
    expect(changes[0].field).toBe('name')
    expect(changes[0].before).toBe('ACME')
    expect(changes[0].after).toBe('ACME SA DE CV')
  })

  it('ignora campos no cambiados', () => {
    const changes = computeChanges(
      { name: 'ACME', rfc: 'XAXX010101000' },
      { name: 'ACME', rfc: 'XAXX010101000' }
    )
    expect(changes).toHaveLength(0)
  })

  it('ignora campos updatedAt y createdAt (los maneja Prisma)', () => {
    const changes = computeChanges(
      { name: 'ACME', updatedAt: new Date('2026-01-01'), createdAt: new Date('2025-01-01') },
      { name: 'ACME', updatedAt: new Date('2026-06-01'), createdAt: new Date('2025-01-01') }
    )
    expect(changes).toHaveLength(0)
  })

  it('detecta cambios en objetos Json (fiscalData, etc.) via JSON.stringify', () => {
    const changes = computeChanges(
      { fiscalData: { rfc: 'XAXX010101000', cp: '06000' } },
      { fiscalData: { rfc: 'XAXX010101000', cp: '06600' } }
    )
    expect(changes).toHaveLength(1)
    expect(changes[0].field).toBe('fiscalData')
  })

  it('respeta ignoreKeys custom', () => {
    const changes = computeChanges(
      { name: 'ACME', internalCounter: 1 },
      { name: 'ACME', internalCounter: 2 },
      { ignoreKeys: ['internalCounter'] }
    )
    expect(changes).toHaveLength(0)
  })

  it('compara Date correctamente con ISO toString', () => {
    const d1 = new Date('2026-01-01T00:00:00.000Z')
    const d2 = new Date('2026-01-01T00:00:00.000Z')
    const d3 = new Date('2026-06-01T00:00:00.000Z')
    expect(computeChanges({ x: d1 }, { x: d2 })).toHaveLength(0)
    expect(computeChanges({ x: d1 }, { x: d3 })).toHaveLength(1)
  })
})
