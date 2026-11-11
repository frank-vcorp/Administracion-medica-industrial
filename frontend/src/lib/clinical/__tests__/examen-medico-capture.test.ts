import { describe, expect, it } from 'vitest'
import { applyExploracionFisicaDefaults } from '@/schemas/clinical/exam.schema'
import {
  filterEventTestsForCheckout,
  isExamenMedicoCaptureClosed,
  assertExamenMedicoReadyToClose,
} from '../examen-medico-capture'

describe('examen-medico-capture', () => {
  it('excluye somato/agudeza del checkout si hay examen médico', () => {
    const tests = [
      { id: '1', status: 'COMPLETED', testNameSnapshot: 'Somatometría' },
      { id: '2', status: 'PENDING', testNameSnapshot: 'Examen Médico General' },
      { id: '3', status: 'COMPLETED', testNameSnapshot: 'Agudeza Visual' },
    ]
    const filtered = filterEventTestsForCheckout(tests)
    expect(filtered.map((t) => t.id)).toEqual(['2'])
  })

  it('checkout examen médico requiere captura cerrada', () => {
    expect(isExamenMedicoCaptureClosed({ examen_capture_closed: true })).toBe(true)
    expect(isExamenMedicoCaptureClosed({})).toBe(false)
  })

  it('assertExamenMedicoReadyToClose valida fases mínimas', () => {
    expect(
      assertExamenMedicoReadyToClose({
        somatometryData: { peso_kg: '80', talla_m: '1.75', ta_sistolica: '120' },
        eyeAcuityData: { vision_lejana_od: '20/20', vision_lejana_oi: '20/20' },
        physicalExamData: {
          impresion_diagnostica: 'Normal',
          recomendaciones_clinicas: '1.- Control anual',
          estado_nutricional: 'NORMAL',
          salud_bucal: 'SIN DATOS',
          agudeza_visual_resumen: 'NORMAL',
          presion_arterial_resumen: 'NORMAL',
          modulo1: { m1_sexo: 'Masculino' },
          antecedentes_captured: {
            datos_personales: { nombre: 'Test' },
            historia_laboral: { puesto: 'Op' },
            heredo_familiares: { diabetes: 'NEGADO' },
            no_patologicos: { tabaco: 'NEGADO' },
            patologicos: { diabetes: 'NEGADO' },
          },
          ...applyExploracionFisicaDefaults({}),
        },
      }),
    ).toBeNull()
    expect(
      assertExamenMedicoReadyToClose({
        somatometryData: {},
        eyeAcuityData: {},
        physicalExamData: {},
      }),
    ).toMatch(/Falta:/i)
  })
})
