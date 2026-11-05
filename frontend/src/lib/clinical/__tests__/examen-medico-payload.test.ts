import { describe, expect, it } from 'vitest'
import { ExamenMedicoCompletoSchema } from '@/schemas/clinical/exam.schema'
import { prepareExamenMedicoPayloadForSave } from '@/lib/clinical/examen-medico-payload'

describe('prepareExamenMedicoPayloadForSave', () => {
  it('aplica defaults de exploración y permite parse Zod', () => {
    const prepared = prepareExamenMedicoPayloadForSave(
      {
        antecedentes_medico: '',
        recomendaciones_clinicas: '1.- Higiene.',
      },
      { medicoLine: 'Dr. Prueba — Cédula: 123' },
    )
    expect(() => ExamenMedicoCompletoSchema.parse(prepared)).not.toThrow()
    expect(prepared.medico_evaluador).toBe('Dr. Prueba — Cédula: 123')
    expect(String(prepared.impresion_diagnostica ?? '').length).toBeGreaterThan(0)
  })
})
