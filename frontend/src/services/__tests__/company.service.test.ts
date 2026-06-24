/**
 * @file Tests unitarios puros: helpers CompanyService.
 * @id IMPL-20260623-03
 *
 * Cubre:
 *  - hashToken("test") retorna string hex de 64 chars
 *  - hashToken es determinístico
 *  - generateSelfRegToken genera pares plano/hash con hash determinístico
 *
 * No se mockea Prisma. Solo funciones puras exportadas de company.service.
 * Si Vitest no está instalado, `pnpm test` fallará; la instalación queda
 * como tarea de INTEGRA (ver self-review).
 */
import { describe, it, expect } from 'vitest'
import { hashToken, generateSelfRegToken } from '@/services/company.service'

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
