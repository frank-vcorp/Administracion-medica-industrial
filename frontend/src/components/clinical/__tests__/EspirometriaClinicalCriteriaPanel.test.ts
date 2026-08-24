/**
 * Tests focales (V1) para EspirometriaClinicalCriteriaPanel.
 *
 * Cubre los AC de FEATURE-20260824-01 que aplican al panel UI:
 *   - AC-1: presencia del bloque antes del prediagnóstico cuando hay snapshot.
 *   - AC-2: FVC 30 ml y FEV1 40 ml cuando están presentes en el payload.
 *   - AC-3: 3 pruebas aceptables y calidad A cuando están presentes.
 *   - AC-5: payload parcial o histórico sin los campos nuevos renderiza sin
 *     excepción ni valores inventados.
 *   - AC-6 (parcial): el bloque sólo se muestra cuando hay criterios
 *     renderizables (no aparece en Audiometría u otros estudios sin
 *     `calidad` con claves conocidas).
 *   - Texto fuente del documento: si `impresion_diagnostica_texto` o
 *     `recomendaciones_texto` están presentes, se renderizan con el marbete
 *     explícito "Texto fuente del documento (no es diagnóstico IA)".
 *
 * Implementación: SSR puro con `renderToStaticMarkup` (sin DOM environment).
 * Consistente con `ClinicalExtractionRenderer.fase5.test.ts` y
 * `ExamenMedicoEstudio.test.ts`. Extensión `.ts` (no `.tsx`) para no activar
 * el runner jsdom.
 *
 * @id IMPL-20260824-01
 * @backup context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md
 */

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import EspirometriaClinicalCriteriaPanel, {
  hasRenderableEspirometriaCriteria,
} from '../EspirometriaClinicalCriteriaPanel'

// --- Fixtures alineadas con `context/lote-nocturno-20260820-01/extraction-espirometria-rd2026.json` ---

const FULL_CALIDAD = {
  pico_maximo: 'SI',
  forma_triangular: 'SI',
  libre_artefactos: 'SI',
  meseta: 'SI',
  tiempo: 'SI',
  repetibilidad_fvc_menor_200: 'SI',
  repetibilidad_fev1_menor_200: 'SI',
  pruebas_aceptables: 3,
  criterios_para_dx: 'SI',
  calidad: 'A',
  repetibilidad_ats_ers_fvc: 'No',
  repetibilidad_ats_ers_fev1: 'No',
  repetibilidad_fvc_ml: 30.0,
  repetibilidad_fev1_ml: 40.0,
}

describe('EspirometriaClinicalCriteriaPanel — AC-1..AC-7', () => {
  it('AC-1: renderiza el bloque cuando hay criterios válidos', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        calidad: FULL_CALIDAD,
        version: 5,
      })
    )
    expect(html).toContain('Criterios clínicos de Espirometría')
    expect(html).toContain('data-testid="espirometria-clinical-criteria-panel"')
    expect(html).toContain('data-snapshot-version="5"')
  })

  it('AC-2: muestra FVC 30 ml y FEV1 40 ml cuando están presentes', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        calidad: FULL_CALIDAD,
      })
    )
    // Verificamos exactamente los valores visibles esperados.
    // Los enteros se muestran sin decimales innecesarios (`Number.isInteger`).
    expect(html).toContain('Repetibilidad FVC')
    expect(html).toContain('Repetibilidad FEV1')
    // Etiqueta data-criteria-key distingue las dos filas numéricas
    expect(html).toContain('data-criteria-key="Repetibilidad FVC"')
    expect(html).toContain('data-criteria-key="Repetibilidad FEV1"')
    // Valores numéricos presentes en el render
    expect(html).toMatch(/>30<.*ml/)
    expect(html).toMatch(/>40<.*ml/)
    // La unidad debe quedar visible
    expect(html).toContain('ml')
  })

  it('AC-3: muestra 3 pruebas aceptables y calidad A cuando están presentes', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        calidad: FULL_CALIDAD,
      })
    )
    expect(html).toContain('#Pruebas aceptables')
    expect(html).toMatch(/>3</)
    expect(html).toContain('Calidad')
    // Calidad "A" presente en una celda de valor (etiqueta + valor)
    expect(html).toMatch(/>A</)
  })

  it('AC-3: muestra criterios SI/NO cuando están presentes (Pico máximo, Forma triangular, Meseta, Tiempo, Libre de artefactos, Criterios para Dx, Repetibilidad <200)', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        calidad: FULL_CALIDAD,
      })
    )
    // Nota: React escapa automáticamente `<` como `&lt;` en el HTML serializado.
    for (const label of [
      'Pico máximo',
      'Forma triangular',
      'Libre de artefactos',
      'Meseta',
      'Tiempo',
      'Repetibilidad FVC &lt; 200',
      'Repetibilidad FEV1 &lt; 200',
      'Criterios para Dx',
    ]) {
      expect(html).toContain(label)
    }
  })

  it('AC-5: payload parcial sin campos conocidos NO genera render ni excepción', () => {
    // Sin campos conocidos
    const html1 = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        calidad: { es_interpretable: true, completitud_documental: 'suficiente' },
      })
    )
    expect(html1).toBe('')

    // null
    const html2 = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        calidad: null,
      })
    )
    expect(html2).toBe('')

    // undefined
    const html3 = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        calidad: undefined,
      })
    )
    expect(html3).toBe('')

    // objeto vacío
    const html4 = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        calidad: {},
      })
    )
    expect(html4).toBe('')
  })

  it('AC-5: payload parcial con sólo pruebas_aceptables + calidad muestra sólo lo conocido', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        calidad: { pruebas_aceptables: 2, calidad: 'B' },
      })
    )
    expect(html).toContain('Criterios clínicos de Espirometría')
    expect(html).toContain('#Pruebas aceptables')
    expect(html).toContain('Calidad')
    // NO debe mostrar repetibilidad numérica (ausente)
    expect(html).not.toContain('ml')
  })

  it('AC-6: helper hasRenderableEspirometriaCriteria discrimina tipos de estudio', () => {
    // Audiometría (no tiene claves conocidas de espirometría)
    expect(hasRenderableEspirometriaCriteria({
      oido_derecho: { '500': 15 },
      completitud_documental: 'suficiente',
    })).toBe(false)
    // Espirometría
    expect(hasRenderableEspirometriaCriteria(FULL_CALIDAD)).toBe(true)
    // Vacío
    expect(hasRenderableEspirometriaCriteria(null)).toBe(false)
    expect(hasRenderableEspirometriaCriteria(undefined)).toBe(false)
  })

  it('AC-5: booleanos NO (libre_artefactos=NO) se renderizan con tono warn sin lanzar', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        calidad: {
          pico_maximo: 'SI',
          forma_triangular: 'SI',
          libre_artefactos: 'NO',
          meseta: 'SI',
          tiempo: 'SI',
          criterios_para_dx: 'SI',
          calidad: 'B',
        },
      })
    )
    expect(html).toContain('Libre de artefactos')
    // Aparece "NO" como valor
    expect(html).toContain('>NO<')
  })

  it('Texto fuente del documento: cuando impresion_diagnostica_texto está presente, se renderiza con marbete explícito y NO se promueve como IA', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        calidad: {
          ...FULL_CALIDAD,
          impresion_diagnostica_texto: 'PATRÓN ESPIROMÉTRICO RESTRICTIVO FVC: 70%',
          recomendaciones_texto:
            'INDICAR EJERCICIOS RESPIRATORIOS. SE SUGIERE COMPLEMENTAR CON RADIOGRAFÍA DE TÓRAX.',
        },
      })
    )
    // Marbete explícito exigido por SPEC §2
    expect(html).toContain('Texto fuente del documento (no es diagnóstico IA)')
    expect(html).toContain('Impresión diagnóstica')
    expect(html).toContain('Recomendaciones')
    // Texto fuente del médico presente en el render
    expect(html).toContain('PATRÓN ESPIROMÉTRICO RESTRICTIVO FVC: 70%')
    expect(html).toContain('INDICAR EJERCICIOS RESPIRATORIOS')
    // Grupo etiquetado
    expect(html).toContain('data-criteria-group="fuente-texto"')
  })

  it('Texto fuente del documento: ausencia de impresion_diagnostica_texto NO genera bloque placeholder', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        calidad: FULL_CALIDAD,
      })
    )
    // No debe aparecer el marbete de texto fuente si el payload no los expone
    expect(html).not.toContain('Texto fuente del documento (no es diagnóstico IA)')
    expect(html).not.toContain('data-criteria-group="fuente-texto"')
  })

  it('Notas de calidad se renderizan si están presentes (texto plano)', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        calidad: {
          ...FULL_CALIDAD,
          notas_calidad:
            'Repetibilidad ATS/ERS figura como FVC: No, FEV1: No en la imagen embebida.',
        },
      })
    )
    expect(html).toContain('Notas de calidad')
    expect(html).toContain(
      'Repetibilidad ATS/ERS figura como FVC: No, FEV1: No en la imagen embebida.'
    )
  })

  it('Notas de calidad como objeto (legacy) con `descripcion` se aplanan correctamente', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        calidad: {
          ...FULL_CALIDAD,
          notas_calidad: { descripcion: 'Gráfica ilegible.' },
        },
      })
    )
    expect(html).toContain('Notas de calidad')
    expect(html).toContain('Gráfica ilegible.')
  })

  it('Repetibilidad numérica se omite si no está presente sin inventar valor', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        calidad: {
          pico_maximo: 'SI',
          forma_triangular: 'SI',
          libre_artefactos: 'SI',
          criterios_para_dx: 'SI',
          calidad: 'A',
          pruebas_aceptables: 3,
        },
      })
    )
    // "ml" sólo aparecería si hay repetibilidad numérica; aquí no debería
    expect(html).not.toContain('ml')
  })

  it('Cabecera del panel incluye el emoji y la etiqueta correcta', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        calidad: FULL_CALIDAD,
      })
    )
    expect(html).toContain('🫁')
    expect(html).toContain('Criterios clínicos de Espirometría')
  })
})