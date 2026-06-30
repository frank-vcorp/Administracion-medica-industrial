/// <reference types="vitest/globals" />
/**
 * @file Tests unitarios puros: helpers de company.service (IMPL-20260624-01)
 * @id IMPL-20260624-01
 * @spec context/SPECs/SPEC_ARCH-20260624-01-RUTA-PUBLICA-SIN-TOKEN.md
 *
 * Cubre:
 *  - random8() retorna string de 8 chars hex/base64url-safe.
 *  - random8() es determinísticamente único (dos llamadas consecutivas distintas).
 *  - getClientIp() resuelve x-forwarded-for (primer IP) cuando está presente.
 *  - getClientIp() cae a x-real-ip si x-forwarded-for no está.
 *  - getClientIp() retorna null si no hay headers.
 *  - CompanyFullFormPayloadSchema acepta payload con channel='PUBLIC_DIRECT'
 *    y también sin channel (opcional retrocompatible).
 *
 * NO mockeamos @/lib/prisma ni next/cache. Solo next/headers para getClientIp
 * porque headers() requiere request context real.
 */

// vi, describe, it, expect están disponibles como globals gracias a
// vitest.config.ts (globals: true) + tsconfig.json (types: vitest/globals).

// Mock SOLO next/headers (headers() requiere request context real en server actions).
// NO mockeamos @/lib/prisma — los helpers testeados son puros.
vi.mock('next/headers', () => ({
  headers: vi.fn(),
}))

import { headers } from 'next/headers'
import { random8, getClientIp } from '@/services/company.service'
import { CompanyFullFormPayloadSchema } from '@/lib/schemas/company-full-form'

const mockedHeaders = vi.mocked(headers)

/** Helper para construir un mock parcial de Headers (solo .get). */
function buildHeadersMock(values: Record<string, string | null>): { get: (k: string) => string | null } {
  return {
    get: (k: string) => {
      const v = values[k]
      return v === undefined ? null : v
    },
  }
}

describe('random8 (IMPL-20260624-01)', () => {
  it('retorna un string de 8 caracteres hex/base64url', () => {
    const token = random8()
    expect(typeof token).toBe('string')
    expect(token).toHaveLength(8)
    // base64url-safe: [A-Za-z0-9_-]. En este caso, con slice(0,8) sobre 6 bytes,
    // la salida está en este alfabeto.
    expect(token).toMatch(/^[A-Za-z0-9_-]{8}$/)
  })

  it('dos llamadas consecutivas retornan strings diferentes', () => {
    const a = random8()
    const b = random8()
    expect(a).not.toBe(b)
  })
})

describe('getClientIp (IMPL-20260624-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna el primer IP de x-forwarded-for cuando hay múltiples proxies', async () => {
    mockedHeaders.mockResolvedValue(
      buildHeadersMock({ 'x-forwarded-for': '192.168.1.1, 10.0.0.1' }) as unknown as Headers
    )
    const ip = await getClientIp()
    expect(ip).toBe('192.168.1.1')
  })

  it('retorna el IP de x-real-ip cuando x-forwarded-for no está presente', async () => {
    mockedHeaders.mockResolvedValue(
      buildHeadersMock({ 'x-real-ip': '10.0.0.5' }) as unknown as Headers
    )
    const ip = await getClientIp()
    expect(ip).toBe('10.0.0.5')
  })

  it('retorna null cuando no hay headers de proxy', async () => {
    mockedHeaders.mockResolvedValue(buildHeadersMock({}) as unknown as Headers)
    const ip = await getClientIp()
    expect(ip).toBe(null)
  })
})

describe('CompanyFullFormPayloadSchema — channel (IMPL-20260624-01)', () => {
  const baseValid = {
    fiscal: {
      fecha: '2026-06-24T00:00:00.000Z',
      razonSocial: 'PUBLI SA DE CV',
      rfc: 'XAXX010101000',
      giro: 'Servicios',
      // FIX-ARCH-20260624-05: domicilio en 3 campos.
      domicilioCalle: 'Av Reforma 100',
      domicilioInterior: '',
      domicilioExterior: '',
      colonia: 'Centro',
      estado: 'Ciudad de México',
      municipio: 'Cuauhtémoc',
      pais: 'México',
      cp: '06000',
      usoCFDI: 'G03',
      metodoPago: 'PUE',
    },
    repLegal: { nombre: 'Juan', apellidos: 'Pérez', puesto: 'Dir', telefono: '5512345678', extension: '', email: 'j@x.mx' },
    rh: { nombre: 'Ana', apellidos: 'López', puesto: 'RH', telefono: '5512345679', extension: '', email: 'a@x.mx' },
    cuentasPagar: { nombre: 'C', apellidos: 'P', puesto: 'CxP', telefono: '5512345680', extension: '', email: 'c@x.mx' },
    facturacion: { correoXml: 'xml@x.mx', correoComplemento: '', procesoFacturacion: '' },
    documentos: [
      { nombre: 'c.pdf', seccion: 'constanciaFiscal', key: 'k1', fileUrl: '/api/files/k1', size: 1024, mime: 'application/pdf', extension: 'pdf' },
      { nombre: 'i.pdf', seccion: 'identificacionRepLegal', key: 'k2', fileUrl: '/api/files/k2', size: 1024, mime: 'application/pdf', extension: 'pdf' },
      { nombre: 'd.pdf', seccion: 'comprobanteDomicilio', key: 'k3', fileUrl: '/api/files/k3', size: 1024, mime: 'application/pdf', extension: 'pdf' },
      { nombre: 's.pdf', seccion: 'opinionSat', key: 'k4', fileUrl: '/api/files/k4', size: 1024, mime: 'application/pdf', extension: 'pdf' },
      { nombre: 'a.pdf', seccion: 'actaConstitutiva', key: 'k5', fileUrl: '/api/files/k5', size: 1024, mime: 'application/pdf', extension: 'pdf' },
    ],
    terminosAceptados: true,
  }

  it('acepta payload con channel=PUBLIC_DIRECT', () => {
    const parsed = CompanyFullFormPayloadSchema.safeParse({ ...baseValid, channel: 'PUBLIC_DIRECT' })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.channel).toBe('PUBLIC_DIRECT')
    }
  })

  it('acepta payload sin channel (campo opcional retrocompatible)', () => {
    const parsed = CompanyFullFormPayloadSchema.safeParse(baseValid)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.channel).toBeUndefined()
    }
  })
})
