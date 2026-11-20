/**
 * @fileoverview Tests focales (V1) para el helper `buildAudiometriaPdfData`
 *   tras FND-20260825-15.
 *
 * Cubre la rectificación de Frank (DEC-20260825-11 / BR-20260825-12):
 *   - El shape del PDF RETIRA el bloque `criterios` (PTA3, PTA fuente,
 *     criterio AMI, patrón, estado bilateral, completitud, advertencias).
 *   - El panel clínico muestra el índice de Fletcher, el estado bilateral
 *     y la completitud documental, sin la captura de PTA ni la tabla.
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

describe('formato ESTUDIO DE AUDIOMETRIA', () => {
  it('arma la tabla de Cervantes: 12.00% por oído y 12.0000% bilateral', () => {
    const data = buildAudiometriaPdfData({
      ...MIN_INPUT,
      doctorDiagnosis: 'CAÍDA DEL UMBRAL DE AUDICIÓN BILATERAL EN 4000 HZ',
      doctorRecommendations:
        'Se sugiere evitar exponer a ruido mayor de 85 dB, Uso adecuado de tapones auditivos, audiometría de seguimiento cada año',
      patient: {
        firstName: 'Damián',
        lastName: 'Cervante Celedón',
        universalId: 'VALIANT29',
        companyName: null,
      },
      extractionStructuredData: {
        paciente_detalle: {
          identificacion: 'VALIANT29',
          fecha_nacimiento: '26/06/1989',
          sexo: 'Hombre',
          notas: 'ESAMBRE 4 AÑOS',
        },
        estudio: {
          fecha_estudio: '26/11/2025',
          hora_estudio: '02:39 p. m.',
          equipo_modelo: 'Amplitude T3 AMPT3-3000-015',
          transductor: 'HDA300',
          numero_serie_sistema: '96000030/96000030',
          ultima_calibracion: '20250910',
        },
        oido_derecho: { va: { 500: 15, 1000: 15, 2000: 10, 3000: 20 } },
        oido_izquierdo: { va: { 500: 10, 1000: 5, 2000: 15, 3000: 30 } },
        campos_fuente: {
          faringe: 'Sin datos patológicos',
          cad: 'permeable',
          cai: 'permeable',
          mtd: 'íntegra,aspecto normal',
          mti: 'íntegra,aspecto normal',
        },
        notas_calidad: {
          descripcion: 'CAÍDA DEL UMBRAL DE AUDICIÓN BILATERAL EN 4000 HZ',
        },
        diagnostico_nosologico_od: 'Hipoacusia Neurosensorial',
        diagnostico_nosologico_oi: 'Hipoacusia Neurosensorial',
        diagnostico_etiologico: 'Secundario a Trauma Acústico crónico por ruido',
        clasificacion_hipoacusia_od: 'Leve',
        clasificacion_hipoacusia_oi: 'Leve',
      },
    })

    expect(data).not.toHaveProperty('criterios')
    expect(data.taOd[500]).toBe(15)
    expect(data.taOi[3000]).toBe(30)
    expect(data.formato.identificacion).toBe('VALIANT29')
    expect(data.patient.fullName).toBe('Damián Cervante Celedón')
    expect(data.formato.nacimiento).toBe('26/06/1989')
    expect(data.formato.sexo).toBe('Hombre')
    expect(data.formato.notasPaciente).toBe('ESAMBRE 4 AÑOS')
    expect(data.formato.audiometro).toBe('Amplitude T3 AMPT3-3000-015')
    expect(data.formato.transductor).toBe('HDA300')
    expect(data.formato.perdidaPorOidoOd).toBe('12.00%')
    expect(data.formato.perdidaPorOidoOi).toBe('12.00%')
    expect(data.formato.hipoacusiaBilateralCombinada).toBe('12.0000%')
    expect(data.formato.faringe).toBe('Sin datos patológicos')
    expect(data.formato.cad).toBe('permeable')
    expect(data.formato.mtd).toBe('íntegra,aspecto normal')
    expect(data.formato.descripcionAudiometrica).toBe(
      'CAÍDA DEL UMBRAL DE AUDICIÓN BILATERAL EN 4000 HZ',
    )
    expect(data.formato.diagnosticoNosologicoOd).toBe('Hipoacusia Neurosensorial')
    expect(data.formato.diagnosticoEtiologicoOi).toBe(
      'Secundario a Trauma Acústico crónico por ruido',
    )
    expect(data.formato.clasificacionHipoacusiaOd).toBe('Leve')
    expect(data.formato.recomendacionesTexto).toContain('tapones auditivos')
  })

  it('no inventa la pérdida si falta una de las cuatro frecuencias', () => {
    const data = buildAudiometriaPdfData({
      ...MIN_INPUT,
      extractionStructuredData: {
        oido_derecho: { va: { 500: 10, 1000: 10, 2000: 10 } },
        oido_izquierdo: { va: { 500: 10, 1000: 10, 2000: 10, 3000: 10 } },
      },
    })
    expect(data.formato.perdidaPorOidoOd).toBeNull()
    expect(data.formato.perdidaPorOidoOi).toBe('8.00%')
    expect(data.formato.hipoacusiaBilateralCombinada).toBeNull()
  })

  it('traduce el patrón aceptado y no inventa etiología', () => {
    const data = buildAudiometriaPdfData({
      ...MIN_INPUT,
      doctorDiagnosis: 'Hallazgos compatibles con hipoacusia.',
      prediagnosisData: {
        recommendation: 'Uso de tapones.',
        resumen_por_oido: {
          oido_derecho: { pattern: 'NEUROSENSORIAL', severity: 'LEVE' },
          oido_izquierdo: { pattern: 'NORMAL', severity: 'NORMAL' },
        },
        clasificacion_hipoacusia: { right: 'LEVE', left: 'NO_APLICA' },
      },
    })
    expect(data.formato.diagnosticoNosologicoOd).toBe('Hipoacusia Neurosensorial')
    expect(data.formato.diagnosticoNosologicoOi).toBe('Audición Normal')
    expect(data.formato.clasificacionHipoacusiaOd).toBe('Leve')
    expect(data.formato.clasificacionHipoacusiaOi).toBe('No Aplica')
    expect(data.formato.diagnosticoEtiologicoOd).toBeNull()
    expect(data.formato.diagnosticoEtiologicoOi).toBeNull()
  })

  it('la exploración del cuestionario llena faringe, CAD y membranas', () => {
    const data = buildAudiometriaPdfData({
      ...MIN_INPUT,
      clinicalContext: {
        exploracionFisica: {
          faringe: { estado: 'NORMAL' },
          cad: { estado: 'NORMAL' },
          cai: { estado: 'ALTERADO', observacion: 'Cerumen' },
          mtd: { estado: 'NORMAL' },
          mti: { estado: 'NO_REALIZADO' },
        },
      },
    })
    expect(data.formato.faringe).toBe('Sin datos patológicos')
    expect(data.formato.cad).toBe('permeable')
    expect(data.formato.cai).toBe('Cerumen')
    expect(data.formato.mtd).toBe('íntegra, aspecto normal')
    expect(data.formato.mti).toBe('No realizado')
  })
})