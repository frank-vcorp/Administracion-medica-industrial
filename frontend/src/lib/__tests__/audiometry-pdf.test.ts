/**
 * @fileoverview Tests focales (V1) para el helper `buildAudiometriaPdfData`
 *   tras FND-20260825-15.
 *
 * Cubre la rectificación de Frank (DEC-20260825-11 / BR-20260825-12):
 *   - El shape del PDF RETIRA el bloque `criterios` (PTA3, PTA fuente,
 *     criterio AMI, patrón, estado bilateral, completitud, advertencias).
 *   - Los datos derivados del paciente quedan SÓLO en el panel clínico
 *     audiométrico.
 *   - El shape del PDF conserva: identificación (reviewId, signedAt,
 *     studyName, studyType, paciente), EVIDENCIA documental (frecuencias,
 *     taOd, taOi, voOd, voOi), impresión del médico, recomendaciones
 *     validadas, notas, identidad del médico firmante + logoUrl.
 *
 * No verificamos el render real (no hay DOM en vitest); sólo el shape
 * de `AudiometriaValidatedPDFData`. Este contrato es la única superficie
 * que la API route y el `submitDoctorStudyReview` consumen.
 *
 * @id IMPL-FEATURE-20260825-02 (FND-20260825-15)
 * @backup context/SPECs/SPEC-FEATURE-20260825-02-AUDIOMETRIA-ENTREGABLE.md
 */

import { describe, it, expect } from 'vitest'
import { buildAudiometriaPdfData } from '../audiometry-pdf'

const MIN_INPUT = {
  reviewId: 'rev-1',
  doctorStatus: 'REVIEWED_ACCEPTED' as const,
  doctorDiagnosis: 'Paciente sin hallazgos audiométricos.',
  doctorNotes: null,
  reviewCreatedAt: new Date('2026-08-25T14:30:00.000Z'),
  prediagnosisData: {},
  extractionStructuredData: {},
  studyName: 'Audiometría',
  studyType: 'Audiometria',
  patient: {
    firstName: 'Juan',
    lastName: 'Pérez',
    universalId: 'U-123',
    companyName: 'ACME',
  },
  medico: {
    fullName: 'Dra. María López',
    professionalLicense: '1234567',
    signatureImageUrl: 'data:image/png;base64,AAA',
  },
  logoDataUrl: null,
}

describe('buildAudiometriaPdfData — FND-20260825-15 (sin `criterios`)', () => {
  it('NO incluye el campo `criterios` (PTA3, criterio AMI, patrón, etc.)', () => {
    const data = buildAudiometriaPdfData(MIN_INPUT)
    expect(data).not.toHaveProperty('criterios')
  })

  it('CONSERVAR campos de identificación', () => {
    const data = buildAudiometriaPdfData(MIN_INPUT)
    expect(data.reviewId).toBe('rev-1')
    expect(data.studyName).toBe('Audiometría')
    expect(data.studyType).toBe('Audiometria')
    expect(data.doctorStatus).toBe('REVIEWED_ACCEPTED')
    expect(data.doctorDiagnosis).toBe('Paciente sin hallazgos audiométricos.')
    expect(data.doctorNotes).toBeNull()
  })

  it('CONSERVAR paciente y médico firmante', () => {
    const data = buildAudiometriaPdfData(MIN_INPUT)
    expect(data.patient.fullName).toBe('Juan Pérez')
    expect(data.patient.universalId).toBe('U-123')
    expect(data.patient.companyName).toBe('ACME')
    expect(data.medico.fullName).toBe('Dra. María López')
    expect(data.medico.professionalLicense).toBe('1234567')
    expect(data.medico.signatureImageUrl).toBe('data:image/png;base64,AAA')
  })

  it('CONSERVAR campos de EVIDENCIA documental (frecuencias + TA/VO por oído)', () => {
    const data = buildAudiometriaPdfData({
      ...MIN_INPUT,
      extractionStructuredData: {
        oido_derecho: {
          va: { 500: 20, 1000: 25, 2000: 30 },
          vo: { 500: 15, 1000: 20, 2000: 25 },
        },
        oido_izquierdo: {
          va: { 500: 25, 1000: 30, 2000: 35 },
          vo: { 500: 20, 1000: 25, 2000: 30 },
        },
      },
    })
    expect(data.frecuencias).toEqual([500, 1000, 2000])
    expect(data.taOd).toEqual({ 500: 20, 1000: 25, 2000: 30 })
    expect(data.taOi).toEqual({ 500: 25, 1000: 30, 2000: 35 })
    expect(data.voOd).toEqual({ 500: 15, 1000: 20, 2000: 25 })
    expect(data.voOi).toEqual({ 500: 20, 1000: 25, 2000: 30 })
  })

  it('FRECUENCIAS DETECTADAS: unión TA/VO por oído, ordenadas; sin invención', () => {
    // Sólo dos frecuencias por oído, mezcla de TA y VO.
    const data = buildAudiometriaPdfData({
      ...MIN_INPUT,
      extractionStructuredData: {
        oido_derecho: { va: { 500: 20 }, vo: { 3000: 30 } },
        oido_izquierdo: { va: { 1000: 25 }, vo: { 4000: 40 } },
      },
    })
    expect(data.frecuencias).toEqual([500, 1000, 3000, 4000])
    // Ausentes en `taOd` se exponen como null
    expect(data.taOd[3000]).toBeNull()
    expect(data.taOd[4000]).toBeNull()
    expect(data.taOd[500]).toBe(20)
    expect(data.taOd[1000]).toBeNull()
  })

  it('Recomendaciones validadas: preferentemente del snap IA aceptado', () => {
    const data = buildAudiometriaPdfData({
      ...MIN_INPUT,
      doctorStatus: 'REVIEWED_ACCEPTED',
      prediagnosisData: {
        recommendation: 'Reposición de EPP auditivo.',
      },
    })
    expect(data.recomendacionesValidadas).toEqual([
      'Reposición de EPP auditivo.',
    ])
  })

  it('Recomendaciones NO se exponen cuando la revisión fue EDITED (decisión médica)', () => {
    const data = buildAudiometriaPdfData({
      ...MIN_INPUT,
      doctorStatus: 'REVIEWED_EDITED',
      prediagnosisData: {
        recommendation: 'Texto del snapshot IA, NO avalado en la impresión.',
      },
    })
    expect(data.recomendacionesValidadas).toEqual([])
  })
})

describe('buildAudiometriaPdfData — FND-20260825-15 (payload sanity)', () => {
  it('PACIENTE INCOMPLETO: nombre = "—" cuando no se provee firstName / lastName', () => {
    const data = buildAudiometriaPdfData({
      ...MIN_INPUT,
      patient: { firstName: '', lastName: '' },
    })
    expect(data.patient.fullName).toBe('—')
  })

  it('DOCTOR DIAGNOSIS VACÍO: fallback explícito para que el PDF siempre tenga impresión', () => {
    const data = buildAudiometriaPdfData({
      ...MIN_INPUT,
      doctorDiagnosis: '   ',
    })
    expect(data.doctorDiagnosis).toBe(
      'Aceptado sin diagnóstico adicional explícito.',
    )
  })

  it('DOCTOR NOTES vacío: `doctorNotes = null` (la sección NO se renderiza)', () => {
    const data = buildAudiometriaPdfData({ ...MIN_INPUT })
    expect(data.doctorNotes).toBeNull()
  })
})