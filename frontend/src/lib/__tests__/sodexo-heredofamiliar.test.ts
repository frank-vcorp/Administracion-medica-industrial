import { describe, expect, it } from 'vitest'
import {
  prefillHeredofamiliarFromAmi,
  resolveHeredofamiliarPdfDisplay,
  sodexoHeredofamiliarRowToDisplay,
} from '@/lib/sodexo-heredofamiliar'
import type { ExamenMedicoPDFData } from '@/components/pdf/ExamenMedicoValidatedPDF'

const emptyPdf = (): ExamenMedicoPDFData =>
  ({
    ahf: {
      diabetes: 'NEGADOS',
      hipertension: 'PADRE',
      epilepsia: null,
      cardiopatia: null,
      renales: null,
      asma: null,
      cancer: null,
      mentales: null,
      otras: null,
    },
  }) as ExamenMedicoPDFData

describe('sodexo-heredofamiliar', () => {
  it('convierte fila extensión a display PDF', () => {
    expect(sodexoHeredofamiliarRowToDisplay({ respuesta: 'NO' })).toBe('NEGADOS')
    expect(sodexoHeredofamiliarRowToDisplay({ respuesta: 'SI', parentesco: 'HERMANA' })).toBe('HERMANA')
  })

  it('prioriza extensión sobre AMI en PDF', () => {
    const data = emptyPdf()
    expect(
      resolveHeredofamiliarPdfDisplay({ respuesta: 'NO' }, data, 'cardiovascular'),
    ).toBe('NEGADOS')
    expect(resolveHeredofamiliarPdfDisplay(null, data, 'cardiovascular')).toContain('PADRE')
  })

  it('prefill desde AMI mapea filas Sodexo', () => {
    const map = prefillHeredofamiliarFromAmi({
      heredo_familiares: {
        diabetes: 'NEGADOS',
        has: 'PADRE',
        cancer: 'OTROS',
        cancer_especifique: 'MAMA',
      },
    })
    expect(map.diabetes?.respuesta).toBe('NO')
    expect(map.cardiovascular?.respuesta).toBe('SI')
    expect(map.cancer?.parentesco).toContain('MAMA')
  })
})
