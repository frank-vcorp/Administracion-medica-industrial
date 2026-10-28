import {
  readEmployerAptitudLaboral,
  readPatientHealthRecommendations,
  patientDictamenHasRequiredContent,
} from '@/lib/clinical/dictamen-audience'

describe('dictamen-audience (S8-05)', () => {
  it('separa aptitud empleador de recomendaciones paciente', () => {
    const data = {
      aptitud: 'APTO PARA CUBRIR O SEGUIR EN LA PLAZA',
      recomendaciones_clinicas: '1.- Control anual con médico familiar.',
    }
    expect(readEmployerAptitudLaboral(data)).toContain('APTO')
    expect(readPatientHealthRecommendations(data)).toContain('Control anual')
    expect(patientDictamenHasRequiredContent(data)).toBe(true)
  })

  it('dictamen paciente no usa aptitud como contenido', () => {
    const data = { aptitud: 'NO APTO', recomendaciones_clinicas: '' }
    expect(patientDictamenHasRequiredContent(data)).toBe(false)
  })
})
