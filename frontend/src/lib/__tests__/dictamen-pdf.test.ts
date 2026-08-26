/**
 * @file Tests focalales (V1) para el builder del dictamen general
 *   (`buildDictamenPdfPayload`, `dictamenInputFileName`,
 *   `dictamenSignedFileName`, `sanitizeEventId`).
 *
 * @id IMPL-FEATURE-20260825-03 (ronda 7 / FND-20260825-24)
 * @finding discovery/FINDINGS.md FND-20260825-24
 *
 * Cubre (helper puro — sin DOM, sin FS):
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
 */
import { describe, it, expect } from 'vitest'
import {
  buildDictamenPdfPayload,
  dictamenInputFileName,
  dictamenSignedFileName,
  sanitizeEventId,
  type BuildDictamenPayloadInput,
} from '@/lib/dictamen-pdf'

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

describe('IMPL-FEATURE-20260825-03 ronda 7: builder del dictamen general', () => {
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
    const out = buildDictamenPdfPayload(
      baseInput({ company: null }),
    )
    expect(out.company).toBeUndefined()
  })

  it('buildDictamenPdfPayload: recommendations=null → undefined', () => {
    const out = buildDictamenPdfPayload(
      baseInput({ recommendations: null }),
    )
    expect(out.recommendations).toBeUndefined()
  })

  it('buildDictamenPdfPayload: studies normaliza extractedData (sin undefined)', () => {
    // FND-20260825-24 / contrato de MedicalDictamenPDF: `extractedData`
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
    // Sin validator → falla explícitamente en runtime (no auto-firma).
    // En TS no podemos quitar el campo required, así que validamos que
    // el builder respeta exactamente lo que recibe.
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
})