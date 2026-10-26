import { describe, expect, it } from 'vitest'
import {
  mapEscolaridadChecksForPdf,
  mapSexCheckboxesForPdf,
} from '@/lib/sodexo-pdf-identificacion'

describe('sodexo-pdf-identificacion', () => {
  it('sexo masculino desde etiquetas comunes', () => {
    expect(mapSexCheckboxesForPdf('Masculino')).toEqual({
      femenino: false,
      masculino: true,
    })
    expect(mapSexCheckboxesForPdf('M')).toEqual({
      femenino: false,
      masculino: true,
    })
  })

  it('escolaridad básica con acento', () => {
    expect(mapEscolaridadChecksForPdf('Básica').basica).toBe(true)
  })
})
