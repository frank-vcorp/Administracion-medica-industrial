/**
 * @file Tests unitarios del helper getPublicBaseUrl.
 * @id IMPL-20260624-02 (SPEC ARCH-20260624-02)
 *
 * Cubre los 5 escenarios de la SPEC (CA-1 a CA-5):
 *  - CA-1: override manual (NEXT_PUBLIC_BASE_URL)
 *  - CA-2: dominio custom de Vercel (VERCEL_PROJECT_PRODUCTION_URL)
 *  - CA-3: fallback a VERCEL_URL (preview *.vercel.app)
 *  - CA-4: dev sin env vars (localhost:3000)
 *  - CA-5: nunca retorna string con trailing slash
 *
 * No se mockea process.env. Se pasa un env literal determinista al helper.
 */
import { describe, it, expect } from 'vitest'
import { getPublicBaseUrl } from './public-base-url'

describe('getPublicBaseUrl', () => {
  it('CA-1: retorna NEXT_PUBLIC_BASE_URL cuando está definida', () => {
    expect(
      getPublicBaseUrl({ NEXT_PUBLIC_BASE_URL: 'https://mi-dominio.com' })
    ).toBe('https://mi-dominio.com')
  })

  it('CA-2: retorna VERCEL_PROJECT_PRODUCTION_URL cuando no hay override y hay dominio custom', () => {
    expect(
      getPublicBaseUrl({
        VERCEL_PROJECT_PRODUCTION_URL:
          'https://administracion-medica-industrial.vercel.app',
      })
    ).toBe('https://administracion-medica-industrial.vercel.app')
  })

  it('CA-3: retorna VERCEL_URL cuando no hay override ni dominio custom', () => {
    expect(
      getPublicBaseUrl({ VERCEL_URL: 'https://ami-git-main.vercel.app' })
    ).toBe('https://ami-git-main.vercel.app')
  })

  it('CA-4: retorna http://localhost:3000 en dev sin env vars', () => {
    expect(getPublicBaseUrl({})).toBe('http://localhost:3000')
  })

  it('CA-5: nunca retorna string con trailing slash (override con /)', () => {
    expect(
      getPublicBaseUrl({ NEXT_PUBLIC_BASE_URL: 'https://mi-dominio.com/' })
    ).toBe('https://mi-dominio.com')
  })

  it('CA-5b: nunca retorna string con trailing slash (vercel con /)', () => {
    expect(
      getPublicBaseUrl({ VERCEL_URL: 'https://foo.vercel.app/' })
    ).toBe('https://foo.vercel.app')
  })

  it('jerarquía: NEXT_PUBLIC_BASE_URL gana sobre VERCEL_*', () => {
    expect(
      getPublicBaseUrl({
        NEXT_PUBLIC_BASE_URL: 'https://override.com',
        VERCEL_PROJECT_PRODUCTION_URL: 'https://prod.vercel.app',
        VERCEL_URL: 'https://preview.vercel.app',
      })
    ).toBe('https://override.com')
  })

  it('jerarquía: VERCEL_PROJECT_PRODUCTION_URL gana sobre VERCEL_URL', () => {
    expect(
      getPublicBaseUrl({
        VERCEL_PROJECT_PRODUCTION_URL: 'https://prod.vercel.app',
        VERCEL_URL: 'https://preview.vercel.app',
      })
    ).toBe('https://prod.vercel.app')
  })

  it('strings vacías se tratan como ausentes y cae al siguiente nivel', () => {
    expect(
      getPublicBaseUrl({
        NEXT_PUBLIC_BASE_URL: '',
        VERCEL_PROJECT_PRODUCTION_URL: '',
        VERCEL_URL: 'https://fallback.vercel.app',
      })
    ).toBe('https://fallback.vercel.app')
  })
})
