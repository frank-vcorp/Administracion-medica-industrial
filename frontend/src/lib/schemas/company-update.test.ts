/**
 * @file Tests unitarios: schemas Zod de company-update (ARCH-20260624-03).
 * @id IMPL-20260624-03
 *
 * Cubre:
 *  - updateCompanyBasicSchema acepta name/rfc válidos.
 *  - updateCompanyBasicSchema rechaza RFC con formato inválido.
 *  - updateCompanyBasicSchema acepta RFC null.
 *  - updateFiscalSchema rechaza CP con formato inválido.
 *  - updateCompanySchema rechaza payload sin expectedUpdatedAt.
 *  - updateCompanySchema acepta payload completo con todas las secciones.
 *  - updateCompanySchema rechaza payload vacío (sin secciones).
 *  - updateRepLegalSchema rechaza email inválido.
 */
/// <reference types="vitest/globals" />

import {
  updateCompanyBasicSchema,
  updateCompanySchema,
  updateFiscalSchema,
  updateRepLegalSchema,
  RFC_REGEX,
  CP_REGEX,
} from '@/lib/schemas/company-update'

describe('RFC_REGEX / CP_REGEX (helpers)', () => {
  it('RFC_REGEX acepta RFCs válidos de 12 y 13 caracteres', () => {
    expect(RFC_REGEX.test('XAXX010101000')).toBe(true)
    expect(RFC_REGEX.test('ABC010101XYZ')).toBe(true)
  })

  it('RFC_REGEX rechaza RFCs con formato inválido', () => {
    expect(RFC_REGEX.test('XAXX01010100')).toBe(false) // muy corto
    expect(RFC_REGEX.test('XAXX0101010000')).toBe(false) // muy largo
    expect(RFC_REGEX.test('123456789012')).toBe(false) // empieza con dígitos
    expect(RFC_REGEX.test('xaXX010101000')).toBe(false) // minúscula
    expect(RFC_REGEX.test('')).toBe(false)
  })

  it('CP_REGEX acepta CPs de 5 dígitos', () => {
    expect(CP_REGEX.test('06000')).toBe(true)
    expect(CP_REGEX.test('12345')).toBe(true)
  })

  it('CP_REGEX rechaza CPs con formato inválido', () => {
    expect(CP_REGEX.test('1234')).toBe(false)
    expect(CP_REGEX.test('123456')).toBe(false)
    expect(CP_REGEX.test('1234A')).toBe(false)
    expect(CP_REGEX.test('')).toBe(false)
  })
})

describe('updateCompanyBasicSchema', () => {
  it('acepta name y RFC válidos', () => {
    const r = updateCompanyBasicSchema.safeParse({
      name: 'ACME SA DE CV',
      rfc: 'XAXX010101000',
    })
    expect(r.success).toBe(true)
  })

  it('acepta RFC null (empresas sin RFC capturado)', () => {
    const r = updateCompanyBasicSchema.safeParse({
      name: 'ACME SA DE CV',
      rfc: null,
    })
    expect(r.success).toBe(true)
  })

  it('acepta RFC undefined (no se incluye en payload)', () => {
    const r = updateCompanyBasicSchema.safeParse({
      name: 'ACME SA DE CV',
    })
    expect(r.success).toBe(true)
  })

  it('rechaza RFC con formato inválido', () => {
    const r = updateCompanyBasicSchema.safeParse({
      name: 'ACME',
      rfc: 'INVALIDO',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('rfc'))).toBe(true)
    }
  })

  it('rechaza name vacío', () => {
    const r = updateCompanyBasicSchema.safeParse({
      name: '',
      rfc: 'XAXX010101000',
    })
    expect(r.success).toBe(false)
  })

  it('rechaza email inválido', () => {
    const r = updateCompanyBasicSchema.safeParse({
      name: 'ACME',
      email: 'no-es-email',
    })
    expect(r.success).toBe(false)
  })

  it('rechaza phone con menos de 7 caracteres', () => {
    const r = updateCompanyBasicSchema.safeParse({
      name: 'ACME',
      phone: '12345',
    })
    expect(r.success).toBe(false)
  })
})

describe('updateFiscalSchema', () => {
  const validFiscal = {
    fecha: '2026-06-24T00:00:00.000Z',
    razonSocial: 'ACME SA DE CV',
    rfc: 'XAXX010101000',
    giro: 'Industrial',
    domicilio: 'Av Reforma 100',
    colonia: 'Centro',
    estado: 'Ciudad de México',
    municipio: 'Cuauhtémoc',
    pais: 'México',
    cp: '06000',
    usoCFDI: 'G03',
    metodoPago: 'PUE',
  }

  it('acepta datos fiscales válidos', () => {
    const r = updateFiscalSchema.safeParse(validFiscal)
    expect(r.success).toBe(true)
  })

  it('rechaza CP con 6 dígitos', () => {
    const r = updateFiscalSchema.safeParse({ ...validFiscal, cp: '060000' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('cp'))).toBe(true)
    }
  })

  it('rechaza CP con caracteres no numéricos', () => {
    const r = updateFiscalSchema.safeParse({ ...validFiscal, cp: '1234A' })
    expect(r.success).toBe(false)
  })

  it('rechaza CP vacío', () => {
    const r = updateFiscalSchema.safeParse({ ...validFiscal, cp: '' })
    expect(r.success).toBe(false)
  })

  it('rechaza usoCFDI fuera del catálogo', () => {
    const r = updateFiscalSchema.safeParse({ ...validFiscal, usoCFDI: 'INVALID' })
    expect(r.success).toBe(false)
  })

  it('rechaza metodoPago fuera del catálogo', () => {
    const r = updateFiscalSchema.safeParse({ ...validFiscal, metodoPago: 'XYZ' })
    expect(r.success).toBe(false)
  })
})

describe('updateRepLegalSchema', () => {
  const validRepLegal = {
    nombre: 'Juan',
    apellidos: 'Pérez',
    puesto: 'Director',
    telefono: '5512345678',
    extension: '',
    email: 'juan@acme.mx',
  }

  it('acepta representante legal válido', () => {
    const r = updateRepLegalSchema.safeParse(validRepLegal)
    expect(r.success).toBe(true)
  })

  it('rechaza email inválido', () => {
    const r = updateRepLegalSchema.safeParse({ ...validRepLegal, email: 'no-email' })
    expect(r.success).toBe(false)
  })

  it('rechaza teléfono con menos de 7 caracteres', () => {
    const r = updateRepLegalSchema.safeParse({ ...validRepLegal, telefono: '12345' })
    expect(r.success).toBe(false)
  })

  it('rechaza nombre vacío', () => {
    const r = updateRepLegalSchema.safeParse({ ...validRepLegal, nombre: '' })
    expect(r.success).toBe(false)
  })
})

describe('updateCompanySchema (consolidado)', () => {
  const validUpdatedAt = '2026-06-24T16:00:00.000Z'

  it('rechaza payload sin expectedUpdatedAt', () => {
    const r = updateCompanySchema.safeParse({
      basic: { name: 'ACME' },
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('expectedUpdatedAt'))).toBe(true)
    }
  })

  it('rechaza expectedUpdatedAt que no es ISO 8601', () => {
    const r = updateCompanySchema.safeParse({
      expectedUpdatedAt: 'ayer',
      basic: { name: 'ACME' },
    })
    expect(r.success).toBe(false)
  })

  it('acepta payload mínimo (solo basic + expectedUpdatedAt)', () => {
    const r = updateCompanySchema.safeParse({
      expectedUpdatedAt: validUpdatedAt,
      basic: { name: 'ACME SA DE CV' },
    })
    expect(r.success).toBe(true)
  })

  it('acepta payload completo con todas las secciones', () => {
    const r = updateCompanySchema.safeParse({
      expectedUpdatedAt: validUpdatedAt,
      basic: {
        name: 'ACME SA DE CV',
        rfc: 'XAXX010101000',
        contactName: 'Juan Pérez',
        email: 'j@acme.mx',
        phone: '5512345678',
      },
      fiscalData: {
        fecha: '2026-06-24T00:00:00.000Z',
        razonSocial: 'ACME SA DE CV',
        rfc: 'XAXX010101000',
        giro: 'Industrial',
        domicilio: 'Av Reforma 100',
        colonia: 'Centro',
        estado: 'Ciudad de México',
        municipio: 'Cuauhtémoc',
        pais: 'México',
        cp: '06000',
        usoCFDI: 'G03',
        metodoPago: 'PUE',
      },
      repLegalData: {
        nombre: 'Juan',
        apellidos: 'Pérez',
        puesto: 'Director',
        telefono: '5512345678',
        extension: '',
        email: 'j@acme.mx',
      },
      rhData: {
        nombre: 'Ana',
        apellidos: 'López',
        puesto: 'RH',
        telefono: '5512345679',
        extension: '',
        email: 'a@acme.mx',
      },
      cuentasPagarData: {
        nombre: 'Carlos',
        apellidos: 'Ruiz',
        puesto: 'CxP',
        telefono: '5512345680',
        extension: '',
        email: 'c@acme.mx',
      },
    })
    expect(r.success).toBe(true)
  })

  it('rechaza payload vacío (sin secciones editables)', () => {
    const r = updateCompanySchema.safeParse({
      expectedUpdatedAt: validUpdatedAt,
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message.includes('al menos una sección'))).toBe(true)
    }
  })

  it('rechaza basic sin name (campo requerido dentro del partial)', () => {
    const r = updateCompanySchema.safeParse({
      expectedUpdatedAt: validUpdatedAt,
      basic: { name: '' },
    })
    expect(r.success).toBe(false)
  })

  it('rechaza basic con RFC inválido', () => {
    const r = updateCompanySchema.safeParse({
      expectedUpdatedAt: validUpdatedAt,
      basic: { name: 'ACME', rfc: 'INVALIDO' },
    })
    expect(r.success).toBe(false)
  })

  it('acepta referenciasData como array de hasta 3 elementos', () => {
    const r = updateCompanySchema.safeParse({
      expectedUpdatedAt: validUpdatedAt,
      referenciasData: [
        { nombre: 'Ref 1', rfc: 'XAXX010101000', telefono: '5511111111' },
        { nombre: 'Ref 2', telefono: '5522222222' },
      ],
    })
    expect(r.success).toBe(true)
  })

  it('rechaza referenciasData con más de 3 elementos', () => {
    const r = updateCompanySchema.safeParse({
      expectedUpdatedAt: validUpdatedAt,
      referenciasData: [
        { nombre: 'Ref 1' },
        { nombre: 'Ref 2' },
        { nombre: 'Ref 3' },
        { nombre: 'Ref 4' },
      ],
    })
    expect(r.success).toBe(false)
  })
})