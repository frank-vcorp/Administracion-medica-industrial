/**
 * @file Tests focales (V1) para el endpoint autenticado de descarga del PDF
 *   validado de Espirometría (`/api/pdf/espirometry/[reviewId]`).
 * @id IMPL-FEATURE-20260825-01 / QA-20260825-01 P2-C
 * @backup context/SPECs/SPEC-FEATURE-20260825-01-PDF-ESPIROMETRIA-VALIDADA.md
 *
 * Cobertura:
 *  - Sin sesión → 401, no se hace lookup del review ni se filtra PII.
 *  - Rol no autorizado (CAPTURIST, RECEPTIONIST, ...) → 403, no se hace
 *    lookup del review.
 *  - IDOR fix: DOCTOR_GENERAL/DOCTOR_VALIDATOR SÓLO pueden descargar SU
 *    PROPIA revisión (reviewedByUserId === session.user.id). Cualquier
 *    UUID ajeno → 403, no se devuelve PII.
 *  - SUPERADMIN puede descargar cualquier revisión.
 *  - REVIEWED_REJECTED → 404 (sin PDF por contrato de SPEC).
 *  - Fast-path: si `validatedPdfUrl` apunta a un archivo que existe,
 *    se sirve desde disco (no se llama al generador).
 *
 * Aislamiento:
 *  - Mock de `getServerSession`, `@/lib/prisma` y `node:fs/promises`
 *    (readFile) para no requerir FS ni DB.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Mock state ─────────────────────────────────────────────────────────────
const mockDoctorStudyReviewFindUnique = vi.fn()
const mockDoctorStudyReviewUpdate = vi.fn()
const mockGetServerSession = vi.fn()
const mockReadFile = vi.fn()
const mockGenerateEspirometryValidatedPdf = vi.fn()

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
  },
}))
vi.mock('node:fs/promises', () => ({
  readFile: (...a: unknown[]) => mockReadFile(...a),
}))
vi.mock('@/lib/espirometry-pdf', async () => {
  const actual = await vi.importActual<typeof import('@/lib/espirometry-pdf')>(
    '@/lib/espirometry-pdf',
  )
  return {
    ...actual,
    generateEspirometryValidatedPdf: (...a: unknown[]) =>
      mockGenerateEspirometryValidatedPdf(...a),
    resolveAmiLogoDataUrl: vi.fn().mockResolvedValue(null),
  }
})

// Importamos DESPUÉS de los mocks.
import { GET } from '../route'

function setSession(opts: { id?: string; role?: string } | null) {
  if (!opts || !opts.id) {
    mockGetServerSession.mockResolvedValue(null)
    return
  }
  mockGetServerSession.mockResolvedValue({
    user: { id: opts.id, role: opts.role ?? 'DOCTOR_GENERAL' },
  })
}

function makeRequest(): Request {
  // No usamos el request para auth (sólo sesión), pero el handler lo recibe.
  return new Request('http://localhost/api/pdf/espirometry/review-1')
}

const REVIEW_BASE = {
  id: 'review-1',
  doctorStatus: 'REVIEWED_ACCEPTED' as const,
  doctorDiagnosis: 'Patrón normal.',
  doctorNotes: null,
  createdAt: new Date('2026-08-25T12:00:00.000Z'),
  reviewedByUserId: 'reviewer-A',
  validatedPdfUrl: null,
  validatedPdfGeneratedAt: null,
  validatedPdfError: null,
  validatorSnapshotFullName: 'Dr. A',
  validatorSnapshotProfessionalLicense: '1234567',
  validatorSnapshotSignatureUrl: 'data:image/png;base64,SIG',
  prediagnosisSnapshot: {
    prediagnosisData: { recommendation: 'A' },
    extractionSnapshot: {
      studyType: 'Espirometria',
      structuredData: {},
      eventTest: {
        testNameSnapshot: 'Espirometría',
        eventId: 'ev-1',
        event: {
          worker: {
            firstName: 'Juan',
            lastName: 'Pérez',
            universalId: 'U-1',
            company: { name: 'ACME' },
          },
        },
      },
    },
  },
}

beforeEach(() => {
  mockDoctorStudyReviewFindUnique.mockReset()
  mockDoctorStudyReviewUpdate.mockReset().mockResolvedValue({})
  mockGetServerSession.mockReset()
  mockReadFile.mockReset()
  mockGenerateEspirometryValidatedPdf.mockReset()
})

describe('GET /api/pdf/espirometry/[reviewId] — QA-20260825-01 P2-C auth/IDOR', () => {
  it('sin sesión → 401 y NO se consulta la revisión', async () => {
    setSession(null)
    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ reviewId: 'review-1' }),
    })
    expect(res.status).toBe(401)
    expect(mockDoctorStudyReviewFindUnique).not.toHaveBeenCalled()
  })

  it('rol no autorizado (CAPTURIST) → 403 y NO se consulta la revisión', async () => {
    setSession({ id: 'u-1', role: 'CAPTURIST' })
    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ reviewId: 'review-1' }),
    })
    expect(res.status).toBe(403)
    expect(mockDoctorStudyReviewFindUnique).not.toHaveBeenCalled()
  })

  it('rol no autorizado (RECEPTIONIST) → 403', async () => {
    setSession({ id: 'u-1', role: 'RECEPTIONIST' })
    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ reviewId: 'review-1' }),
    })
    expect(res.status).toBe(403)
    expect(mockDoctorStudyReviewFindUnique).not.toHaveBeenCalled()
  })

  it('DOCTOR_GENERAL NO puede descargar una revisión ajena (IDOR bloqueado)', async () => {
    setSession({ id: 'doctor-X', role: 'DOCTOR_GENERAL' })
    // La revisión pertenece a otro médico.
    mockDoctorStudyReviewFindUnique.mockResolvedValue({
      ...REVIEW_BASE,
      reviewedByUserId: 'doctor-OTHER',
    })

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ reviewId: 'review-1' }),
    })

    expect(res.status).toBe(403)
    // El body genérico NO debe filtrar PII (no menciona UUIDs ni nombres).
    const text = await res.text()
    expect(text).not.toMatch(/Juan/)
    expect(text).not.toMatch(/P[eé]rez/)
    expect(text).not.toMatch(/Dr\. A/)
  })

  it('DOCTOR_GENERAL SÍ puede descargar SU PROPIA revisión', async () => {
    setSession({ id: 'doctor-X', role: 'DOCTOR_GENERAL' })
    mockDoctorStudyReviewFindUnique.mockResolvedValue({
      ...REVIEW_BASE,
      reviewedByUserId: 'doctor-X',
    })
    mockGenerateEspirometryValidatedPdf.mockResolvedValue({
      buffer: Buffer.from('%PDF-1.4 fake'),
      hash: 'sha256:fake',
      url: null, // simular Vercel serverless (sin FS)
      absolutePath: null,
    })

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ reviewId: 'review-1' }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toMatch(/^inline; filename="Espirometria-/)
  })

  it('SUPERADMIN puede descargar CUALQUIER revisión', async () => {
    setSession({ id: 'super-1', role: 'SUPERADMIN' })
    mockDoctorStudyReviewFindUnique.mockResolvedValue({
      ...REVIEW_BASE,
      reviewedByUserId: 'doctor-OTHER',
    })
    mockGenerateEspirometryValidatedPdf.mockResolvedValue({
      buffer: Buffer.from('%PDF-1.4 fake'),
      hash: 'sha256:fake',
      url: null,
      absolutePath: null,
    })

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ reviewId: 'review-1' }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
  })

  it('REVIEWED_REJECTED → 404 (no hay PDF por contrato de SPEC)', async () => {
    setSession({ id: 'doctor-X', role: 'DOCTOR_GENERAL' })
    mockDoctorStudyReviewFindUnique.mockResolvedValue({
      ...REVIEW_BASE,
      doctorStatus: 'REVIEWED_REJECTED',
      reviewedByUserId: 'doctor-X',
    })

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ reviewId: 'review-1' }),
    })

    expect(res.status).toBe(404)
    expect(mockGenerateEspirometryValidatedPdf).not.toHaveBeenCalled()
  })

  it('revisión inexistente → 404 genérico (no enumera)', async () => {
    setSession({ id: 'doctor-X', role: 'DOCTOR_GENERAL' })
    mockDoctorStudyReviewFindUnique.mockResolvedValue(null)

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ reviewId: 'no-existe' }),
    })

    expect(res.status).toBe(404)
  })

  it('fast-path: si el PDF existe en disco se sirve SIN llamar al generador (QA P3-E)', async () => {
    setSession({ id: 'doctor-X', role: 'DOCTOR_GENERAL' })
    mockDoctorStudyReviewFindUnique.mockResolvedValue({
      ...REVIEW_BASE,
      reviewedByUserId: 'doctor-X',
      validatedPdfUrl: 'espirometry-pdfs/review-1.pdf',
    })
    mockReadFile.mockResolvedValue(Buffer.from('%PDF-1.4 disk'))

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ reviewId: 'review-1' }),
    })

    expect(res.status).toBe(200)
    expect(mockReadFile).toHaveBeenCalledTimes(1)
    // El path debe apuntar a <repo>/uploads/espirometry-pdfs/review-1.pdf,
    // NO a <repo>/uploads/uploads/...  (P3-E: sin duplicación de prefijo).
    const pathArg = mockReadFile.mock.calls[0][0]
    expect(String(pathArg)).not.toMatch(/uploads\/uploads/)
    expect(String(pathArg)).toMatch(/espirometry-pdfs\/review-1\.pdf$/)
    expect(mockGenerateEspirometryValidatedPdf).not.toHaveBeenCalled()
  })
})
