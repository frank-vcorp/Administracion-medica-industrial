/**
 * Tests focales (V1) para EspirometriaClinicalCriteriaPanel — revisión 1.1.
 *
 * Cubre los AC de FEATURE-20260824-01 rev. 1.1 que aplican al panel UI:
 *   - AC-1: presencia del bloque antes del prediagnóstico cuando hay snapshot.
 *   - AC-2: FVC 30 ml y FEV1 40 ml cuando están presentes (extraídos O
 *     calculados deterministamente desde `parametros[]`).
 *   - AC-3: 3 pruebas aceptables y calidad A cuando están presentes.
 *   - AC-4: cubierto en `StudyAIPrediagnosisPanel.open-details.test.ts`.
 *   - AC-5: payload parcial o histórico sin los campos nuevos renderiza sin
 *     excepción ni valores inventados; criterios cualitativos no se infieren
 *     desde la tabla numérica.
 *   - AC-6: el bloque sólo se muestra cuando hay criterios renderizables
 *     (no aparece en Audiometría u otros estudios sin claves conocidas).
 *   - Texto fuente del documento: si `impresion_diagnostica_texto` o
 *     `recomendaciones_texto` están presentes, se renderizan con el marbete
 *     explícito "Texto fuente del documento (no es diagnóstico IA)".
 *
 * Verifica además el contrato de cálculo (§2.1 rev. 1.1):
 *   - `repetibilidad_fvc_ml` = diff entre 2 valores FVC más altos (L → ml).
 *   - `repetibilidad_fev1_ml` = idem para FEV1.
 *   - `repetibilidad_<200` se deriva como Sí/No cuando hay diff computable.
 *   - `pruebas_aceptables` = # maniobras válidas (3 si m1/m2/m3 presentes).
 *   - Los extraídos en `calidad` ganan sobre los calculados.
 *
 * Implementación: SSR puro con `renderToStaticMarkup` (sin DOM environment).
 * Consistente con `ClinicalExtractionRenderer.fase5.test.ts`.
 *
 * @id IMPL-20260824-01
 * @backup context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md (rev. 1.1)
 */

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import EspirometriaClinicalCriteriaPanel, {
  resolveCriteria,
  hasRenderableEspirometriaCriteria,
  computeRepetibilidadFromRow,
} from '../EspirometriaClinicalCriteriaPanel'

// --- Fixture alineada con `context/lote-nocturno-20260820-01/extraction-espirometria-rd2026.json` ---
// Contiene `calidad` (valores cualitativos) + `parametros[]` (maniobras M1/M2/M3).

const PARAMETROS_FIXTURE = [
  { label: 'Mejor FVC', key: 'mejor_fvc_l', unidad: 'L', m1: 2.33, m2: 2.33, m3: 2.33 },
  { label: 'Mejor FEV1', key: 'mejor_fev1_l', unidad: 'L', m1: 2.15, m2: 2.15, m3: 2.15 },
  { label: 'FVC', key: 'fvc_l', unidad: 'L', m1: 2.3, m2: 2.33, m3: 2.26 },
  { label: 'FEV1', key: 'fev1_l', unidad: 'L', m1: 2.15, m2: 2.11, m3: 2.09 },
]

const CALIDAD_FIXTURE = {
  pico_maximo: 'SI',
  forma_triangular: 'SI',
  libre_artefactos: 'SI',
  meseta: 'SI',
  tiempo: 'SI',
  repetibilidad_fvc_menor_200: 'SI',
  repetibilidad_fev1_menor_200: 'SI',
  criterios_para_dx: 'SI',
  calidad: 'A',
}

const FULL_EXTRACTED = {
  calidad: CALIDAD_FIXTURE,
  parametros: PARAMETROS_FIXTURE,
}

// --- AC-1 / AC-2 / AC-3: con payload completo ---

describe('EspirometriaClinicalCriteriaPanel — AC-1, AC-2, AC-3 con payload real', () => {
  it('AC-1: renderiza el bloque cuando hay criterios válidos', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: FULL_EXTRACTED,
        version: 5,
      })
    )
    expect(html).toContain('Criterios clínicos de Espirometría')
    expect(html).toContain('data-testid="espirometria-clinical-criteria-panel"')
    expect(html).toContain('data-snapshot-version="5"')
  })

  it('AC-2: muestra FVC 30.00 ml y FEV1 40.00 ml calculados desde parametros[] (PDF Sibelmed)', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: FULL_EXTRACTED,
      })
    )
    // FVC: top 2 = 2.33 - 2.30 = 0.03 L → 30 ml (con float → 30.000000…)
    // FEV1: top 2 = 2.15 - 2.11 = 0.04 L → 40 ml
    // Verificamos el render visible (toFixed(2)) y el data-testid único
    expect(html).toContain('data-testid="repetibilidad-fvc-ml"')
    expect(html).toContain('data-testid="repetibilidad-fev1-ml"')
    // El valor visible es ">30.00<" (toFixed(2)); el atributo data-criteria-value
    // lleva la precisión completa del float. Aceptamos ambos.
    expect(html).toMatch(/>30\.00</)
    expect(html).toMatch(/>40\.00</)
    expect(html).toMatch(/data-criteria-value="30(?:\.0+)?[^"]*"/)
    expect(html).toMatch(/data-criteria-value="40(?:\.0+)?[^"]*"/)
    // Etiquetas visibles
    expect(html).toContain('Repetibilidad FVC')
    expect(html).toContain('Repetibilidad FEV1')
    expect(html).toContain('ml')
  })

  it('AC-3: muestra 3 pruebas aceptables derivado de M1/M2/M3 presentes', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: FULL_EXTRACTED,
      })
    )
    expect(html).toContain('data-testid="pruebas-aceptables"')
    expect(html).toContain('data-criteria-value="3"')
    expect(html).toContain('#Pruebas aceptables')
    // Visible como "3"
    expect(html).toMatch(/>3</)
  })

  it('AC-3: muestra calidad A cuando está presente en calidad', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: FULL_EXTRACTED,
      })
    )
    expect(html).toContain('Calidad')
    expect(html).toMatch(/>A</)
  })

  it('Repetibilidad FVC ≤ 150 ml y FEV1 ≤ 150 ml se muestran como Sí (BR-20260824-01, diff Sibelmed 30/40 ≤ 150)', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: FULL_EXTRACTED,
      })
    )
    // Labels (React NO escapa el unicode `≤`; `&le;` no aplica aquí)
    expect(html).toContain('Repetibilidad FVC ≤ 150 ml')
    expect(html).toContain('Repetibilidad FEV1 ≤ 150 ml')
    // El umbral 200 NO debe aparecer como regla activa (BR-20260824-01)
    expect(html).not.toContain('Repetibilidad FVC &lt; 200')
    expect(html).not.toContain('Repetibilidad FEV1 &lt; 200')
    // Ambos como Sí (diff 30 y 40 ml son ≤ 150)
    const siMatches = html.match(/>SI</g) ?? []
    expect(siMatches.length).toBeGreaterThanOrEqual(2)
  })
})

// --- AC-5: payload parcial / sin extracción / sin inflar ---

describe('EspirometriaClinicalCriteriaPanel — AC-5 payload parcial', () => {
  it('Sin extractionSnapshot (extractedData=null) → no renderiza', () => {
    const html1 = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: null,
      })
    )
    expect(html1).toBe('')

    const html2 = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: undefined,
      })
    )
    expect(html2).toBe('')
  })

  it('Sin parametros[] ni calidad → no renderiza', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: { oido_derecho: { '500': 15 } },
      })
    )
    expect(html).toBe('')
  })

  it('Sólo calidad sin parametros: NO muestra repetibilidad numérica (no hay fuente para calcularla)', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: {
          calidad: {
            pico_maximo: 'SI',
            forma_triangular: 'SI',
            criterios_para_dx: 'SI',
            calidad: 'A',
          },
        },
      })
    )
    // El bloque aparece porque hay criterios
    expect(html).toContain('Criterios clínicos de Espirometría')
    // Pero NO debe haber valores numéricos 30 / 40 ml inventados
    expect(html).not.toContain('data-testid="repetibilidad-fvc-ml"')
    expect(html).not.toContain('data-testid="repetibilidad-fev1-ml"')
    // Cualitativos sí
    expect(html).toContain('Pico máximo')
  })

  it('Sólo parametros[] (sin calidad): calcula repetibilidad y pruebas; cualitativos ausentes → "—"', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: { parametros: PARAMETROS_FIXTURE },
      })
    )
    // Repetibilidad calculada
    expect(html).toContain('data-testid="repetibilidad-fvc-ml"')
    expect(html).toContain('data-testid="repetibilidad-fev1-ml"')
    expect(html).toMatch(/>30\.00</)
    expect(html).toMatch(/>40\.00</)
    expect(html).toMatch(/data-criteria-value="30(?:\.0+)?[^"]*"/)
    expect(html).toMatch(/data-criteria-value="40(?:\.0+)?[^"]*"/)
    // Cualitativos: labels visibles, valores ausentes como "—"
    expect(html).toContain('Pico máximo')
    expect(html).toContain('Forma triangular')
    expect(html).toContain('Libre de artefactos')
    expect(html).toContain('Meseta')
    expect(html).toContain('Tiempo')
    expect(html).toContain('Criterios para Dx')
    // Marcador "—" presente para los cualitativos ausentes
    const dashCount = html.match(/>—</g) ?? []
    expect(dashCount.length).toBeGreaterThanOrEqual(5)
  })

  it('Cualitativos NO se infieren desde la tabla numérica (NO -> Pico máximo "—" sin parametros relevantes)', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: { parametros: PARAMETROS_FIXTURE },
      })
    )
    // Específicamente: Pico máximo no debe mostrar Sí/NO (sólo "—")
    // El badge de Pico máximo debe contener el placeholder
    expect(html).toMatch(/data-criteria-key="Pico máximo"[\s\S]{0,200}>—</)
  })
})

// --- AC-6: discriminación de tipos de estudio ---

describe('EspirometriaClinicalCriteriaPanel — AC-6 helper discriminador', () => {
  it('Audiometría (sin claves de espirometría) → false', () => {
    expect(
      hasRenderableEspirometriaCriteria({
        oido_derecho: { '500': 15 },
        completitud_documental: 'suficiente',
      })
    ).toBe(false)
  })

  it('Espirometría con payload completo → true', () => {
    expect(hasRenderableEspirometriaCriteria(FULL_EXTRACTED)).toBe(true)
  })

  it('null/undefined → false', () => {
    expect(hasRenderableEspirometriaCriteria(null)).toBe(false)
    expect(hasRenderableEspirometriaCriteria(undefined)).toBe(false)
  })

  it('Sólo pruebas_aceptables=2 (extraído) → true', () => {
    expect(
      hasRenderableEspirometriaCriteria({
        calidad: { pruebas_aceptables: 2 },
      })
    ).toBe(true)
  })
})

// --- Texto fuente del documento (sin cambios desde rev. 1.0) ---

describe('EspirometriaClinicalCriteriaPanel — texto fuente del documento', () => {
  it('Cuando impresion_diagnostica_texto está presente, se renderiza con marbete explícito y NO se promueve como IA', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: {
          ...FULL_EXTRACTED,
          calidad: {
            ...CALIDAD_FIXTURE,
            impresion_diagnostica_texto: 'PATRÓN ESPIROMÉTRICO RESTRICTIVO FVC: 70%',
            recomendaciones_texto:
              'INDICAR EJERCICIOS RESPIRATORIOS. SE SUGIERE COMPLEMENTAR CON RADIOGRAFÍA DE TÓRAX.',
          },
        },
      })
    )
    expect(html).toContain('Texto fuente del documento (no es diagnóstico IA)')
    expect(html).toContain('Impresión diagnóstica')
    expect(html).toContain('Recomendaciones')
    expect(html).toContain('PATRÓN ESPIROMÉTRICO RESTRICTIVO FVC: 70%')
    expect(html).toContain('INDICAR EJERCICIOS RESPIRATORIOS')
    expect(html).toContain('data-criteria-group="fuente-texto"')
  })

  it('Ausencia de texto fuente → no se renderiza el bloque amber', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: FULL_EXTRACTED,
      })
    )
    expect(html).not.toContain('Texto fuente del documento (no es diagnóstico IA)')
    expect(html).not.toContain('data-criteria-group="fuente-texto"')
  })
})

// --- Helper puro `computeRepetibilidadFromRow` (SPEC §2.1) ---

describe('computeRepetibilidadFromRow — algoritmo determinista', () => {
  it('FVC: diff entre 2 valores más altos = 30 ml', () => {
    const result = computeRepetibilidadFromRow({
      label: 'FVC',
      key: 'fvc_l',
      unidad: 'L',
      m1: 2.3,
      m2: 2.33,
      m3: 2.26,
    })
    expect(result.diffMl).toBeCloseTo(30, 5)
    expect(result.pruebas).toBe(3)
  })

  it('FEV1: diff entre 2 valores más altos = 40 ml', () => {
    const result = computeRepetibilidadFromRow({
      label: 'FEV1',
      key: 'fev1_l',
      unidad: 'L',
      m1: 2.15,
      m2: 2.11,
      m3: 2.09,
    })
    expect(result.diffMl).toBeCloseTo(40, 5)
    expect(result.pruebas).toBe(3)
  })

  it('Orden de maniobras no afecta el cálculo', () => {
    const result = computeRepetibilidadFromRow({
      label: 'FVC',
      key: 'fvc_l',
      unidad: 'L',
      m1: 2.33,
      m2: 2.26,
      m3: 2.3,
    })
    expect(result.diffMl).toBeCloseTo(30, 5)
  })

  it('Una sola maniobra → no se puede calcular diff', () => {
    const result = computeRepetibilidadFromRow({
      label: 'FVC',
      key: 'fvc_l',
      unidad: 'L',
      m1: 2.3,
    })
    expect(result.diffMl).toBe(null)
    expect(result.pruebas).toBe(1)
  })

  it('Sin maniobra válida → null', () => {
    const result = computeRepetibilidadFromRow(null)
    expect(result.diffMl).toBe(null)
    expect(result.pruebas).toBe(null)
  })

  it('Unidad distinta de L → diffMl no se computa (no se inventa unidad)', () => {
    const result = computeRepetibilidadFromRow({
      label: 'FEF25%-75%',
      key: 'fef25_75_l_s',
      unidad: 'l/s',
      m1: 3.29,
      m2: 2.92,
      m3: 3.03,
    })
    expect(result.diffMl).toBe(null)
    expect(result.diffNative).toBeCloseTo(0.26, 5)
  })
})

// --- Resolución: extraído gana sobre calculado ---

describe('resolveCriteria — extraído gana sobre calculado', () => {
  it('Si calidad.repetibilidad_fvc_ml=30 y parametros calculan 40, gana 30 (extraído)', () => {
    const c = resolveCriteria({
      calidad: { repetibilidad_fvc_ml: 30 },
      parametros: [
        { key: 'fvc_l', unidad: 'L', m1: 2.4, m2: 2.0, m3: 2.35 }, // diff = 50 ml
      ],
    })
    expect(c.repetibilidadFvcMl).toBe(30)
    expect(c.repetibilidadFvcSource).toBe('extracted')
  })

  it('Si calidad ausente pero parametros presente, usa cálculo', () => {
    const c = resolveCriteria({
      parametros: PARAMETROS_FIXTURE,
    })
    expect(c.repetibilidadFvcMl).toBeCloseTo(30, 5)
    expect(c.repetibilidadFvcSource).toBe('computed')
    expect(c.repetibilidadFev1Ml).toBeCloseTo(40, 5)
    expect(c.repetibilidadFev1Source).toBe('computed')
    expect(c.pruebasAceptables).toBe(3)
  })

  it('Sin parametros ni calidad → repetibilidad null y source missing', () => {
    const c = resolveCriteria({})
    expect(c.repetibilidadFvcMl).toBe(null)
    expect(c.repetibilidadFvcSource).toBe('missing')
    expect(c.pruebasAceptables).toBe(null)
  })

  it('pruebas_aceptables extraído gana sobre cálculo', () => {
    const c = resolveCriteria({
      calidad: { pruebas_aceptables: 4 },
      parametros: [
        { key: 'fvc_l', unidad: 'L', m1: 2.3, m2: 2.33, m3: 2.26 }, // pruebas = 3
      ],
    })
    expect(c.pruebasAceptables).toBe(4)
  })

  it('repetibilidad_≤150 se deriva del diff cuando calidad no expone el boolean (BR-20260824-01)', () => {
    const c = resolveCriteria({
      parametros: PARAMETROS_FIXTURE, // diff 30 y 40 ml → ≤ 150 → Sí
    })
    expect(c.repetibilidadFvcMenor150).toBe('SI')
    expect(c.repetibilidadFev1Menor150).toBe('SI')
  })

  it('repetibilidad_≤150 se deriva como NO si el diff > 150 ml', () => {
    const c = resolveCriteria({
      parametros: [
        { key: 'fvc_l', unidad: 'L', m1: 2.0, m2: 2.3, m3: 2.5 }, // diff = 200 ml → NO
        { key: 'fev1_l', unidad: 'L', m1: 2.0, m2: 2.15, m3: 2.3 }, // diff = 150 ml → Sí (inclusivo)
      ],
    })
    expect(c.repetibilidadFvcMenor150).toBe('NO')
    expect(c.repetibilidadFev1Menor150).toBe('SI')
  })

  it('BR-20260824-01: diff EXACTAMENTE 150 ml → Sí (umbral inclusivo)', () => {
    const c = resolveCriteria({
      parametros: [
        { key: 'fvc_l', unidad: 'L', m1: 2.0, m2: 2.15, m3: 2.3 }, // top-2 = 2.15/2.30 → diff = 0.15 L = 150 ml
      ],
    })
    expect(c.repetibilidadFvcMl).toBeCloseTo(150, 5)
    expect(c.repetibilidadFvcMenor150).toBe('SI')
  })

  it('BR-20260824-01: diff = 151 ml → NO', () => {
    const c = resolveCriteria({
      parametros: [
        { key: 'fvc_l', unidad: 'L', m1: 2.0, m2: 2.0, m3: 2.151 }, // diff = 0.151 L = 151 ml
      ],
    })
    expect(c.repetibilidadFvcMl).toBeCloseTo(151, 1)
    expect(c.repetibilidadFvcMenor150).toBe('NO')
  })

  it('boolean extraído en calidad gana sobre cálculo (clave canónica _menor_150)', () => {
    const c = resolveCriteria({
      calidad: { repetibilidad_fvc_menor_150: 'NO' },
      parametros: [
        { key: 'fvc_l', unidad: 'L', m1: 2.3, m2: 2.31, m3: 2.32 }, // diff = 20 ml → Sí (cálculo)
      ],
    })
    expect(c.repetibilidadFvcMenor150).toBe('NO')
  })

  it('Backwards compat: payload con clave legacy _menor_200 se acepta como fallback', () => {
    const c = resolveCriteria({
      calidad: { repetibilidad_fvc_menor_200: 'SI' },
      // Sin parametros para forzar el fallback a la clave legacy.
    })
    expect(c.repetibilidadFvcMenor150).toBe('SI')
  })

  it('Precedencia: clave canónica _menor_150 gana sobre _menor_200 legacy', () => {
    const c = resolveCriteria({
      calidad: {
        repetibilidad_fvc_menor_150: 'NO',
        repetibilidad_fvc_menor_200: 'SI', // legacy
      },
      // Sin parametros para no entrar al cálculo derivado.
    })
    expect(c.repetibilidadFvcMenor150).toBe('NO')
  })
})

// --- AC-7: cobertura de los 8 indicadores cualitativos SI/NO ---

describe('EspirometriaClinicalCriteriaPanel — cobertura cualitativos', () => {
  it('Renderiza los 8 indicadores: ≤150 FVC, ≤150 FEV1, Pico, Forma, Libre, Meseta, Tiempo, Criterios', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: FULL_EXTRACTED,
      })
    )
    for (const label of [
      'Repetibilidad FVC ≤ 150 ml',
      'Repetibilidad FEV1 ≤ 150 ml',
      'Pico máximo',
      'Forma triangular',
      'Libre de artefactos',
      'Meseta',
      'Tiempo',
      'Criterios para Dx',
    ]) {
      expect(html).toContain(label)
    }
    // El umbral "200" NO debe aparecer como regla activa visible
    expect(html).not.toContain('Repetibilidad FVC &lt; 200')
    expect(html).not.toContain('Repetibilidad FEV1 &lt; 200')
  })

  it('Layout: repetibilidad numérica aparece ANTES del bloque de indicadores SI/NO', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: FULL_EXTRACTED,
      })
    )
    const idxRepNum = html.indexOf('Repetibilidad numérica')
    const idxIndicadores = html.indexOf('Indicadores de calidad')
    const idxAceptabilidad = html.indexOf('Resumen de aceptabilidad')
    expect(idxRepNum).toBeGreaterThan(-1)
    expect(idxIndicadores).toBeGreaterThan(-1)
    expect(idxAceptabilidad).toBeGreaterThan(-1)
    // Orden §4 segunda imagen: numérica → indicadores → aceptabilidad
    expect(idxRepNum).toBeLessThan(idxIndicadores)
    expect(idxIndicadores).toBeLessThan(idxAceptabilidad)
  })
})
