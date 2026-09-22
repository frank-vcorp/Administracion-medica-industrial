import { describe, expect, it } from 'vitest'
import {
  filterEventTestsForCheckout,
  isExamenMedicoCaptureClosed,
  assertExamenMedicoReadyToClose,
} from '../examen-medico-capture'

describe('examen-medico-capture', () => {
  it('excluye somato/agudeza del checkout si hay examen médico', () => {
    const tests = [
      { id: '1', status: 'COMPLETED', testNameSnapshot: 'Somatometría' },
      { id: '2', status: 'PENDING', testNameSnapshot: 'Examen Médico AMI' },
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
        eyeAcuityData: { vision_lejana_od: '20/20' },
        physicalExamData: {
          impresion_diagnostica: 'Normal',
          recomendaciones_clinicas: '1.- Control anual',
        },
      }),
    ).toBeNull()
    expect(
      assertExamenMedicoReadyToClose({
        somatometryData: {},
        eyeAcuityData: {},
        physicalExamData: {},
      }),
    ).toMatch(/somatometría/i)
  })
})
