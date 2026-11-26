import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  resolveEventTestFilesForZip,
  resolveEventTestPdfForZip,
} from '../study-pdf-for-zip'

const {
  mockTryReadSourceFromBackend,
  mockFindReviewUnique,
  mockBuildAudiometriaPdfDataAsync,
  mockGenerateAudiometriaValidatedPdf,
} = vi.hoisted(() => ({
  mockTryReadSourceFromBackend: vi.fn(),
  mockFindReviewUnique: vi.fn(),
  mockBuildAudiometriaPdfDataAsync: vi.fn(),
  mockGenerateAudiometriaValidatedPdf: vi.fn(),
}))

vi.mock('@/lib/clinical/backend-file-read', () => ({
  tryReadSourceFromBackend: mockTryReadSourceFromBackend,
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    doctorStudyReview: {
      findUnique: mockFindReviewUnique,
    },
  },
}))

vi.mock('@/lib/ami-brand', () => ({
  resolveAmiLogoDataUrl: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/audiometry-pdf', () => ({
  buildAudiometriaPdfDataAsync: mockBuildAudiometriaPdfDataAsync,
  generateAudiometriaValidatedPdf: mockGenerateAudiometriaValidatedPdf,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('resolveEventTestPdfForZip', () => {
  it('omite examen médico (resolver dedicado en ZIP)', async () => {
    const out = await resolveEventTestPdfForZip({
      id: '1',
      status: 'COMPLETED',
      testNameSnapshot: 'Examen Médico General',
      fileUrl: null,
      sourceFileUrl: null,
      sourceFileName: null,
      validatedPdfUrl: 'examen-medico-pdfs/x.pdf',
    })
    expect(out).toBeNull()
  })

  it('omite cancelados', async () => {
    const out = await resolveEventTestPdfForZip({
      id: '1',
      status: 'CANCELLED',
      testNameSnapshot: 'Audiometría',
      fileUrl: null,
      sourceFileUrl: null,
      sourceFileName: null,
      validatedPdfUrl: null,
    })
    expect(out).toBeNull()
  })
})

describe('resolveEventTestFilesForZip', () => {
  it('regenera PDF validado vía reviewId e incluye el archivo fuente sin duplicar', async () => {
    mockFindReviewUnique.mockResolvedValue({
      id: 'rev-1',
      doctorStatus: 'REVIEWED_ACCEPTED',
      doctorDiagnosis: 'Audición normal',
      doctorNotes: null,
      doctorRecommendations: null,
      createdAt: new Date('2026-11-26T10:00:00Z'),
      validatedPdfGeneratedAt: null,
      validatorSnapshotFullName: 'Dra. Prueba',
      validatorSnapshotProfessionalLicense: '123456',
      validatorSnapshotSignatureUrl: '',
      reviewedBy: null,
      prediagnosisSnapshot: {
        prediagnosisData: {},
        extractionSnapshot: {
          studyType: 'Audiometria',
          structuredData: {},
          eventTest: {
            id: 'et-1',
            testNameSnapshot: 'AUDIOMETRIA',
            eventId: 'ev-1',
            clinicalContext: null,
            event: {
              worker: {
                firstName: 'Ernesto',
                lastName: 'De la Cruz',
                universalId: 'UID-1',
                company: { name: 'Empresa X' },
              },
            },
          },
        },
      },
    })
    mockBuildAudiometriaPdfDataAsync.mockResolvedValue({ mocked: true })
    mockGenerateAudiometriaValidatedPdf.mockResolvedValue({
      buffer: Buffer.from('%PDF-VALIDATED'),
      hash: 'sha256:abc',
      url: null,
      absolutePath: null,
    })
    mockTryReadSourceFromBackend.mockResolvedValue(new Uint8Array([1, 2, 3, 4]))

    const files = await resolveEventTestFilesForZip({
      id: 'et-1',
      status: 'RESULT_REGISTERED',
      testNameSnapshot: 'AUDIOMETRIA',
      fileUrl: '/uploads/audio_normal.pdf',
      sourceFileUrl: '/uploads/audio_normal.pdf',
      sourceFileName: 'audio_normal.pdf',
      validatedPdfUrl: null,
      reviewId: 'rev-1',
      studyType: 'Audiometria',
    })

    expect(files.map((f) => f.filename)).toEqual([
      'informe-AUDIOMETRIA.pdf',
      'fuente-audio_normal.pdf',
    ])
    expect(mockTryReadSourceFromBackend).toHaveBeenCalledTimes(1)
  })

  it('cuando sólo hay fileUrl crudo (sin validatedPdfUrl ni reviewId), no lo duplica como informe y fuente', async () => {
    mockTryReadSourceFromBackend.mockResolvedValue(new Uint8Array([9, 8, 7]))

    const files = await resolveEventTestFilesForZip({
      id: 'et-lab',
      status: 'COMPLETED',
      testNameSnapshot: 'Laboratorio',
      fileUrl: '/uploads/lab.pdf',
      sourceFileUrl: '/uploads/lab.pdf',
      sourceFileName: 'lab.pdf',
      validatedPdfUrl: null,
    })

    expect(files.map((f) => f.filename)).toEqual(['fuente-lab.pdf'])
  })

  it('incluye múltiples adjuntos fuente desde clinicalContext.files (ej. placas Rayos X)', async () => {
    mockTryReadSourceFromBackend
      .mockResolvedValueOnce(new Uint8Array([10, 20]))
      .mockResolvedValueOnce(new Uint8Array([30, 40]))

    const files = await resolveEventTestFilesForZip({
      id: 'et-rx',
      status: 'RESULT_REGISTERED',
      testNameSnapshot: 'RX DE COLUMNA CERVICAL AP Y LAT',
      fileUrl: '/api/files/rayos-x/et-rx/ap.jpg',
      sourceFileUrl: '/api/files/rayos-x/et-rx/ap.jpg',
      sourceFileName: 'RX_AP.jpg',
      validatedPdfUrl: null,
      clinicalContext: {
        files: [
          { url: '/api/files/rayos-x/et-rx/ap.jpg', fileName: 'RX_AP.jpg' },
          { url: '/api/files/rayos-x/et-rx/lat.jpg', fileName: 'RX_LAT.jpg' },
        ],
      },
    })

    expect(files.map((f) => f.filename)).toEqual([
      'fuente-RX_AP.jpg',
      'fuente-RX_LAT.jpg',
    ])
  })
})
