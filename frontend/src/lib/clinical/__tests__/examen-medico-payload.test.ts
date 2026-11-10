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

  it('F04: auto-impresión desde APP SÍ + hallazgos al guardar', () => {
    const prepared = prepareExamenMedicoPayloadForSave({
      antecedentes_captured: {
        patologicos: { diabetes: { estado: 'SI', detalle: { tratamiento: 'Metformina' } } },
      },
      estado_nutricional: 'SOBREPESO',
      agudeza_visual_resumen: 'NORMAL',
      salud_bucal: 'NORMAL',
      presion_arterial_resumen: 'NORMAL AL MOMENTO DE LA TOMA',
      impresion_diagnostica: '',
    })
    expect(String(prepared.impresion_diagnostica ?? '')).toContain('Diabetes')
    expect(String(prepared.impresion_diagnostica ?? '')).toContain('Sobrepeso')
  })
})
