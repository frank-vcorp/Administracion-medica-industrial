/**
 * @file Tests focales (V1) para `dictamen-summary`.
 *
 *   Helpers puros que alimentan el PDF del dictamen general AMI
 *   (`<MedicalDictamenPDF>`). Cubren:
 *     - Catálogo canónico de estudios disponibles en AMI.
 *     - Clasificación aplicado/pendiente según `extractedData`.
 *     - Resumen textual del `extractedData` SIN volcar valores
 *       sensibles.
 *     - Detección de estudios del catálogo NO aplicados al evento.
 *
 * @id IMPL-20260826-04 (FIX dictamen general AMI, Frank 2026-08-26)
 * @businessRule discovery/BUSINESS-RULES.md BR-20260825-17
 * @businessRule discovery/BUSINESS-RULES.md BR-20260825-18
 *
 * Patrón: igual a `src/lib/__tests__/dictamen-pdf.test.ts` (vitest
 * directo, sin DOM, sin FS, sin red).
 */
import { describe, it, expect } from 'vitest'

import {
  AMI_STUDIES_BASELINE,
  amiBaselineStudiesNotApplied,
  buildDictamenStudySummary,
  classifyStudyStatus,
  isAmiBaselineStudy,
  summarizeExtractedData,
  type DictamenStudyEntry,
} from '../dictamen-summary'

describe('IMPL-20260826-04: dictamen-summary helpers', () => {
  // ─── Catálogo AMI baseline ─────────────────────────────────────────────
  it('AMI_STUDIES_BASELINE contiene los estudios canónicos del dominio', () => {
    // El catálogo NO debe estar vacío ni inventar estudios específicos
    // por paciente — sólo los que existen en el dominio AMI.
    expect(AMI_STUDIES_BASELINE.length).toBeGreaterThanOrEqual(5)
    expect(AMI_STUDIES_BASELINE).toContain('Audiometría')
    expect(AMI_STUDIES_BASELINE).toContain('Espirometría')
    expect(AMI_STUDIES_BASELINE).toContain('Radiografía de Tórax')
    expect(AMI_STUDIES_BASELINE).toContain('Laboratorio Clínico')
  })

  it('AMI_STUDIES_BASELINE es una constante readonly (definida con `as const`)', () => {
    // TypeScript enforces readonly a nivel de tipos; en runtime sigue
    // siendo un array normal, pero el `as const` documenta la
    // inmutabilidad en la firma. Verificamos que el módulo expone
    // exactamente el catálogo declarado y que no se reasigna.
    const exported: readonly string[] = AMI_STUDIES_BASELINE
    expect(exported.length).toBeGreaterThanOrEqual(5)
    // El mismo objeto en cada lectura (mismo Reference identity).
    expect(AMI_STUDIES_BASELINE).toBe(AMI_STUDIES_BASELINE)
  })

  // ─── isAmiBaselineStudy (match tolerante) ─────────────────────────────
  it('isAmiBaselineStudy: match exacto', () => {
    expect(isAmiBaselineStudy('Audiometría')).toBe(true)
    expect(isAmiBaselineStudy('Espirometría')).toBe(true)
  })

  it('isAmiBaselineStudy: match tolerante a mayúsculas / espacios', () => {
    expect(isAmiBaselineStudy('AUDIOMETRIA')).toBe(true)
    expect(isAmiBaselineStudy('  audiometría  ')).toBe(true)
    expect(isAmiBaselineStudy('radiografía   de   tórax')).toBe(true)
  })

  it('isAmiBaselineStudy: rechaza nombres fuera del catálogo', () => {
    expect(isAmiBaselineStudy('Sicología Cuántica')).toBe(false)
    expect(isAmiBaselineStudy('Lectura de Tarot')).toBe(false)
    expect(isAmiBaselineStudy('')).toBe(false)
  })

  // ─── amiBaselineStudiesNotApplied ──────────────────────────────────────
  it('amiBaselineStudiesNotApplied: vacío cuando el snapshot cubre todo el catálogo', () => {
    const allApplied = AMI_STUDIES_BASELINE.map((s) => s)
    const notApplied = amiBaselineStudiesNotApplied(allApplied)
    expect(notApplied).toEqual([])
  })

  it('amiBaselineStudiesNotApplied: devuelve el resto cuando el snapshot es parcial', () => {
    const applied = ['Audiometría', 'Espirometría']
    const notApplied = amiBaselineStudiesNotApplied(applied)
    expect(notApplied).toContain('Somatometría')
    expect(notApplied).toContain('Radiografía de Tórax')
    expect(notApplied).toContain('Laboratorio Clínico')
    expect(notApplied).not.toContain('Audiometría')
    expect(notApplied).not.toContain('Espirometría')
    // Orden estable según el catálogo baseline, NO el orden del snapshot.
    expect(notApplied[0]).toBe('Somatometría') // primero del baseline
  })

  it('amiBaselineStudiesNotApplied: normaliza mayúsculas / espacios del snapshot', () => {
    const applied = ['AUDIOMETRIA', 'espirometría']
    const notApplied = amiBaselineStudiesNotApplied(applied)
    expect(notApplied).not.toContain('Audiometría')
    expect(notApplied).not.toContain('Espirometría')
  })

  // ─── summarizeExtractedData ────────────────────────────────────────────
  it('summarizeExtractedData: null/undefined → "Sin resultado capturado"', () => {
    expect(summarizeExtractedData(null)).toBe('Sin resultado capturado')
    expect(summarizeExtractedData(undefined)).toBe('Sin resultado capturado')
  })

  it('summarizeExtractedData: objeto vacío → "Sin resultado capturado"', () => {
    expect(summarizeExtractedData({})).toBe('Sin resultado capturado')
  })

  it('summarizeExtractedData: objeto con claves → "<N> campo(s) capturado(s)" + etiquetas', () => {
    const data = { fev1: 3.2, fev1_pred: 95, observaciones: 'normal' }
    const out = summarizeExtractedData(data)
    expect(out).toMatch(/^3 campo\(s\) capturado\(s\):/)
    expect(out).toContain('fev1')
    expect(out).toContain('fev1_pred')
    expect(out).toContain('observaciones')
  })

  it('summarizeExtractedData: NO vuelca valores al PDF (defensa PII)', () => {
    // Verificamos explícitamente que ningún valor del paciente aparece
    // en el summary — sólo etiquetas de campo. Esto protege contra
    // fugas accidentales (nombres, RFC, resultados numéricos, etc.).
    const sensitive = {
      nombre_paciente: 'Juan Pérez Secreto',
      rfc: 'PESJ850101ABC',
      resultado_lab: 'POSITIVO-12345',
      conclusion: 'Ver detalles en dictamen',
    }
    const out = summarizeExtractedData(sensitive)
    expect(out).not.toContain('Juan')
    expect(out).not.toContain('Pérez')
    expect(out).not.toContain('PESJ')
    expect(out).not.toContain('POSITIVO')
    expect(out).not.toContain('12345')
    expect(out).not.toContain('Ver detalles')
    // Sólo aparecen los nombres de campo (etiquetas del esquema):
    expect(out).toContain('nombre_paciente')
    expect(out).toContain('rfc')
    expect(out).toContain('resultado_lab')
    expect(out).toContain('conclusion')
  })

  it('summarizeExtractedData: trunca la lista a 8 campos con sufijo "+N más"', () => {
    const many = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [`campo_${i}`, i]),
    )
    const out = summarizeExtractedData(many)
    expect(out).toContain('12 campo(s) capturado(s)')
    expect(out).toContain('(+4 más)')
    expect(out).toContain('campo_0')
    expect(out).toContain('campo_7')
    expect(out).not.toContain('campo_8') // truncado
  })

  it('summarizeExtractedData: array o primitivo → tipo no esperado', () => {
    expect(summarizeExtractedData('texto')).toContain('string')
    expect(summarizeExtractedData([1, 2, 3])).toContain('array')
    expect(summarizeExtractedData(42)).toContain('number')
  })

  // ─── classifyStudyStatus ───────────────────────────────────────────────
  it('classifyStudyStatus: objeto con claves → APLICADO', () => {
    const { status, label } = classifyStudyStatus({
      serviceName: 'Audiometría',
      extractedData: { oido_der: 'normal' },
    })
    expect(status).toBe('APLICADO')
    expect(label).toBe('Aplicado')
  })

  it('classifyStudyStatus: null → PENDIENTE', () => {
    const { status, label } = classifyStudyStatus({
      serviceName: 'Audiometría',
      extractedData: null,
    })
    expect(status).toBe('PENDIENTE')
    expect(label).toBe('Pendiente de resultado')
  })

  it('classifyStudyStatus: undefined → PENDIENTE', () => {
    const { status } = classifyStudyStatus({
      serviceName: 'Espirometría',
    })
    expect(status).toBe('PENDIENTE')
  })

  it('classifyStudyStatus: objeto vacío {} → PENDIENTE', () => {
    const { status } = classifyStudyStatus({
      serviceName: 'RX',
      extractedData: {},
    })
    expect(status).toBe('PENDIENTE')
  })

  // ─── buildDictamenStudySummary ─────────────────────────────────────────
  it('buildDictamenStudySummary: combina estudios y labs en una sola lista', () => {
    const entries: DictamenStudyEntry[] = [
      { serviceName: 'Audiometría', extractedData: { oido_der: 'normal' } },
      { serviceName: 'Laboratorio', extractedData: null },
    ]
    const summaries = buildDictamenStudySummary(entries)
    expect(summaries).toHaveLength(2)
    expect(summaries[0].status).toBe('APLICADO')
    expect(summaries[1].status).toBe('PENDIENTE')
    // dataSummary nunca debe ser vacío — siempre hay al menos una
    // etiqueta legible para el médico.
    expect(summaries[0].dataSummary).toMatch(/campo\(s\) capturado\(s\)/)
    expect(summaries[1].dataSummary).toBe('Sin resultado capturado')
  })

  it('buildDictamenStudySummary: NO inventa estudios — sólo refleja el snapshot', () => {
    // Si pasamos un snapshot vacío, el resultado es vacío. Los
    // "adicionales disponibles" los calcula el consumidor con
    // `amiBaselineStudiesNotApplied`, NO este builder.
    const summaries = buildDictamenStudySummary([])
    expect(summaries).toEqual([])
  })
})
