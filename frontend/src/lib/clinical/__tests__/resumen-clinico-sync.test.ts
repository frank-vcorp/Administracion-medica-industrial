import { describe, expect, it } from 'vitest'
import {
  buildRecommendationsFromExam,
  detectHallazgosFromExam,
} from '@/lib/clinical/recommendations'
import {
  deriveEstadoNutricionalFromSoma,
  derivePresionArterialResumenFromVitals,
  isResumenFieldManualOverride,
  isSaludBucalManualOverride,
  syncBocaEstadoToSaludBucal,
} from '@/lib/clinical/resumen-clinico-sync'

describe('resumen-clinico-sync', () => {
  it('detecta si salud_bucal tiene override manual vs default obsoleto', () => {
    expect(isSaludBucalManualOverride('CARIES Y SARRO', '')).toBe(false)
    expect(isSaludBucalManualOverride('CARIES Y SARRO', 'NORMAL')).toBe(false)
    expect(isSaludBucalManualOverride('CARIES Y SARRO', 'SIN DATOS')).toBe(false)
    expect(isSaludBucalManualOverride('CARIES Y SARRO', 'CARIES Y SARRO')).toBe(false)
    expect(isSaludBucalManualOverride('SIN DATOS', 'SIN DATOS')).toBe(false)

    expect(isSaludBucalManualOverride('CARIES Y SARRO', 'CARIES')).toBe(true)
    expect(isSaludBucalManualOverride('SIN DATOS', 'SARRO')).toBe(true)
  })

  it('syncBocaEstadoToSaludBucal sincroniza cuando no hay override y respeta edición manual', () => {
    const base = { boca_estado: 'SIN DATOS', salud_bucal: 'SIN DATOS' }
    const synced = syncBocaEstadoToSaludBucal(base, 'CARIES Y SARRO', false)
    expect(synced.boca_estado).toBe('CARIES Y SARRO')
    expect(synced.salud_bucal).toBe('CARIES Y SARRO')

    const manual = syncBocaEstadoToSaludBucal(
      { boca_estado: 'CARIES Y SARRO', salud_bucal: 'CARIES' },
      'SARRO',
      true,
    )
    expect(manual.boca_estado).toBe('SARRO')
    expect(manual.salud_bucal).toBe('CARIES')

    const manualVacio = syncBocaEstadoToSaludBucal(
      { boca_estado: 'SIN DATOS', salud_bucal: '' },
      'CARIES Y SARRO',
      true,
    )
    expect(manualVacio.salud_bucal).toBe('CARIES Y SARRO')
  })

  it('deriva estado_nutricional desde somatometría en valores del catálogo ZIN', () => {
    expect(deriveEstadoNutricionalFromSoma('50', '1.75')).toBe('BAJO PESO')
    expect(deriveEstadoNutricionalFromSoma('70', '1.75')).toBe('NORMAL')
    expect(deriveEstadoNutricionalFromSoma('85', '1.75')).toBe('SOBREPESO')
    expect(deriveEstadoNutricionalFromSoma('98', '1.75')).toBe('OBESIDAD G1')
    expect(deriveEstadoNutricionalFromSoma('112', '1.75')).toBe('OBESIDAD G2')
    expect(deriveEstadoNutricionalFromSoma('130', '1.75')).toBe('OBESIDAD G3')
    expect(deriveEstadoNutricionalFromSoma('', '')).toBe('')
  })

  it('deriva presion_arterial_resumen desde signos vitales', () => {
    expect(derivePresionArterialResumenFromVitals('120', '80')).toBe(
      'NORMAL AL MOMENTO DE LA TOMA',
    )
    expect(derivePresionArterialResumenFromVitals('145', '90')).toBe('ALTA')
    expect(derivePresionArterialResumenFromVitals('85', '55')).toBe('BAJA')
    expect(derivePresionArterialResumenFromVitals('', '80')).toBe('')
  })

  it('detecta override manual en campos derivados del resumen', () => {
    expect(isResumenFieldManualOverride('DISMINUIDA', '')).toBe(false)
    expect(isResumenFieldManualOverride('DISMINUIDA', 'DISMINUIDA')).toBe(false)
    expect(isResumenFieldManualOverride('DISMINUIDA', 'NORMAL')).toBe(true)
  })
})

describe('recommendations: fallback exploración física (boca_estado y circulacion_venosa)', () => {
  it('detecta caries_sarro desde exploracion.boca_estado cuando salud_bucal viene vacía o NORMAL', () => {
    const ids = detectHallazgosFromExam({
      salud_bucal: '',
      agudeza_visual_resumen: 'DISMINUIDA',
      exploracion: {
        boca_estado: 'CARIES Y SARRO',
        circulacion_venosa: 'C0: SIN SIGNOS VISIBLES NI PALPABLES',
      },
    }).map((h) => h.id)

    expect(ids).toContain('caries_sarro')
    expect(ids).toContain('vision_disminuida')
    expect(ids).not.toContain('insuficiencia_venosa')
  })

  it('detecta caries_sarro desde boca_estado plano (como physicalExamData en EventFlowController)', () => {
    const recs = buildRecommendationsFromExam({
      salud_bucal: 'NORMAL',
      boca_estado: 'CARIES Y SARRO',
      agudeza_visual_resumen: 'DISMINUIDA',
      circulacion_venosa: 'C0: SIN SIGNOS VISIBLES NI PALPABLES',
    })
    expect(recs).toContain('VALORACIÓN POR ODONTOLOGÍA PARA TRATAMIENTO DE CARIES Y SARRO')
    expect(recs).toContain('VALORACIÓN CON OPTOMETRISTA POR DISMINUCIÓN DE LA AGUDEZA VISUAL')
    expect(recs).not.toContain('MEDIDAS DE HIGIENE VENOSA')
  })

  it('detecta insuficiencia_venosa para CEAP C1–C6 y no para C0', () => {
    const c0 = detectHallazgosFromExam({
      exploracion: { circulacion_venosa: 'C0: SIN SIGNOS VISIBLES NI PALPABLES' },
    })
    expect(c0.map((h) => h.id)).not.toContain('insuficiencia_venosa')

    const c2 = detectHallazgosFromExam({
      exploracion: { circulacion_venosa: 'C2: VARICES' },
    })
    expect(c2.map((h) => h.id)).toContain('insuficiencia_venosa')

    const recs = buildRecommendationsFromExam({
      exploracion: { circulacion_venosa: 'C3: EDEMA' },
    })
    expect(recs).toContain('MEDIDAS DE HIGIENE VENOSA')
  })
})
