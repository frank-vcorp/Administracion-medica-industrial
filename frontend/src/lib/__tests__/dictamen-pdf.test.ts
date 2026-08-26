/**
 * @file Tests focales (V1) para el builder del dictamen general
 *   (`buildDictamenPdfPayload`, `dictamenInputFileName`,
 *   `dictamenSignedFileName`, `sanitizeEventId`,
 *   `renderDictamenInputToMemory`).
 *
 * @id IMPL-FEATURE-20260825-03 (ronda 8 / FND-20260825-25)
 * @finding discovery/FINDINGS.md FND-20260825-25
 * @decision discovery/DECISIONS.md DEC-20260825-21
 * @businessRule discovery/BUSINESS-RULES.md BR-20260825-22
 *
 * Cubre (helper puro — sin DOM, sin FS, sin red):
 *   - Nombres canónicos de archivos (`dictamen-<eventId>-<ts>.pdf`,
 *     `dictamen-<eventId>-signed.pdf`) — el backend acepta sólo
 *     basenames sin path traversal.
 *   - `sanitizeEventId` neutraliza payloads adversarios (`..`, `/`,
 *     `\`, `\0`, espacios, longitudes absurdas).
 *   - `buildDictamenPdfPayload` mapea correctamente el snapshot
 *     `MedicalEvent` + `MedicalVerdict` al shape que requiere
 *     `<MedicalDictamenPDF>`.
 *   - El shape producido satisface el contrato del componente
 *     (`studies`/`labs` con `extractedData: unknown` no-undefined).
 *
 * REGRESIÓN FND-20260825-25: el helper NO escribe en filesystem.
 * `renderDictamenInputToDisk` (ronda 7) se eliminó en favor de
 * `renderDictamenInputToMemory` (ronda 8). Verificamos que el
 * contrato sigue disponible.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mockear @react-pdf/renderer para evitar DOM/FS en tests.
const mockRenderToBuffer = vi.fn()
vi.mock('@react-pdf/renderer', () => ({
  renderToBuffer: (...a: unknown[]) => mockRenderToBuffer(...a),
  // Componentes `<X />` que no se renderizan en runtime puro:
  Document: () => null,
  Page: () => null,
  Text: () => null,
  View: () => null,
  StyleSheet: { create: (s: unknown) => s },
  Image: () => null,
}))

import {
  buildDictamenPdfPayload,
  dictamenInputFileName,
  dictamenSignedFileName,
  sanitizeEventId,
  renderDictamenInputToMemory,
  dictamenBackendUrl,
  deriveEventShortId,
  type BuildDictamenPayloadInput,
} from '@/lib/dictamen-pdf'
import * as mod from '@/lib/dictamen-pdf'

function baseInput(
  overrides: Partial<BuildDictamenPayloadInput> = {},
): BuildDictamenPayloadInput {
  return {
    eventId: 'event-1',
    verdictId: 'verdict-1',
    signedAt: new Date('2026-08-25T12:00:00.000Z'),
    worker: {
      firstName: 'Juan',
      lastName: 'Pérez',
      universalId: 'U-001',
    },
    company: { name: 'ACME S.A.' },
    finalDiagnosis: 'Sano, apto para el puesto.',
    recommendations: '1.- Continuar con hábitos saludables.',
    validator: { fullName: 'Dra. María González' },
    ...overrides,
  }
}

describe('IMPL-FEATURE-20260825-03 ronda 8: builder del dictamen general', () => {
  // ─── dictamenInputFileName / dictamenSignedFileName ──────────────────────
  it('dictamenInputFileName: dictamen-<eventId>-<timestamp>.pdf', () => {
    expect(dictamenInputFileName('event-1', 1700000000000)).toBe(
      'dictamen-event-1-1700000000000.pdf',
    )
  })

  it('dictamenSignedFileName: dictamen-<eventId>-signed.pdf', () => {
    expect(dictamenSignedFileName('event-1')).toBe(
      'dictamen-event-1-signed.pdf',
    )
  })

  it('los nombres NO contienen path traversal ni caracteres especiales', () => {
    const name = dictamenInputFileName('event-1', 1700000000000)
    expect(name).not.toContain('..')
    expect(name).not.toContain('/')
    expect(name).not.toContain('\\')
    expect(name).not.toContain('\0')
    expect(name).toMatch(/^dictamen-[A-Za-z0-9_-]+-\d+\.pdf$/)
  })

  // ─── sanitizeEventId (defensa en profundidad) ───────────────────────────
  it('sanitizeEventId: acepta UUIDs y slugs alfanuméricos', () => {
    expect(sanitizeEventId('7c6f1c2e-4f8b-4d2b-9b9c-1f9a4d6e7b21')).toBe(
      '7c6f1c2e-4f8b-4d2b-9b9c-1f9a4d6e7b21',
    )
    expect(sanitizeEventId('clx-abc123')).toBe('clx-abc123')
  })

  it('sanitizeEventId: neutraliza payloads adversarios', () => {
    // Inputs sin caracteres seguros → invalid-event-id.
    expect(sanitizeEventId('')).toBe('invalid-event-id')
    expect(sanitizeEventId('!!!')).toBe('invalid-event-id')
    expect(sanitizeEventId('   ')).toBe('invalid-event-id')
    expect(sanitizeEventId('a'.repeat(200))).toBe('invalid-event-id')
    // Inputs con caracteres peligrosos — los strips defensivamente.
    // El residuo NO puede usarse para path traversal porque sólo
    // contiene alfanuméricos + guion/guion bajo, y el backend usa
    // `os.path.basename(...)` que rechaza cualquier `/` o `..`.
    expect(sanitizeEventId('../../../etc/passwd')).toBe('etcpasswd')
    expect(sanitizeEventId('..\\..\\windows')).toBe('windows')
    expect(sanitizeEventId('/etc/passwd')).toBe('etcpasswd')
    expect(sanitizeEventId('event/with/slashes')).toBe('eventwithslashes')
    expect(sanitizeEventId('event with space')).toBe('eventwithspace')
    expect(sanitizeEventId('evt\0attack')).toBe('evtattack')
  })

  // ─── buildDictamenPdfPayload ────────────────────────────────────────────
  it('buildDictamenPdfPayload: mapea el snapshot al shape del componente', () => {
    const out = buildDictamenPdfPayload(baseInput())
    expect(out.signedAt).toBeInstanceOf(Date)
    expect(out.eventId).toBe('event-1')
    expect(out.worker.firstName).toBe('Juan')
    expect(out.worker.lastName).toBe('Pérez')
    expect(out.worker.universalId).toBe('U-001')
    expect(out.company).toEqual({ name: 'ACME S.A.' })
    expect(out.finalDiagnosis).toBe('Sano, apto para el puesto.')
    expect(out.recommendations).toBe('1.- Continuar con hábitos saludables.')
    expect(out.validator).toEqual({ fullName: 'Dra. María González' })
    expect(out.id).toBe('verdict-1')
    expect(out.studies).toEqual([])
    expect(out.labs).toEqual([])
  })

  it('buildDictamenPdfPayload: company=null → undefined (shape compatible)', () => {
    const out = buildDictamenPdfPayload(baseInput({ company: null }))
    expect(out.company).toBeUndefined()
  })

  it('buildDictamenPdfPayload: recommendations=null → undefined', () => {
    const out = buildDictamenPdfPayload(baseInput({ recommendations: null }))
    expect(out.recommendations).toBeUndefined()
  })

  it('buildDictamenPdfPayload: studies normaliza extractedData (sin undefined)', () => {
    // FND-20260825-25 / contrato de MedicalDictamenPDF: `extractedData`
    // debe ser `unknown` (required), no `undefined`. El builder
    // neutraliza entradas parciales.
    const out = buildDictamenPdfPayload(
      baseInput({
        studies: [
          { serviceName: 'Audiometría' }, // sin extractedData
          { serviceName: 'Espirometría', extractedData: { fev1: 3.2 } },
          { serviceName: 'RX', extractedData: null },
        ],
        labs: [{ serviceName: 'Biometría' }],
      }),
    )
    expect(out.studies).toEqual([
      { serviceName: 'Audiometría', extractedData: null },
      { serviceName: 'Espirometría', extractedData: { fev1: 3.2 } },
      { serviceName: 'RX', extractedData: null },
    ])
    expect(out.labs).toEqual([
      { serviceName: 'Biometría', extractedData: null },
    ])
  })

  it('buildDictamenPdfPayload: signedAt acepta string ISO', () => {
    const out = buildDictamenPdfPayload(
      baseInput({ signedAt: '2026-08-25T12:00:00.000Z' }),
    )
    expect(out.signedAt).toBe('2026-08-25T12:00:00.000Z')
  })

  it('buildDictamenPdfPayload: NO inventa identidad — validator.fullName viene del caller', () => {
    const out = buildDictamenPdfPayload(
      baseInput({ validator: { fullName: 'Dr. Snapshot' } }),
    )
    expect(out.validator.fullName).toBe('Dr. Snapshot')
    expect(out.validator.fullName).not.toBe('Dr. Demo')
  })

  it('buildDictamenPdfPayload: idempotente (mismo input → mismo output)', () => {
    const input = baseInput()
    const a = buildDictamenPdfPayload(input)
    const b = buildDictamenPdfPayload(input)
    expect(a).toEqual(b)
  })

  // ─── IMPL-20260826-06: bloques consolidados por atención/cita ─────
  it('buildDictamenPdfPayload: consolidatedEvents vacío por default (compat)', () => {
    // Si el orquestador (signature.actions o zip-cierre-clinico) no
    // los pasa, el payload se construye igual que antes. El renderer
    // omitirá la sección III.B.
    const out = buildDictamenPdfPayload(baseInput())
    expect(out.consolidatedEvents).toEqual([])
  })

  it('buildDictamenPdfPayload: consolidatedEvents preserva isCurrent y eventShortId', () => {
    const out = buildDictamenPdfPayload(
      baseInput({
        consolidatedEvents: [
          {
            eventId: '7c6f1c2e-4f8b-4d2b-9b9c-1f9a4d6e7b21',
            eventShortId: '7C6F1C2E',
            isCurrent: true,
            studies: [
              { serviceName: 'Audiometría', extractedData: { oido: 'normal' } },
            ],
            labs: [],
          },
          {
            eventId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            eventShortId: 'AAAAAAAA',
            isCurrent: false,
            studies: [{ serviceName: 'Espirometría' }],
            labs: [],
          },
        ],
      }),
    )
    expect(out.consolidatedEvents).toHaveLength(2)
    expect(out.consolidatedEvents[0].isCurrent).toBe(true)
    expect(out.consolidatedEvents[0].eventShortId).toBe('7C6F1C2E')
    expect(out.consolidatedEvents[1].isCurrent).toBe(false)
    // Normalización: extractedData undefined → null.
    expect(out.consolidatedEvents[1].studies[0].extractedData).toBeNull()
  })

  it('buildDictamenPdfPayload: NO inventa eventos — sólo refleja el input', () => {
    // Pasamos consolidatedEvents=[] y verificamos que NO se rellena
    // con eventos fantasma.
    const out = buildDictamenPdfPayload(baseInput({ consolidatedEvents: [] }))
    expect(out.consolidatedEvents).toEqual([])
  })

  it('deriveEventShortId: primeros 8 chars uppercase', () => {
    expect(
      deriveEventShortId('7c6f1c2e-4f8b-4d2b-9b9c-1f9a4d6e7b21'),
    ).toBe('7C6F1C2E')
  })

  it('deriveEventShortId: defensa con input inválido', () => {
    expect(deriveEventShortId('')).toBe('')
    expect(deriveEventShortId(null as unknown as string)).toBe('')
    expect(deriveEventShortId('xxx')).toBe('XXX')
  })

  // ─── dictamenBackendUrl ────────────────────────────────────────────────
  it('dictamenBackendUrl: lee NEXT_PUBLIC_API_URL o fallback localhost', () => {
    const original = process.env.NEXT_PUBLIC_API_URL
    delete process.env.NEXT_PUBLIC_API_URL
    expect(dictamenBackendUrl()).toBe('http://localhost:8000')
    process.env.NEXT_PUBLIC_API_URL = 'https://api.medicaindustrial.com'
    expect(dictamenBackendUrl()).toBe('https://api.medicaindustrial.com')
    if (original) process.env.NEXT_PUBLIC_API_URL = original
  })

  // ─── renderDictamenInputToMemory (Vercel-safe — sin FS) ────────────────
  beforeEach(() => {
    mockRenderToBuffer.mockReset()
    mockRenderToBuffer.mockResolvedValue(
      Buffer.from('%PDF-1.4 memory'),
    )
  })

  it('renderDictamenInputToMemory: devuelve un Buffer sin tocar FS', async () => {
    const buf = await renderDictamenInputToMemory({
      payload: baseInput(),
    })
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(mockRenderToBuffer).toHaveBeenCalledTimes(1)
  })

  it('renderDictamenInputToMemory: propaga error del render sin caer a FS', async () => {
    mockRenderToBuffer.mockRejectedValueOnce(
      new Error('MedicalDictamenPDF props inválidas'),
    )
    await expect(
      renderDictamenInputToMemory({ payload: baseInput() }),
    ).rejects.toThrow(/props inválidas/)
  })

  it('REGRESIÓN FND-20260825-25: el módulo NO exporta writeFile ni FS helpers', () => {
    // El helper debe permanecer libre de IO. Verificamos que el
    // barrel NO expone helpers de filesystem que pudieran usarse por
    // accidente en producción Vercel.
    const exportedKeys = Object.keys(
      // Re-evaluar el módulo vía el import top-level no funciona
      // porque Vitest ya lo cacheó, pero `Object.keys` sobre el
      // namespace import muestra exactamente las exports nombradas.
      mod as unknown as Record<string, unknown>,
    )
    expect(exportedKeys).not.toContain('writeFile')
    expect(exportedKeys).not.toContain('mkdir')
    expect(exportedKeys).not.toContain('REPO_UPLOAD_DIR')
    expect(exportedKeys).not.toContain('renderDictamenInputToDisk')
  })
})