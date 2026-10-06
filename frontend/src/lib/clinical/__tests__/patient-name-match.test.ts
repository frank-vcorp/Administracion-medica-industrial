import {
  evaluatePatientNameMatch,
  extractPatientNameFromStructuredData,
  normalizePersonName,
  patientNamesMatch,
} from '../patient-name-match'

describe('patient-name-match', () => {
  it('normaliza acentos y mayúsculas', () => {
    expect(normalizePersonName('José María PÉREZ')).toBe('jose maria perez')
  })

  it('extrae nombre desde paciente string o paciente_detalle', () => {
    expect(extractPatientNameFromStructuredData({ paciente: 'Ana López' })).toBe('Ana López')
    expect(
      extractPatientNameFromStructuredData({
        paciente_detalle: { nombre_completo: 'Pedro Ruiz' },
      }),
    ).toBe('Pedro Ruiz')
  })

  it('acepta cuando todos los tokens del trabajador están en el PDF', () => {
    expect(patientNamesMatch('Juan Carlos Pérez', 'PEREZ JUAN CARLOS')).toBe(true)
  })

  it('rechaza cuando falta un apellido', () => {
    expect(patientNamesMatch('Juan Carlos Pérez', 'Juan Carlos Martínez')).toBe(false)
  })

  it('evaluatePatientNameMatch: sin nombre extraído no genera warning', () => {
    const r = evaluatePatientNameMatch('Ana López', { fvc: 3.2 })
    expect(r.evaluated).toBe(false)
    expect(r.warning).toBeNull()
  })

  it('evaluatePatientNameMatch: mismatch genera warning', () => {
    const r = evaluatePatientNameMatch('Ana López', { paciente: 'Pedro Ruiz' })
    expect(r.evaluated).toBe(true)
    expect(r.matches).toBe(false)
    expect(r.warning?.extractedName).toBe('Pedro Ruiz')
  })
})
