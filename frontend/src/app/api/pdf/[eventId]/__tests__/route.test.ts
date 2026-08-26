/**
 * @file Tests focales (V1) para el endpoint legacy `/api/pdf/[eventId]`.
 * @id IMPL-FEATURE-20260825-03 / FND-20260825-18 / P1-2 (QA-20260825-03)
 * @finding discovery/FINDINGS.md FND-20260825-18
 *
 * REGRESIÓN P1-2: la ruta legacy sirve el dictamen reducido
 * (`MedicalDictamenPDF`) que consume el portal corporativo. Antes de
 * este fix la ruta era PÚBLICA: cualquier petición con un `eventId`
 * válido descargaba el PDF clínico (IDOR). Ahora exige:
 *  - Sesión activa (sin sesión → 401, sin lookup).
 *  - Roles clínicos (SUPERADMIN/DOCTOR_*) → cualquier Event.
 *  - COMPANY_CLIENT → sólo el Event cuyo `worker.companyId ===
 *    session.user.companyId`.
 *  - Otros roles → 403.
 *
 * Estos tests cierran P1-2 (QA-20260825-03) verificando:
 *  - Sin sesión → 401 sin filtrar PII.
 *  - CAPTURIST/RECEPTIONIST → 403 sin lookup.
 *  - COMPANY_CLIENT con empresa ajena → 403 (NO enumera eventos).
 *  - COMPANY_CLIENT con SU empresa → 200.
 *  - DOCTOR_GENERAL/SUPERADMIN → 200.
 *  - Event inexistente → 404.
 *  - COMPANY_CLIENT sin companyId en sesión → 403.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Mock state ─────────────────────────────────────────────────────────────
const mockMedicalVerdictFindUnique = vi.fn()
const mockGetServerSession = vi.fn()
const mockReadFile = vi.fn()
const mockRenderToStream = vi.fn()

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))
vi.mock('@/auth', () => ({
  authOptions: {},
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    medicalVerdict: {
      findUnique: (...a: unknown[]) => mockMedicalVerdictFindUnique(...a),
    },
  },
}))
vi.mock('node:fs/promises', () => ({
  readFile: (...a: unknown[]) => mockReadFile(...a),
}))
vi.mock('@react-pdf/renderer', async () => {
  const actual = await vi.importActual<typeof import('@react-pdf/renderer')>(
    '@react-pdf/renderer'
  )
  return {
    ...actual,
    renderToStream: (...a: unknown[]) => mockRenderToStream(...a),
  }
})

// Importamos DESPUÉS de los mocks.
import { GET } from '../route'

function setSession(
  opts:
    | { id?: string; role?: string; companyId?: string | null }
    | null
) {
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
  return new Request('http://localhost/api/pdf/event-1')
}

const VERDICT_BASE = {
  id: 'verdict-1',
  eventId: 'event-1',
  finalDiagnosis: 'Sano, apto para el puesto.',
  recommendations: '1.- Mejorar hábitos alimenticios',
  signedAt: new Date('2026-08-25T12:00:00.000Z'),
  pdfUrl: null,
  signatureHash: null,
  validator: {
    fullName: 'Dra. María González',
  },
  event: {
    worker: {
      firstName: 'Juan',
      lastName: 'Pérez',
      universalId: 'U-1',
      companyId: 'company-A',
      company: { name: 'ACME S.A.' },
    },
    studies: [],
    labs: [],
  },
}

beforeEach(() => {
  mockMedicalVerdictFindUnique.mockReset()
  mockGetServerSession.mockReset()
  mockReadFile.mockReset()
  mockRenderToStream
    .mockReset()
    .mockResolvedValue({} as unknown as ReadableStream)
})

describe('REGRESIÓN P1-2 / FND-20260825-18: GET /api/pdf/[eventId] — auth/IDOR legacy', () => {
  it('sin sesión → 401 y NO se consulta el verdict (antes era PÚBLICA)', async () => {
    setSession(null)
    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })
    expect(res.status).toBe(401)
    expect(mockMedicalVerdictFindUnique).not.toHaveBeenCalled()
  })

  it('rol no autorizado (CAPTURIST) → 403 y NO se consulta el verdict', async () => {
    setSession({ id: 'u-1', role: 'CAPTURIST' })
    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })
    expect(res.status).toBe(403)
    expect(mockMedicalVerdictFindUnique).not.toHaveBeenCalled()
  })

  it('rol no autorizado (RECEPTIONIST) → 403 y NO se consulta el verdict', async () => {
    setSession({ id: 'u-1', role: 'RECEPTIONIST' })
    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })
    expect(res.status).toBe(403)
    expect(mockMedicalVerdictFindUnique).not.toHaveBeenCalled()
  })

  it('COMPANY_CLIENT con OTRA empresa → 403 (IDOR bloqueado)', async () => {
    setSession({
      id: 'cc-1',
      role: 'COMPANY_CLIENT',
      companyId: 'company-OTHER',
    })
    mockMedicalVerdictFindUnique.mockResolvedValue(VERDICT_BASE)

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })

    expect(res.status).toBe(403)
    const text = await res.text()
    // El body genérico NO debe filtrar PII.
    expect(text).not.toMatch(/Juan/)
    expect(text).not.toMatch(/P[eé]rez/)
    expect(text).not.toMatch(/Dra\. Mar[ií]a/)
  })

  it('COMPANY_CLIENT con SU empresa → 200 (portal corporativo recibe dictamen reducido)', async () => {
    setSession({
      id: 'cc-1',
      role: 'COMPANY_CLIENT',
      companyId: 'company-A',
    })
    mockMedicalVerdictFindUnique.mockResolvedValue(VERDICT_BASE)

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toMatch(
      /^inline; filename="Dictamen-/
    )
  })

  it('COMPANY_CLIENT sin companyId en sesión → 403 (no puede scope-ar)', async () => {
    setSession({
      id: 'cc-1',
      role: 'COMPANY_CLIENT',
      companyId: null,
    })
    mockMedicalVerdictFindUnique.mockResolvedValue(VERDICT_BASE)

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })

    expect(res.status).toBe(403)
  })

  it('DOCTOR_GENERAL puede descargar cualquier Event (papeleta es su unidad)', async () => {
    setSession({ id: 'doctor-X', role: 'DOCTOR_GENERAL' })
    mockMedicalVerdictFindUnique.mockResolvedValue(VERDICT_BASE)

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
  })

  it('SUPERADMIN puede descargar CUALQUIER Event', async () => {
    setSession({ id: 'super-1', role: 'SUPERADMIN' })
    mockMedicalVerdictFindUnique.mockResolvedValue(VERDICT_BASE)

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })

    expect(res.status).toBe(200)
  })

  it('verdict inexistente → 404 genérico (no enumera)', async () => {
    setSession({ id: 'doctor-X', role: 'DOCTOR_GENERAL' })
    mockMedicalVerdictFindUnique.mockResolvedValue(null)

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'no-existe' }),
    })

    expect(res.status).toBe(404)
  })

  it('fast-path: si verdict.pdfUrl existe en disco, se sirve SIN regenerar', async () => {
    setSession({ id: 'doctor-X', role: 'DOCTOR_GENERAL' })
    mockMedicalVerdictFindUnique.mockResolvedValue({
      ...VERDICT_BASE,
      pdfUrl: 'dictamen-event-1-signed.pdf',
    })
    mockReadFile.mockResolvedValue(Buffer.from('%PDF-1.4 disk'))

    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })

    expect(res.status).toBe(200)
    expect(mockReadFile).toHaveBeenCalledTimes(1)
    expect(mockRenderToStream).not.toHaveBeenCalled()
  })
})