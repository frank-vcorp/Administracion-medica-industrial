/**
 * @file Tests focales (V1) para el endpoint autenticado de descarga del PDF
 *   consolidado de Examen Médico (`/api/pdf/examen-medico/[eventId]`).
 * @id IMPL-FEATURE-20260825-03
 * @backup context/SPECs/SPEC-FEATURE-20260825-03-EXAMEN-MEDICO-ENTREGABLE.md
 * @adr context/decisions/ADR-20260825-02-EXAMEN-MEDICO-ENTREGABLE.md
 * @qa context/reviews/QA-20260825-03-FEATURE-20260825-03.md (P1-1, P2-3, P3-1)
 * @finding discovery/FINDINGS.md FND-20260825-18
 *
 * Cobertura:
 *  - Sin sesión → 401, no se hace lookup del Event ni se filtra PII.
 *  - Rol no autorizado (CAPTURIST, RECEPTIONIST, ...) → 403, no se hace
 *    lookup del Event.
 *  - **REGRESIÓN P1-1 / FND-20260825-18**: `COMPANY_CLIENT` → **403** sin
 *    importar empresa. El portal corporativo NO recibe el PDF clínico
 *    consolidado (PII clínica: AHF, APNP toxicomanías, APP, GO,
 *    exploración, firma). Sólo recibe el dictamen reducido vía
 *    `/api/pdf/[eventId]` (legacy, también autenticada tras P1-2).
 *  - DOCTOR_GENERAL/DOCTOR_VALIDATOR pueden descargar cualquier Event
 *    (la papeleta es la unidad de trabajo del médico).
 *  - SUPERADMIN puede descargar cualquier Event.
 *  - Sin `MedicalVerdict` firmado → 404 ("Dictamen aún no emitido").
 *  - **REGRESIÓN P2-3**: `physicalExamData.aptitud` vacía → **409
 *    Conflict** (gate ADR R6 reforzado — el dictamen debe incluir
 *    aptitud canónica).
 *  - Fast-path: si `verdict.pdfUrl` apunta a un archivo que existe,
 *    se sirve desde disco (no se llama al generador).
 *  - Filename `ExamenMedico-<universalId>.pdf` consistente con el patrón
 *    `Dictamen-<universalId>.pdf` / `Espirometria-<universalId>.pdf` /
 *    `Audiometria-<universalId>.pdf`.
 *  - Sin firma/cédula del médico → 410 Gone (regla R6 del ADR).
 *  - **REGRESIÓN P3-1**: tras regenerar en línea con persistencia
 *    exitosa, se cablea `MedicalVerdict.pdfUrl` para que la próxima
 *    descarga use el fast-path.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Mock state ─────────────────────────────────────────────────────────────
const mockMedicalEventFindUnique = vi.fn()
const mockMedicalVerdictUpdate = vi.fn()
const mockGetServerSession = vi.fn()
const mockReadFile = vi.fn()
const mockGenerateExamenMedicoValidatedPdf = vi.fn()
const mockResolveAmiLogoDataUrl = vi.fn()

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))
vi.mock('@/auth', () => ({
  authOptions: {},
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    medicalEvent: {
      findUnique: (...a: unknown[]) => mockMedicalEventFindUnique(...a),
    },
    medicalVerdict: {
      update: (...a: unknown[]) => mockMedicalVerdictUpdate(...a),
    },
  },
}))
vi.mock('node:fs/promises', () => ({
  readFile: (...a: unknown[]) => mockReadFile(...a),
}))
vi.mock('@/lib/examen-medico-pdf', async () => {
  const actual = await vi.importActual<typeof import('@/lib/examen-medico-pdf')>(
    '@/lib/examen-medico-pdf'
  )
  return {
    ...actual,
    generateExamenMedicoValidatedPdf: (...a: unknown[]) =>
      mockGenerateExamenMedicoValidatedPdf(...a),
    resolveAmiLogoDataUrl: (...a: unknown[]) => mockResolveAmiLogoDataUrl(...a),
  }
})

// Importamos DESPUÉS de los mocks.
import { GET } from '../route'

function setSession(opts: { id?: string; role?: string; companyId?: string } | null) {
  if (!opts || !opts.id) {
    mockGetServerSession.mockResolvedValue(null)
    return
  }
  mockGetServerSession.mockResolvedValue({
    user: {
      id: opts.id,
      role: opts.role ?? 'DOCTOR_GENERAL',
      companyId: opts.companyId ?? null,
    },
  })
}

function makeRequest(): Request {
  return new Request('http://localhost/api/pdf/examen-medico/event-1')
}

const EVENT_BASE = {
  id: 'event-1',
  worker: {
    firstName: 'Juan',
    lastName: 'Pérez',
    universalId: 'U-1',
    dob: new Date('1985-04-12T00:00:00.000Z'),
    companyId: 'company-A',
    company: { name: 'ACME S.A.' },
    clinicalHistory: {
      data: {
        datos_personales: { puesto_actual: 'Operador' },
      },
    },
  },
  exam: {
    physicalExamData: {
      aptitud: 'APTO',
      audiometria_texto: 'Audiometría: normal',
      espirometria_texto: 'Espirometría: normal',
      examen_medico_texto: 'Examen: sin alteraciones',
    },
    eyeAcuityData: {},
    somatometryData: { peso_kg: '75.5', talla_m: '1.75', imc: '24.65' },
    vitalSignsData: { ta_sistolica: '120', ta_diastolica: '80', fc_min: '72' },
  },
  verdict: {
    id: 'verdict-1',
    finalDiagnosis: 'Sano, apto para el puesto.',
    recommendations: '1.- Mejorar hábitos alimenticios',
    signedAt: new Date('2026-08-25T12:00:00.000Z'),
    pdfUrl: null,
    signatureHash: null,
    validator: {
      id: 'doctor-1',
      fullName: 'Dra. María González',
      professionalLicense: '12345678',
      signatureImageUrl: 'data:image/png;base64,SIG',
    },
  },
  studies: [
    {
      serviceName: 'Audiometría',
      aiPrediction: null,
      extractedData: {},
    },
  ],
  labs: [],
}

beforeEach(() => {
  mockMedicalEventFindUnique.mockReset()
  mockMedicalVerdictUpdate.mockReset().mockResolvedValue({})
  mockGetServerSession.mockReset()
  mockReadFile.mockReset()
  mockGenerateExamenMedicoValidatedPdf.mockReset()
  mockResolveAmiLogoDataUrl.mockReset().mockResolvedValue(null)
})

describe('GET /api/pdf/examen-medico/[eventId] — IMPL-FEATURE-20260825-03 auth/IDOR', () => {
  it('sin sesión → 401 y NO se consulta el Event', async () => {
    setSession(null)
    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })
    expect(res.status).toBe(401)
    expect(mockMedicalEventFindUnique).not.toHaveBeenCalled()
  })

  it('rol no autorizado (CAPTURIST) → 403 y NO se consulta el Event', async () => {
    setSession({ id: 'u-1', role: 'CAPTURIST' })
    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })
    expect(res.status).toBe(403)
    expect(mockMedicalEventFindUnique).not.toHaveBeenCalled()
  })

  it('rol no autorizado (RECEPTIONIST) → 403', async () => {
    setSession({ id: 'u-1', role: 'RECEPTIONIST' })
    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })
    expect(res.status).toBe(403)
    expect(mockMedicalEventFindUnique).not.toHaveBeenCalled()
  })

  // ─── REGRESIÓN P1-1 / FND-20260825-18 ──────────────────────────────────
  it('REGRESIÓN P1-1: COMPANY_CLIENT con SU empresa → 403 (portal NO recibe PDF clínico)', async () => {
    setSession({
      id: 'cc-1',
      role: 'COMPANY_CLIENT',
      companyId: 'company-A', // MISMA empresa que el Event
    })

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })

    expect(res.status).toBe(403)
    // NO debe llegar a consultar el Event ni a generar PDF.
    expect(mockMedicalEventFindUnique).not.toHaveBeenCalled()
    expect(mockGenerateExamenMedicoValidatedPdf).not.toHaveBeenCalled()
    const text = await res.text()
    expect(text).not.toMatch(/Juan/)
    expect(text).not.toMatch(/P[eé]rez/)
    expect(text).not.toMatch(/12345678/)
  })

  it('REGRESIÓN P1-1: COMPANY_CLIENT con OTRA empresa → 403 (portal NO recibe PDF clínico)', async () => {
    setSession({
      id: 'cc-1',
      role: 'COMPANY_CLIENT',
      companyId: 'company-OTHER',
    })

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })

    expect(res.status).toBe(403)
    expect(mockMedicalEventFindUnique).not.toHaveBeenCalled()
    expect(mockGenerateExamenMedicoValidatedPdf).not.toHaveBeenCalled()
  })

  // ─── Roles clínicos ──────────────────────────────────────────────────────
  it('DOCTOR_GENERAL puede descargar cualquier Event (papeleta es su unidad)', async () => {
    setSession({ id: 'doctor-X', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue(EVENT_BASE)
    mockGenerateExamenMedicoValidatedPdf.mockResolvedValue({
      buffer: Buffer.from('%PDF-1.4 fake'),
      hash: 'sha256:fake',
      url: null,
      absolutePath: null,
    })

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toMatch(
      /^inline; filename="ExamenMedico-/
    )
  })

  it('DOCTOR_VALIDATOR puede descargar cualquier Event', async () => {
    setSession({ id: 'doctor-X', role: 'DOCTOR_VALIDATOR' })
    mockMedicalEventFindUnique.mockResolvedValue(EVENT_BASE)
    mockGenerateExamenMedicoValidatedPdf.mockResolvedValue({
      buffer: Buffer.from('%PDF-1.4 fake'),
      hash: 'sha256:fake',
      url: null,
      absolutePath: null,
    })

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })

    expect(res.status).toBe(200)
  })

  it('SUPERADMIN puede descargar CUALQUIER Event', async () => {
    setSession({ id: 'super-1', role: 'SUPERADMIN' })
    mockMedicalEventFindUnique.mockResolvedValue(EVENT_BASE)
    mockGenerateExamenMedicoValidatedPdf.mockResolvedValue({
      buffer: Buffer.from('%PDF-1.4 fake'),
      hash: 'sha256:fake',
      url: null,
      absolutePath: null,
    })

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })

    expect(res.status).toBe(200)
  })

  it('sin MedicalVerdict firmado → 404 (PDF requiere dictamen)', async () => {
    setSession({ id: 'doctor-X', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue({
      ...EVENT_BASE,
      verdict: null,
    })

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })

    expect(res.status).toBe(404)
    expect(mockGenerateExamenMedicoValidatedPdf).not.toHaveBeenCalled()
  })

  // ─── REGRESIÓN P2-3 ──────────────────────────────────────────────────────
  it('REGRESIÓN P2-3: aptitud vacía en physicalExamData → 409 (gate ADR R6)', async () => {
    setSession({ id: 'doctor-X', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue({
      ...EVENT_BASE,
      exam: {
        ...EVENT_BASE.exam,
        physicalExamData: {
          ...EVENT_BASE.exam.physicalExamData,
          aptitud: '', // sin aptitud
        },
      },
    })

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })

    expect(res.status).toBe(409)
    expect(mockGenerateExamenMedicoValidatedPdf).not.toHaveBeenCalled()
  })

  it('REGRESIÓN P2-3: aptitud undefined en physicalExamData → 409', async () => {
    setSession({ id: 'doctor-X', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue({
      ...EVENT_BASE,
      exam: {
        ...EVENT_BASE.exam,
        physicalExamData: {
          audiometria_texto: 'normal',
          // sin `aptitud`
        },
      },
    })

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })

    expect(res.status).toBe(409)
  })

  it('sin firma/cédula del médico → 410 Gone (R6 ADR: gate de identidad congelada)', async () => {
    setSession({ id: 'doctor-X', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue({
      ...EVENT_BASE,
      verdict: {
        ...EVENT_BASE.verdict,
        validator: {
          ...EVENT_BASE.verdict.validator,
          signatureImageUrl: null,
        },
      },
    })

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })

    expect(res.status).toBe(410)
    expect(mockGenerateExamenMedicoValidatedPdf).not.toHaveBeenCalled()
  })

  it('Event inexistente → 404 genérico (no enumera)', async () => {
    setSession({ id: 'doctor-X', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue(null)

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'no-existe' }),
    })

    expect(res.status).toBe(404)
  })

  it('fast-path: si el PDF existe en disco se sirve SIN llamar al generador', async () => {
    setSession({ id: 'doctor-X', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue({
      ...EVENT_BASE,
      verdict: {
        ...EVENT_BASE.verdict,
        pdfUrl: 'examen-medico-pdfs/event-1.pdf',
      },
    })
    mockReadFile.mockResolvedValue(Buffer.from('%PDF-1.4 disk'))

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })

    expect(res.status).toBe(200)
    expect(mockReadFile).toHaveBeenCalledTimes(1)
    const pathArg = mockReadFile.mock.calls[0][0]
    // Sin duplicación del prefijo `uploads/` (paridad con QA P3-E).
    expect(String(pathArg)).not.toMatch(/uploads\/uploads/)
    expect(String(pathArg)).toMatch(/examen-medico-pdfs\/event-1\.pdf$/)
    expect(mockGenerateExamenMedicoValidatedPdf).not.toHaveBeenCalled()
    // Fast-path NO debe escribir MedicalVerdict.pdfUrl (ya estaba).
    expect(mockMedicalVerdictUpdate).not.toHaveBeenCalled()
  })

  it('regenera en línea con snapshot congelado del médico cuando no hay archivo', async () => {
    setSession({ id: 'doctor-X', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue(EVENT_BASE)
    mockGenerateExamenMedicoValidatedPdf.mockResolvedValue({
      buffer: Buffer.from('%PDF-1.4 fake'),
      hash: 'sha256:fake',
      url: null,
      absolutePath: null,
    })

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })

    expect(res.status).toBe(200)
    expect(mockGenerateExamenMedicoValidatedPdf).toHaveBeenCalledTimes(1)
    expect(mockResolveAmiLogoDataUrl).toHaveBeenCalledTimes(1)
  })

  // ─── REGRESIÓN P3-1 ──────────────────────────────────────────────────────
  it('REGRESIÓN P3-1: tras regenerar con persistencia exitosa, se cablea MedicalVerdict.pdfUrl', async () => {
    setSession({ id: 'doctor-X', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue(EVENT_BASE)
    mockGenerateExamenMedicoValidatedPdf.mockResolvedValue({
      buffer: Buffer.from('%PDF-1.4 fake'),
      hash: 'sha256:fake',
      url: 'examen-medico-pdfs/event-1.pdf',
      absolutePath: '/repo/uploads/examen-medico-pdfs/event-1.pdf',
    })

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })

    expect(res.status).toBe(200)
    expect(mockMedicalVerdictUpdate).toHaveBeenCalledTimes(1)
    expect(mockMedicalVerdictUpdate).toHaveBeenCalledWith({
      where: { eventId: 'event-1' },
      data: { pdfUrl: 'examen-medico-pdfs/event-1.pdf' },
    })
  })

  it('REGRESIÓN P3-1: sin persistencia (Vercel serverless) NO se escribe MedicalVerdict', async () => {
    setSession({ id: 'doctor-X', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue(EVENT_BASE)
    mockGenerateExamenMedicoValidatedPdf.mockResolvedValue({
      buffer: Buffer.from('%PDF-1.4 fake'),
      hash: 'sha256:fake',
      url: null, // sin FS escribible
      absolutePath: null,
    })

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })

    expect(res.status).toBe(200)
    expect(mockMedicalVerdictUpdate).not.toHaveBeenCalled()
  })
})