import { describe, expect, it } from 'vitest'
import { validateConsultaMedicaPayload } from '@/lib/clinical/consulta-medica-validate'
import { CONSULTA_MEDICA_SCHEMA_VERSION_V1 } from '@/schemas/clinical/consulta-medica.constants'

describe('consulta incapacidad v1 → v2', () => {
  it('migra pase_salida SI a tipo PASE_SALIDA', () => {
    const raw = {
      schemaVersion: CONSULTA_MEDICA_SCHEMA_VERSION_V1,
      tipo_consulta: 'ENFERMEDAD_GENERAL',
      motivo_consulta: 'Motivo de consulta suficientemente largo.',
      signos_vitales: {},
      exploracion_fisica: 'Exploración física con hallazgos dentro de normalidad.',
      diagnostico_unificado: 'J06.9 — Infección respiratoria',
      diagnostico_especifico: 'Rinofaringitis',
      incapacidad_aplica: true,
      otorga_incapacidad: 'SI',
      pase_salida: 'SI',
      receta_lineas: [],
      medico_nombre: 'Dr.',
      medico_cedula: '1',
    }
    const r = validateConsultaMedicaPayload(raw, 'final')
    expect(r.valid).toBe(true)
    if (r.valid) {
      expect(r.payload.tipo_incapacidad).toBe('PASE_SALIDA')
      expect(r.payload.pase_salida).toBeUndefined()
    }
  })

  it('migra días sin pase a INTERNA_SME', () => {
    const raw = {
      schemaVersion: CONSULTA_MEDICA_SCHEMA_VERSION_V1,
      tipo_consulta: 'ENFERMEDAD_GENERAL',
      motivo_consulta: 'Motivo de consulta suficientemente largo.',
      signos_vitales: {},
      exploracion_fisica: 'Exploración física con hallazgos dentro de normalidad.',
      diagnostico_unificado: 'J06.9 — Infección respiratoria',
      diagnostico_especifico: 'Rinofaringitis',
      incapacidad_aplica: true,
      otorga_incapacidad: 'SI',
      pase_salida: 'NO',
      dias_incapacidad: 5,
      receta_lineas: [],
      medico_nombre: 'Dr.',
      medico_cedula: '1',
    }
    const r = validateConsultaMedicaPayload(raw, 'final')
    expect(r.valid).toBe(true)
    if (r.valid) {
      expect(r.payload.tipo_incapacidad).toBe('INTERNA_SME')
      expect(r.payload.dias_incapacidad).toBe(5)
    }
  })
})
