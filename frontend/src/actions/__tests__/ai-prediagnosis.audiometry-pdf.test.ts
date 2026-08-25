/**
 * @file Tests V1 focales para el dispatch por tipo de estudio en
 *   `submitDoctorStudyReview` (FEATURE-20260825-02 + gap-fix del
 *   IMPLEMENTATION_DEFECT detectado por GEMINI).
 *
 * Verifica que la regla de la SPEC se respeta por tipo canónico:
 *   - REVIEWED_ACCEPTED y REVIEWED_EDITED generan PDF válido.
 *   - REVIEWED_REJECTED NO genera PDF (sin importar el estudio).
 *
 * Y específicamente para Audiometría (gap-fix):
 *   - Cuando el `studyType` del snapshot es `Audiometria`, la action
 *     delega en el helper `audiometry-pdf.tsx` (NO en
 *     `espirometry-pdf.tsx`).
 *   - El PDF persistido usa la ruta `audiometry-pdfs/<reviewId>.pdf`.
 *
 * @id IMPL-FEATURE-20260825-02
 * @backup context/SPECs/SPEC-FEATURE-20260825-02-AUDIOMETRIA-ENTREGABLE.md
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Mock state ─────────────────────────────────────────────────────────────
const mockAIPrediagnosisSnapshotFindUnique = vi.fn()
const mockAIPrediagnosisSnapshotUpdate = vi.fn()
const mockDoctorStudyReviewCreate = vi.fn()
const mockDoctorStudyReviewUpdate = vi.fn()
const mockUserFindUnique = vi.fn()
const mockRevalidatePath = vi.fn()
const mockGetServerSession = vi.fn()

const txMock = {
  studyExtractionSnapshot: {
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  aIPrediagnosisSnapshot: {
    create: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  eventTest: {
    update: vi.fn().mockResolvedValue({}),
  },
}

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    aIPrediagnosisSnapshot: {
      findUnique: (...a: unknown[]) =>
        mockAIPrediagnosisSnapshotFindUnique(...a),
      update: (...a: unknown[]) => mockAIPrediagnosisSnapshotUpdate(...a),
    },
    doctorStudyReview: {
      create: (...a: unknown[]) => mockDoctorStudyReviewCreate(...a),
      update: (...a: unknown[]) => mockDoctorStudyReviewUpdate(...a),
    },
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
    },
    $transaction: async (cb: (tx: typeof txMock) => Promise<unknown>) =>
      cb(txMock),
  },
}))
vi.mock('@/actions/calibration-v3.actions', () => ({
  getPublishedCalibrationForEventTest: vi.fn().mockResolvedValue(null),
  getPublishedVersionForSnapshot: vi.fn().mockResolvedValue(null),
}))
vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))
// Mock específico: cada helper de PDF está mockeado por separado para
// detectar de cuál se llama. Si el dispatch por tipo está mal,将会
// fallar el assertivo de `expect`.
const generateEspirometry = vi.fn()
const generateAudiometry = vi.fn()
vi.mock('@/lib/espirometry-pdf', async () => {
  const actual = await vi.importActual<typeof import('@/lib/espirometry-pdf')>(
    '@/lib/espirometry-pdf',
  )
  return {
    ...actual,
    generateEspirometryValidatedPdf: (...a: unknown[]) =>
      generateEspirometry(...a),
    resolveAmiLogoDataUrl: vi.fn().mockResolvedValue(null),
  }
})
vi.mock('@/lib/audiometry-pdf', async () => {
  const actual = await vi.importActual<typeof import('@/lib/audiometry-pdf')>(
    '@/lib/audiometry-pdf',
  )
  return {
    ...actual,
    generateAudiometriaValidatedPdf: (...a: unknown[]) =>
      generateAudiometry(...a),
  }
})

import { submitDoctorStudyReview } from '../ai-prediagnosis.actions'

const VALID_AUDIO_SNAPSHOT = {
  id: 'predx-audio-1',
  version: 1,
  clinicalState: 'AI_PENDING_REVIEW',
  createdAt: new Date('2026-08-25T12:00:00.000Z'),
  isSuperseded: false,
  prediagnosisData: {
    summary: 's',
    confidence: 0.7,
    recommendation: 'Seguimiento audiométrico anual.',
  },
  extractionSnapshot: {
    studyType: 'Audiometria',
    structuredData: {
      oido_derecho: { va: { 500: 20, 1000: 25, 2000: 30 }, pta_visible: 25 },
      oido_izquierdo: { va: { 500: 20, 1000: 25, 2000: 30 }, pta_visible: 25 },
    },
    eventTest: {
      testNameSnapshot: 'Audiometría',
      eventId: 'ev-1',
      event: {
        worker: {
          firstName: 'Juan',
          lastName: 'Pérez',
          universalId: 'U-123',
          company: { name: 'ACME SA' },
        },
      },
    },
  },
}

const VALID_ESPIRO_SNAPSHOT = {
  ...VALID_AUDIO_SNAPSHOT,
  id: 'predx-espi-1',
  extractionSnapshot: {
    ...VALID_AUDIO_SNAPSHOT.extractionSnapshot,
    studyType: 'Espirometria',
    structuredData: {
      calidad: { repetibilidad_fvc_ml: 30 },
      parametros: [],
    },
  },
}

function setSession(opts: { id?: string; role?: string } | null) {
  if (!opts || !opts.id) {
    mockGetServerSession.mockResolvedValue(null)
    return
  }
  mockGetServerSession.mockResolvedValue({
    user: { id: opts.id, role: opts.role ?? 'DOCTOR_GENERAL' },
  })
}

const VALID_MEDICO = {
  fullName: 'Dra. María López',
  professionalLicense: '1234567',
  signatureImageUrl: 'data:image/png;base64,AAA',
}

beforeEach(() => {
  mockAIPrediagnosisSnapshotFindUnique.mockReset()
  mockAIPrediagnosisSnapshotUpdate.mockReset().mockResolvedValue({})
  mockDoctorStudyReviewCreate.mockReset().mockImplementation(({ data }) =>
    Promise.resolve({ id: 'review-1', ...data, createdAt: new Date() }),
  )
  mockDoctorStudyReviewUpdate.mockReset().mockResolvedValue({})
  mockUserFindUnique.mockReset()
  mockRevalidatePath.mockReset()
  mockGetServerSession.mockReset()
  generateEspirometry.mockReset().mockResolvedValue({
    buffer: Buffer.from('%PDF-1.4 fake-espi'),
    hash: 'sha256:fake-espi',
    url: 'espirometry-pdfs/review-1.pdf',
    absolutePath: '/tmp/fake-espi',
  })
  generateAudiometry.mockReset().mockResolvedValue({
    buffer: Buffer.from('%PDF-1.4 fake-audio'),
    hash: 'sha256:fake-audio',
    url: 'audiometry-pdfs/review-1.pdf',
    absolutePath: '/tmp/fake-audio',
  })
  setSession({ id: 'session-user-1', role: 'DOCTOR_GENERAL' })
})

// ===========================================================================
// Regla por doctorStatus (independiente del tipo de estudio)
// ===========================================================================

describe('submitDoctorStudyReview — regla PDF por doctorStatus', () => {
  it('REVIEWED_ACCEPTED con Audiometria genera PDF (helper audiometry)', async () => {
    setSession({ id: 'session-user-1', role: 'DOCTOR_GENERAL' })
    mockAIPrediagnosisSnapshotFindUnique.mockResolvedValue(VALID_AUDIO_SNAPSHOT)
    mockUserFindUnique.mockResolvedValue(VALID_MEDICO)

    const res = await submitDoctorStudyReview({
      prediagnosisSnapshotId: 'predx-audio-1',
      doctorStatus: 'REVIEWED_ACCEPTED',
      doctorDiagnosis: 'HIPOACUSIA BILATERAL LEVE',
      reviewedByUserId: 'ignored-by-action',
      eventId: 'ev-1',
    })

    expect(res.success).toBe(true)
    expect(res.pdfGenerated).toBe(true)
    // El helper de Audiometría fue llamado; el de Espirometría NO.
    expect(generateAudiometry).toHaveBeenCalledTimes(1)
    expect(generateEspirometry).not.toHaveBeenCalled()

    const updateArgs = mockDoctorStudyReviewUpdate.mock.calls[0][0]
    expect(updateArgs.data.validatedPdfUrl).toBe(
      'audiometry-pdfs/review-1.pdf',
    )
    expect(updateArgs.data.validatedPdfError).toBeNull()
  })

  it('REVIEWED_EDITED con Audiometria genera PDF (helper audiometry)', async () => {
    setSession({ id: 'session-user-1', role: 'DOCTOR_VALIDATOR' })
    mockAIPrediagnosisSnapshotFindUnique.mockResolvedValue(VALID_AUDIO_SNAPSHOT)
    mockUserFindUnique.mockResolvedValue(VALID_MEDICO)

    const res = await submitDoctorStudyReview({
      prediagnosisSnapshotId: 'predx-audio-1',
      doctorStatus: 'REVIEWED_EDITED',
      doctorDiagnosis: 'HIPOACUSIA BILATERAL LEVE — corregida',
      reviewedByUserId: 'ignored-by-action',
      eventId: 'ev-1',
    })

    expect(res.success).toBe(true)
    expect(res.pdfGenerated).toBe(true)
    expect(generateAudiometry).toHaveBeenCalledTimes(1)
    expect(generateEspirometry).not.toHaveBeenCalled()
    const updateArgs = mockDoctorStudyReviewUpdate.mock.calls[0][0]
    expect(updateArgs.data.validatedPdfUrl).toBe(
      'audiometry-pdfs/review-1.pdf',
    )
  })

  it('REVIEWED_REJECTED con Audiometria NO genera PDF (espirometry ni audiometry)', async () => {
    setSession({ id: 'session-user-1', role: 'DOCTOR_GENERAL' })
    mockAIPrediagnosisSnapshotFindUnique.mockResolvedValue(VALID_AUDIO_SNAPSHOT)
    mockUserFindUnique.mockResolvedValue(VALID_MEDICO)

    const res = await submitDoctorStudyReview({
      prediagnosisSnapshotId: 'predx-audio-1',
      doctorStatus: 'REVIEWED_REJECTED',
      doctorNotes: 'Documento ilegible; sugiero re-captura.',
      reviewedByUserId: 'ignored-by-action',
      eventId: 'ev-1',
    })

    expect(res.success).toBe(true)
    // Aceptado/Editado sin cambios: REVIEWED_REJECTED ⇒ sin PDF.
    expect(res.pdfGenerated).toBe(false)
    expect(res.pdfErrorMessage).toBeNull()
    // Ningún helper de PDF fue llamado.
    expect(generateAudiometry).not.toHaveBeenCalled()
    expect(generateEspirometry).not.toHaveBeenCalled()

    // La revisión queda persistida pero sin identidad congelada.
    expect(mockDoctorStudyReviewCreate).toHaveBeenCalledTimes(1)
    const createArgs = mockDoctorStudyReviewCreate.mock.calls[0][0]
    expect(createArgs.data.validatorSnapshotFullName).toBeNull()
    expect(createArgs.data.validatorSnapshotProfessionalLicense).toBeNull()
    expect(createArgs.data.validatorSnapshotSignatureUrl).toBeNull()
    // NO se invoca update del review (no hay PDF para persistir).
    expect(mockDoctorStudyReviewUpdate).not.toHaveBeenCalled()
  })

  it('REVIEWED_REJECTED con Espirometria NO genera PDF (regresión)', async () => {
    setSession({ id: 'session-user-1', role: 'DOCTOR_GENERAL' })
    mockAIPrediagnosisSnapshotFindUnique.mockResolvedValue(VALID_ESPIRO_SNAPSHOT)
    mockUserFindUnique.mockResolvedValue(VALID_MEDICO)

    const res = await submitDoctorStudyReview({
      prediagnosisSnapshotId: 'predx-espi-1',
      doctorStatus: 'REVIEWED_REJECTED',
      doctorNotes: 'Sin calidad documental suficiente.',
      reviewedByUserId: 'ignored-by-action',
      eventId: 'ev-1',
    })

    expect(res.success).toBe(true)
    expect(res.pdfGenerated).toBe(false)
    expect(generateAudiometry).not.toHaveBeenCalled()
    expect(generateEspirometry).not.toHaveBeenCalled()
    expect(mockDoctorStudyReviewUpdate).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// Dispatch por tipo canónico
// ===========================================================================

describe('submitDoctorStudyReview — dispatch por tipo canónico del estudio', () => {
  it('Espirometria → generateEspirometryValidatedPdf (default)', async () => {
    setSession({ id: 'session-user-1', role: 'DOCTOR_GENERAL' })
    mockAIPrediagnosisSnapshotFindUnique.mockResolvedValue(VALID_ESPIRO_SNAPSHOT)
    mockUserFindUnique.mockResolvedValue(VALID_MEDICO)

    const res = await submitDoctorStudyReview({
      prediagnosisSnapshotId: 'predx-espi-1',
      doctorStatus: 'REVIEWED_ACCEPTED',
      doctorDiagnosis: 'Patrón normal.',
      reviewedByUserId: 'ignored-by-action',
      eventId: 'ev-1',
    })

    expect(res.success).toBe(true)
    expect(res.pdfGenerated).toBe(true)
    expect(generateEspirometry).toHaveBeenCalledTimes(1)
    expect(generateAudiometry).not.toHaveBeenCalled()
    const updateArgs = mockDoctorStudyReviewUpdate.mock.calls[0][0]
    expect(updateArgs.data.validatedPdfUrl).toBe(
      'espirometry-pdfs/review-1.pdf',
    )
  })

  it('Audiometria → generateAudiometriaValidatedPdf (gap-fix IMPL-FEATURE-20260825-02)', async () => {
    setSession({ id: 'session-user-1', role: 'DOCTOR_GENERAL' })
    mockAIPrediagnosisSnapshotFindUnique.mockResolvedValue(VALID_AUDIO_SNAPSHOT)
    mockUserFindUnique.mockResolvedValue(VALID_MEDICO)

    const res = await submitDoctorStudyReview({
      prediagnosisSnapshotId: 'predx-audio-1',
      doctorStatus: 'REVIEWED_ACCEPTED',
      doctorDiagnosis: 'HIPOACUSIA BILATERAL LEVE',
      reviewedByUserId: 'ignored-by-action',
      eventId: 'ev-1',
    })

    expect(res.success).toBe(true)
    expect(res.pdfGenerated).toBe(true)
    expect(generateAudiometry).toHaveBeenCalledTimes(1)
    expect(generateEspirometry).not.toHaveBeenCalled()
    const updateArgs = mockDoctorStudyReviewUpdate.mock.calls[0][0]
    expect(updateArgs.data.validatedPdfUrl).toBe(
      'audiometry-pdfs/review-1.pdf',
    )
  })
})
