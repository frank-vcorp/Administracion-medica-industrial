/**
 * Al regenerar el PDF, el firmante es la cuenta de la sesión, no un
 * nombre fijo ni el del ejemplo.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockDoctorStudyReviewFindUnique = vi.fn()
const mockDoctorStudyReviewUpdate = vi.fn()
const mockUserFindUnique = vi.fn()
const mockGetServerSession = vi.fn()
const mockBuild = vi.fn()
const mockGenerate = vi.fn()

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))
vi.mock('@/auth', () => ({
  authOptions: {},
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    doctorStudyReview: {
      findUnique: (...a: unknown[]) => mockDoctorStudyReviewFindUnique(...a),
      update: (...a: unknown[]) => mockDoctorStudyReviewUpdate(...a),
    },
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
    },
  },
}))
vi.mock('@/lib/audiometry-pdf', () => ({
  generateAudiometriaValidatedPdf: (...a: unknown[]) => mockGenerate(...a),
  buildAudiometriaPdfDataAsync: (...a: unknown[]) => mockBuild(...a),
  resolveAmiLogoDataUrl: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/audiometry-source-crop', () => ({
  ensureAudiometrySourceCrop: vi.fn().mockResolvedValue(null),
  loadAudiometrySourceCrop: vi.fn().mockResolvedValue(null),
}))

import { GET } from '../route'

const FIRMA = 'data:image/png;base64,FIRMADECUENTA'

const REVIEW = {
  id: 'review-1',
  doctorStatus: 'REVIEWED_ACCEPTED',
  doctorDiagnosis: 'Umbrales estables.',
  doctorNotes: null,
  doctorRecommendations: null,
  createdAt: new Date('2026-03-02T15:00:00.000Z'),
  reviewedByUserId: 'cuenta-prueba',
  validatedPdfUrl: null,
  validatedPdfGeneratedAt: null,
  validatedPdfError: null,
  prediagnosisSnapshot: {
    prediagnosisData: {},
    extractionSnapshot: {
      studyType: 'Audiometria',
      structuredData: {},
      eventTest: {
        id: 'test-1',
        testNameSnapshot: 'Audiometría',
        eventId: 'ev-1',
        clinicalContext: null,
        event: {
          worker: {
            firstName: 'Ana',
            lastName: 'López',
            universalId: 'TRAB-100',
            company: { name: 'Norte Industrial' },
          },
        },
      },
    },
  },
}

function setSession(id: string, role = 'DOCTOR_GENERAL') {
  mockGetServerSession.mockResolvedValue({ user: { id, role } })
}

beforeEach(() => {
  mockDoctorStudyReviewFindUnique.mockReset()
  mockDoctorStudyReviewUpdate.mockReset().mockResolvedValue({})
  mockUserFindUnique.mockReset()
  mockGetServerSession.mockReset()
  mockBuild.mockReset().mockImplementation(async (input: unknown) => input)
  mockGenerate.mockReset().mockResolvedValue({
    buffer: Buffer.from('%PDF-1.4 cuenta'),
    hash: 'sha256:cuenta',
    url: null,
    absolutePath: null,
  })
})

describe('GET /api/pdf/audiometry — firmante de la sesión', () => {
  it('usa el nombre, la cédula y la firma del perfil de la cuenta', async () => {
    setSession('cuenta-prueba')
    mockDoctorStudyReviewFindUnique.mockResolvedValue(REVIEW)
    mockUserFindUnique.mockResolvedValue({
      fullName: 'Prueba Cuenta Audiometria',
      professionalLicense: '5544332',
      signatureImageUrl: FIRMA,
    })

    const res = await GET(new Request('http://localhost/api/pdf/audiometry/review-1') as never, {
      params: Promise.resolve({ reviewId: 'review-1' }),
    })

    expect(res.status).toBe(200)
    const medico = mockBuild.mock.calls[0][0].medico
    expect(medico).toEqual({
      fullName: 'Prueba Cuenta Audiometria',
      professionalLicense: '5544332',
      signatureImageUrl: FIRMA,
    })
    expect(JSON.stringify(medico)).not.toMatch(/Marta Ruiz|Erika/)
  })

  it('sin cédula ni firma igual genera el PDF con el nombre de la cuenta', async () => {
    setSession('cuenta-prueba')
    mockDoctorStudyReviewFindUnique.mockResolvedValue(REVIEW)
    mockUserFindUnique.mockResolvedValue({
      fullName: 'Prueba Cuenta Audiometria',
      professionalLicense: null,
      signatureImageUrl: null,
    })

    const res = await GET(new Request('http://localhost/api/pdf/audiometry/review-1') as never, {
      params: Promise.resolve({ reviewId: 'review-1' }),
    })

    expect(res.status).toBe(200)
    expect(mockBuild.mock.calls[0][0].medico).toEqual({
      fullName: 'Prueba Cuenta Audiometria',
      professionalLicense: '—',
      signatureImageUrl: '',
    })
  })
})
