/**
 * @file Tests focales (V1) para la server action `signMedicalDictamPDF`.
 *
 * @id IMPL-FEATURE-20260825-03 (ronda 8 / FND-20260825-25)
 * @finding discovery/FINDINGS.md FND-20260825-25
 * @decision discovery/DECISIONS.md DEC-20260825-21
 * @businessRule discovery/BUSINESS-RULES.md BR-20260825-22
 *
 * Cubre (integración con Prisma + fetch mockeados):
 *   - Sin sesión → `success:false, error:'No autorizado'` (no
 *     auto-firma).
 *   - Event inexistente → error.
 *   - Event sin verdict → error 'No hay dictamen para firmar'.
 *   - Event con verdict sin identidad del validador → error.
 *   - **REGRESIÓN FND-20260825-25** (ronda 8 — contrato upload-only +
 *     sign-pdf):
 *     1) `signMedicalDictamPDF` resuelve Event + Verdict + Validador.
 *     2) Renderiza `<MedicalDictamenPDF>` en MEMORIA
 *        (`renderToBuffer` sin disco — Vercel-safe).
 *     3) POST `/api/v1/upload-only` con FormData(`file=<Blob>`,
 *        `key=<basename>`) — el backend persiste.
 *     4) POST `/api/v1/sign-pdf` con `input_pdf=<basename>`,
 *        `output_pdf=<basename>`.
 *     5) Si el backend responde `success`, actualiza
 *        `MedicalVerdict.{signatureHash, pdfUrl, signedAt}` y
 *        `MedicalEvent.status='COMPLETED'`.
 *     6) Devuelve `{ success:true, fileName }`.
 *   - Si el render falla, NO se hace upload ni sign (Vercel-safe).
 *   - Si el upload-only falla, NO se llama al firmador.
 *   - Si el firmador responde 404, la action devuelve el error sin
 *     corromper `MedicalVerdict`.
 *   - `MedicalVerdict` queda intacto cuando el flujo falla
 *     (no se hace update).
 *   - El output PDF no se escribe en filesystem Vercel
 *     (`<repo>/uploads/`) — todo va al backend vía HTTP.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────
const mockGetServerSession = vi.fn()
const mockMedicalEventFindUnique = vi.fn()
const mockMedicalEventUpdate = vi.fn()
const mockMedicalVerdictUpdate = vi.fn()
const mockRevalidatePath = vi.fn()
const mockRenderDictamenInputToMemory = vi.fn()
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
  renderDictamenInputToMemory: (...a: unknown[]) =>
    mockRenderDictamenInputToMemory(...a),
  dictamenInputFileName: (...a: unknown[]) =>
    mockDictamenInputFileName(...a),
  dictamenSignedFileName: (...a: unknown[]) =>
    mockDictamenSignedFileName(...a),
  dictamenBackendUrl: () => 'http://localhost:8000',
  // IMPL-20260826-06: helper de folio corto para bloques consolidados.
  deriveEventShortId: (id: string) =>
    (id ?? '').split('-')[0]?.toUpperCase() ?? '',
}))

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
  mockRenderDictamenInputToMemory.mockReset()
  mockDictamenInputFileName.mockReset()
  mockDictamenSignedFileName.mockReset()
  mockFetch.mockReset()

  // Helpers por defecto (los tests pueden sobrescribir con mockReturnValue).
  mockDictamenInputFileName.mockImplementation(
    (eventId: string, nowMs: number) =>
      `dictamen-${eventId}-${nowMs}.pdf`,
  )
  mockDictamenSignedFileName.mockImplementation(
    (eventId: string) => `dictamen-${eventId}-signed.pdf`,
  )
  mockRenderDictamenInputToMemory.mockResolvedValue(
    Buffer.from('%PDF-1.4 mock'),
  )

  global.fetch = mockFetch as unknown as typeof fetch
})

describe('signMedicalDictamPDF — IMPL-FEATURE-20260825-03 ronda 8 (FND-20260825-25)', () => {
  // ─── Auth ─────────────────────────────────────────────────────────────
  it('sin sesión → 401 (no auto-firma)', async () => {
    setSession(null)
    const res = await signMedicalDictamPDF('event-1')
    expect(res.success).toBe(false)
    expect(res.error).toBe('No autorizado')
    expect(mockMedicalEventFindUnique).not.toHaveBeenCalled()
    expect(mockRenderDictamenInputToMemory).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // ─── Lookup failures ──────────────────────────────────────────────────
  it('event inexistente → error sin renderizar PDF ni llamar upload/sign', async () => {
    setSession({ id: 'doctor-1', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue(null)

    const res = await signMedicalDictamPDF('event-1')

    expect(res.success).toBe(false)
    expect(res.error).toBe('Evento no encontrado')
    expect(mockRenderDictamenInputToMemory).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('event sin verdict → error sin renderizar PDF ni llamar upload/sign', async () => {
    setSession({ id: 'doctor-1', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue(
      makeBaseEvent({ verdict: null }),
    )

    const res = await signMedicalDictamPDF('event-1')

    expect(res.success).toBe(false)
    expect(res.error).toBe('No hay dictamen para firmar')
    expect(mockRenderDictamenInputToMemory).not.toHaveBeenCalled()
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
    expect(mockRenderDictamenInputToMemory).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // ─── REGRESIÓN FND-20260825-25 (caso feliz — upload + sign) ────────────
  it('REGRESIÓN FND-20260825-25: flujo feliz — render memoria → upload-only → sign-pdf → MedicalVerdict', async () => {
    setSession({ id: 'doctor-1', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue(makeBaseEvent())
    // upload-only responde success, sign-pdf responde success.
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          status: 'success',
          key: 'dictamen-event-1-1700000000000.pdf',
          file_url: '/api/files/dictamen-event-1-1700000000000.pdf',
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
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

    // 1. Render se llamó con el snapshot del Verdict.
    expect(mockRenderDictamenInputToMemory).toHaveBeenCalledTimes(1)
    const renderCall = mockRenderDictamenInputToMemory.mock.calls[0][0]
    expect(renderCall.payload.eventId).toBe('event-1')
    expect(renderCall.payload.verdictId).toBe('verdict-1')
    expect(renderCall.payload.validator.fullName).toBe(
      'Dra. María González',
    )

    // 2. fetch se llamó DOS veces: upload-only + sign-pdf.
    expect(mockFetch).toHaveBeenCalledTimes(2)
    const [uploadUrl, uploadInit] = mockFetch.mock.calls[0]
    expect(uploadUrl).toMatch(/\/api\/v1\/upload-only$/)
    expect(uploadInit.method).toBe('POST')
    expect(uploadInit.body).toBeInstanceOf(FormData)
    // El FormData lleva `file` (Blob) y `key` (basename).
    const formData = uploadInit.body as FormData
    expect(formData.get('key')).toMatch(/^dictamen-event-1-\d+\.pdf$/)
    expect(formData.get('file')).toBeInstanceOf(Blob)

    // NO Content-Type manual — fetch lo genera con boundary.
    expect(uploadInit.headers).toBeUndefined()

    const [signUrl, signInit] = mockFetch.mock.calls[1]
    expect(signUrl).toMatch(/\/api\/v1\/sign-pdf$/)
    const signBody = JSON.parse(signInit.body)
    expect(signBody.input_pdf).toMatch(/^dictamen-event-1-\d+\.pdf$/)
    expect(signBody.output_pdf).toBe('dictamen-event-1-signed.pdf')
    expect(signBody.reason).toBe('Dictamen Médico AMI')

    // 3. MedicalEvent.status='COMPLETED'.
    expect(mockMedicalEventUpdate).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: { status: 'COMPLETED' },
    })

    // 4. MedicalVerdict con hash + pdfUrl (basename firmado) + signedAt.
    expect(mockMedicalVerdictUpdate).toHaveBeenCalledTimes(1)
    const updateArg = mockMedicalVerdictUpdate.mock.calls[0][0]
    expect(updateArg.where).toEqual({ eventId: 'event-1' })
    expect(updateArg.data.signatureHash).toBe('sha256:abc')
    expect(updateArg.data.pdfUrl).toBe('dictamen-event-1-signed.pdf')
    expect(updateArg.data.signedAt).toBeInstanceOf(Date)

    // 5. Revalidación.
    expect(mockRevalidatePath).toHaveBeenCalledWith('/portal/events')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/events/event-1')
  })

  // ─── REGRESIÓN: si el render falla, NO se hace upload ni sign ──────────
  it('REGRESIÓN FND-20260825-25: si el render FALLA, NO se sube ni se firma', async () => {
    setSession({ id: 'doctor-1', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue(makeBaseEvent())
    mockRenderDictamenInputToMemory.mockRejectedValueOnce(
      new Error('MedicalDictamenPDF props inválidas'),
    )

    const res = await signMedicalDictamPDF('event-1')

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/No se pudo generar el PDF del dictamen/)
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockMedicalVerdictUpdate).not.toHaveBeenCalled()
    expect(mockMedicalEventUpdate).not.toHaveBeenCalled()
  })

  // ─── REGRESIÓN: si upload-only falla, NO se llama al firmador ──────────
  it('REGRESIÓN FND-20260825-25: si upload-only FALLA, NO se llama al firmador', async () => {
    setSession({ id: 'doctor-1', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue(makeBaseEvent())
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({
        error: 'No se pudo persistir el archivo',
      }),
    } as unknown as Response)

    const res = await signMedicalDictamPDF('event-1')

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/No se pudo persistir el archivo/)
    // Sólo se llamó a upload-only; sign-pdf nunca se invoca.
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockMedicalVerdictUpdate).not.toHaveBeenCalled()
  })

  it('upload-only status="error" → error devuelto', async () => {
    setSession({ id: 'doctor-1', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue(makeBaseEvent())
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        status: 'error',
        error: 'key inválida (path traversal o absoluta no permitida)',
      }),
    } as unknown as Response)

    const res = await signMedicalDictamPDF('event-1')

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/key inválida/)
    expect(mockMedicalVerdictUpdate).not.toHaveBeenCalled()
  })

  it('upload-only network error → error devuelto', async () => {
    setSession({ id: 'doctor-1', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue(makeBaseEvent())
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED upload'))

    const res = await signMedicalDictamPDF('event-1')

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/ECONNREFUSED|No se pudo contactar al backend/)
    expect(mockMedicalVerdictUpdate).not.toHaveBeenCalled()
  })

  // ─── sign-pdf 404 (input no encontrado) ─────────────────────────────────
  it('sign-pdf 404 → error devuelto sin corromper MedicalVerdict', async () => {
    setSession({ id: 'doctor-1', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue(makeBaseEvent())
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ status: 'success', key: 'dictamen-event-1-1.pdf' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({
          detail: 'Archivo no encontrado: dictamen-event-1-1.pdf',
        }),
      } as unknown as Response)

    const res = await signMedicalDictamPDF('event-1')

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Archivo no encontrado/)
    expect(mockMedicalVerdictUpdate).not.toHaveBeenCalled()
    expect(mockMedicalEventUpdate).not.toHaveBeenCalled()
  })

  // ─── Backend sin output_pdf (usa el fallback canónico) ────────────────
  it('sign-pdf sin output_pdf → usa el fallback dictamen-<eventId>-signed.pdf', async () => {
    setSession({ id: 'doctor-1', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue(makeBaseEvent())
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ status: 'success', key: 'dictamen-event-1-1.pdf' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          status: 'success',
          signature_hash: 'sha256:fallback',
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

  // ─── Identity: no se inventa validator.fullName ────────────────────────
  it('NO inventa identidad: validator.fullName del snapshot del Verdict', async () => {
    setSession({ id: 'doctor-1', role: 'DOCTOR_GENERAL' })
    mockMedicalEventFindUnique.mockResolvedValue(
      makeBaseEvent({
        verdict: {
          ...makeBaseEvent().verdict,
          validator: {
            ...makeBaseEvent().verdict.validator,
            fullName: 'Dr. Snapshot Real',
          },
        },
      }),
    )
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'success' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'success',
          output_pdf: 'dictamen-event-1-signed.pdf',
          signature_hash: 'sha256:real',
        }),
      } as unknown as Response)
    mockMedicalEventUpdate.mockResolvedValue({})
    mockMedicalVerdictUpdate.mockResolvedValue({})

    await signMedicalDictamPDF('event-1')

    const renderCall = mockRenderDictamenInputToMemory.mock.calls[0][0]
    expect(renderCall.payload.validator.fullName).toBe('Dr. Snapshot Real')
    expect(renderCall.payload.validator.fullName).not.toBe('Dr. Demo')
  })
})