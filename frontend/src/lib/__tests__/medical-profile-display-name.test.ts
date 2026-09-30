import { describe, expect, it } from 'vitest'
import {
  buildMedicalProfileDisplayName,
  parseMedicalProfileDisplayName,
  initialGenderAndLabelFromProfileName,
} from '../medical-profile-display-name'

describe('medical-profile-display-name', () => {
  it('arma el nombre con CTM fijo', () => {
    expect(
      buildMedicalProfileDisplayName({
        companyLegalName: 'Sodexo México',
        gender: 'FEMALE',
        profileLabel: 'Ingreso operativo',
      }),
    ).toBe('Sodexo México / Femenino / CTM / Ingreso operativo')
  })

  it('parsea nombres generados', () => {
    const raw = 'Flowserve / Masculino / CTM / Periódico'
    expect(parseMedicalProfileDisplayName(raw)).toEqual({
      companyLegalName: 'Flowserve',
      gender: 'MALE',
      profileLabel: 'Periódico',
    })
  })

  it('devuelve null si no hay cuatro segmentos o CTM', () => {
    expect(parseMedicalProfileDisplayName('Solo nombre libre')).toBeNull()
    expect(parseMedicalProfileDisplayName('A / B / X / C')).toBeNull()
  })

  it('inicializa edición desde nombre legacy', () => {
    expect(initialGenderAndLabelFromProfileName('Ingreso Soldadura')).toEqual({
      gender: 'MALE',
      profileLabel: 'Ingreso Soldadura',
    })
  })
})
