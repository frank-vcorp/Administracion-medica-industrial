import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import EspirometriaClinicalCriteriaPanel, {
  computeRepetibilidadFromRow,
} from '../EspirometriaClinicalCriteriaPanel'

describe('EspirometriaClinicalCriteriaPanel — repetibilidad float 150 ml y limpieza de bloques', () => {
  it('redondea diferencia IEEE-754 (4.86 - 4.71) * 1000 exactamente a 150 ml', () => {
    const calc = computeRepetibilidadFromRow({
      key: 'fvc_l',
      label: 'FVC',
      unidad: 'L',
      m1: 4.62,
      m2: 4.71,
      m3: 4.86,
    })

    expect(calc.diffMl).toBe(150)
    expect(calc.diffMl! <= 150).toBe(true)
    expect(calc.pruebas).toBe(3)
  })

  it('muestra Repetibilidad numérica y NO renderiza Indicadores de calidad ni Resumen de aceptabilidad', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        version: 4,
        extractedData: {
          calidad: {
            pico_maximo: 'SI',
            calidad: 'A',
          },
          parametros: [
            { key: 'fvc_l', label: 'FVC', unidad: 'L', m1: 4.62, m2: 4.71, m3: 4.86 },
            { key: 'fev1_l', label: 'FEV1', unidad: 'L', m1: 3.94, m2: 3.77, m3: 3.75 },
          ],
        },
      }),
    )

    expect(html).toContain('Repetibilidad numérica')
    expect(html).toContain('150')
    expect(html).not.toContain('Indicadores de calidad')
    expect(html).not.toContain('Resumen de aceptabilidad')
  })

  it('retorna markup vacío cuando no hay datos de repetibilidad numérica aunque vengan flags de calidad', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: {
          calidad: {
            pico_maximo: 'SI',
            calidad: 'A',
            pruebas_aceptables: 3,
          },
          parametros: [],
        },
      }),
    )

    expect(html).toBe('')
  })
})
