/**
 * @file Tests focales (V1) para `submitDoctorStudyReview` respecto al
 *   congelamiento de identidad, la autorización por sesión (QA-20260825-01
 *   P1-A) y la generación condicional del PDF validado de Espirometría.
 * @id IMPL-FEATURE-20260825-01
 * @backup context/SPECs/SPEC-FEATURE-20260825-01-PDF-ESPIROMETRIA-VALIDADA.md
 *
 * Cobertura:
 *  - QA-20260825-01 P1-A:
 *    · Sin sesión → 401-style failure, sin leer identidad de nadie.
 *    · Rol no autorizado (CAPTURIST/RECEPTIONIST/...) → failure, sin
 *      leer identidad de nadie.
 *    · El ID `reviewedByUserId` enviado por el cliente se IGNORA: la
 *      identidad congelada proviene SIEMPRE del `user.findUnique`
 *      resuelto por `session.user.id`.
 *  - REVIEWED_ACCEPTED congela identidad del médico y genera PDF.
 *  - REVIEWED_EDITED congela identidad del médico y genera PDF.
 *  - REVIEWED_REJECTED NO genera PDF y NO congela identidad.
 *  - Si el médico no tiene cédula/firma, REVIEWED_ACCEPTED falla con
 *    error legible (la validación se hace antes de crear la revisión).
 *  - Si la generación del PDF lanza excepción, la revisión QUEDA guardada,
 *    `validatedPdfError` se persiste y `pdfGenerated=false` se devuelve.
 *
 * Aislamiento:
 *  - Mock de `getServerSession` con sesión controlada por test.
 *  - Mock de Prisma (todos los modelos necesarios) y next/cache.
 *  - Mock de `@/lib/espirometry-pdf` para que no se ejecute @react-pdf
 *    real (no hay DOM en vitest).
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
      findUnique: (...a: unknown[]) => mockAIPrediagnosisSnapshotFindUnique(...a),
      update: (...a: unknown[]) => mockAIPrediagnosisSnapshotUpdate(...a),
    },
    doctorStudyReview: {
      create: (...a: unknown[]) => mockDoctorStudyReviewCreate(...a),
      update: (...a: unknown[]) => mockDoctorStudyReviewUpdate(...a),
    },
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
    },
    $transaction: async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock),
  },
}))
vi.mock('@/actions/calibration-v3.actions', () => ({
  getPublishedCalibrationForEventTest: vi.fn().mockResolvedValue(null),
  getPublishedVersionForSnapshot: vi.fn().mockResolvedValue(null),
}))
vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))
vi.mock('@/lib/espirometry-pdf', async () => {
  const actual = await vi.importActual<typeof import('@/lib/espirometry-pdf')>(
    '@/lib/espirometry-pdf',
  )
  return {
    ...actual,
    // PDF generator mockeado para no requerir DOM. Por defecto devuelve
    // un buffer de prueba + URL relativa + hash determinístico.
    generateEspirometryValidatedPdf: vi.fn().mockResolvedValue({
      buffer: Buffer.from('%PDF-1.4 fake'),
      hash: 'sha256:fakehash',
      url: 'espirometry-pdfs/review-1.pdf',
      absolutePath: '/tmp/fake',
    }),
    resolveAmiLogoDataUrl: vi.fn().mockResolvedValue(null),
  }
})

import { submitDoctorStudyReview } from '../ai-prediagnosis.actions'

const VALID_SNAPSHOT = {
  id: 'predx-1',
  version: 1,
  clinicalState: 'AI_PENDING_REVIEW',
  createdAt: new Date('2026-08-25T12:00:00.000Z'),
  isSuperseded: false,
  prediagnosisData: {
    summary: 's',
    confidence: 0.7,
    recommendation: 'Reposo relativo 24 h, control en 1 semana.',
  },
  extractionSnapshot: {
    studyType: 'Espirometria',
    eventTest: {
      testNameSnapshot: 'Espirometría',
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

function setSession(opts: { id?: string; role?: string } | null) {
  if (!opts || !opts.id) {
    mockGetServerSession.mockResolvedValue(null)
    return
  }
  mockGetServerSession.mockResolvedValue({
    user: { id: opts.id, role: opts.role ?? 'DOCTOR_GENERAL' },
  })
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
  // Por defecto: sesión de médico válida. Tests que requieren otra cosa
  // deben sobreescribir.
  setSession({ id: 'session-user-1', role: 'DOCTOR_GENERAL' })
})

describe('submitDoctorStudyReview — QA-20260825-01 P1-A: autorización por sesión', () => {
  it('rechaza la revisión cuando NO hay sesión', async () => {
    setSession(null)
    const res = await submitDoctorStudyReview({
      prediagnosisSnapshotId: 'predx-1',
      doctorStatus: 'REVIEWED_ACCEPTED',
      reviewedByUserId: 'cualquier-id',
      eventId: 'ev-1',
    })
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/autenticado/i)
    expect(mockDoctorStudyReviewCreate).not.toHaveBeenCalled()
    expect(mockUserFindUnique).not.toHaveBeenCalled()
  })

  it('rechaza la revisión cuando el rol no está autorizado (CAPTURIST)', async () => {
    setSession({ id: 'u-1', role: 'CAPTURIST' })
    const res = await submitDoctorStudyReview({
      prediagnosisSnapshotId: 'predx-1',
      doctorStatus: 'REVIEWED_ACCEPTED',
      reviewedByUserId: 'u-1',
      eventId: 'ev-1',
    })
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/permisos/i)
    expect(mockDoctorStudyReviewCreate).not.toHaveBeenCalled()
    expect(mockUserFindUnique).not.toHaveBeenCalled()
  })

  it('rechaza la revisión cuando el rol no está autorizado (RECEPTIONIST)', async () => {
    setSession({ id: 'u-1', role: 'RECEPTIONIST' })
    const res = await submitDoctorStudyReview({
      prediagnosisSnapshotId: 'predx-1',
      doctorStatus: 'REVIEWED_ACCEPTED',
      reviewedByUserId: 'u-1',
      eventId: 'ev-1',
    })
    expect(res.success).toBe(false)
    expect(mockUserFindUnique).not.toHaveBeenCalled()
  })

  it('IGNORA reviewedByUserId del cliente y usa el de la sesión para congelar identidad', async () => {
    mockAIPrediagnosisSnapshotFindUnique.mockResolvedValue(VALID_SNAPSHOT)
    // Sesión: usuario sesión-user-1 (médico). El cliente manda otro id.
    setSession({ id: 'session-user-1', role: 'DOCTOR_GENERAL' })
    mockUserFindUnique.mockImplementation(({ where }) => {
      if (where.id === 'session-user-1') {
        return Promise.resolve({
          fullName: 'Dra. Sesión',
          professionalLicense: '1234567',
          signatureImageUrl: 'data:image/png;base64,SESION',
        })
      }
      // Cualquier otro id (cliente) NO debe ser consultado ni devuelto.
      throw new Error(`IDOR-prevent: User lookup no autorizado para ${where.id}`)
    })

    const res = await submitDoctorStudyReview({
      prediagnosisSnapshotId: 'predx-1',
      doctorStatus: 'REVIEWED_ACCEPTED',
      doctorDiagnosis: 'OK',
      reviewedByUserId: 'otro-user-falso', // <-- cliente intenta suplantar
      eventId: 'ev-1',
    })

    expect(res.success).toBe(true)
    expect(res.pdfGenerated).toBe(true)
    const createArgs = mockDoctorStudyReviewCreate.mock.calls[0][0]
    // La identidad congelada es la del usuario de SESIÓN, no la del cliente.
    expect(createArgs.data.validatorSnapshotFullName).toBe('Dra. Sesión')
    expect(createArgs.data.validatorSnapshotProfessionalLicense).toBe('1234567')
    expect(createArgs.data.validatorSnapshotSignatureUrl).toBe('data:image/png;base64,SESION')
    // Sólo se consultó al usuario de sesión, no al id del cliente.
    const userLookups = mockUserFindUnique.mock.calls.map((c) => c[0]?.where?.id)
    expect(userLookups).toEqual(['session-user-1'])
  })
})

describe('submitDoctorStudyReview — IMPL-FEATURE-20260825-01 PDF validado', () => {
  it('REVIEWED_ACCEPTED congela identidad del médico y genera PDF', async () => {
    setSession({ id: 'session-user-1', role: 'DOCTOR_GENERAL' })
    mockAIPrediagnosisSnapshotFindUnique.mockResolvedValue(VALID_SNAPSHOT)
    mockUserFindUnique.mockResolvedValue({
      fullName: 'Dra. María López',
      professionalLicense: '1234567',
      signatureImageUrl: 'data:image/png;base64,AAA',
    })

    const res = await submitDoctorStudyReview({
      prediagnosisSnapshotId: 'predx-1',
      doctorStatus: 'REVIEWED_ACCEPTED',
      doctorDiagnosis: 'Patrón normal.',
      reviewedByUserId: 'ignored-by-action',
      eventId: 'ev-1',
    })

    expect(res.success).toBe(true)
    expect(res.pdfGenerated).toBe(true)
    expect(res.pdfErrorMessage).toBeNull()
    expect(mockDoctorStudyReviewCreate).toHaveBeenCalledTimes(1)
    const createArgs = mockDoctorStudyReviewCreate.mock.calls[0][0]
    expect(createArgs.data.validatorSnapshotFullName).toBe('Dra. María López')
    expect(createArgs.data.validatorSnapshotProfessionalLicense).toBe('1234567')
    expect(createArgs.data.validatorSnapshotSignatureUrl).toBe('data:image/png;base64,AAA')
    // Update con URL del PDF persistido (formato sin prefijo uploads/ — QA P3-E).
    expect(mockDoctorStudyReviewUpdate).toHaveBeenCalledTimes(1)
    const updateArgs = mockDoctorStudyReviewUpdate.mock.calls[0][0]
    expect(updateArgs.data.validatedPdfUrl).toBe('espirometry-pdfs/review-1.pdf')
    expect(updateArgs.data.validatedPdfHash).toBe('sha256:fakehash')
    expect(updateArgs.data.validatedPdfError).toBeNull()
  })

  it('REVIEWED_EDITED congela identidad y genera PDF', async () => {
    setSession({ id: 'session-user-2', role: 'DOCTOR_VALIDATOR' })
    mockAIPrediagnosisSnapshotFindUnique.mockResolvedValue(VALID_SNAPSHOT)
    mockUserFindUnique.mockResolvedValue({
      fullName: 'Dr. Edit',
      professionalLicense: '9999',
      signatureImageUrl: 'data:image/png;base64,BBB',
    })

    const res = await submitDoctorStudyReview({
      prediagnosisSnapshotId: 'predx-1',
      doctorStatus: 'REVIEWED_EDITED',
      doctorDiagnosis: 'Patrón obstructivo leve, requiere seguimiento.',
      reviewedByUserId: 'cualquiera',
      eventId: 'ev-1',
    })

    expect(res.success).toBe(true)
    expect(res.pdfGenerated).toBe(true)
    const createArgs = mockDoctorStudyReviewCreate.mock.calls[0][0]
    expect(createArgs.data.validatorSnapshotFullName).toBe('Dr. Edit')
    expect(createArgs.data.validatorSnapshotProfessionalLicense).toBe('9999')
  })

  it('REVIEWED_REJECTED NO genera PDF ni congela identidad', async () => {
    setSession({ id: 'session-user-3', role: 'DOCTOR_GENERAL' })
    mockAIPrediagnosisSnapshotFindUnique.mockResolvedValue(VALID_SNAPSHOT)
    // NO se debería consultar el User en REJECTED.
    mockUserFindUnique.mockResolvedValue({
      fullName: 'Dr. Test',
      professionalLicense: '1234567',
      signatureImageUrl: 'data:image/png;base64,CCC',
    })

    const res = await submitDoctorStudyReview({
      prediagnosisSnapshotId: 'predx-1',
      doctorStatus: 'REVIEWED_REJECTED',
      doctorNotes: 'La sugerencia IA es inconsistente con la calidad documental.',
      reviewedByUserId: 'cualquiera',
      eventId: 'ev-1',
    })

    expect(res.success).toBe(true)
    expect(res.pdfGenerated).toBe(false)
    const createArgs = mockDoctorStudyReviewCreate.mock.calls[0][0]
    expect(createArgs.data.validatorSnapshotFullName).toBeNull()
    expect(createArgs.data.validatorSnapshotProfessionalLicense).toBeNull()
    expect(createArgs.data.validatorSnapshotSignatureUrl).toBeNull()
    // NO se llama update de la revisión para PDF
    expect(mockDoctorStudyReviewUpdate).not.toHaveBeenCalled()
  })

  it('bloquea REVIEWED_ACCEPTED si el médico no tiene cédula', async () => {
    setSession({ id: 'session-user-4', role: 'DOCTOR_GENERAL' })
    mockAIPrediagnosisSnapshotFindUnique.mockResolvedValue(VALID_SNAPSHOT)
    mockUserFindUnique.mockResolvedValue({
      fullName: 'Dr. Sin Cedula',
      professionalLicense: null,
      signatureImageUrl: 'data:image/png;base64,DDD',
    })

    const res = await submitDoctorStudyReview({
      prediagnosisSnapshotId: 'predx-1',
      doctorStatus: 'REVIEWED_ACCEPTED',
      doctorDiagnosis: 'OK',
      reviewedByUserId: 'cualquiera',
      eventId: 'ev-1',
    })

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/c[ée]dula/i)
    expect(mockDoctorStudyReviewCreate).not.toHaveBeenCalled()
  })

  it('bloquea REVIEWED_ACCEPTED si el médico no tiene firma', async () => {
    setSession({ id: 'session-user-5', role: 'DOCTOR_VALIDATOR' })
    mockAIPrediagnosisSnapshotFindUnique.mockResolvedValue(VALID_SNAPSHOT)
    mockUserFindUnique.mockResolvedValue({
      fullName: 'Dr. Sin Firma',
      professionalLicense: '1234567',
      signatureImageUrl: null,
    })

    const res = await submitDoctorStudyReview({
      prediagnosisSnapshotId: 'predx-1',
      doctorStatus: 'REVIEWED_ACCEPTED',
      doctorDiagnosis: 'OK',
      reviewedByUserId: 'cualquiera',
      eventId: 'ev-1',
    })

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/firma/i)
    expect(mockDoctorStudyReviewCreate).not.toHaveBeenCalled()
  })

  it('persiste validatedPdfError si la generación de PDF lanza excepción', async () => {
    setSession({ id: 'session-user-6', role: 'DOCTOR_GENERAL' })
    mockAIPrediagnosisSnapshotFindUnique.mockResolvedValue(VALID_SNAPSHOT)
    mockUserFindUnique.mockResolvedValue({
      fullName: 'Dr. Test',
      professionalLicense: '1234567',
      signatureImageUrl: 'data:image/png;base64,EEE',
    })
    // Forzar fallo del generador mockeado
    const pdfMod = await import('@/lib/espirometry-pdf')
    vi.spyOn(pdfMod, 'generateEspirometryValidatedPdf').mockRejectedValueOnce(
      new Error('Boom PDF'),
    )

    const res = await submitDoctorStudyReview({
      prediagnosisSnapshotId: 'predx-1',
      doctorStatus: 'REVIEWED_ACCEPTED',
      doctorDiagnosis: 'OK',
      reviewedByUserId: 'cualquiera',
      eventId: 'ev-1',
    })

    expect(res.success).toBe(true)
    expect(res.pdfGenerated).toBe(false)
    expect(res.pdfErrorMessage).toBe('Boom PDF')
    // La revisión SÍ quedó guardada
    expect(mockDoctorStudyReviewCreate).toHaveBeenCalledTimes(1)
    // Y se persistió el error
    expect(mockDoctorStudyReviewUpdate).toHaveBeenCalledTimes(1)
    const updateArgs = mockDoctorStudyReviewUpdate.mock.calls[0][0]
    expect(updateArgs.data.validatedPdfError).toBe('Boom PDF')
  })
})
