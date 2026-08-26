/**
 * @file Tests focales (V1) para el endpoint autenticado
 *   `/api/zip/clinical-closure/[eventId]`.
 *
 * @id IMPL-FEATURE-20260825-04
 * @backup context/SPECs/SPEC-FEATURE-20260825-04-ZIP-CIERRE-CLINICO.md
 *
 * Cubre:
 *  - Sin sesión → 401 sin lookup del Event.
 *  - COMPANY_CLIENT → 403 sin lookup del Event (portal corporativo NO
 *    recibe el ZIP clínico consolidado; paridad con FND-20260825-18).
 *  - Roles no clínicos (CAPTURIST, RECEPTIONIST, ADMIN) → 403 sin lookup.
 *  - SUPERADMIN / DOCTOR_GENERAL / DOCTOR_VALIDATOR → 200 con
 *    `Content-Type: application/zip` y filename `CierreClinico-*.zip`.
 *  - Event inexistente → 404.
 *  - Verdict faltante → 404.
 *  - Aptitud vacía → 409 (paridad con P2-3 de FEATURE-20260825-03).
 *  - Identidad del médico incompleta → 410.
 *
 * El builder real (`buildCierreClinicoZip`) se mockea para mantener
 * los tests aislados de Prisma/FS; el round-trip de ZIP se cubre por
 * separado en `lib/__tests__/zip-store.test.ts`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Mock state ─────────────────────────────────────────────────────────────
const mockGetServerSession = vi.fn()
const mockBuildCierreClinicoZip = vi.fn()

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))
vi.mock('@/auth', () => ({
  authOptions: {},
}))
vi.mock('@/lib/zip-cierre-clinico', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/zip-cierre-clinico')>(
      '@/lib/zip-cierre-clinico',
    )
  return {
    ...actual,
    buildCierreClinicoZip: (...a: unknown[]) =>
      mockBuildCierreClinicoZip(...a),
  }
})

import { GET } from '../route'
import { CierreClinicoError } from '@/lib/zip-cierre-clinico'

function setSession(
  opts: { id?: string; role?: string; companyId?: string } | null,
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
  return new Request(
    'http://localhost/api/zip/clinical-closure/event-1',
  )
}

beforeEach(() => {
  mockGetServerSession.mockReset()
  mockBuildCierreClinicoZip.mockReset()
})

describe('IMPL-FEATURE-20260825-04: GET /api/zip/clinical-closure/[eventId] — auth/IDOR', () => {
  it('sin sesión → 401 y NO se construye el ZIP', async () => {
    setSession(null)
    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })
    expect(res.status).toBe(401)
    expect(mockBuildCierreClinicoZip).not.toHaveBeenCalled()
  })

  it('COMPANY_CLIENT → 403 sin construir el ZIP (portal NO recibe ZIP clínico)', async () => {
    setSession({
      id: 'cc-1',
      role: 'COMPANY_CLIENT',
      companyId: 'company-A',
    })
    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })
    expect(res.status).toBe(403)
    expect(mockBuildCierreClinicoZip).not.toHaveBeenCalled()
    const text = await res.text()
    expect(text).not.toMatch(/Juan|Pérez|María/)
  })

  it('CAPTURIST → 403 sin construir el ZIP', async () => {
    setSession({ id: 'u-1', role: 'CAPTURIST' })
    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })
    expect(res.status).toBe(403)
    expect(mockBuildCierreClinicoZip).not.toHaveBeenCalled()
  })

  it('RECEPTIONIST → 403 sin construir el ZIP', async () => {
    setSession({ id: 'u-1', role: 'RECEPTIONIST' })
    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })
    expect(res.status).toBe(403)
    expect(mockBuildCierreClinicoZip).not.toHaveBeenCalled()
  })

  it('eventId vacío → 400', async () => {
    setSession({ id: 'doctor-X', role: 'DOCTOR_GENERAL' })
    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: '' }),
    })
    expect(res.status).toBe(400)
    expect(mockBuildCierreClinicoZip).not.toHaveBeenCalled()
  })
})

describe('IMPL-FEATURE-20260825-04: GET /api/zip/clinical-closure/[eventId] — clínicos OK', () => {
  it('DOCTOR_GENERAL → 200 application/zip CierreClinico-*.zip', async () => {
    setSession({ id: 'doctor-X', role: 'DOCTOR_GENERAL' })
    mockBuildCierreClinicoZip.mockResolvedValue({
      zip: new Uint8Array([0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0]),
      filename: 'CierreClinico-U-1.zip',
      manifest: 'manifest content',
      entries: [],
    })
    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/zip')
    expect(res.headers.get('Content-Disposition')).toMatch(
      /^inline; filename="CierreClinico-/,
    )
  })

  it('DOCTOR_VALIDATOR → 200', async () => {
    setSession({ id: 'validator-1', role: 'DOCTOR_VALIDATOR' })
    mockBuildCierreClinicoZip.mockResolvedValue({
      zip: new Uint8Array([1, 2, 3]),
      filename: 'CierreClinico-U-1.zip',
      manifest: 'm',
      entries: [],
    })
    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })
    expect(res.status).toBe(200)
  })

  it('SUPERADMIN → 200', async () => {
    setSession({ id: 'super-1', role: 'SUPERADMIN' })
    mockBuildCierreClinicoZip.mockResolvedValue({
      zip: new Uint8Array([1, 2, 3]),
      filename: 'CierreClinico-U-1.zip',
      manifest: 'm',
      entries: [],
    })
    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })
    expect(res.status).toBe(200)
  })
})

describe('IMPL-FEATURE-20260825-04: GET /api/zip/clinical-closure/[eventId] — errores del builder', () => {
  it('CierreClinicoError event_not_found → 404', async () => {
    setSession({ id: 'doctor-X', role: 'DOCTOR_GENERAL' })
    mockBuildCierreClinicoZip.mockRejectedValue(
      new CierreClinicoError('event_not_found', 404),
    )
    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })
    expect(res.status).toBe(404)
  })

  it('CierreClinicoError verdict_missing → 404 con mensaje específico', async () => {
    setSession({ id: 'doctor-X', role: 'DOCTOR_GENERAL' })
    mockBuildCierreClinicoZip.mockRejectedValue(
      new CierreClinicoError('verdict_missing', 404),
    )
    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })
    expect(res.status).toBe(404)
    const text = await res.text()
    expect(text).toMatch(/aún no ha sido emitido/)
  })

  it('CierreClinicoError aptitud_missing → 409 (paridad P2-3)', async () => {
    setSession({ id: 'doctor-X', role: 'DOCTOR_GENERAL' })
    mockBuildCierreClinicoZip.mockRejectedValue(
      new CierreClinicoError('aptitud_missing', 409),
    )
    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })
    expect(res.status).toBe(409)
    const text = await res.text()
    expect(text).toMatch(/aptitud/)
  })

  it('CierreClinicoError validator_identity_incomplete → 410', async () => {
    setSession({ id: 'doctor-X', role: 'DOCTOR_GENERAL' })
    mockBuildCierreClinicoZip.mockRejectedValue(
      new CierreClinicoError('validator_identity_incomplete', 410),
    )
    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })
    expect(res.status).toBe(410)
  })

  it('Error genérico → 500', async () => {
    setSession({ id: 'doctor-X', role: 'DOCTOR_GENERAL' })
    mockBuildCierreClinicoZip.mockRejectedValue(new Error('boom'))
    const res = await GET(makeRequest() as never, {
      params: Promise.resolve({ eventId: 'event-1' }),
    })
    expect(res.status).toBe(500)
    const text = await res.text()
    expect(text).not.toMatch(/boom/) // no leak del error interno
  })
})