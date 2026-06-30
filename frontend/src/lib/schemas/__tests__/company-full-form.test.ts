/**
 * @file Tests unitarios puros: Zod schemas Ficha Cliente v2.
 * @id IMPL-20260623-03
 * @spec context/SPECs/SPEC_ARCH-20260623-03-CLIENTE-V2-VENDEDOR-HISTORIAL-LINK-PUBLICO.md
 *
 * Cubre los 7 casos de borde mínimos listados en la SPEC:
 *  - RFC válido mexicano
 *  - RFC con caracteres especiales → falla
 *  - CP no 5 dígitos → falla
 *  - Email inválido → falla
 *  - terminosAceptados = false → falla
 *  - Payload completo válido → pasa
 *  - Archivo > 10 MB → falla
 *
 * No se mockea Prisma. Solo se validan funciones puras (Zod).
 */
import { describe, it, expect } from 'vitest'
import {
  CompanyFullFormPayloadSchema,
  MAX_FILE_SIZE_10MB,
  CFDI_USO_VALUES,
  type CompanyFullFormPayload,
} from '@/lib/schemas/company-full-form'

function buildValidPayload(): CompanyFullFormPayload {
  return {
    fiscal: {
      fecha: '2026-06-23T00:00:00.000Z',
      razonSocial: 'ACME SA DE CV',
      rfc: 'XAXX010101000',
      giro: 'Industrial',
      // FIX-ARCH-20260624-05: domicilio en 3 campos.
      domicilioCalle: 'Av Reforma 123',
      domicilioInterior: '4',
      domicilioExterior: '',
      colonia: 'Centro',
      estado: 'Ciudad de México',
      municipio: 'Cuauhtémoc',
      pais: 'México',
      cp: '06000',
      usoCFDI: 'G03',
      metodoPago: 'PUE',
    },
    repLegal: {
      nombre: 'Juan',
      apellidos: 'Pérez',
      puesto: 'Director',
      telefono: '5512345678',
      extension: '',
      email: 'juan@acme.mx',
    },
    rh: {
      nombre: 'Ana',
      apellidos: 'López',
      puesto: 'Jefe RH',
      telefono: '5512345679',
      extension: '',
      email: 'ana@acme.mx',
    },
    cuentasPagar: {
      nombre: 'Carlos',
      apellidos: 'Ruiz',
      puesto: 'Tesorero',
      telefono: '5512345680',
      extension: '',
      email: 'carlos@acme.mx',
    },
    facturacion: {
      correoXml: 'xml@acme.mx',
      correoComplemento: '',
      procesoFacturacion: '',
    },
    documentos: [
      { nombre: 'constancia.pdf', seccion: 'constanciaFiscal', key: 'k1', fileUrl: '/api/files/k1', size: 1024, mime: 'application/pdf', extension: 'pdf' },
      { nombre: 'ine.pdf', seccion: 'identificacionRepLegal', key: 'k2', fileUrl: '/api/files/k2', size: 1024, mime: 'application/pdf', extension: 'pdf' },
      { nombre: 'comprobante.pdf', seccion: 'comprobanteDomicilio', key: 'k3', fileUrl: '/api/files/k3', size: 1024, mime: 'application/pdf', extension: 'pdf' },
      { nombre: 'opinion.pdf', seccion: 'opinionSat', key: 'k4', fileUrl: '/api/files/k4', size: 1024, mime: 'application/pdf', extension: 'pdf' },
      { nombre: 'acta.pdf', seccion: 'actaConstitutiva', key: 'k5', fileUrl: '/api/files/k5', size: 1024, mime: 'application/pdf', extension: 'pdf' },
    ],
    terminosAceptados: true,
  }
}

describe('FiscalSchema — RFC y CP', () => {
  it('acepta RFC genérico SAT XAXX010101000', () => {
    const payload = buildValidPayload()
    const r = CompanyFullFormPayloadSchema.safeParse(payload)
    expect(r.success).toBe(true)
  })

  it('rechaza RFC con @', () => {
    const payload = buildValidPayload()
    payload.fiscal.rfc = 'XAX@010101000'
    const r = CompanyFullFormPayloadSchema.safeParse(payload)
    expect(r.success).toBe(false)
    if (!r.success) {
      const rfcErr = r.error.issues.find((e: { path: PropertyKey[] }) => e.path.includes('rfc'))
      expect(rfcErr).toBeDefined()
    }
  })

  it('rechaza CP no 5 dígitos', () => {
    const payload = buildValidPayload()
    payload.fiscal.cp = '1234'
    const r = CompanyFullFormPayloadSchema.safeParse(payload)
    expect(r.success).toBe(false)
    if (!r.success) {
      const cpErr = r.error.issues.find((e: { path: PropertyKey[] }) => e.path.includes('cp'))
      expect(cpErr).toBeDefined()
    }
  })
})

describe('PersonaContactoSchema — email inválido', () => {
  it('rechaza email no-es-email en repLegal', () => {
    const payload = buildValidPayload()
    payload.repLegal.email = 'no-es-email'
    const r = CompanyFullFormPayloadSchema.safeParse(payload)
    expect(r.success).toBe(false)
    if (!r.success) {
      const emailErr = r.error.issues.find((e: { path: PropertyKey[] }) => e.path.join('.').includes('repLegal.email'))
      expect(emailErr).toBeDefined()
    }
  })
})

describe('CompanyFullFormPayloadSchema — terminosAceptados', () => {
  it('rechaza terminosAceptados = false (debe ser literal true)', () => {
    const payload = { ...buildValidPayload(), terminosAceptados: false as unknown as true }
    const r = CompanyFullFormPayloadSchema.safeParse(payload)
    expect(r.success).toBe(false)
    if (!r.success) {
      const termErr = r.error.issues.find((e: { path: PropertyKey[] }) => e.path.includes('terminosAceptados'))
      expect(termErr).toBeDefined()
      expect(termErr?.message).toMatch(/t[ée]rminos/i)
    }
  })
})

describe('CompanyFullFormPayloadSchema — payload completo válido', () => {
  it('pasa con todos los campos requeridos correctos', () => {
    const r = CompanyFullFormPayloadSchema.safeParse(buildValidPayload())
    expect(r.success).toBe(true)
  })

  it('incluye al menos un subconjunto de claves CFDI_USO_VALUES', () => {
    expect(CFDI_USO_VALUES).toContain('G03')
    expect(CFDI_USO_VALUES).toContain('P01')
  })
})

describe('DocumentoAdjuntoSchema — tamaño máximo', () => {
  it('rechaza archivo > 10 MB', () => {
    const payload = buildValidPayload()
    payload.documentos[4] = {
      nombre: 'acta.pdf',
      seccion: 'actaConstitutiva',
      key: 'k5',
      fileUrl: '/api/files/k5',
      size: MAX_FILE_SIZE_10MB + 1, // 10 MB + 1 byte
      mime: 'application/pdf',
      extension: 'pdf',
    }
    const r = CompanyFullFormPayloadSchema.safeParse(payload)
    expect(r.success).toBe(false)
    if (!r.success) {
      const sizeErr = r.error.issues.find((e: { path: PropertyKey[] }) => e.path.includes('size'))
      expect(sizeErr).toBeDefined()
    }
  })

  it('rechaza menos de 5 documentos', () => {
    const payload = buildValidPayload()
    payload.documentos = payload.documentos.slice(0, 4)
    const r = CompanyFullFormPayloadSchema.safeParse(payload)
    expect(r.success).toBe(false)
    if (!r.success) {
      const minErr = r.error.issues.find((e: { path: PropertyKey[] }) => e.path.includes('documentos'))
      expect(minErr).toBeDefined()
    }
  })
})

/**
 * FIX-ARCH-20260624-05: cobertura de los 3 campos alineados con medicaindustrial.com.
 */
describe('FIX-ARCH-20260624-05 — domicilio calle/int/ext', () => {
  it('acepta payload con domicilioCalle + domicilioInterior + domicilioExterior', () => {
    const payload = buildValidPayload()
    payload.fiscal.domicilioCalle = 'Av. Industrias 1234'
    payload.fiscal.domicilioInterior = '5'
    payload.fiscal.domicilioExterior = 'B'
    const r = CompanyFullFormPayloadSchema.safeParse(payload)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.fiscal.domicilioCalle).toBe('Av. Industrias 1234')
      expect(r.data.fiscal.domicilioInterior).toBe('5')
      expect(r.data.fiscal.domicilioExterior).toBe('B')
    }
  })

  it('rechaza payload sin domicilioCalle (campo requerido)', () => {
    const payload = buildValidPayload()
    delete (payload.fiscal as Record<string, unknown>).domicilioCalle
    const r = CompanyFullFormPayloadSchema.safeParse(payload)
    expect(r.success).toBe(false)
    if (!r.success) {
      const calleErr = r.error.issues.find((e) => e.path.includes('domicilioCalle'))
      expect(calleErr).toBeDefined()
    }
  })

  it('acepta domicilioCalle sin int/ext (opcionales)', () => {
    const payload = buildValidPayload()
    payload.fiscal.domicilioCalle = 'Av. Reforma 100'
    payload.fiscal.domicilioInterior = ''
    payload.fiscal.domicilioExterior = undefined
    const r = CompanyFullFormPayloadSchema.safeParse(payload)
    expect(r.success).toBe(true)
  })

  it('backwards-compat: acepta payload viejo con `domicilio: string` y lo migra a domicilioCalle', () => {
    const payload = buildValidPayload()
    const legacy = { ...payload.fiscal, domicilio: 'Av. Industrias 1234 Int. 5' } as unknown as Record<string, unknown>
    delete legacy.domicilioCalle
    const wrapped = { ...payload, fiscal: legacy }
    const r = CompanyFullFormPayloadSchema.safeParse(wrapped)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.fiscal.domicilioCalle).toBe('Av. Industrias 1234 Int. 5')
    }
  })
})

describe('FIX-ARCH-20260624-05 — entrega física horarios De/A y contacto estructurado', () => {
  it('acepta entregaFisica con horaDe/minutoDe y horaA/minutoA', () => {
    const payload = buildValidPayload()
    payload.entregaFisica = {
      dias: ['L', 'M', 'X', 'J', 'V'],
      horaDe: '09',
      minutoDe: '00',
      horaA: '14',
      minutoA: '30',
      contactoRecibe: { nombre: 'María', telefono: '4421234500', celular: '4425556677' },
    }
    const r = CompanyFullFormPayloadSchema.safeParse(payload)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.entregaFisica?.horaDe).toBe('09')
      expect(r.data.entregaFisica?.horaA).toBe('14')
      expect(r.data.entregaFisica?.contactoRecibe?.nombre).toBe('María')
    }
  })

  it('acepta entregaFisica sin horaA/minutoA (opcionales)', () => {
    const payload = buildValidPayload()
    payload.entregaFisica = {
      dias: ['L'],
      horaDe: '09',
      minutoDe: '00',
      contactoRecibe: { nombre: '', telefono: '', celular: '' },
    }
    const r = CompanyFullFormPayloadSchema.safeParse(payload)
    expect(r.success).toBe(true)
  })

  it('rechaza horaDe fuera de rango 00-23', () => {
    const payload = buildValidPayload()
    payload.entregaFisica = {
      dias: ['L'],
      horaDe: '24',
      minutoDe: '00',
      contactoRecibe: { nombre: '', telefono: '', celular: '' },
    }
    const r = CompanyFullFormPayloadSchema.safeParse(payload)
    expect(r.success).toBe(false)
  })

  it('rechaza minutoDe fuera de rango 00-59', () => {
    const payload = buildValidPayload()
    payload.entregaFisica = {
      dias: ['L'],
      horaDe: '09',
      minutoDe: '60',
      contactoRecibe: { nombre: '', telefono: '', celular: '' },
    }
    const r = CompanyFullFormPayloadSchema.safeParse(payload)
    expect(r.success).toBe(false)
  })

  it('backwards-compat: acepta entregaFisica viejo con horaRecepcion → horaDe', () => {
    const payload = buildValidPayload()
    const legacyEntrega = {
      dias: ['L', 'M', 'X', 'J', 'V'],
      horaRecepcion: '09',
      minutoRecepcion: '00',
      contactoRecibe: 'Recepción María - tel 4421234500',
    } as unknown as Record<string, unknown>
    payload.entregaFisica = legacyEntrega as never
    const r = CompanyFullFormPayloadSchema.safeParse(payload)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.entregaFisica?.horaDe).toBe('09')
      expect(r.data.entregaFisica?.minutoDe).toBe('00')
      expect(r.data.entregaFisica?.contactoRecibe?.nombre).toBe('Recepción María - tel 4421234500')
      expect(r.data.entregaFisica?.contactoRecibe?.telefono).toBe('')
    }
  })

  it('backwards-compat: entregaFisica viejo con contactoRecibe string vacío se trata como ausente', () => {
    const payload = buildValidPayload()
    const legacyEntrega = {
      dias: ['L'],
      horaRecepcion: '09',
      minutoRecepcion: '00',
      contactoRecibe: '',
    } as unknown as Record<string, unknown>
    payload.entregaFisica = legacyEntrega as never
    const r = CompanyFullFormPayloadSchema.safeParse(payload)
    expect(r.success).toBe(true)
  })
})
