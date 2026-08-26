/**
 * @file Tests focales (V1) para `reemitSignedDictamen` (FND-20260826-03).
 *
 *   Cubre el flujo de re-emisión explícita del dictamen general con el
 *   renderer AMI vigente (`ExamenMedicoValidatedPDF`):
 *   - Sin sesión → 401.
 *   - Roles no clínicos (COMPANY_CLIENT, COMPANY_ADMIN, RECEPTIONIST)
 *     → 403 ("Sin permisos para re-emitir").
 *   - Event inexistente / sin Verdict / sin Validador → error estructurado.
 *   - `MedicalVerdict.pdfUrl` faltante → "nunca fue firmado".
 *   - Render falla → NO se hace upload ni sign.
 *   - upload-only falla → NO se hace sign.
 *   - sign-pdf falla → NO se actualiza Verdict.
 *   - Flujo feliz → render → upload-only → sign-pdf → update Verdict con
 *     nuevo `signedKey` + `signedAt`.
 *   - El Verdict se actualiza CON un `signedKey` DIFERENTE al anterior
 *     (sustituye la versión antigua — FND-20260826-03 explícito).
 *   - El `validator.fullName` se PRESERVA del Verdict original (no se
 *     inventa un médico nuevo).
 *   - El consolidado por cita pasa `consolidatedEvents` al renderer
 *     AMI (DEC-20260826-01).
 *
 * @id IMPL-20260826-08 (FIX FND-20260826-03)
 * @finding discovery/FINDINGS.md FND-20260826-03
 * @businessRule discovery/BUSINESS-RULES.md BR-20260825-17
 * @businessRule discovery/BUSINESS-RULES.md BR-20260826-01
 * @businessRule discovery/BUSINESS-RULES.md BR-20260826-02
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────
const mockGetServerSession = vi.fn()
const mockMedicalEventFindUnique = vi.fn()
const mockMedicalVerdictUpdate = vi.fn()
const mockRevalidatePath = vi.fn()
const mockBuildDictamenGeneralAmiConsolidado = vi.fn()
const mockGenerateExamenMedicoValidatedPdf = vi.fn()

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))
vi.mock('@/auth', () => ({ authOptions: {} }))

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

vi.mock('@/lib/dictamen-general-ami', () => ({
  buildDictamenGeneralAmiConsolidado: (...a: unknown[]) =>
    mockBuildDictamenGeneralAmiConsolidado(...a),
  hasConsolidation: (r: { eventIds: string[] }) => r.eventIds.length > 1,
}))
vi.mock('@/lib/examen-medico-pdf', () => ({
  buildExamenMedicoPdfData: (input: unknown) => input,
  generateExamenMedicoValidatedPdf: (...a: unknown[]) =>
    mockGenerateExamenMedicoValidatedPdf(...a),
}))

vi.mock('next/cache', () => ({
  revalidatePath: (...a: unknown[]) => mockRevalidatePath(...a),
}))

// `signature.actions` no necesita mock de Prisma si el mock del helper
// AMI intercepta la carga de Event+Verdict+Studies+Labs.

const mockFetch = vi.fn()
global.fetch = mockFetch as unknown as typeof fetch

// Importamos DESPUÉS de los mocks.
const { reemitSignedDictamen } = await import('@/actions/signature.actions')

function setSession(opts: { id?: string; role?: string } | null) {
  if (!opts || !opts.id) {
    mockGetServerSession.mockResolvedValue(null)
    return
  }
  mockGetServerSession.mockResolvedValue({
    user: {
      id: opts.id,
      role: opts.role ?? 'DOCTOR_GENERAL',
      fullName: 'Dr. Snapshot Reemit',
      companyId: 'comp-1',
    },
  })
}

function buildMockConsolidado(opts: {
  includeSiblings?: boolean
  hasPdfUrl?: boolean
  validatorName?: string | null
} = {}) {
  const verdict = {
    id: 'verdict-1',
    finalDiagnosis: 'Apto con restricciones',
    recommendations: 'Uso de EPP',
    signedAt: new Date('2026-08-25T12:00:00.000Z'),
    signatureHash: 'sha256:old-hash',
    pdfUrl: opts.hasPdfUrl === false ? null : 'dictamen-old-key.pdf',
  }
  return {
    data: {
      folio: verdict.id,
      signedAt: verdict.signedAt,
      status: 'SIGNED' as const,
      worker: {
        firstName: 'Juan',
        lastName: 'Pérez',
        universalId: 'U-1',
      },
      ahf: { otras: null },
      apnp: { alcohol: null },
      historiaOcupacional: { empresa: null },
      app: { texto: null },
      historiaGineco: null,
      inmunizaciones: null,
      somatometria: { peso: null, talla: null },
      agudezaVisual: {
        visionLejanaOD: null,
        visionLejanaOI: null,
      },
      exploracion: { neurologico: null },
      impresionDiagnostica: verdict.finalDiagnosis,
      aptitud: 'APTO',
      restricciones: null,
      observacionesFinales: null,
      notaCondicionamiento: null,
      medico: {
        fullName: opts.validatorName ?? 'Dr. Original',
        professionalLicense: 'CED-1',
        signatureImageUrl: null,
      },
      slots: { audiometria: null },
      ia: null,
      logoDataUrl: null,
      consolidatedEvents: opts.includeSiblings
        ? [
            {
              eventId: 'evt-current',
              eventShortId: 'EVTCURRENT',
              isCurrent: true,
              studies: [{ serviceName: 'Audiometría', extractedData: null }],
              labs: [],
            },
            {
              eventId: 'evt-sibling',
              eventShortId: 'EVTSIBLING',
              isCurrent: false,
              studies: [],
              labs: [{ serviceName: 'Biometría', extractedData: null }],
            },
          ]
        : [
            {
              eventId: 'evt-current',
              eventShortId: 'EVTCURRENT',
              isCurrent: true,
              studies: [{ serviceName: 'Audiometría', extractedData: null }],
              labs: [],
            },
          ],
    },
    atencionResolution: {
      eventIds: opts.includeSiblings
        ? ['evt-current', 'evt-sibling']
        : ['evt-current'],
      appointmentId: opts.includeSiblings ? 'appt-1' : null,
      hasAppointment: !!opts.includeSiblings,
      workerId: 'worker-1',
    },
    verdict,
  }
}

beforeEach(() => {
  mockGetServerSession.mockReset()
  mockBuildDictamenGeneralAmiConsolidado.mockReset()
  mockGenerateExamenMedicoValidatedPdf.mockReset()
  mockMedicalVerdictUpdate.mockReset()
  mockRevalidatePath.mockReset()
  mockFetch.mockReset()
  delete process.env.PDF_SIGN_PASSWORD
})

describe('IMPL-20260826-08: reemitSignedDictamen (FND-20260826-03)', () => {
  // ─── Defensas de auth ──────────────────────────────────────────────
  it('sin sesión → 401 "No autorizado"', async () => {
    setSession(null)
    const res = await reemitSignedDictamen('evt-1')
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/No autorizado/i)
    expect(mockBuildDictamenGeneralAmiConsolidado).not.toHaveBeenCalled()
  })

  it('COMPANY_CLIENT NO puede re-emitir (gate de rol)', async () => {
    setSession({ id: 'u-1', role: 'COMPANY_CLIENT' })
    const res = await reemitSignedDictamen('evt-1')
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Sin permisos/i)
    expect(mockBuildDictamenGeneralAmiConsolidado).not.toHaveBeenCalled()
  })

  it('RECEPTIONIST NO puede re-emitir (gate de rol)', async () => {
    setSession({ id: 'u-1', role: 'RECEPTIONIST' })
    const res = await reemitSignedDictamen('evt-1')
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Sin permisos/i)
  })

  // ─── Defensas de Verdict ──────────────────────────────────────────
  it('helper AMI lanza "Event no encontrado" → error', async () => {
    setSession({ id: 'u-1', role: 'DOCTOR_GENERAL' })
    mockBuildDictamenGeneralAmiConsolidado.mockRejectedValueOnce(
      new Error('Event no encontrado: evt-ghost'),
    )
    const res = await reemitSignedDictamen('evt-ghost')
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Event no encontrado/i)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('helper AMI lanza "No hay Verdict" → error', async () => {
    setSession({ id: 'u-1', role: 'DOCTOR_GENERAL' })
    mockBuildDictamenGeneralAmiConsolidado.mockRejectedValueOnce(
      new Error('No hay dictamen emitido para este Event.'),
    )
    const res = await reemitSignedDictamen('evt-1')
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/No hay dictamen/i)
  })

  it('helper AMI lanza "Validador sin fullName" → error', async () => {
    setSession({ id: 'u-1', role: 'DOCTOR_GENERAL' })
    mockBuildDictamenGeneralAmiConsolidado.mockRejectedValueOnce(
      new Error('El médico firmante no tiene identidad registrada.'),
    )
    const res = await reemitSignedDictamen('evt-1')
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/identidad/i)
  })

  it('Verdict sin pdfUrl (nunca firmado) → error explícito', async () => {
    setSession({ id: 'u-1', role: 'DOCTOR_GENERAL' })
    mockBuildDictamenGeneralAmiConsolidado.mockResolvedValueOnce(
      buildMockConsolidado({ hasPdfUrl: false }) as never,
    )
    const res = await reemitSignedDictamen('evt-1')
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/nunca fue firmado|nunca ha sido firmado|Verdict no tiene/i)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // ─── Fallas en el flujo (sin corromper Verdict) ────────────────────
  it('render AMI falla → NO se hace upload ni sign', async () => {
    setSession({ id: 'u-1', role: 'DOCTOR_GENERAL' })
    mockBuildDictamenGeneralAmiConsolidado.mockResolvedValueOnce(
      buildMockConsolidado() as never,
    )
    mockGenerateExamenMedicoValidatedPdf.mockRejectedValueOnce(
      new Error('Renderer crash'),
    )

    const res = await reemitSignedDictamen('evt-1')
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/No se pudo generar el PDF/i)
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockMedicalVerdictUpdate).not.toHaveBeenCalled()
  })

  it('upload-only falla → NO se llama al firmador ni se actualiza Verdict', async () => {
    setSession({ id: 'u-1', role: 'DOCTOR_GENERAL' })
    mockBuildDictamenGeneralAmiConsolidado.mockResolvedValueOnce(
      buildMockConsolidado() as never,
    )
    mockGenerateExamenMedicoValidatedPdf.mockResolvedValueOnce({
      buffer: Buffer.from('%PDF-1.4 stub'),
      hash: 'sha256:abc',
      url: null,
      absolutePath: null,
    })
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => ({ error: 'upstream failed' }),
    })

    const res = await reemitSignedDictamen('evt-1')
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/upstream failed|Bad Gateway|Error del backend/i)
    // Sólo se llamó a upload-only; sign-pdf nunca se invoca.
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockMedicalVerdictUpdate).not.toHaveBeenCalled()
  })

  it('sign-pdf falla → NO se actualiza Verdict', async () => {
    setSession({ id: 'u-1', role: 'DOCTOR_GENERAL' })
    mockBuildDictamenGeneralAmiConsolidado.mockResolvedValueOnce(
      buildMockConsolidado() as never,
    )
    mockGenerateExamenMedicoValidatedPdf.mockResolvedValueOnce({
      buffer: Buffer.from('%PDF-1.4 stub'),
      hash: 'sha256:abc',
      url: null,
      absolutePath: null,
    })
    // upload-only OK
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 'success' }),
    })
    // sign-pdf falla
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ detail: 'signer unavailable' }),
    })

    const res = await reemitSignedDictamen('evt-1')
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/signer unavailable|Internal Server Error/i)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockMedicalVerdictUpdate).not.toHaveBeenCalled()
  })

  // ─── Flujo feliz (REGRESIÓN FND-20260826-03) ───────────────────────
  it('REGRESIÓN FND-20260826-03: re-emite con renderer AMI y sustituye el signedKey', async () => {
    setSession({ id: 'u-1', role: 'DOCTOR_GENERAL' })
    const oldSignedKey = 'dictamen-old-key.pdf'
    const newSignedKey = 'dictamen-evt-1-reemit-1700000000000-signed.pdf'
    mockBuildDictamenGeneralAmiConsolidado.mockResolvedValueOnce(
      buildMockConsolidado({ includeSiblings: true }) as never,
    )
    mockGenerateExamenMedicoValidatedPdf.mockResolvedValueOnce({
      buffer: Buffer.from('%PDF-1.4 stub-ami'),
      hash: 'sha256:new-ami',
      url: null,
      absolutePath: null,
    })
    // upload-only OK
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 'success' }),
    })
    // sign-pdf OK con output_pdf DIFERENTE al anterior
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'success',
        output_pdf: newSignedKey,
        signature_hash: 'sha256:reemit-hash',
      }),
    })
    mockMedicalVerdictUpdate.mockResolvedValueOnce({})

    const res = await reemitSignedDictamen('evt-1')

    expect(res.success).toBe(true)
    expect(res.fileName).toBe(newSignedKey)
    expect(res.previousSignedKey).toBe(oldSignedKey)
    expect(res.pdfUrl).toBe('/api/pdf/evt-1')
    expect(res.siblingCount).toBe(2)
    // Mensaje explícito sobre la sustitución.
    expect(res.message).toMatch(/sustituye/i)
    expect(res.message).toMatch(/anterior/i)
    expect(res.reemittedAt).toBeInstanceOf(Date)

    // Verificar que el Verdict se actualizó con el NUEVO signedKey.
    expect(mockMedicalVerdictUpdate).toHaveBeenCalledTimes(1)
    const updateArg = mockMedicalVerdictUpdate.mock.calls[0][0] as {
      where: { eventId: string }
      data: { pdfUrl: string; signatureHash: string; signedAt: Date }
    }
    expect(updateArg.where.eventId).toBe('evt-1')
    expect(updateArg.data.pdfUrl).toBe(newSignedKey)
    expect(updateArg.data.pdfUrl).not.toBe(oldSignedKey)
    expect(updateArg.data.signatureHash).toBe('sha256:reemit-hash')

    // Verificar que el renderer AMI fue llamado con el consolidado.
    expect(mockGenerateExamenMedicoValidatedPdf).toHaveBeenCalledTimes(1)
    const renderArg = mockGenerateExamenMedicoValidatedPdf.mock.calls[0][0] as {
      data: { consolidatedEvents: Array<{ isCurrent: boolean }> }
      eventId: string
    }
    expect(renderArg.eventId).toBe('evt-1')
    expect(renderArg.data.consolidatedEvents).toHaveLength(2)

    // Verificar llamadas HTTP: upload-only + sign-pdf.
    expect(mockFetch).toHaveBeenCalledTimes(2)
    // Primera llamada = upload-only con key reemit.
    const uploadCall = mockFetch.mock.calls[0]
    expect(uploadCall[0]).toMatch(/\/api\/v1\/upload-only/)
    expect(uploadCall[1].method).toBe('POST')
    const uploadForm = uploadCall[1].body as FormData
    expect(uploadForm.get('key')).toMatch(/^dictamen-evt-1-reemit-/)
    // Segunda llamada = sign-pdf con input_pdf/output_pdf reemit.
    const signCall = mockFetch.mock.calls[1]
    expect(signCall[0]).toMatch(/\/api\/v1\/sign-pdf/)
    const signBody = JSON.parse(signCall[1].body as string)
    expect(signBody.input_pdf).toMatch(/^dictamen-evt-1-reemit-/)
    expect(signBody.output_pdf).toMatch(/^dictamen-evt-1-reemit-.*-signed\.pdf$/)

    // revalidatePath fue llamado.
    expect(mockRevalidatePath).toHaveBeenCalledWith('/portal/events')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/events/evt-1')
  })

  // ─── Garantía BR-20260826-02: validator.fullName se PRESERVA ────────
  it('BR-20260826-02: el validator.fullName del Verdict original NO se sustituye', async () => {
    // Si el helper AMI respeta la identidad del firmante original
    // (NO la inventa), el `medico.fullName` del payload que llega al
    // renderer debe ser el del snapshot persistido en Prisma.
    setSession({ id: 'u-1', role: 'DOCTOR_GENERAL' })
    mockBuildDictamenGeneralAmiConsolidado.mockImplementationOnce(
      async () => {
        const r = buildMockConsolidado({
          validatorName: 'Dr. Snapshot Original',
        })
        return r
      },
    )
    mockGenerateExamenMedicoValidatedPdf.mockResolvedValueOnce({
      buffer: Buffer.from('%PDF-1.4 stub'),
      hash: 'sha256:abc',
      url: null,
      absolutePath: null,
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 'success' }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'success',
        output_pdf: 'dictamen-evt-1-reemit-1-signed.pdf',
        signature_hash: 'sha256:reemit-hash',
      }),
    })
    mockMedicalVerdictUpdate.mockResolvedValueOnce({})

    await reemitSignedDictamen('evt-1')

    // El renderer AMI recibió el medico.fullName del helper, que es
    // "Dr. Snapshot Original" (NO "Dr. Snapshot Reemit" de la sesión).
    const renderArg = mockGenerateExamenMedicoValidatedPdf.mock.calls[0][0] as {
      data: {
        medico: { fullName: string }
      }
    }
    expect(renderArg.data.medico.fullName).toBe('Dr. Snapshot Original')
    // Y NO se actualizó el validator.fullName del Verdict.
    const updateArg = mockMedicalVerdictUpdate.mock.calls[0][0] as {
      data: Record<string, unknown>
    }
    expect(updateArg.data).not.toHaveProperty('validator')
    expect(updateArg.data).not.toHaveProperty('medico')
  })

  // ─── Garantía BR-20260826-01: consolidatedEvents se pasa al AMI ─────
  it('BR-20260826-01: pasa consolidatedEvents al renderer AMI (consolidación por cita)', async () => {
    setSession({ id: 'u-1', role: 'DOCTOR_GENERAL' })
    mockBuildDictamenGeneralAmiConsolidado.mockResolvedValueOnce(
      buildMockConsolidado({ includeSiblings: true }) as never,
    )
    mockGenerateExamenMedicoValidatedPdf.mockResolvedValueOnce({
      buffer: Buffer.from('%PDF-1.4 stub'),
      hash: 'sha256:abc',
      url: null,
      absolutePath: null,
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 'success' }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'success',
        output_pdf: 'dictamen-evt-1-reemit-2-signed.pdf',
        signature_hash: 'sha256:reemit-hash',
      }),
    })
    mockMedicalVerdictUpdate.mockResolvedValueOnce({})

    const res = await reemitSignedDictamen('evt-1')

    expect(res.success).toBe(true)
    expect(res.siblingCount).toBe(2)
    const renderArg = mockGenerateExamenMedicoValidatedPdf.mock.calls[0][0] as {
      data: {
        consolidatedEvents: Array<{ isCurrent: boolean; eventId: string }>
      }
    }
    expect(renderArg.data.consolidatedEvents).toHaveLength(2)
    expect(renderArg.data.consolidatedEvents[0].isCurrent).toBe(true)
    expect(renderArg.data.consolidatedEvents[1].isCurrent).toBe(false)
  })

  // ─── Sin consolidación → siblingCount = 1 ──────────────────────────
  it('sin hermanos (1:1 legacy) → siblingCount=1, consolidatedEvents=1', async () => {
    setSession({ id: 'u-1', role: 'DOCTOR_GENERAL' })
    mockBuildDictamenGeneralAmiConsolidado.mockResolvedValueOnce(
      buildMockConsolidado({ includeSiblings: false }) as never,
    )
    mockGenerateExamenMedicoValidatedPdf.mockResolvedValueOnce({
      buffer: Buffer.from('%PDF-1.4 stub'),
      hash: 'sha256:abc',
      url: null,
      absolutePath: null,
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 'success' }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'success',
        output_pdf: 'dictamen-evt-1-reemit-3-signed.pdf',
        signature_hash: 'sha256:reemit-hash',
      }),
    })
    mockMedicalVerdictUpdate.mockResolvedValueOnce({})

    const res = await reemitSignedDictamen('evt-1')

    expect(res.success).toBe(true)
    expect(res.siblingCount).toBe(1)
  })
})
