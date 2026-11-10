import { describe, expect, it } from 'vitest'
import {
  buildDiagnosticoRecetaDisplay,
  buildFechaLugarReceta,
  formatFechaRecetaLegal,
} from '@/lib/clinical/consulta-receta-pdf-format'
import { CONSULTA_MEDICA_SCHEMA_VERSION } from '@/schemas/clinical/consulta-medica.schema'
import { emptySignosVitalesConsulta } from '@/schemas/clinical/consulta-medica.constants'

describe('consulta-receta-pdf-format', () => {
  it('formatFechaRecetaLegal usa mes en palabras', () => {
    const s = formatFechaRecetaLegal(new Date('2026-11-09T18:00:00.000Z'))
    expect(s).toMatch(/noviembre/i)
    expect(s).toMatch(/2026/)
  })

  it('buildFechaLugarReceta incluye lugar y «a»', () => {
    const s = buildFechaLugarReceta('Clínica Norte', new Date('2026-11-09T12:00:00.000Z'))
    expect(s).toContain('Clínica Norte')
    expect(s).toContain(', a ')
  })

  it('buildDiagnosticoRecetaDisplay prioriza CIE-10 y específico', () => {
    const s = buildDiagnosticoRecetaDisplay({
      schemaVersion: CONSULTA_MEDICA_SCHEMA_VERSION,
      tipo_consulta: 'ENFERMEDAD_GENERAL',
      motivo_consulta: '',
      signos_vitales: emptySignosVitalesConsulta(),
      exploracion_fisica: '',
      diagnostico_unificado: 'J06.9 — Infección respiratoria',
      diagnostico_especifico: 'Faringitis',
      incapacidad_aplica: false,
      otorga_incapacidad: 'NO',
      receta_lineas: [],
      medico_nombre: 'Médico',
      medico_cedula: '—',
    })
    expect(s).toContain('J06.9')
    expect(s).toContain('Faringitis')
  })
})
