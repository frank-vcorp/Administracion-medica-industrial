import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetServerSession = vi.fn()
const mockEventTestFindUnique = vi.fn()
const mockUserFindUnique = vi.fn()
const mockPdfToBlob = vi.fn()

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))
vi.mock('@/auth', () => ({
  authOptions: {},
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    eventTest: {
      findUnique: (...args: unknown[]) => mockEventTestFindUnique(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}))
vi.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: { children?: unknown }) => children ?? null,
  Page: ({ children }: { children?: unknown }) => children ?? null,
  Text: ({ children }: { children?: unknown }) => children ?? null,
  View: ({ children }: { children?: unknown }) => children ?? null,
  Image: ({ src }: { src?: unknown }) => null,
  StyleSheet: { create: <T extends Record<string, unknown>>(s: T) => s },
  pdf: () => ({
    toBlob: (...args: unknown[]) => mockPdfToBlob(...args),
  }),
}))

import { GET } from '../route'

function makeEventTestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-cert-1',
    eventId: 'evt-1',
    testNameSnapshot: 'CERTIFICADO MEDICO',
    clinicalContext: null,
    event: {
      id: 'evt-1',
      checkInDate: new Date('2026-11-11T15:00:00.000Z'),
      createdAt: new Date('2026-11-11T15:00:00.000Z'),
      exam: {
        somatometryData: { peso_kg: '74', talla_m: '1.75' },
        eyeAcuityData: { vision_lejana_od: '20/20', vision_lejana_oi: '20/20' },
      },
      worker: {
        firstName: 'Juan Carlos',
        lastName: 'Pérez López',
        nationalId: 'PELJ900101HDF',
        dob: new Date('1990-01-01T00:00:00.000Z'),
        clinicalHistory: { data: null },
      },
    },
    ...overrides,
  }
}

describe('/api/pdf/certificado-medico/[eventId] GET', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({
      fullName: 'Dra. Erika Rodríguez',
      professionalLicense: '7654321',
    })
    mockPdfToBlob.mockResolvedValue(new Blob([new Uint8Array([37, 80, 68, 70])], { type: 'application/pdf' }))
  })

  it('devuelve 401 si no hay sesión', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/pdf/certificado-medico/evt-1?eventTestId=test-cert-1')
    const res = await GET(req, { params: Promise.resolve({ eventId: 'evt-1' }) })
    expect(res.status).toBe(401)
    expect(mockEventTestFindUnique).not.toHaveBeenCalled()
  })

  it('devuelve 403 para roles no clínicos', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1', role: 'COMPANY_CLIENT' } })
    const req = new NextRequest('http://localhost/api/pdf/certificado-medico/evt-1?eventTestId=test-cert-1')
    const res = await GET(req, { params: Promise.resolve({ eventId: 'evt-1' }) })
    expect(res.status).toBe(403)
    expect(mockEventTestFindUnique).not.toHaveBeenCalled()
  })

  it('devuelve 404 si el estudio pertenece a otro evento', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'doc-1', role: 'DOCTOR_GENERAL' } })
    mockEventTestFindUnique.mockResolvedValue(makeEventTestRow({ eventId: 'otro-evento' }))
    const req = new NextRequest('http://localhost/api/pdf/certificado-medico/evt-1?eventTestId=test-cert-1')
    const res = await GET(req, { params: Promise.resolve({ eventId: 'evt-1' }) })
    expect(res.status).toBe(404)
  })

  it('genera vista previa PDF en borrador sin exigir cerrada_at', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'doc-1', role: 'DOCTOR_GENERAL' } })
    mockEventTestFindUnique.mockResolvedValue(
      makeEventTestRow({
        clinicalContext: {
          schemaVersion: 'certificado-medico-v1',
          exploracion_fisica: 'Consciente y orientado.',
          integracion_diagnostica: '',
          dictamen_laboral: 'APTO',
          dictamen_laboral_texto: 'Apto para actividades laborales.',
          signos_vitales: {},
        },
      }),
    )

    const req = new NextRequest(
      'http://localhost/api/pdf/certificado-medico/evt-1?eventTestId=test-cert-1&preview=1',
    )
    const res = await GET(req, { params: Promise.resolve({ eventId: 'evt-1' }) })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toContain('-borrador.pdf')
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
  })

  it('genera vista previa PDF incluso antes del primer guardado (clinicalContext null)', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'doc-1', role: 'DOCTOR_VALIDATOR' } })
    mockEventTestFindUnique.mockResolvedValue(makeEventTestRow({ clinicalContext: null }))

    const req = new NextRequest(
      'http://localhost/api/pdf/certificado-medico/evt-1?eventTestId=test-cert-1&preview=1',
    )
    const res = await GET(req, { params: Promise.resolve({ eventId: 'evt-1' }) })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toContain('-borrador.pdf')
  })

  it('genera PDF final cuando el certificado está cerrado', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'doc-1', role: 'DOCTOR_GENERAL' } })
    mockEventTestFindUnique.mockResolvedValue(
      makeEventTestRow({
        clinicalContext: {
          schemaVersion: 'certificado-medico-v1',
          lugar_expedicion: 'Santiago de Querétaro, Querétaro',
          medico_nombre: 'Dra. Erika Rodríguez',
          medico_cedula: '7654321',
          signos_vitales: {},
          exploracion_fisica: 'Paciente consciente y orientado sin hallazgos.',
          integracion_diagnostica: 'Clínicamente sano',
          dictamen_laboral: 'APTO',
          dictamen_laboral_texto: 'Apto para realizar actividades laborales.',
          cerrada_at: '2026-11-11T16:00:00.000Z',
        },
      }),
    )

    const req = new NextRequest('http://localhost/api/pdf/certificado-medico/evt-1?eventTestId=test-cert-1')
    const res = await GET(req, { params: Promise.resolve({ eventId: 'evt-1' }) })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toBe('inline; filename="CertificadoMedico-test-cer.pdf"')
    expect(res.headers.get('Cache-Control')).toBeNull()
  })
})
