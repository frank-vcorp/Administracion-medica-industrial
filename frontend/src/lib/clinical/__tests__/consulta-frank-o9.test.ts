import { describe, expect, it } from 'vitest'
import { validateConsultaMedicaPayload } from '@/lib/clinical/consulta-medica-validate'
import { parseConsultaMedicaClinicalContext } from '@/lib/clinical/consulta-medica'
import { mergeProfileAntecedentesIntoConsulta } from '@/lib/clinical/consulta-antecedentes'
import { cancellationReasonSchema } from '@/lib/cancellation'
import { CONSULTA_MEDICA_SCHEMA_VERSION } from '@/schemas/clinical/consulta-medica.schema'

const freshDraft = {
  schemaVersion: CONSULTA_MEDICA_SCHEMA_VERSION,
  tipo_consulta: 'ENFERMEDAD_GENERAL',
  motivo_consulta: '',
  signos_vitales: {
    ta_sistolica: '',
    ta_diastolica: '',
    fc_min: '',
    fr_min: '',
    temperatura: '',
    peso_kg: '',
    talla_m: '',
    imc: '',
    complexion: '',
  },
  exploracion_fisica: '',
  diagnostico_sistema: '',
  diagnostico_unificado: '',
  diagnostico_especifico: '',
  incapacidad_aplica: false,
  otorga_incapacidad: 'NO',
  receta_lineas: [{ medicamento: 'Paracetamol', presentacion: '', dosis: '', frecuencia: '', duracion: '' }],
  medico_nombre: 'Médico',
  medico_cedula: '—',
  antecedentes: {
    datos_personales: { puesto_actual: 'Soldador', turno: '' },
  },
}

describe('O9-10 guardado de consulta', () => {
  it('el borrador con campos vacíos sí valida', () => {
    const result = validateConsultaMedicaPayload(freshDraft, 'draft')
    expect(result.valid).toBe(true)
  })

  it('el cierre sigue exigiendo motivo y diagnóstico', () => {
    const result = validateConsultaMedicaPayload(freshDraft, 'final')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error.length).toBeGreaterThan(0)
    }
  })

  it('un borrador guardado se vuelve a leer', () => {
    const saved = validateConsultaMedicaPayload(freshDraft, 'draft')
    expect(saved.valid).toBe(true)
    if (!saved.valid) return
    const parsed = parseConsultaMedicaClinicalContext(saved.payload)
    expect(parsed?.motivo_consulta ?? '').toBe('')
    expect(parsed?.antecedentes?.datos_personales?.puesto_actual).toBe('Soldador')
    expect(parsed?.antecedentes?.datos_personales?.turno).toBeUndefined()
  })
})

describe('O9-03 antecedentes del perfil', () => {
  it('copia el perfil cuando la consulta aún no tiene esa sección', () => {
    const merged = mergeProfileAntecedentesIntoConsulta(
      { datos_personales: { puesto_actual: '' } },
      { datos_personales: { puesto_actual: 'Operador' }, patologicos: { diabetes: { estado: 'SI' } } },
    )
    expect(merged.datos_personales).toEqual({ puesto_actual: 'Operador' })
    expect(merged.patologicos).toEqual({ diabetes: { estado: 'SI' } })
  })

  it('no pisa lo que la consulta ya capturó', () => {
    const merged = mergeProfileAntecedentesIntoConsulta(
      { datos_personales: { puesto_actual: 'Capturado en consulta' } },
      { datos_personales: { puesto_actual: 'Perfil' } },
    )
    expect(merged.datos_personales).toEqual({ puesto_actual: 'Capturado en consulta' })
  })
})

describe('O9-04 motivo de cancelación', () => {
  it('exige un motivo', () => {
    expect(cancellationReasonSchema.safeParse('').success).toBe(false)
    expect(cancellationReasonSchema.safeParse('no').success).toBe(false)
    expect(cancellationReasonSchema.safeParse('El paciente avisó que no asiste').success).toBe(true)
  })
})
