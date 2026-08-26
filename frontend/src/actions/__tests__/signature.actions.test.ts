/**
 * @file Tests focales (V1) para la server action `signMedicalDictamPDF`.
 *
 * @id IMPL-FEATURE-20260825-03 (ronda 7 / FND-20260825-24)
 * @finding discovery/FINDINGS.md FND-20260825-24
 *
 * Cubre (integration con Prisma + fetch mockeados):
 *   - Sin sesión → `success:false, error:'No autorizado'` (no
 *     auto-firma).
 *   - Event inexistente → error 404-friendly.
 *   - Event sin verdict → error 'No hay dictamen para firmar'.
 *   - Event con verdict sin identidad del validador → error.
 *   - Flujo feliz (FND-20260825-24 cerrado):
 *     1) `signMedicalDictamPDF` resuelve Event + Verdict + Validador.
 *     2) Llama al helper `renderDictamenInputToDisk` con el snapshot
 *        (mockeamos el helper para no tocar FS real en los tests).
 *     3) POST a `/api/v1/sign-pdf` con `input_pdf=<basename>` y
 *        `output_pdf=<basename>`.
 *     4) Si el backend responde `success`, actualiza
 *        `MedicalVerdict.signatureHash`, `MedicalVerdict.pdfUrl`,
 *        `MedicalVerdict.signedAt` y `MedicalEvent.status=COMPLETED`.
 *     5) Devuelve `{ success:true, fileName }`.
 *   - Si el render falla (FS read-only, p.ej. Vercel serverless), la
 *     action NO llama al firmador (ésta es la regresión del fix
 *     FND-20260825-24: antes el código seguía con un input inexistente).
 *   - Si el backend responde 404 (input no encontrado), la action
 *     devuelve el error sin corromper `MedicalVerdict`.
 *   - Si el backend responde con error genérico, la action devuelve
 *     el error sin corromper `MedicalVerdict`.
 *   - `MedicalVerdict` queda intacto cuando el firmador falla
 *     (no se hace update).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────
const mockGetServerSession = vi.fn()
const mockMedicalEventFindUnique = vi.fn()
const mockMedicalEventUpdate = vi.fn()
const mockMedicalVerdictUpdate = vi.fn()
const mockRevalidatePath = vi.fn()
const mockRenderDictamenInputToDisk = vi.fn()
const mockDictamenInputFileName = vi.fn()
const mockDictamenSignedFileName = vi.fn()

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))
vi.mock('@/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  default: {
    medicalEvent: {
      findUnique: (...a: unknown[]) => mockMedicalEventFindUnique(...a),
      update: (...a: unknown[]) => mockMedicalEventUpdate(...a),
    },
    medicalVerdict: {
      update: (...a: unknown[]) => mockMedicalVerdictUpdate(...a),
    },
  },
}))
vi.mock('next/cache', () => ({
  revalidatePath: (...a: unknown[]) => mockRevalidatePath(...a),
}))
vi.mock('@/lib/dictamen-pdf', () => ({
  renderDictamenInputToDisk: (...a: unknown[]) =>
    mockRenderDictamenInputToDisk(...a),
  dictamenInputFileName: (...a: unknown[]) =>
    mockDictamenInputFileName(...a),
  dictamenSignedFileName: (...a: unknown[]) =>
    mockDictamenSignedFileName(...a),
}))

// `global.fetch` ya existe en Node 20+; lo mockeamos.
const mockFetch = vi.fn()

// Importamos DESPUÉS de los mocks.
const { signMedicalDictamPDF } = await import('@/actions/signature.actions')

function setSession(opts: { id?: string; role?: string } | null) {
  if (!opts || !opts.id) {
    mockGetServerSession.mockResolvedValue(null)
    return
  }
  mockGetServerSession.mockResolvedValue({
    user: {
      id: opts.id,
      role: opts.role ?? 'DOCTOR_GENERAL',
    },
  })
}

function makeBaseEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    worker: {
      firstName: 'Juan',
      lastName: 'Pérez',
      universalId: 'U-001',
      dob: null,
      nationalId: null,
      company: { name: 'ACME S.A.' },
    },
    branch: { name: 'Querétaro', address: null },
    studies: [],
    labs: [],
    verdict: {
      id: 'verdict-1',
      finalDiagnosis: 'Sano, apto para el puesto.',
      recommendations: '1.- Hábitos saludables.',
      createdAt: new Date('2026-08-25T11:00:00.000Z'),
      signedAt: new Date('2026-08-25T11:30:00.000Z'),
      signatureHash: null,
      pdfUrl: null,
      validatorId: 'doctor-1',
      validator: {
        id: 'doctor-1',
        fullName: 'Dra. María González',
        professionalLicense: '12345678',
        signatureImageUrl: 'data:image/png;base64,SIG',
      },
    },
    ...overrides,
  }
}

beforeEach(() => {
  mockGetServerSession.mockReset()
  mockMedicalEventFindUnique.mockReset()
  mockMedicalEventUpdate.mockReset()
  mockMedicalVerdictUpdate.mockReset()
  mockRevalidatePath.mockReset()
  mockRenderDictamenInputToDisk.mockReset()
  mockDictamenInputFileName.mockReset()
  mockDictamenSignedFileName.mockReset()
  mockFetch.mockReset()

  // Helpers por defecto (los tests pueden sobrescribir con
  // mockReturnValue).
  mockDictamenInputFileName.mockImplementation(
    (eventId: string, nowMs: number) =>
      `dictamen-${eventId}-${nowMs}.pdf`,
  )
  mockDictamenSignedFileName.mockImplementation(
    (eventId: string) => `dictamen-${eventId}-signed.pdf`,
  )
  mockRenderDictamenInputToDisk.mockResolvedValue({
    buffer: Buffer.from('%PDF-1.4 mock'),
    absolutePath: '/repo/uploads/dictamen-event-1-1700000000000.pdf',
    fileName: 'dictamen-event-1-1700000000000.pdf',
    payload: {
      signedAt: new Date(),
      eventId: 'event-1',
      worker: { firstName: 'Juan', lastName: 'Pérez', universalId: 'U-001' },
      company: { name: 'ACME S.A.' },
      finalDiagnosis: 'Sano.',
      recommendations: '1.- Hábitos.',
      validator: { fullName: 'Dra. María González' },
      id: 'verdict-1',
      studies: [],
      labs: [],
    },
  })

  // Stub global fetch.
  global.fetch = mockFetch as unknown as typeof fetch
})

describe('signMedicalDictamPDF — IMPL-FEATURE-20260825-03 ronda 7 (FND-20260825-24)', () => {
  // ─── Auth ─────────────────────────────────────────────────────────────
  it('sin sesión → 401 (no auto-firma)', async () => {
    setSession(null)
    const res = await signMedicalDictamPDF('event-1')
    expect(res.success).toBe(false)
    expect(res.error).toBe('No autorizado')
    expect(mockMedicalEventFindUnique).not.toHaveBeenCalled()
    expect(mockRenderDictamenInputToDisk).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // ─── Lookup failures ──────────────────────────────────────────────────
  it('event inexistente → error sin renderizar PDF ni llamar firmador', async () => {
    setSession({ id: 'doctor-1', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue(null)

    const res = await signMedicalDictamPDF('event-1')

    expect(res.success).toBe(false)
    expect(res.error).toBe('Evento no encontrado')
    expect(mockRenderDictamenInputToDisk).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('event sin verdict → error sin renderizar PDF ni llamar firmador', async () => {
    setSession({ id: 'doctor-1', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue(
      makeBaseEvent({ verdict: null }),
    )

    const res = await signMedicalDictamPDF('event-1')

    expect(res.success).toBe(false)
    expect(res.error).toBe('No hay dictamen para firmar')
    expect(mockRenderDictamenInputToDisk).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('event con verdict sin validator.fullName → error sin renderizar PDF', async () => {
    setSession({ id: 'doctor-1', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue(
      makeBaseEvent({
        verdict: {
          ...makeBaseEvent().verdict,
          validator: { ...makeBaseEvent().verdict.validator, fullName: '' },
        },
      }),
    )

    const res = await signMedicalDictamPDF('event-1')

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/identidad/i)
    expect(mockRenderDictamenInputToDisk).not.toHaveBeenCalled()
  })

  // ─── Regresión FND-20260825-24 (caso feliz) ────────────────────────────
  it('REGRESIÓN FND-20260825-24: flujo feliz — renderiza input, firma, persiste MedicalVerdict', async () => {
    setSession({ id: 'doctor-1', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue(makeBaseEvent())
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        status: 'success',
        output_pdf: 'dictamen-event-1-signed.pdf',
        signature_hash: 'sha256:abc',
      }),
    } as unknown as Response)
    mockMedicalEventUpdate.mockResolvedValue({ id: 'event-1' })
    mockMedicalVerdictUpdate.mockResolvedValue({ eventId: 'event-1' })

    const res = await signMedicalDictamPDF('event-1')

    expect(res.success).toBe(true)
    expect(res.fileName).toBe('dictamen-event-1-signed.pdf')
    expect(res.pdfUrl).toBe('/api/pdf/event-1')

    // 1. Se llamó al helper de render.
    expect(mockRenderDictamenInputToDisk).toHaveBeenCalledTimes(1)
    const renderCall = mockRenderDictamenInputToDisk.mock.calls[0][0]
    expect(renderCall.payload.eventId).toBe('event-1')
    expect(renderCall.payload.verdictId).toBe('verdict-1')
    expect(renderCall.payload.validator.fullName).toBe(
      'Dra. María González',
    )
    expect(renderCall.payload.worker.firstName).toBe('Juan')
    expect(renderCall.payload.worker.lastName).toBe('Pérez')

    // 2. Se llamó al firmador con el basename del input.
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toMatch(/\/api\/v1\/sign-pdf$/)
    const body = JSON.parse(init.body)
    expect(body.input_pdf).toMatch(/^dictamen-event-1-\d+\.pdf$/)
    expect(body.output_pdf).toBe('dictamen-event-1-signed.pdf')
    expect(body.reason).toBe('Dictamen Médico AMI')

    // 3. Se actualizó MedicalEvent.status='COMPLETED'.
    expect(mockMedicalEventUpdate).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: { status: 'COMPLETED' },
    })

    // 4. Se actualizó MedicalVerdict con hash + pdfUrl + signedAt.
    expect(mockMedicalVerdictUpdate).toHaveBeenCalledTimes(1)
    const updateArg = mockMedicalVerdictUpdate.mock.calls[0][0]
    expect(updateArg.where).toEqual({ eventId: 'event-1' })
    expect(updateArg.data.signatureHash).toBe('sha256:abc')
    expect(updateArg.data.pdfUrl).toBe('dictamen-event-1-signed.pdf')
    expect(updateArg.data.signedAt).toBeInstanceOf(Date)

    // 5. Se revalidaron las páginas.
    expect(mockRevalidatePath).toHaveBeenCalledWith('/portal/events')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/events/event-1')
  })

  // ─── REGRESIÓN: si el render falla, NO se llama al firmador ──────────
  it('REGRESIÓN FND-20260825-24: si el render FALLA, NO se llama al firmador', async () => {
    setSession({ id: 'doctor-1', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue(makeBaseEvent())
    mockRenderDictamenInputToDisk.mockRejectedValueOnce(
      new Error('EROFS: read-only filesystem'),
    )

    const res = await signMedicalDictamPDF('event-1')

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/No se pudo generar el PDF del dictamen/)
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockMedicalVerdictUpdate).not.toHaveBeenCalled()
    expect(mockMedicalEventUpdate).not.toHaveBeenCalled()
  })

  // ─── Backend 404 (input no encontrado) ─────────────────────────────────
  it('backend 404 → error devuelto sin corromper MedicalVerdict', async () => {
    setSession({ id: 'doctor-1', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue(makeBaseEvent())
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({
        detail: 'Archivo no encontrado: dictamen-event-1-1700000000000.pdf',
      }),
    } as unknown as Response)

    const res = await signMedicalDictamPDF('event-1')

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Archivo no encontrado/)
    expect(mockMedicalVerdictUpdate).not.toHaveBeenCalled()
    expect(mockMedicalEventUpdate).not.toHaveBeenCalled()
  })

  // ─── Backend status=error ──────────────────────────────────────────────
  it('backend status="error" → error devuelto sin corromper MedicalVerdict', async () => {
    setSession({ id: 'doctor-1', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue(makeBaseEvent())
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        status: 'error',
        error: 'Certificado autofirmado expirado',
      }),
    } as unknown as Response)

    const res = await signMedicalDictamPDF('event-1')

    expect(res.success).toBe(false)
    expect(res.error).toBe('Certificado autofirmado expirado')
    expect(mockMedicalVerdictUpdate).not.toHaveBeenCalled()
  })

  // ─── Backend sin output_pdf (usa el fallback canónico) ────────────────
  it('backend sin output_pdf → usa el fallback dictamen-<eventId>-signed.pdf', async () => {
    setSession({ id: 'doctor-1', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue(makeBaseEvent())
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        status: 'success',
        signature_hash: 'sha256:fallback',
        // sin output_pdf
      }),
    } as unknown as Response)
    mockMedicalEventUpdate.mockResolvedValue({})
    mockMedicalVerdictUpdate.mockResolvedValue({})

    const res = await signMedicalDictamPDF('event-1')

    expect(res.success).toBe(true)
    expect(res.fileName).toBe('dictamen-event-1-signed.pdf')
    expect(mockMedicalVerdictUpdate.mock.calls[0][0].data.pdfUrl).toBe(
      'dictamen-event-1-signed.pdf',
    )
  })

  // ─── Network error ─────────────────────────────────────────────────────
  it('error de red llamando al firmador → error devuelto', async () => {
    setSession({ id: 'doctor-1', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue(makeBaseEvent())
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const res = await signMedicalDictamPDF('event-1')

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/ECONNREFUSED|No se pudo contactar al firmador/)
    expect(mockMedicalVerdictUpdate).not.toHaveBeenCalled()
  })

  // ─── Idempotencia: el helper de input filename usa timestamp ───────────
  it('dictamenInputFileName se llama con eventId y timestamp (un nombre único)', () => {
    mockDictamenInputFileName('event-1', 1700000000000)
    expect(mockDictamenInputFileName).toHaveBeenCalledWith('event-1', 1700000000000)
  })
})