import { describe, expect, it } from 'vitest'
import { ExamenMedicoCompletoSchema } from '@/schemas/clinical/exam.schema'
import { prepareExamenMedicoPayloadForSave } from '@/lib/clinical/examen-medico-payload'
import { IMPRESION_DIAGNOSTICA_PENDIENTE } from '@/lib/clinical/impresion-diagnostica'

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

  it('F04: el texto pendiente no bloquea el jalado cuando hay APP SÍ', () => {
    const prepared = prepareExamenMedicoPayloadForSave({
      antecedentes_captured: {
        patologicos: { diabetes: { estado: 'SI', detalle: { tratamiento: 'Metformina' } } },
      },
      estado_nutricional: 'SOBREPESO',
      impresion_diagnostica: IMPRESION_DIAGNOSTICA_PENDIENTE,
    })
    const text = String(prepared.impresion_diagnostica ?? '')
    expect(text).toContain('Diabetes')
    expect(text).toContain('Sobrepeso')
    expect(text).not.toBe(IMPRESION_DIAGNOSTICA_PENDIENTE)
  })

  it('sincroniza salud_bucal desde boca_estado cuando viene vacía y usa SIN DATOS por defecto', () => {
    const conCaries = prepareExamenMedicoPayloadForSave({
      boca_estado: 'CARIES Y SARRO',
      recomendaciones_clinicas: '1.- Odontología.',
    })
    expect(conCaries.salud_bucal).toBe('CARIES Y SARRO')

    const sinDatos = prepareExamenMedicoPayloadForSave({
      recomendaciones_clinicas: '1.- Higiene.',
    })
    expect(sinDatos.boca_estado).toBe('SIN DATOS')
    expect(sinDatos.salud_bucal).toBe('SIN DATOS')

    const overrideManual = prepareExamenMedicoPayloadForSave({
      boca_estado: 'CARIES Y SARRO',
      salud_bucal: 'CARIES',
      recomendaciones_clinicas: '1.- Odontología.',
    })
    expect(overrideManual.salud_bucal).toBe('CARIES')
  })
})
