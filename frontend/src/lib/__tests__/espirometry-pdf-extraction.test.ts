import { describe, it, expect } from 'vitest'
import { buildEspirometryPdfExtractionView } from '@/lib/espirometry-pdf-extraction'

describe('buildEspirometryPdfExtractionView', () => {
  it('mapea parametros y metadatos del snapshot', () => {
    const view = buildEspirometryPdfExtractionView({
      extracted_data: {
        paciente: {
          nombre_completo: 'PEÑA PATRICIO MARBELLA',
          edad_anios: 34,
          sexo: 'Mujer',
        },
        estudio: { referencia: '1803202501', fecha_estudio: '2025-03-18' },
        condiciones: { temperatura_c: 21.8, presion_mmhg: 760 },
        calidad: {
          repetibilidad_ats_ers_fvc: 'No',
          repetibilidad_ats_ers_fev1: 'No',
        },
        parametros: [
          {
            label: 'FVC',
            key: 'fvc_l',
            unidad: 'L',
            m1: 2.3,
            m1_pct_ref: 69,
            m2: 2.33,
            m2_pct_ref: 70,
            m3: 2.26,
            m3_pct_ref: 68,
            ref: 3.32,
            lln: 2.69,
          },
        ],
      },
    })

    expect(view.paciente.some(row => row.label === 'Nombre')).toBe(true)
    expect(view.parametros).toHaveLength(1)
    expect(view.parametros[0]?.m1).toBe('2.30')
    expect(view.parametros[0]?.m2Pct).toBe('70')
    expect(view.repetibilidadAtsErs).toBe('FVC: No, FEV1: No')
  })
})
