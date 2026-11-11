import { describe, expect, it } from 'vitest'
import {
  antecedentesSectionAddressed,
  formatStudyMissingFieldsSpanish,
  validateExamenMedicoForClinicalClose,
  validateExamenMedicoTab,
} from '../examen-medico-required-fields'
import { emptyFlowserveExtension } from '@/schemas/clinical/examen-medico-variant.schema'
import { applyExploracionFisicaDefaults } from '@/schemas/clinical/exam.schema'
import { VISION_SNELLEN_NO_APLICA } from '@/lib/clinical/agudeza-visual'

const emptyAntecedentes = {
  datos_personales: { nombre: 'Juan' },
  historia_laboral: { empresa: 'ACME' },
  heredo_familiares: { diabetes: 'NEGADO' },
  no_patologicos: { tabaco: 'NEGADO' },
  patologicos: { diabetes: 'NEGADO' },
}

function baseCloseInput(overrides: Partial<Parameters<typeof validateExamenMedicoForClinicalClose>[0]> = {}) {
  return {
    somaForm: { peso_kg: '80', talla_m: '1.75', ta_sistolica: '120' },
    vitalsForm: { ta_sistolica: '120', fc_min: '72' },
    agudezaForm: { vision_lejana_od: '20/20', vision_lejana_oi: '20/20' },
    form: applyExploracionFisicaDefaults({
      estado_nutricional: 'NORMAL',
      salud_bucal: 'SIN DATOS',
      agudeza_visual_resumen: 'NORMAL',
      presion_arterial_resumen: 'NORMAL',
      impresion_diagnostica: 'Paciente sano',
    }),
    modulo1: { m1_sexo: 'Masculino' },
    antecedentesCaptured: emptyAntecedentes,
    examVariant: 'SME',
    flowserveExt: emptyFlowserveExtension(),
    recomendaciones: '1.- Control anual',
    ...overrides,
  }
}

describe('examen-medico-required-fields', () => {
  it('somatometria: exige peso y talla', () => {
    const bad = validateExamenMedicoTab('somatometria', baseCloseInput({ somaForm: {} }))
    expect(bad.ok).toBe(false)
    if (!bad.ok) {
      expect(formatStudyMissingFieldsSpanish(bad.missing)).toContain('Falta:')
    }
  })

  it('signos_vitales: exige TA o FC', () => {
    const bad = validateExamenMedicoTab(
      'signos_vitales',
      baseCloseInput({ vitalsForm: { ta_sistolica: '', fc_min: '' } }),
    )
    expect(bad.ok).toBe(false)
  })

  it('agudeza_visual: rechaza NO APLICA en lejana', () => {
    const bad = validateExamenMedicoTab('agudeza_visual', {
      ...baseCloseInput(),
      agudezaForm: {
        vision_lejana_od: VISION_SNELLEN_NO_APLICA,
        vision_lejana_oi: VISION_SNELLEN_NO_APLICA,
      },
    })
    expect(bad.ok).toBe(false)
  })

  it('antecedentes: sexo y cinco secciones (NEGADO cuenta)', () => {
    expect(antecedentesSectionAddressed({ diabetes: 'NEGADO' })).toBe(true)
    const bad = validateExamenMedicoTab('antecedentes', {
      ...baseCloseInput(),
      modulo1: {},
      antecedentesCaptured: {},
    })
    expect(bad.ok).toBe(false)
  })

  it('impresion: combos, impresión y recomendaciones', () => {
    const bad = validateExamenMedicoTab('impresion', {
      ...baseCloseInput(),
      form: applyExploracionFisicaDefaults({}),
      recomendaciones: '',
    })
    expect(bad.ok).toBe(false)
  })

  it('cierre clínico: pasa con payload mínimo SME', () => {
    expect(validateExamenMedicoForClinicalClose(baseCloseInput()).ok).toBe(true)
  })

  it('cierre clínico: falla si falta somatometría', () => {
    const gate = validateExamenMedicoForClinicalClose(
      baseCloseInput({ somaForm: { peso_kg: '', talla_m: '' } }),
    )
    expect(gate.ok).toBe(false)
  })
})
