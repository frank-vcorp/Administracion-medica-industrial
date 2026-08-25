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
  detectParamInconsistency,
  detectCrossInconsistency,
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

// --- Texto fuente del documento ELIMINADO del panel UI (rev. UI Frank) ---

describe('EspirometriaClinicalCriteriaPanel — texto fuente del documento (eliminado del panel UI)', () => {
  it('Cuando impresion_diagnostica_texto está presente, NO se renderiza en el panel UI (Frank confirmó)', () => {
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
    // El bloque amber "Texto fuente del documento" NO aparece en la UI.
    expect(html).not.toContain('Texto fuente del documento (no es diagnóstico IA)')
    expect(html).not.toContain('data-criteria-group="fuente-texto"')
    // Las etiquetas "Impresión diagnóstica" / "Recomendaciones" como
    // campos del snapshot NO aparecen en la UI (la impresión diagnóstica
    // vive ahora en el bloque del prediagnóstico IA, modo sombra).
    expect(html).not.toContain('Impresión diagnóstica (texto fuente)')
    expect(html).not.toContain('Recomendaciones (texto fuente)')
    // El texto del médico NO aparece tal cual en el panel.
    expect(html).not.toContain('PATRÓN ESPIROMÉTRICO RESTRICTIVO FVC: 70%')
    expect(html).not.toContain('INDICAR EJERCICIOS RESPIRATORIOS')
  })

  it('Los datos del snapshot siguen disponibles para auditoría (resolveCriteria)', () => {
    // Aunque NO se renderiza, los datos del snapshot siguen expuestos en
    // `ResolvedCriteria` para QA/export/auditoría.
    const c = resolveCriteria({
      calidad: {
        impresion_diagnostica_texto:
          'PATRÓN ESPIROMÉTRICO RESTRICTIVO FVC: 70%',
        recomendaciones_texto:
          'INDICAR EJERCICIOS RESPIRATORIOS. SE SUGIERE COMPLEMENTAR CON RADIOGRAFÍA DE TÓRAX.',
      },
      parametros: PARAMETROS_FIXTURE,
    })
    expect(c.impresionTexto).toBe(
      'PATRÓN ESPIROMÉTRICO RESTRICTIVO FVC: 70%'
    )
    expect(c.recomendacionesTexto).toBe(
      'INDICAR EJERCICIOS RESPIRATORIOS. SE SUGIERE COMPLEMENTAR CON RADIOGRAFÍA DE TÓRAX.'
    )
  })

  it('Ausencia de texto fuente → no se renderiza el bloque (regresión preservada)', () => {
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

  it('boolean extraído en calidad NO sobrescribe el cálculo numérico (IMPL-20260824-05)', () => {
    // Defecto v6 captura Sibelmed: el extractor podía copiar
    // `repetibilidad_fvc_menor_150: 'NO'` desde el flag ATS/ERS de la imagen
    // embebida. Bajo IMPL-20260824-05 el panel SIEMPRE deriva el boolean
    // del valor numérico (repetibilidadFvcMl), así que `calidad.*_menor_150`
    // queda IGNORADO como fuente de verdad (es un criterio distinto del
    // AMI ≤ 150 ml del panel). ATS/ERS se conserva aparte vía el renderer
    // (`repetibilidad_ats_ers_fvc`).
    const c = resolveCriteria({
      calidad: { repetibilidad_fvc_menor_150: 'NO' },
      parametros: [
        // top-2 = 2.32 y 2.30 → diff = 0.02 L = 20 ml
        { key: 'fvc_l', unidad: 'L', m1: 2.28, m2: 2.32, m3: 2.30 },
      ],
    })
    // Numérico 20 ml ≤ 150 → SI, ignorando el boolean extraído.
    expect(c.repetibilidadFvcMl).toBeCloseTo(20, 5)
    expect(c.repetibilidadFvcMenor150).toBe('SI')
  })

  it('Legacy _menor_200 ya NO se acepta como fallback del boolean (IMPL-20260824-05)', () => {
    // Antes: la clave legacy `repetibilidad_fvc_menor_200` sustentaba el
    // boolean cuando no había numérico. Ahora el panel NO consulta esas
    // claves como verdad — sólo el numérico. Sin numérico → null.
    const c = resolveCriteria({
      calidad: { repetibilidad_fvc_menor_200: 'SI' },
    })
    expect(c.repetibilidadFvcMenor150).toBe(null)
  })

  it('Sin numérico ni calidad numérica → null (IMPL-20260824-05)', () => {
    // Aunque calidad declare ambas claves booleanas, sin numérico no hay
    // base para derivar el AMI ≤ 150.
    const c = resolveCriteria({
      calidad: {
        repetibilidad_fvc_menor_150: 'NO',
        repetibilidad_fvc_menor_200: 'SI',
      },
    })
    expect(c.repetibilidadFvcMl).toBe(null)
    expect(c.repetibilidadFvcMenor150).toBe(null)
  })

  it('CASO V6 SIBELMED: repetibilidad 30/40 ml + flag ATS/ERS NO extraído → resuelve SI/SI', () => {
    // Reproducción exacta del defecto visible en la captura v6:
    //   - El extractor copia el flag ATS/ERS de la imagen embebida
    //     (`repetibilidad_ats_ers_fvc: 'No'`) en claves booleanas.
    //   - Los vectores PDF dicen "Repetibilidad FVC: 30.00 ml /
    //     FEV1: 40.00 ml" (transcrito a `repetibilidad_fvc_ml: 30` y
    //     `repetibilidad_fev1_ml: 40`).
    //   - El panel antes mostraba NO/NO por copiar el flag; ahora SI/SI
    //     por derivar del numérico (30/40 ≤ 150).
    const c = resolveCriteria({
      calidad: {
        // Simula el extractor post-v4 que copió el flag ATS/ERS a la
        // clave canónica (defecto v6):
        repetibilidad_fvc_menor_150: 'NO',
        repetibilidad_fev1_menor_150: 'NO',
        // Y también quedó el flag legacy _menor_200 con la lectura
        // histórica del documento ("SI"), irrelevante bajo la nueva regla.
        repetibilidad_fvc_menor_200: 'SI',
        repetibilidad_fev1_menor_200: 'SI',
        // Repetibilidad ATS/ERS del equipo (criterio aparte; ya se renderiza
        // vía `extraction-presentation-schemas.ts`):
        repetibilidad_ats_ers_fvc: 'No',
        repetibilidad_ats_ers_fev1: 'No',
        // Valor numérico explícito del documento (vector PDF):
        repetibilidad_fvc_ml: 30,
        repetibilidad_fev1_ml: 40,
        pruebas_aceptables: 3,
      },
      parametros: [
        { label: 'FVC', key: 'fvc_l', unidad: 'L', m1: 2.30, m2: 2.33, m3: 2.26 },
        { label: 'FEV1', key: 'fev1_l', unidad: 'L', m1: 2.15, m2: 2.11, m3: 2.09 },
      ],
    })
    // Numéricos preservados (ganan sobre cálculo porque vienen del PDF).
    expect(c.repetibilidadFvcMl).toBe(30)
    expect(c.repetibilidadFev1Ml).toBe(40)
    expect(c.repetibilidadFvcSource).toBe('extracted')
    expect(c.repetibilidadFev1Source).toBe('extracted')
    // Booleanos derivados del NUMÉRICO (NO del ATS/ERS del equipo).
    // 30 ml ≤ 150 → SI; 40 ml ≤ 150 → SI.
    expect(c.repetibilidadFvcMenor150).toBe('SI')
    expect(c.repetibilidadFev1Menor150).toBe('SI')
    // pruebas_aceptables explícito gana (3 maniobras en FVC).
    expect(c.pruebasAceptables).toBe(3)
  })

  it('CASO V6 SIBELMED (cálculo puro, sin numérico en calidad): 30/40 ml calculados + flag NO → SI/SI', () => {
    // Variante: el extractor NO entrega el numérico explícito
    // (repetibilidad_fvc_ml), sólo el flag ATS/ERS copiado a _menor_150.
    // El panel calcula 30/40 ml desde `parametros[]` y deriva SI/SI.
    const c = resolveCriteria({
      calidad: {
        repetibilidad_fvc_menor_150: 'NO',
        repetibilidad_fev1_menor_150: 'NO',
      },
      parametros: [
        { label: 'FVC', key: 'fvc_l', unidad: 'L', m1: 2.30, m2: 2.33, m3: 2.26 },
        { label: 'FEV1', key: 'fev1_l', unidad: 'L', m1: 2.15, m2: 2.11, m3: 2.09 },
      ],
    })
    expect(c.repetibilidadFvcMl).toBeCloseTo(30, 5)
    expect(c.repetibilidadFev1Ml).toBeCloseTo(40, 5)
    expect(c.repetibilidadFvcSource).toBe('computed')
    expect(c.repetibilidadFev1Source).toBe('computed')
    expect(c.repetibilidadFvcMenor150).toBe('SI')
    expect(c.repetibilidadFev1Menor150).toBe('SI')
  })

  it('CASO V6 SIBELMED: diff 200/210 ml + flag NO extraído → NO/NO (umbral respetado)', () => {
    // Garantía: aunque el extractor haya copiado SI a _menor_150, un diff
    // real > 150 ml produce NO (no es el flag copiado el que decide).
    const c = resolveCriteria({
      calidad: {
        repetibilidad_fvc_menor_150: 'SI', // copia contradictoria
        repetibilidad_fev1_menor_150: 'SI',
      },
      parametros: [
        // top-2 FVC = 2.4 y 2.2 → diff = 0.2 L = 200 ml → NO
        { key: 'fvc_l', unidad: 'L', m1: 2.0, m2: 2.2, m3: 2.4 },
        // top-2 FEV1 = 2.32 y 2.11 → diff = 0.21 L = 210 ml → NO
        { key: 'fev1_l', unidad: 'L', m1: 2.0, m2: 2.11, m3: 2.32 },
      ],
    })
    expect(c.repetibilidadFvcMl).toBeCloseTo(200, 5)
    expect(c.repetibilidadFev1Ml).toBeCloseTo(210, 5)
    expect(c.repetibilidadFvcMenor150).toBe('NO')
    expect(c.repetibilidadFev1Menor150).toBe('NO')
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

// --- rev. 1.3: aliases reales del renderer/schema (`key`/`unit`/`m1_value`/...) ---

/**
 * Fixture alineada con `frontend/src/components/clinical/extraction-presentation-schemas.ts`:
 * columnas `{key, unit, m1_value, m2_value, m3_value, ref_value, lln_value}`.
 * Es la forma que el renderer/schema espera para la tabla "Parámetros
 * espirométricos". El extractor en producción puede entregar esta forma o
 * la del extractor (`m1`/`unidad`); el panel debe soportar AMBAS.
 */
const PARAMETROS_ALIASED_FIXTURE = [
  { label: 'FVC', key: 'fvc_l', unit: 'L', m1_value: 2.30, m2_value: 2.33, m3_value: 2.26, ref_value: 3.32, lln_value: 2.69 },
  { label: 'FEV1', key: 'fev1_l', unit: 'L', m1_value: 2.15, m2_value: 2.11, m3_value: 2.09, ref_value: 2.77, lln_value: 2.23 },
]

const CALIDAD_MIN_FIXTURE = {
  pico_maximo: 'SI',
  forma_triangular: 'SI',
  libre_artefactos: 'SI',
  meseta: 'SI',
  tiempo: 'SI',
  criterios_para_dx: 'SI',
  calidad: 'A',
}

const EXTRACTED_ALIASED = {
  calidad: CALIDAD_MIN_FIXTURE,
  parametros: PARAMETROS_ALIASED_FIXTURE,
}

describe('EspirometriaClinicalCriteriaPanel — rev. 1.3 aliases renderer/schema', () => {
  it('Soporta m1_value/m2_value/m3_value con key canónica y unit (sin m1/m2/m3/unidad)', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: EXTRACTED_ALIASED,
      })
    )
    // AC-2 con aliases: FVC 30 ml, FEV1 40 ml visibles.
    expect(html).toContain('data-testid="repetibilidad-fvc-ml"')
    expect(html).toContain('data-testid="repetibilidad-fev1-ml"')
    expect(html).toMatch(/>30\.00</)
    expect(html).toMatch(/>40\.00</)
    expect(html).toMatch(/data-criteria-value="30(?:\.0+)?[^"]*"/)
    expect(html).toMatch(/data-criteria-value="40(?:\.0+)?[^"]*"/)
    // AC-3: 3 pruebas aceptables derivadas del # de m*_value presentes.
    expect(html).toContain('data-testid="pruebas-aceptables"')
    expect(html).toContain('data-criteria-value="3"')
    // BR-20260824-01: Sí/Sí porque 30 y 40 ml ≤ 150.
    expect(html).toContain('Repetibilidad FVC ≤ 150 ml')
    expect(html).toContain('Repetibilidad FEV1 ≤ 150 ml')
    const siMatches = html.match(/>SI</g) ?? []
    expect(siMatches.length).toBeGreaterThanOrEqual(2)
    // Calidad A preservada del bloque calidad.
    expect(html).toMatch(/>A</)
    // El bloque se renderiza con el marcador de fuente "calc." porque no
    // hay repetibilidad_fvc_ml en `calidad` y se derivó de la tabla.
    expect(html).toContain('FVC: calc.')
    expect(html).toContain('FEV1: calc.')
  })

  it('Soporta mezcla de aliases (m1/m2/m3 + m1_value/m2_value/m3_value) en la misma fila', () => {
    // Caso defensivo: el extractor puede emitir m1/m2/m3 legacy y el
    // renderer/schema puede sobreescribir parcialmente con m*_value.
    const mezcla = {
      calidad: CALIDAD_MIN_FIXTURE,
      parametros: [
        // FVC con m1 legacy pero m2/m3 como _value
        { label: 'FVC', key: 'fvc_l', unit: 'l', m1: 2.30, m2_value: 2.33, m3_value: 2.26 },
        // FEV1 sólo con _value
        { label: 'FEV1', key: 'fev1_l', unit: 'l', m1_value: 2.15, m2_value: 2.11, m3_value: 2.09 },
      ],
    }
    const c = resolveCriteria(mezcla)
    // FVC: top-2 = 2.33 - 2.30 = 0.03 L → 30 ml
    expect(c.repetibilidadFvcMl).toBeCloseTo(30, 5)
    // FEV1: top-2 = 2.15 - 2.11 = 0.04 L → 40 ml
    expect(c.repetibilidadFev1Ml).toBeCloseTo(40, 5)
    expect(c.pruebasAceptables).toBe(3)
  })

  it('Acepta unit="l" (minúscula) como L para conversión a ml', () => {
    const c = resolveCriteria({
      calidad: CALIDAD_MIN_FIXTURE,
      parametros: [
        { label: 'FVC', key: 'fvc_l', unit: 'l', m1_value: 2.30, m2_value: 2.33, m3_value: 2.26 },
      ],
    })
    expect(c.repetibilidadFvcMl).toBeCloseTo(30, 5)
  })

  it('Acepta unit="L" (mayúscula) como L para conversión a ml', () => {
    const c = resolveCriteria({
      calidad: CALIDAD_MIN_FIXTURE,
      parametros: [
        { label: 'FEV1', key: 'fev1_l', unit: 'L', m1_value: 2.15, m2_value: 2.11, m3_value: 2.09 },
      ],
    })
    expect(c.repetibilidadFev1Ml).toBeCloseTo(40, 5)
  })

  it('Si unidad NO es L/l (p.ej. "l/s"), diffMl queda null pero diffNative sí se computa', () => {
    const c = resolveCriteria({
      calidad: CALIDAD_MIN_FIXTURE,
      parametros: [
        { label: 'FEF25%-75%', key: 'fef25_75_l_s', unit: 'l/s', m1_value: 3.29, m2_value: 2.92, m3_value: 3.03 },
      ],
    })
    expect(c.repetibilidadFvcMl).toBe(null) // no hay FVC
    expect(c.repetibilidadFev1Ml).toBe(null) // no hay FEV1
    expect(c.pruebasAceptables).toBe(null) // sólo FVC computable, pero aquí no hay FVC
  })

  it('FVC/FEV1 no se prefieren cuando la única fila es "Mejor FVC" / "Mejor FEV1"', () => {
    // Caso defensivo: si el extractor sólo entrega la fila resumen
    // "Mejor FVC"/"Mejor FEV1" (sin la estándar), el panel NO debe
    // confundir la fila resumen con la estándar para fines de repetibilidad.
    // La fila resumen tiene m1=m2=m3 idénticos → diff = 0 (NO representativo).
    const c = resolveCriteria({
      calidad: CALIDAD_MIN_FIXTURE,
      parametros: [
        { label: 'Mejor FVC', key: 'mejor_fvc_l', unit: 'L', m1_value: 2.33, m2_value: 2.33, m3_value: 2.33 },
        { label: 'Mejor FEV1', key: 'mejor_fev1_l', unit: 'L', m1_value: 2.15, m2_value: 2.15, m3_value: 2.15 },
      ],
    })
    // Como fallback (paso 3) usa las filas "mejor_*" pero su diff es 0 ml.
    // El test verifica que NO se inflan los repetibilidad desde filas "Mejor X"
    // cuando también existen filas estándar, garantizando la exclusión.
    // Cuando SÓLO hay filas "Mejor X", el panel reporta diff=0 con marca
    // explícita "calc." y el médico ve "0.00 ml" (no es inventado, es lo
    // que produce la fórmula); en este caso la única opción es mostrar
    // ese valor computed.
    expect(c.repetibilidadFvcMl).toBeCloseTo(0, 5)
    expect(c.repetibilidadFev1Ml).toBeCloseTo(0, 5)
  })

  it('Si coexisten filas "Mejor FVC"/"FVC", la fila estándar gana para el cálculo', () => {
    // Caso crítico: NO usar la fila "Mejor FVC" (diff=0) sino la "FVC"
    // estándar (diff=30 ml). Verifica que findRowByKey excluye correctamente.
    const c = resolveCriteria({
      calidad: CALIDAD_MIN_FIXTURE,
      parametros: [
        { label: 'Mejor FVC', key: 'mejor_fvc_l', unit: 'L', m1_value: 2.33, m2_value: 2.33, m3_value: 2.33 },
        { label: 'FVC', key: 'fvc_l', unit: 'L', m1_value: 2.30, m2_value: 2.33, m3_value: 2.26 },
        { label: 'Mejor FEV1', key: 'mejor_fev1_l', unit: 'L', m1_value: 2.15, m2_value: 2.15, m3_value: 2.15 },
        { label: 'FEV1', key: 'fev1_l', unit: 'L', m1_value: 2.15, m2_value: 2.11, m3_value: 2.09 },
      ],
    })
    // FVC: 2.33 - 2.30 = 0.03 L → 30 ml (de la fila "FVC" estándar)
    expect(c.repetibilidadFvcMl).toBeCloseTo(30, 5)
    // FEV1: 2.15 - 2.11 = 0.04 L → 40 ml (de la fila "FEV1" estándar)
    expect(c.repetibilidadFev1Ml).toBeCloseTo(40, 5)
    expect(c.pruebasAceptables).toBe(3)
  })

  it('Fallback por label "FVC"/"FEV1" cuando key canónica está ausente (extractor entrega sólo label)', () => {
    const c = resolveCriteria({
      calidad: CALIDAD_MIN_FIXTURE,
      parametros: [
        { label: 'FVC', unit: 'L', m1_value: 2.30, m2_value: 2.33, m3_value: 2.26 },
        { label: 'FEV1', unit: 'L', m1_value: 2.15, m2_value: 2.11, m3_value: 2.09 },
      ],
    })
    expect(c.repetibilidadFvcMl).toBeCloseTo(30, 5)
    expect(c.repetibilidadFev1Ml).toBeCloseTo(40, 5)
    expect(c.pruebasAceptables).toBe(3)
  })

  it('Caso real Sibelmed con aliases: extraído en calidad gana sobre cálculo (alias-safe)', () => {
    // Cuando calidad entrega repetibilidad_fvc_ml/fev1_ml explícitas del
    // documento, esas ganan sobre el cálculo desde parametros (independiente
    // del alias usado para maniobras).
    const c = resolveCriteria({
      calidad: {
        ...CALIDAD_MIN_FIXTURE,
        repetibilidad_fvc_ml: 30,
        repetibilidad_fev1_ml: 40,
        repetibilidad_fvc_menor_150: 'SI',
        repetibilidad_fev1_menor_150: 'SI',
        pruebas_aceptables: 3,
      },
      parametros: PARAMETROS_ALIASED_FIXTURE,
    })
    expect(c.repetibilidadFvcMl).toBe(30)
    expect(c.repetibilidadFvcSource).toBe('extracted')
    expect(c.repetibilidadFev1Ml).toBe(40)
    expect(c.repetibilidadFev1Source).toBe('extracted')
    expect(c.repetibilidadFvcMenor150).toBe('SI')
    expect(c.repetibilidadFev1Menor150).toBe('SI')
    expect(c.pruebasAceptables).toBe(3)
  })

  it('El panel NO muestra "—" para FVC/FEV1/#Pruebas cuando el payload usa aliases renderer/schema', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: EXTRACTED_ALIASED,
      })
    )
    // Repetibilidad numérica visible (no "—").
    expect(html).toContain('data-testid="repetibilidad-fvc-ml"')
    expect(html).toContain('data-testid="repetibilidad-fev1-ml"')
    expect(html).toContain('data-testid="pruebas-aceptables"')
    // NO debe haber "—" en las celdas de repetibilidad/pruebas.
    // Las celdas que SÍ pueden tener "—" son los cualitativos ausentes
    // (este fixture los tiene todos como SI, pero por seguridad verificamos
    // que las celdas numéricas tienen valores).
    expect(html).toMatch(/data-testid="repetibilidad-fvc-ml"[\s\S]{0,200}>30\.00</)
    expect(html).toMatch(/data-testid="repetibilidad-fev1-ml"[\s\S]{0,200}>40\.00</)
    expect(html).toMatch(/data-testid="pruebas-aceptables"[\s\S]{0,200}>3</)
  })
})

// --- Operación exacta visible (FEATURE-20260824-01 rev. 1.3, mini-corte) ---

describe('EspirometriaClinicalCriteriaPanel — operación exacta visible', () => {
  it('Con payload Sibelmed: FVC: (2.33 − 2.30) × 1000 = 30.00 ml  /  FEV1: (2.15 − 2.11) × 1000 = 40.00 ml', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: FULL_EXTRACTED,
      })
    )
    // Top-2 FVC = 2.33 y 2.30 → (2.33 − 2.30) × 1000 = 30.00 ml
    expect(html).toMatch(
      /FVC:\s*\(2\.33\s*[−-]\s*2\.30\)\s*[×x]\s*1000\s*=\s*30\.00\s*ml/
    )
    // Top-2 FEV1 = 2.15 y 2.11 → (2.15 − 2.11) × 1000 = 40.00 ml
    expect(html).toMatch(
      /FEV1:\s*\(2\.15\s*[−-]\s*2\.11\)\s*[×x]\s*1000\s*=\s*40\.00\s*ml/
    )
    // data-testid para E2E
    expect(html).toContain('data-testid="repetibilidad-fvc-operacion"')
    expect(html).toContain('data-testid="repetibilidad-fev1-operacion"')
  })

  it('Si faltan valores (sin fila FVC), muestra "—" sin inventar', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: {
          // Sin parametros: no hay fuente para la operación
          calidad: { repetibilidad_fvc_ml: 30, repetibilidad_fev1_ml: 40 },
        },
      })
    )
    // El bloque se renderiza por los numéricos extraídos
    expect(html).toContain('Repetibilidad numérica')
    // Líneas de operación presentes con "—"
    expect(html).toContain('data-testid="repetibilidad-fvc-operacion"')
    expect(html).toContain('data-testid="repetibilidad-fev1-operacion"')
    expect(html).toMatch(/FVC:\s*[—]/)
    expect(html).toMatch(/FEV1:\s*[—]/)
  })

  it('Una sola maniobra no produce operación: muestra "—" (no inventa)', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: {
          parametros: [
            { label: 'FVC', key: 'fvc_l', unit: 'L', m1: 2.33 },
            { label: 'FEV1', key: 'fev1_l', unit: 'L', m1: 2.15 },
          ],
        },
      })
    )
    // IMPL-20260824-XX (Frank): el bloque "Repetibilidad numérica" SÍ se
    // renderiza con la línea de maniobras M1/M2/M3 (payload parcial visible
    // para el médico); la operación top-2 muestra "—" (no inventa).
    expect(html).toContain('Repetibilidad numérica')
    // La operación muestra "—" (no se inventa fórmula).
    expect(html).toContain('FVC: —')
    expect(html).toContain('FEV1: —')
    expect(html).not.toMatch(/FVC:\s*\([\d.]+\s*[−-]/)
    expect(html).not.toMatch(/FEV1:\s*\([\d.]+\s*[−-]/)
  })

  it('La fórmula NO usa la unidad nativa si la fila está en l/s: "—" (no se mezcla)', () => {
    // FEF25%-75% tiene unidad 'l/s'; no es FVC ni FEV1, pero verificamos que
    // aunque tuviera key 'fvc_l' por algún error, la unidad != 'l' → topTwo null.
    const c = resolveCriteria({
      parametros: [
        { label: 'FVC', key: 'fvc_l', unit: 'l/s', m1: 2.30, m2: 2.33, m3: 2.26 },
      ],
    })
    expect(c.fvcTopTwoNative).toBe(null)
    expect(c.repetibilidadFvcMl).toBe(null)
  })
})

// --- FIX-FEATURE-20260824-01 rev. 1.4: regresión del layout Sibelmed RD2026 ---
//
// Carga el fixture documental bit-a-bit en `context/lote-nocturno-20260820-01/
// extraction-espirometria-rd2026.json` y verifica que el panel:
//   1. Preserva la celda m1=2.15/m1_pct_ref=77 de FEV1 (no se desplaza a m2).
//   2. Calcula repetibilidad FEV1 = 40 ml con la operación (2.15 − 2.11)×1000.
//   3. Mantiene repetibilidad FVC = 30 ml con la operación (2.33 − 2.30)×1000.
//   4. Conserva las 6 celdas (m1/m1_pct_ref/m2/m2_pct_ref/m3/m3_pct_ref) en
//      la fila FEV1 del payload final.
//
// Esto protege contra el desplazamiento/pérdida de M1 que Frank reportó tras
// el commit 740229e: el cálculo del frontend ya era correcto, el defecto
// estaba en la extracción (LLM emitía FEV1 sin m1 / con m1 desplazado a m2).
//
// Sin el `vi.mock('node:fs')` y sin red — lectura síncrona con `node:fs`.

import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'

const RD2026_FIXTURE_PATH = resolvePath(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'context',
  'lote-nocturno-20260820-01',
  'extraction-espirometria-rd2026.json'
)

function loadRd2026ExtractedData(): {
  calidad: Record<string, unknown>
  parametros: Array<Record<string, unknown>>
  repetibilidad_numerica?: string
} {
  // Lanzar con mensaje claro si la fixture no está (problema de paths en CI).
  let payload: {
    extracted_data: {
      calidad: Record<string, unknown>
      parametros: Array<Record<string, unknown>>
    }
  }
  try {
    const raw = readFileSync(RD2026_FIXTURE_PATH, 'utf-8')
    payload = JSON.parse(raw)
  } catch (err) {
    throw new Error(
      `No se pudo cargar el fixture documental RD2026 desde ${RD2026_FIXTURE_PATH}: ${
        (err as Error).message
      }`
    )
  }
  return {
    ...payload.extracted_data,
    parametros: payload.extracted_data.parametros,
  }
}

describe('EspirometriaClinicalCriteriaPanel — rev. 1.4 regresión layout Sibelmed RD2026', () => {
  it('Carga el fixture documental RD2026 desde el árbol', () => {
    // Sanity check: la fixture existe y tiene al menos las 2 filas críticas.
    const data = loadRd2026ExtractedData()
    const fvcRows = data.parametros.filter(
      (r) => (r.key ?? '').toString().toLowerCase() === 'fvc_l'
    )
    const fev1Rows = data.parametros.filter(
      (r) => (r.key ?? '').toString().toLowerCase() === 'fev1_l'
    )
    expect(fvcRows.length).toBe(1)
    expect(fev1Rows.length).toBe(1)
  })

  it('FEV1 conserva m1=2.15 / m1_pct_ref=77 después de pasar por resolveCriteria', () => {
    // El frontend NO modifica parametros[] — sólo lee. Esta aserción protege
    // contra un futuro refactor que pudiera "limpiar" o "mover" m1 a otro slot.
    const data = loadRd2026ExtractedData()
    const c = resolveCriteria(data)
    // FEV1 m1=2.15 entra al top-2 (2.15 y 2.11) → 40 ml.
    expect(c.repetibilidadFev1Ml).toBeCloseTo(40, 5)
    expect(c.fev1TopTwoNative).toEqual([2.15, 2.11])
    expect(c.pruebasAceptables).toBe(3)
  })

  it('FVC conserva m1=2.30/m2=2.33/m3=2.26 → repetibilidad 30 ml sin regresión', () => {
    const data = loadRd2026ExtractedData()
    const c = resolveCriteria(data)
    expect(c.repetibilidadFvcMl).toBeCloseTo(30, 5)
    expect(c.fvcTopTwoNative).toEqual([2.33, 2.30])
  })

  it('El render HTML del panel muestra FVC 30.00 ml y FEV1 40.00 ml con la operación exacta', () => {
    const data = loadRd2026ExtractedData()
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: data,
      })
    )
    // AC-2 (FEATURE-20260824-01 rev. 1.2 / 1.3) sobre el fixture documental
    // completo: celdas numéricas y operación exacta visibles.
    expect(html).toContain('data-testid="repetibilidad-fvc-ml"')
    expect(html).toContain('data-testid="repetibilidad-fev1-ml"')
    // El fixture documental entrega `calidad.repetibilidad_fvc_ml = 30.0`
    // (entero) y `calidad.repetibilidad_fev1_ml = 40.0`; el NumberCell los
    // renderiza vía `Number.isInteger(v) ? v.toString() : v.toFixed(2)`.
    // Aceptamos tanto `>30<` como `>30.00<` según el camino del cálculo.
    expect(html).toMatch(
      /data-testid="repetibilidad-fvc-ml"[\s\S]{0,200}>(?:30(?:\.00)?)</
    )
    expect(html).toMatch(
      /data-testid="repetibilidad-fev1-ml"[\s\S]{0,200}>(?:40(?:\.00)?)</
    )
    // data-criteria-value lleva la precisión completa del número (float).
    expect(html).toMatch(/data-criteria-value="30(?:\.0+)?[^"]*"/)
    expect(html).toMatch(/data-criteria-value="40(?:\.0+)?[^"]*"/)
    // Operación exacta: si M1 se hubiera perdido/desplazado a m2, se vería
    // "FEV1: (2.11 − 2.09) × 1000 = 20.00 ml". El fixture canónico exige
    // "(2.15 − 2.11) × 1000 = 40.00 ml".
    expect(html).toMatch(
      /FEV1:\s*\(2\.15\s*[−-]\s*2\.11\)\s*[×x]\s*1000\s*=\s*40(?:\.00)?\s*ml/
    )
    expect(html).toMatch(
      /FVC:\s*\(2\.33\s*[−-]\s*2\.30\)\s*[×x]\s*1000\s*=\s*30(?:\.00)?\s*ml/
    )
    expect(html).toContain('data-testid="repetibilidad-fvc-operacion"')
    expect(html).toContain('data-testid="repetibilidad-fev1-operacion"')
  })

  it('Defensa: si el payload llegara con FEV1 m1 ausente, el panel no inventa y la operación sale con "—"', () => {
    // Caso reportado por Frank tras `740229e`: el extractor a veces entrega
    // FEV1 con m1 ausente y m2/m3 presentes → repetibilidad FEV1 cae a 20 ml
    // en lugar de 40 ml. El frontend NO debe inventar m1 (la corrección
    // corresponde al normalizador backend, no al panel).
    const c = resolveCriteria({
      calidad: CALIDAD_MIN_FIXTURE,
      parametros: [
        { label: 'FVC', key: 'fvc_l', unit: 'L', m1: 2.30, m2: 2.33, m3: 2.26 },
        // FEV1 sin m1 (escenario del hallazgo)
        { label: 'FEV1', key: 'fev1_l', unit: 'L', m2: 2.11, m3: 2.09 },
      ],
    })
    // Con sólo m2 y m3, el top-2 es (2.11, 2.09) → 20 ml.
    // Esto NO es un valor "inventado" — es lo que produce la fórmula sobre
    // las celdas presentes. La defensa del panel es que NO rellena m1 con
    // valor alguno, contrario a lo que el hallazgo original pedía.
    expect(c.repetibilidadFev1Ml).toBeCloseTo(20, 5)
    expect(c.fev1TopTwoNative).toEqual([2.11, 2.09])
  })
})

// --- FEATURE-20260824-01 mini-corte: notas_calidad oculto del panel ---

describe('EspirometriaClinicalCriteriaPanel — NOTAS DE CALIDAD oculto', () => {
  it('NO renderiza el bloque "Notas de calidad" aunque el payload lo exponga', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: {
          ...FULL_EXTRACTED,
          calidad: {
            ...CALIDAD_FIXTURE,
            notas_calidad:
              'Repetibilidad ATS/ERS figura como FVC: No, FEV1: No en la imagen embebida (rango entre M1/M2/M3 supera tolerancia).',
          },
        },
      })
    )
    // El bloque visual está eliminado
    expect(html).not.toContain('Notas de calidad')
    // El atributo data-criteria-hidden debe aparecer (señal de auditoría)
    expect(html).not.toContain('data-criteria-hidden="notas-calidad"')
    // El cuerpo del texto NO debe aparecer en el render
    expect(html).not.toContain(
      'Repetibilidad ATS/ERS figura como FVC: No'
    )
  })

  it('resolveCriteria SIGUE leyendo notas_calidad para conservarlo en auditoría/snapshot', () => {
    const c = resolveCriteria({
      calidad: {
        pico_maximo: 'SI',
        notas_calidad:
          'Repetibilidad ATS/ERS figura como FVC: No, FEV1: No en la imagen embebida.',
      },
    })
    // El dato se preserva en el snapshot resuelto (para auditoría/persistencia)
    expect(c.notasCalidad).toContain('Repetibilidad ATS/ERS figura como FVC: No')
    // Pero NO se devuelve al render: el componente no lo expone
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: {
          calidad: {
            pico_maximo: 'SI',
            notas_calidad:
              'Repetibilidad ATS/ERS figura como FVC: No, FEV1: No en la imagen embebida.',
          },
        },
      })
    )
    expect(html).not.toContain('Notas de calidad')
  })
})

// --- FIX-FEATURE-20260824-01 rev. 1.5: duplicación M2→M1 marcado inconsistente ---
//
// Tras rev. 1.3/1.4, Frank reportó Event v9: el LLM DUPLICA M2 como M1 en la
// fila FEV1 (m1=m2=2.11, %REF 76/76) en vez de dejar m1 vacío. La operación
// renderizada era `(2.11 − 2.11) × 1000 = 0 ml` en lugar de
// `(2.15 − 2.11) × 1000 = 40 ml`. El backend (rev. 1.5) ahora anota
// `SOSPECHA_INCONSISTENCIA_MEJOR_FEV1`/`_FVC` en `notas_calidad` y fuerza
// `completitud_documental = "no_concluyente"`.
//
// Esta suite verifica que el panel, al ver la anotación, NO presenta un
// cálculo espurio (0 ml) sobre una fila no confiable:
//   - Si la repetibilidad venía del CÁLCULO (source="computed"): invalida el
//     número, la operación visible (topTwoNative=null → "—") y el flag ≤150.
//   - Si la repetibilidad venía del TEXTO NATIVO extraído
//     (`calidad.repetibilidad_fev1_ml`, fuente independiente del layout):
//     conserva el número pero oculta la operación espuria ("—").
//   - Inconsistencia selectiva: sólo el parámetro anotado se invalida.

describe('EspirometriaClinicalCriteriaPanel — rev. 1.5 duplicación M2→M1 inconsistente', () => {
  const DUPLICATED_FEV1_PARAMETROS = [
    { label: 'Mejor FVC', key: 'mejor_fvc_l', unidad: 'L', m1: 2.33, m2: 2.33, m3: 2.33 },
    { label: 'Mejor FEV1', key: 'mejor_fev1_l', unidad: 'L', m1: 2.15, m2: 2.15, m3: 2.15 },
    { label: 'FVC', key: 'fvc_l', unidad: 'L', m1: 2.3, m2: 2.33, m3: 2.26 },
    // FEV1 con M1 duplicada de M2 (defecto Event v9).
    { label: 'FEV1', key: 'fev1_l', unidad: 'L', m1: 2.11, m2: 2.11, m3: 2.09 },
  ]

  const INCONSISTENCIA_FEV1_NOTA =
    'SOSPECHA_INCONSISTENCIA_MEJOR_FEV1: FEV1: max(m1,m2,m3)=2.11 de la fila ' +
    'estándar < Mejor FEV1=2.15. El valor de la mejor maniobra no aparece entre ' +
    'las maniobras de la fila estándar — posible duplicación de M2 como M1 o ' +
    'pérdida de M1. (m1==m2 detectado). Extracción marcada no_concluyente: el ' +
    'cálculo de repetibilidad sobre la(s) fila(s) afectada(s) no es confiable.'

  it('Caso canónico (sin anotación): FEV1 40 ml + operación visible sin cambios', () => {
    // Sanity: sin la anotación de inconsistencia, el panel sigue mostrando
    // 40 ml con la operación (2.15 − 2.11) × 1000. La rev. 1.5 NO introduce
    // regresión en el caso canónico.
    const c = resolveCriteria({
      calidad: { ...CALIDAD_FIXTURE },
      parametros: PARAMETROS_FIXTURE,
    })
    expect(c.repetibilidadFev1Ml).toBeCloseTo(40, 5)
    expect(c.fev1TopTwoNative).toEqual([2.15, 2.11])
    expect(c.repetibilidadFev1Menor150).toBe('SI')
  })

  it('Duplicación FEV1 (source=computed) → invalida número, operación y flag ≤150', () => {
    // El backend anotó la inconsistencia; el panel NO muestra 0 ml espurio.
    const c = resolveCriteria({
      calidad: {
        ...CALIDAD_FIXTURE,
        notas_calidad: INCONSISTENCIA_FEV1_NOTA,
      },
      parametros: DUPLICATED_FEV1_PARAMETROS,
    })
    // Repetibilidad FEV1 invalidada (no 0 ml como válido).
    expect(c.repetibilidadFev1Ml).toBe(null)
    expect(c.fev1TopTwoNative).toBe(null)
    expect(c.repetibilidadFev1Menor150).toBe(null)
    // La fuente sigue siendo "computed" (la anotación no cambia la fuente).
    expect(c.repetibilidadFev1Source).toBe('computed')
    // FVC consistente: NO se invalida (sigue 30 ml, operación visible).
    expect(c.repetibilidadFvcMl).toBeCloseTo(30, 5)
    expect(c.fvcTopTwoNative).toEqual([2.33, 2.3])
    expect(c.repetibilidadFvcMenor150).toBe('SI')
  })

  it('Duplicación FEV1 con repetibilidad extraída del texto nativo → conserva 40, oculta operación', () => {
    // El documento trajo `repetibilidad_fev1_ml=40` como texto nativo
    // (fuente independiente del layout tabular). La anotación de
    // inconsistencia NO invalida el valor extraído (es la verdad declarada
    // por el reporte), PERO oculta la operación espuria derivada de la fila
    // duplicada (topTwoNative=null → la operación muestra "—").
    const c = resolveCriteria({
      calidad: {
        ...CALIDAD_FIXTURE,
        repetibilidad_fev1_ml: 40,
        notas_calidad: INCONSISTENCIA_FEV1_NOTA,
      },
      parametros: DUPLICATED_FEV1_PARAMETROS,
    })
    // Valor extraído del texto nativo conservado (fuente independiente).
    expect(c.repetibilidadFev1Ml).toBeCloseTo(40, 5)
    expect(c.repetibilidadFev1Source).toBe('extracted')
    // Operación oculta (no mostrar "(2.11 − 2.11) × 1000 = 0 ml").
    expect(c.fev1TopTwoNative).toBe(null)
  })

  it('Duplicación FVC → invalida selectivamente FVC, FEV1 intacto', () => {
    // La anotación específica por parámetro permite invalidar sólo el
    // afectado. Aquí sólo FVC está duplicada; FEV1 (consistente) sigue 40 ml.
    const notaFvc = INCONSISTENCIA_FEV1_NOTA.replace(
      /SOSPECHA_INCONSISTENCIA_MEJOR_FEV1/g,
      'SOSPECHA_INCONSISTENCIA_MEJOR_FVC'
    ).replace(/FEV1/g, 'FVC')
    const c = resolveCriteria({
      calidad: { ...CALIDAD_FIXTURE, notas_calidad: notaFvc },
      parametros: [
        { label: 'Mejor FVC', key: 'mejor_fvc_l', unidad: 'L', m1: 2.33, m2: 2.33, m3: 2.33 },
        { label: 'Mejor FEV1', key: 'mejor_fev1_l', unidad: 'L', m1: 2.15, m2: 2.15, m3: 2.15 },
        // FVC duplicada (defecto).
        { label: 'FVC', key: 'fvc_l', unidad: 'L', m1: 2.33, m2: 2.33, m3: 2.26 },
        { label: 'FEV1', key: 'fev1_l', unidad: 'L', m1: 2.15, m2: 2.11, m3: 2.09 },
      ],
    })
    // FVC invalidada.
    expect(c.repetibilidadFvcMl).toBe(null)
    expect(c.fvcTopTwoNative).toBe(null)
    expect(c.repetibilidadFvcMenor150).toBe(null)
    // FEV1 consistente: intacto (40 ml, operación visible).
    expect(c.repetibilidadFev1Ml).toBeCloseTo(40, 5)
    expect(c.fev1TopTwoNative).toEqual([2.15, 2.11])
    expect(c.repetibilidadFev1Menor150).toBe('SI')
  })

  it('Render: con duplicación FEV1, la operación FEV1 muestra "—" (no 0 ml)', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: {
          calidad: {
            ...CALIDAD_FIXTURE,
            notas_calidad: INCONSISTENCIA_FEV1_NOTA,
          },
          parametros: DUPLICATED_FEV1_PARAMETROS,
        },
      })
    )
    // NO se renderiza la operación espuria "(2.11 − 2.11) × 1000 = 0 ml".
    expect(html).not.toMatch(/\(2\.11\s*[−-]\s*2\.11\)/)
    // La operación FEV1 está presente pero muestra "—" (topTwoNative=null).
    expect(html).toContain('data-testid="repetibilidad-fev1-operacion"')
    expect(html).toMatch(/FEV1:\s*—/)
    // FVC consistente: su operación sigue visible ((2.33 − 2.30) × 1000 = 30).
    expect(html).toMatch(
      /FVC:\s*\(2\.33\s*[−-]\s*2\.30\)\s*[×x]\s*1000\s*=\s*30(?:\.00)?\s*ml/
    )
  })

  it('La anotación se busca en ambos canales (raíz notas_calidad y calidad.notas_calidad)', () => {
    // El backend escribe la anotación en AMBOS canales. El panel debe
    // detectarla en cualquiera de los dos (defensa: algunos snapshots sólo
    // conservan uno).
    const cRaiz = resolveCriteria({
      notas_calidad: INCONSISTENCIA_FEV1_NOTA,
      calidad: { ...CALIDAD_FIXTURE },
      parametros: DUPLICATED_FEV1_PARAMETROS,
    })
    expect(cRaiz.repetibilidadFev1Ml).toBe(null)
    expect(cRaiz.fev1TopTwoNative).toBe(null)
  })
})

// ---------------------------------------------------------------------------
// IMPL-FIX-20260824-04-rev3 — Detección robusta de inconsistencia FEV1/FVC.
//
// Caso Event v10 reportado por Frank: el payload real NO contiene el
// código `SOSPECHA_INCONSISTENCIA_MEJOR_FEV1` exacto. Contiene una frase
// estructurada:
//
//   "Inconsistencia detectada entre fila 'Mejor FEV1' ... y fila
//    estándar FEV1 ... SOSPECHA_MAPEO"
//
// La detección frontend rev. 1.5 sólo buscaba el código literal, así que
// `resolveCriteria` NO invalidaba la operación `(2.11−2.11)×1000=0 ml`.
//
// Esta suite valida:
//   1) El helper `detectParamInconsistency` reconoce:
//      - Código explícito backend (compat).
//      - Frase estructurada (caso v10).
//      - Variantes con/sin acento (`estándar`/`estandar`).
//      - FEV1 vs FVC con selectividad (no cross-detección).
//      - NO oculta notas genéricas que sólo mencionan una de las
//        palabras sueltas.
//   2) Caso canónico Event v10 (texto exacto reportado por Frank):
//      `resolveCriteria` invalida el número, la operación y el flag ≤150
//      de FEV1 — sin 0 ml visible.
//   3) Regresión: FEV1 canónico 40 ml y FVC 30 ml NO regresan; duplicado
//      m1=m2 sigue marcado inconsistente.
// ---------------------------------------------------------------------------

describe('EspirometriaClinicalCriteriaPanel — IMPL-FIX-20260824-04-rev3 helper detectParamInconsistency', () => {
  it('detecta código explícito backend (compatibilidad rev. 1.5)', () => {
    expect(
      detectParamInconsistency('SOSPECHA_INCONSISTENCIA_MEJOR_FEV1', 'FEV1')
    ).toBe(true)
    expect(
      detectParamInconsistency('SOSPECHA_INCONSISTENCIA_MEJOR_FVC', 'FVC')
    ).toBe(true)
  })

  it('detecta código backend embebido en prosa (no exacto al inicio)', () => {
    expect(
      detectParamInconsistency(
        'Texto adicional | SOSPECHA_INCONSISTENCIA_MEJOR_FEV1 | cola',
        'FEV1'
      )
    ).toBe(true)
  })

  it('detecta frase estructurada v10 (caso Frank)', () => {
    const v10Text =
      "Inconsistencia detectada entre fila 'Mejor FEV1' (valores consolidados) " +
      "y fila estándar FEV1 (3 maniobras separadas). Posible duplicación de M2 " +
      "como M1 o pérdida de M1. Verifique el layout tabular. SOSPECHA_MAPEO."
    expect(detectParamInconsistency(v10Text, 'FEV1')).toBe(true)
    // No debe detectar FVC si la frase es sobre FEV1.
    expect(detectParamInconsistency(v10Text, 'FVC')).toBe(false)
  })

  it('detecta variante sin acento ("estandar" sin tilde)', () => {
    expect(
      detectParamInconsistency(
        'Inconsistencia detectada entre Mejor FVC y fila estandar FVC',
        'FVC'
      )
    ).toBe(true)
  })

  it('detecta variante con mayúsculas/minúsculas mezcladas', () => {
    expect(
      detectParamInconsistency(
        'INCONSISTENCIA entre mejor fev1 y fila estándar fev1',
        'FEV1'
      )
    ).toBe(true)
  })

  it('Selectividad FEV1 vs FVC: una nota FVC no invalida FEV1', () => {
    const fvcOnly =
      "Inconsistencia detectada entre fila 'Mejor FVC' ... y fila estándar FVC"
    expect(detectParamInconsistency(fvcOnly, 'FVC')).toBe(true)
    expect(detectParamInconsistency(fvcOnly, 'FEV1')).toBe(false)
  })

  it('NO oculta nota genérica que sólo menciona "inconsistencia"', () => {
    expect(
      detectParamInconsistency(
        'Inconsistencia menor en la curva, no afecta FEV1 ni FVC',
        'FEV1'
      )
    ).toBe(false)
  })

  it('NO oculta nota que sólo menciona "Mejor FEV1" sin "fila estándar"', () => {
    expect(
      detectParamInconsistency(
        'Mejor FEV1 registrado correctamente como 2.15',
        'FEV1'
      )
    ).toBe(false)
  })

  it('NO oculta nota que sólo menciona "fila estándar FEV1" sin "inconsistencia"', () => {
    expect(
      detectParamInconsistency(
        'La fila estándar FEV1 tiene 3 maniobras válidas',
        'FEV1'
      )
    ).toBe(false)
  })

  it('NO oculta nota con palabra suelta "MEJOR FEV1" en mayúsculas sin más contexto', () => {
    expect(
      detectParamInconsistency(
        'MEJOR FEV1 detectado en página 1',
        'FEV1'
      )
    ).toBe(false)
  })

  it('String vacío / null / undefined → no detecta', () => {
    expect(detectParamInconsistency('', 'FEV1')).toBe(false)
    expect(detectParamInconsistency(null, 'FEV1')).toBe(false)
    expect(detectParamInconsistency(undefined, 'FEV1')).toBe(false)
  })

  it('NO activa con palabras que contengan el parámetro como subcadena (p.ej. FEV10)', () => {
    // `\b` evita matchear "FEV10" o "FEV1_l" como si fuera FEV1.
    expect(
      detectParamInconsistency(
        'Inconsistencia detectada entre Mejor FEV10 y fila estándar FEV10',
        'FEV1'
      )
    ).toBe(false)
  })
})

describe('EspirometriaClinicalCriteriaPanel — IMPL-FIX-20260824-04-rev3 caso Event v10 (Frank)', () => {
  // Texto EXACTO (paráfrasis fiel) reportado por Frank para Event v10.
  // Contiene la frase estructurada "Inconsistencia detectada ... Mejor
  // FEV1 ... fila estándar FEV1 ... SOSPECHA_MAPEO" — NO contiene el
  // código `SOSPECHA_INCONSISTENCIA_MEJOR_FEV1` literal.
  const V10_NOTAS_CALIDAD =
    "Inconsistencia detectada entre fila 'Mejor FEV1' (valor consolidado 2.15) " +
    "y fila estándar FEV1 (m1=2.11, m2=2.11, m3=2.09). Posible duplicación " +
    "de M2 como M1 o pérdida de M1. Verifique el layout tabular. " +
    "SOSPECHA_MAPEO."

  // El layout estándar Sibelmed v10: FEV1 con m1=m2=2.11 (duplicado),
  // Mejor FEV1=2.15, FVC consistente.
  const V10_PARAMETROS = [
    {
      label: 'Mejor FVC',
      key: 'mejor_fvc_l',
      unidad: 'L',
      m1: 2.33, m2: 2.33, m3: 2.33,
    },
    {
      label: 'Mejor FEV1',
      key: 'mejor_fev1_l',
      unidad: 'L',
      m1: 2.15, m2: 2.15, m3: 2.15,
    },
    {
      label: 'FVC',
      key: 'fvc_l',
      unidad: 'L',
      m1: 2.30, m2: 2.33, m3: 2.26,
    },
    {
      label: 'FEV1',
      key: 'fev1_l',
      unidad: 'L',
      m1: 2.11, m2: 2.11, m3: 2.09,
    },
  ]

  it('v10 (texto en notas_calidad raíz): invalida FEV1 (sin 0 ml), FVC intacto', () => {
    const c = resolveCriteria({
      notas_calidad: V10_NOTAS_CALIDAD,
      calidad: {},
      parametros: V10_PARAMETROS,
    })
    // FEV1 inconsistente: ml=null, operación=null, flag=null.
    expect(c.repetibilidadFev1Ml).toBe(null)
    expect(c.fev1TopTwoNative).toBe(null)
    expect(c.repetibilidadFev1Menor150).toBe(null)
    // FEV1 NO debe mostrar 0 ml (regresión principal de v10).
    expect(c.repetibilidadFev1Ml).not.toBe(0)
    // FVC consistente: 30 ml intacto (no regresa).
    expect(c.repetibilidadFvcMl).toBeCloseTo(30, 5)
    expect(c.fvcTopTwoNative).toEqual([2.33, 2.3])
    expect(c.repetibilidadFvcMenor150).toBe('SI')
  })

  it('v10 (texto en calidad.notas_calidad): mismo comportamiento — defensa por canal', () => {
    const c = resolveCriteria({
      notas_calidad: undefined,
      calidad: { notas_calidad: V10_NOTAS_CALIDAD },
      parametros: V10_PARAMETROS,
    })
    // La detección busca en AMBOS canales (raíz + calidad).
    expect(c.repetibilidadFev1Ml).toBe(null)
    expect(c.fev1TopTwoNative).toBe(null)
    expect(c.repetibilidadFvcMl).toBeCloseTo(30, 5)
  })

  it('v10 (texto en AMBOS canales): detección robusta', () => {
    const c = resolveCriteria({
      notas_calidad: V10_NOTAS_CALIDAD,
      calidad: { notas_calidad: V10_NOTAS_CALIDAD },
      parametros: V10_PARAMETROS,
    })
    expect(c.repetibilidadFev1Ml).toBe(null)
    expect(c.fev1TopTwoNative).toBe(null)
  })

  it('v10 con repetibilidad_fev1_ml extraída del texto nativo: conserva 40, oculta operación', () => {
    // Si el reporte trae explícitamente `repetibilidad_fev1_ml=40` como
    // texto nativo (no derivado de la tabla), se CONSERVA el número
    // (fuente independiente del layout) pero se OCULTA la operación
    // espuria (topTwoNative=null → la línea de operación muestra "—").
    const c = resolveCriteria({
      notas_calidad: V10_NOTAS_CALIDAD,
      calidad: { repetibilidad_fev1_ml: 40 },
      parametros: V10_PARAMETROS,
    })
    expect(c.repetibilidadFev1Ml).toBeCloseTo(40, 5)
    expect(c.repetibilidadFev1Source).toBe('extracted')
    expect(c.fev1TopTwoNative).toBe(null)
  })

  it('v10 render HTML: FEV1 muestra "—" (operación) y NO renderiza "(2.11−2.11) = 0 ml"', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: {
          notas_calidad: V10_NOTAS_CALIDAD,
          parametros: V10_PARAMETROS,
        },
      })
    )
    // La operación FEV1 NO debe aparecer (0 ml espurio).
    expect(html).not.toMatch(/\(2\.11\s*[−-]\s*2\.11\)/)
    // La operación FEV1 está presente pero muestra "—".
    expect(html).toContain('data-testid="repetibilidad-fev1-operacion"')
    expect(html).toMatch(/FEV1:\s*—/)
    // El número de Repetibilidad FEV1 también cae al placeholder "—"
    // (atributo `data-criteria-value=""` cuando value=null).
    expect(html).toMatch(
      /data-criteria-key="Repetibilidad FEV1"[^>]*data-criteria-value=""/s
    )
    // FVC consistente: 30 ml + operación visible (no regresa).
    expect(html).toMatch(
      /FVC:\s*\(2\.33\s*[−-]\s*2\.30\)\s*[×x]\s*1000\s*=\s*30(?:\.00)?\s*ml/
    )
  })

  it('v10 con calidad.completitud_documental="no_concluyente" preservado en el payload', () => {
    // Cuando backend anota no_concluyente + frase estructurada v10, el
    // panel debe respetar ambas señales (defensa trazable).
    const c = resolveCriteria({
      notas_calidad: V10_NOTAS_CALIDAD,
      calidad: {
        completitud_documental: 'no_concluyente',
      },
      parametros: V10_PARAMETROS,
    })
    expect(c.repetibilidadFev1Ml).toBe(null)
    expect(c.fev1TopTwoNative).toBe(null)
  })
})

describe('EspirometriaClinicalCriteriaPanel — IMPL-FIX-20260824-04-rev3 regresión preservada', () => {
  it('REGRESIÓN: FEV1 canónico 2.15/77, 2.11/76, 2.09/75 → 40 ml + operación visible (sin inconsistencias)', () => {
    const c = resolveCriteria({
      calidad: { ...CALIDAD_FIXTURE },
      parametros: PARAMETROS_FIXTURE,
    })
    expect(c.repetibilidadFev1Ml).toBeCloseTo(40, 5)
    expect(c.fev1TopTwoNative).toEqual([2.15, 2.11])
    expect(c.repetibilidadFev1Menor150).toBe('SI')
  })

  it('REGRESIÓN: FVC canónico 2.30/69, 2.33/70, 2.26/68 → 30 ml + operación visible (no regresa)', () => {
    const c = resolveCriteria({
      calidad: { ...CALIDAD_FIXTURE },
      parametros: PARAMETROS_FIXTURE,
    })
    expect(c.repetibilidadFvcMl).toBeCloseTo(30, 5)
    expect(c.fvcTopTwoNative).toEqual([2.33, 2.3])
    expect(c.repetibilidadFvcMenor150).toBe('SI')
  })

  it('REGRESIÓN: duplicación m1=m2 con código backend → sigue marcando inconsistente (no 0 ml)', () => {
    const INCONSISTENCIA_FEV1_NOTA =
      'SOSPECHA_INCONSISTENCIA_MEJOR_FEV1: FEV1: max(m1,m2,m3)=2.11 de la fila ' +
      'estándar < Mejor FEV1=2.15. El valor de la mejor maniobra no aparece entre ' +
      'las maniobras de la fila estándar — posible duplicación de M2 como M1 o ' +
      'pérdida de M1. (m1==m2 detectado). Extracción marcada no_concluyente: el ' +
      'cálculo de repetibilidad sobre la(s) fila(s) afectada(s) no es confiable.'
    const DUPLICATED_FEV1_PARAMETROS = [
      { label: 'Mejor FVC', key: 'mejor_fvc_l', unidad: 'L', m1: 2.33, m2: 2.33, m3: 2.33 },
      { label: 'Mejor FEV1', key: 'mejor_fev1_l', unidad: 'L', m1: 2.15, m2: 2.15, m3: 2.15 },
      { label: 'FVC', key: 'fvc_l', unidad: 'L', m1: 2.3, m2: 2.33, m3: 2.26 },
      { label: 'FEV1', key: 'fev1_l', unidad: 'L', m1: 2.11, m2: 2.11, m3: 2.09 },
    ]
    const c = resolveCriteria({
      calidad: {
        ...CALIDAD_FIXTURE,
        notas_calidad: INCONSISTENCIA_FEV1_NOTA,
      },
      parametros: DUPLICATED_FEV1_PARAMETROS,
    })
    expect(c.repetibilidadFev1Ml).toBe(null)
    expect(c.fev1TopTwoNative).toBe(null)
    expect(c.repetibilidadFev1Menor150).toBe(null)
    // FVC consistente: 30 ml intacto (no regresa).
    expect(c.repetibilidadFvcMl).toBeCloseTo(30, 5)
    expect(c.fvcTopTwoNative).toEqual([2.33, 2.3])
    expect(c.repetibilidadFvcMenor150).toBe('SI')
  })

  it('REGRESIÓN: nota genérica SIN marcadores no marca inconsistencia', () => {
    // Ningún código + ningún patrón completo = no marcar.
    const c = resolveCriteria({
      notas_calidad: 'Curva legible. Sin particularidades.',
      parametros: PARAMETROS_FIXTURE,
    })
    expect(c.repetibilidadFev1Ml).toBeCloseTo(40, 5)
    expect(c.repetibilidadFvcMl).toBeCloseTo(30, 5)
  })
})

// ---------------------------------------------------------------------------
// IMPL-FIX-20260824-04-rev4 — Event v11: claves no canónicas, sin token.
//
// El payload real de Event v11 trae keys como `M*FEV1`/`M*FVC` (no
// `mejor_fev1_l`/`fvc_l`/`fev1_l`) y NO incluye el código SOSPECHA ni la
// frase estructurada. Las detecciones rev. 1.5 y rev. 3 fallaban; el panel
// seguía mostrando `(2.11−2.11)×1000 = 0 ml`.
//
// Esta suite valida el nuevo cross-check DIRECTO sobre `parametros[]`:
//   - Localiza fila estándar FEV1/FVC por key o label exacto, EXCLUYENDO
//     filas "Mejor X".
//   - Localiza fila "Mejor <param>" por label/key (incluye variantes no
//     canónicas).
//   - Compara `mejor.m1 > max(std.m1,std.m2,std.m3)` + epsilon.
//   - Combina OR lógico con la detección por notas — invalida operación,
//     resultado y flag cuando detecta inconsistencia por CUALQUIER canal.
//   - FVC consistente sigue mostrando 30 ml (no regresión).
//
// @id IMPL-FIX-20260824-04-rev4
// ---------------------------------------------------------------------------

describe('EspirometriaClinicalCriteriaPanel — IMPL-FIX-20260824-04-rev4 helper detectCrossInconsistency', () => {
  it('detecta inconsistencia FEV1 con claves no canónicas (caso v11)', () => {
    const v11 = [
      { label: 'Mejor FVC', key: 'M_FVC', unidad: 'L', m1: 2.33, m2: 2.33, m3: 2.33 },
      { label: 'Mejor FEV1', key: 'M_FEV1', unidad: 'L', m1: 2.15, m2: 2.15, m3: 2.15 },
      { label: 'FVC', key: 'STD_FVC', unidad: 'L', m1: 2.30, m2: 2.33, m3: 2.26 },
      { label: 'FEV1', key: 'STD_FEV1', unidad: 'L', m1: 2.11, m2: 2.11, m3: 2.09 },
    ]
    expect(detectCrossInconsistency(v11, 'FEV1')).toBe(true)
    // FVC consistente: mejor=2.33 == max(std)=2.33 → NO inconsistencia.
    expect(detectCrossInconsistency(v11, 'FVC')).toBe(false)
  })

  it('detecta inconsistencia FVC con claves no canónicas', () => {
    const v11FVC = [
      { label: 'Mejor FVC', key: 'M_FVC', unidad: 'L', m1: 2.33, m2: 2.33, m3: 2.33 },
      { label: 'Mejor FEV1', key: 'M_FEV1', unidad: 'L', m1: 2.15, m2: 2.15, m3: 2.15 },
      { label: 'FVC', key: 'STD_FVC', unidad: 'L', m1: 2.20, m2: 2.25, m3: 2.22 },
      { label: 'FEV1', key: 'STD_FEV1', unidad: 'L', m1: 2.15, m2: 2.11, m3: 2.09 },
    ]
    expect(detectCrossInconsistency(v11FVC, 'FVC')).toBe(true)
    // FEV1 consistente: mejor=2.15 == max(std)=2.15 → NO.
    expect(detectCrossInconsistency(v11FVC, 'FEV1')).toBe(false)
  })

  it('NO dispara cuando FEV1 es consistente (canónico: mejor=2.15, max std=2.15)', () => {
    const canonical = [
      { label: 'Mejor FVC', key: 'mejor_fvc_l', unidad: 'L', m1: 2.33, m2: 2.33, m3: 2.33 },
      { label: 'Mejor FEV1', key: 'mejor_fev1_l', unidad: 'L', m1: 2.15, m2: 2.15, m3: 2.15 },
      { label: 'FVC', key: 'fvc_l', unidad: 'L', m1: 2.30, m2: 2.33, m3: 2.26 },
      { label: 'FEV1', key: 'fev1_l', unidad: 'L', m1: 2.15, m2: 2.11, m3: 2.09 },
    ]
    expect(detectCrossInconsistency(canonical, 'FEV1')).toBe(false)
    expect(detectCrossInconsistency(canonical, 'FVC')).toBe(false)
  })

  it('NO dispara cuando falta la fila "Mejor X"', () => {
    const noMejor = [
      { label: 'FVC', key: 'fvc_l', unidad: 'L', m1: 2.30, m2: 2.33, m3: 2.26 },
      { label: 'FEV1', key: 'fev1_l', unidad: 'L', m1: 2.15, m2: 2.11, m3: 2.09 },
    ]
    expect(detectCrossInconsistency(noMejor, 'FEV1')).toBe(false)
    expect(detectCrossInconsistency(noMejor, 'FVC')).toBe(false)
  })

  it('NO dispara cuando falta la fila estándar (sólo hay Mejor)', () => {
    const onlyMejor = [
      { label: 'Mejor FEV1', key: 'mejor_fev1_l', unidad: 'L', m1: 2.15, m2: 2.15, m3: 2.15 },
    ]
    expect(detectCrossInconsistency(onlyMejor, 'FEV1')).toBe(false)
  })

  it('NO dispara si `mejor.m1` es null', () => {
    const nullMejor = [
      { label: 'Mejor FEV1', key: 'mejor_fev1_l', unidad: 'L', m1: null },
      { label: 'FEV1', key: 'fev1_l', unidad: 'L', m1: 2.15, m2: 2.11, m3: 2.09 },
    ]
    expect(detectCrossInconsistency(nullMejor, 'FEV1')).toBe(false)
  })

  it('NO dispara si la fila estándar no tiene valores de maniobra', () => {
    const emptyStd = [
      { label: 'Mejor FEV1', key: 'mejor_fev1_l', unidad: 'L', m1: 2.15 },
      { label: 'FEV1', key: 'fev1_l', unidad: 'L' }, // sin m1/m2/m3
    ]
    expect(detectCrossInconsistency(emptyStd, 'FEV1')).toBe(false)
  })

  it('Lee m1_value como alias de m1 (Mejor row)', () => {
    const aliasMejor = [
      { label: 'Mejor FEV1', key: 'mejor_fev1', m1_value: 2.15 },
      { label: 'FEV1', key: 'fev1_l', m1: 2.11, m2: 2.11, m3: 2.09 },
    ]
    expect(detectCrossInconsistency(aliasMejor, 'FEV1')).toBe(true)
  })

  it('Lee m1_value/m2_value/m3_value como alias de m1/m2/m3 (Std row)', () => {
    const aliasStd = [
      { label: 'Mejor FEV1', key: 'mejor_fev1', m1: 2.15 },
      { label: 'FEV1', key: 'fev1_l', m1_value: 2.11, m2_value: 2.11, m3_value: 2.09 },
    ]
    expect(detectCrossInconsistency(aliasStd, 'FEV1')).toBe(true)
  })

  it('parametros null/undefined → false', () => {
    expect(detectCrossInconsistency(null, 'FEV1')).toBe(false)
    expect(detectCrossInconsistency(undefined, 'FEV1')).toBe(false)
  })

  it('Selectividad FEV1 vs FVC: una inconsistencia FEV1 no afecta FVC', () => {
    const v11 = [
      { label: 'Mejor FVC', key: 'M_FVC', m1: 2.33, m2: 2.33, m3: 2.33 },
      { label: 'Mejor FEV1', key: 'M_FEV1', m1: 2.15, m2: 2.15, m3: 2.15 },
      { label: 'FVC', key: 'STD_FVC', m1: 2.30, m2: 2.33, m3: 2.26 },
      { label: 'FEV1', key: 'STD_FEV1', m1: 2.11, m2: 2.11, m3: 2.09 },
    ]
    expect(detectCrossInconsistency(v11, 'FEV1')).toBe(true)
    expect(detectCrossInconsistency(v11, 'FVC')).toBe(false)
  })
})

describe('EspirometriaClinicalCriteriaPanel — IMPL-FIX-20260824-04-rev4 caso Event v11 (Frank)', () => {
  // Payload v11 con claves NO canónicas (`M*FEV1`/`M*FVC`).
  // Sin SOSPECHA en notas_calidad; sin frase estructurada.
  // FEV1 inconsistente: Mejor=2.15, max std=2.11 (m1=m2=2.11).
  // FVC consistente: Mejor=2.33, max std=2.33 (m2=2.33).
  const V11_PARAMETROS = [
    { label: 'Mejor FVC', key: 'M_FVC', unidad: 'L', m1: 2.33, m1_pct_ref: 70, m2: 2.33, m2_pct_ref: 70, m3: 2.33, m3_pct_ref: 70 },
    { label: 'Mejor FEV1', key: 'M_FEV1', unidad: 'L', m1: 2.15, m1_pct_ref: 77, m2: 2.15, m2_pct_ref: 77, m3: 2.15, m3_pct_ref: 77 },
    { label: 'FVC', key: 'STD_FVC', unidad: 'L', m1: 2.30, m1_pct_ref: 69, m2: 2.33, m2_pct_ref: 70, m3: 2.26, m3_pct_ref: 68 },
    { label: 'FEV1', key: 'STD_FEV1', unidad: 'L', m1: 2.11, m1_pct_ref: 76, m2: 2.11, m2_pct_ref: 76, m3: 2.09, m3_pct_ref: 75 },
  ]

  it('v11: FEV1 inválido (sin 0 ml), FVC intacto 30 ml — sin notas SOSPECHA', () => {
    const c = resolveCriteria({
      // Sin notas_calidad (no hay SOSPECHA ni frase estructurada).
      parametros: V11_PARAMETROS,
    })
    // FEV1 inconsistente: ml=null, operación=null, flag=null.
    expect(c.repetibilidadFev1Ml).toBe(null)
    expect(c.fev1TopTwoNative).toBe(null)
    expect(c.repetibilidadFev1Menor150).toBe(null)
    // FEV1 NO debe mostrar 0 ml (regresión principal).
    expect(c.repetibilidadFev1Ml).not.toBe(0)
    // FVC consistente: 30 ml + operación visible (no regresa).
    expect(c.repetibilidadFvcMl).toBeCloseTo(30, 5)
    expect(c.fvcTopTwoNative).toEqual([2.33, 2.3])
    expect(c.repetibilidadFvcMenor150).toBe('SI')
  })

  it('v11: FEV1 inválido aunque notas_calidad tenga sólo texto genérico (no SOSPECHA)', () => {
    const c = resolveCriteria({
      notas_calidad: 'Curva legible. Sin particularidades.',
      parametros: V11_PARAMETROS,
    })
    expect(c.repetibilidadFev1Ml).toBe(null)
    expect(c.fev1TopTwoNative).toBe(null)
    expect(c.repetibilidadFvcMl).toBeCloseTo(30, 5)
  })

  it('v11 render HTML: FEV1 muestra "—" (operación) y NO renderiza "(2.11−2.11) = 0 ml"', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: { parametros: V11_PARAMETROS },
      })
    )
    expect(html).not.toMatch(/\(2\.11\s*[−-]\s*2\.11\)/)
    expect(html).toContain('data-testid="repetibilidad-fev1-operacion"')
    expect(html).toMatch(/FEV1:\s*—/)
    // FVC consistente: 30 ml + operación visible.
    expect(html).toMatch(
      /FVC:\s*\(2\.33\s*[−-]\s*2\.30\)\s*[×x]\s*1000\s*=\s*30(?:\.00)?\s*ml/
    )
  })

  it('v11 con repetibilidad_fev1_ml extraída del texto nativo: conserva 40, oculta operación', () => {
    const c = resolveCriteria({
      calidad: { repetibilidad_fev1_ml: 40 },
      parametros: V11_PARAMETROS,
    })
    expect(c.repetibilidadFev1Ml).toBeCloseTo(40, 5)
    expect(c.repetibilidadFev1Source).toBe('extracted')
    expect(c.fev1TopTwoNative).toBe(null)
    // FVC intacto.
    expect(c.repetibilidadFvcMl).toBeCloseTo(30, 5)
  })

  it('v11: combinado nota (rev. 3) + parametros (rev. 4) — OR lógico', () => {
    // Si las notas tienen SOSPECHA pero los parametros son consistentes,
    // igual debe invalidar (sólo notas disparan).
    const c = resolveCriteria({
      notas_calidad: 'SOSPECHA_INCONSISTENCIA_MEJOR_FEV1',
      parametros: PARAMETROS_FIXTURE, // canónico consistente
    })
    expect(c.repetibilidadFev1Ml).toBe(null)

    // Si los parametros son inconsistentes pero NO hay notas, debe
    // invalidar (sólo parametros disparan — caso v11 puro).
    const c2 = resolveCriteria({
      notas_calidad: 'Sin particularidades.',
      parametros: V11_PARAMETROS,
    })
    expect(c2.repetibilidadFev1Ml).toBe(null)

    // Si ambos coinciden (notas SOSPECHA + parametros v11), debe
    // invalidar con la misma lógica.
    const c3 = resolveCriteria({
      notas_calidad: 'SOSPECHA_INCONSISTENCIA_MEJOR_FEV1',
      parametros: V11_PARAMETROS,
    })
    expect(c3.repetibilidadFev1Ml).toBe(null)
  })
})

describe('EspirometriaClinicalCriteriaPanel — IMPL-FIX-20260824-04-rev4 regresión preservada', () => {
  it('REGRESIÓN: FEV1 canónico 2.15/77, 2.11/76, 2.09/75 → 40 ml + operación visible', () => {
    const c = resolveCriteria({
      calidad: { ...CALIDAD_FIXTURE },
      parametros: PARAMETROS_FIXTURE,
    })
    expect(c.repetibilidadFev1Ml).toBeCloseTo(40, 5)
    expect(c.fev1TopTwoNative).toEqual([2.15, 2.11])
    expect(c.repetibilidadFev1Menor150).toBe('SI')
  })

  it('REGRESIÓN: FVC canónico 2.30/69, 2.33/70, 2.26/68 → 30 ml + operación visible', () => {
    const c = resolveCriteria({
      calidad: { ...CALIDAD_FIXTURE },
      parametros: PARAMETROS_FIXTURE,
    })
    expect(c.repetibilidadFvcMl).toBeCloseTo(30, 5)
    expect(c.fvcTopTwoNative).toEqual([2.33, 2.3])
    expect(c.repetibilidadFvcMenor150).toBe('SI')
  })

  it('REGRESIÓN: duplicación m1=m2 con código backend (rev. 1.5) sigue marcando FEV1', () => {
    const INCONSISTENCIA_FEV1_NOTA =
      'SOSPECHA_INCONSISTENCIA_MEJOR_FEV1: FEV1: max(m1,m2,m3)=2.11 de la fila ' +
      'estándar < Mejor FEV1=2.15. El valor de la mejor maniobra no aparece entre ' +
      'las maniobras de la fila estándar — posible duplicación de M2 como M1 o ' +
      'pérdida de M1. (m1==m2 detectado). Extracción marcada no_concluyente: el ' +
      'cálculo de repetibilidad sobre la(s) fila(s) afectada(s) no es confiable.'
    const DUPLICATED_FEV1_PARAMETROS = [
      { label: 'Mejor FVC', key: 'mejor_fvc_l', unidad: 'L', m1: 2.33, m2: 2.33, m3: 2.33 },
      { label: 'Mejor FEV1', key: 'mejor_fev1_l', unidad: 'L', m1: 2.15, m2: 2.15, m3: 2.15 },
      { label: 'FVC', key: 'fvc_l', unidad: 'L', m1: 2.3, m2: 2.33, m3: 2.26 },
      { label: 'FEV1', key: 'fev1_l', unidad: 'L', m1: 2.11, m2: 2.11, m3: 2.09 },
    ]
    const c = resolveCriteria({
      calidad: { ...CALIDAD_FIXTURE, notas_calidad: INCONSISTENCIA_FEV1_NOTA },
      parametros: DUPLICATED_FEV1_PARAMETROS,
    })
    expect(c.repetibilidadFev1Ml).toBe(null)
    expect(c.fev1TopTwoNative).toBe(null)
    expect(c.repetibilidadFvcMl).toBeCloseTo(30, 5)
  })

  it('REGRESIÓN: frase estructurada rev. 3 (Event v10) sigue marcando FEV1', () => {
    const v10Text =
      "Inconsistencia detectada entre fila 'Mejor FEV1' ... y fila estándar FEV1"
    const c = resolveCriteria({
      notas_calidad: v10Text,
      parametros: PARAMETROS_FIXTURE,
    })
    // La nota marca FEV1 como inconsistente (rev. 3) aunque los
    // parametros canónicos son consistentes (mejor=2.15 == max std=2.15).
    // OR lógico: cualquier canal basta para invalidar.
    expect(c.repetibilidadFev1Ml).toBe(null)
    expect(c.fev1TopTwoNative).toBe(null)
    expect(c.repetibilidadFvcMl).toBeCloseTo(30, 5)
  })

  it('REGRESIÓN: nota genérica SIN marcadores no invalida (cualquier canal)', () => {
    const c = resolveCriteria({
      notas_calidad: 'Curva legible. Sin particularidades.',
      parametros: PARAMETROS_FIXTURE,
    })
    expect(c.repetibilidadFev1Ml).toBeCloseTo(40, 5)
    expect(c.repetibilidadFvcMl).toBeCloseTo(30, 5)
  })
})

// ---------------------------------------------------------------------------
// IMPL-20260824-XX (Frank) — REPETIBILIDAD NUMÉRICA muestra M1/M2/M3.
//
// La línea de maniobras aparece junto a la operación top-2 en formato:
//   `FVC — M1: x.xx L · M2: x.xx L · M3: x.xx L`
//
// Soporta:
//   - aliases `m1`/`m2`/`m3` y `m1_value`/`m2_value`/`m3_value`
//   - payload parcial (maniobra faltante → `—`)
//   - fila FEV1/FVC ausente (no renderiza esa línea)
//   - key no canónica (también funciona por label `FEV1` / `FVC`)
//
// No se modifica la fórmula (top-2 × 1000), ni el umbral AMI, ni la
// extracción, ni el prompt MedGemma, ni los criterios visuales.
// ---------------------------------------------------------------------------

describe('EspirometriaClinicalCriteriaPanel — IMPL-20260824-XX Maniobras M1/M2/M3', () => {
  it('FVC canónico (m1=2.30, m2=2.33, m3=2.26) muestra M1/M2/M3 con 2 decimales', () => {
    const c = resolveCriteria({
      parametros: PARAMETROS_FIXTURE,
    })
    expect(c.fvcManeuverTripleNative).toEqual([2.3, 2.33, 2.26])
  })

  it('FEV1 canónico (m1=2.15, m2=2.11, m3=2.09) muestra M1/M2/M3 con 2 decimales', () => {
    const c = resolveCriteria({
      parametros: PARAMETROS_FIXTURE,
    })
    expect(c.fev1ManeuverTripleNative).toEqual([2.15, 2.11, 2.09])
  })

  it('FVC render HTML: muestra `FVC — M1: 2.30 L · M2: 2.33 L · M3: 2.26 L`', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: { parametros: PARAMETROS_FIXTURE },
      })
    )
    expect(html).toContain('FVC — M1: 2.30 L · M2: 2.33 L · M3: 2.26 L')
    expect(html).toContain('data-testid="repetibilidad-fvc-maniobras"')
  })

  it('FEV1 render HTML: muestra `FEV1 — M1: 2.15 L · M2: 2.11 L · M3: 2.09 L`', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: { parametros: PARAMETROS_FIXTURE },
      })
    )
    expect(html).toContain('FEV1 — M1: 2.15 L · M2: 2.11 L · M3: 2.09 L')
    expect(html).toContain('data-testid="repetibilidad-fev1-maniobras"')
  })

  it('Aliases m1_value/m2_value/m3_value funcionan igual que m1/m2/m3', () => {
    const c = resolveCriteria({
      parametros: [
        { label: 'FVC', key: 'fvc_l', unidad: 'L', m1_value: 2.3, m2_value: 2.33, m3_value: 2.26 },
        { label: 'FEV1', key: 'fev1_l', unidad: 'L', m1_value: 2.15, m2_value: 2.11, m3_value: 2.09 },
      ],
    })
    expect(c.fvcManeuverTripleNative).toEqual([2.3, 2.33, 2.26])
    expect(c.fev1ManeuverTripleNative).toEqual([2.15, 2.11, 2.09])
  })

  it('Aliases `m1` tienen precedencia sobre `m1_value` cuando ambos presentes', () => {
    const c = resolveCriteria({
      parametros: [
        { label: 'FEV1', key: 'fev1_l', unidad: 'L', m1: 2.15, m1_value: 9.99 },
      ],
    })
    expect(c.fev1ManeuverTripleNative).toEqual([2.15, null, null])
  })

  it('Payload parcial: maniobra faltante → `null` (no se inventa)', () => {
    const c = resolveCriteria({
      parametros: [
        // Sólo M1 y M2; M3 ausente.
        { label: 'FVC', key: 'fvc_l', unidad: 'L', m1: 2.30, m2: 2.33 },
        { label: 'FEV1', key: 'fev1_l', unidad: 'L', m1: 2.15, m3: 2.09 },
      ],
    })
    expect(c.fvcManeuverTripleNative).toEqual([2.3, 2.33, null])
    expect(c.fev1ManeuverTripleNative).toEqual([2.15, null, 2.09])
  })

  it('Payload parcial HTML: renderiza `M2: — L` y `M3: — L` (no inventa)', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: {
          parametros: [
            { label: 'FVC', key: 'fvc_l', unidad: 'L', m1: 2.30, m2: 2.33 },
          ],
        },
      })
    )
    expect(html).toContain('FVC — M1: 2.30 L · M2: 2.33 L · M3: — L')
  })

  it('Fila ausente → triple null (no renderiza la línea)', () => {
    const c = resolveCriteria({
      parametros: [
        // Sólo FVC; sin FEV1.
        { label: 'FVC', key: 'fvc_l', unidad: 'L', m1: 2.30, m2: 2.33, m3: 2.26 },
      ],
    })
    expect(c.fvcManeuverTripleNative).toEqual([2.3, 2.33, 2.26])
    expect(c.fev1ManeuverTripleNative).toBe(null)
  })

  it('Sin filas parametros[] → ambos triples null', () => {
    const c = resolveCriteria({
      parametros: [],
    })
    expect(c.fvcManeuverTripleNative).toBe(null)
    expect(c.fev1ManeuverTripleNative).toBe(null)
  })

  it('Maniobras no numéricas → null por slot, no se inventa', () => {
    const c = resolveCriteria({
      parametros: [
        { label: 'FVC', key: 'fvc_l', unidad: 'L', m1: 'abc', m2: null, m3: 2.26 },
      ],
    })
    // m1='abc' (string no numérica) → null; m2=null → null; m3=2.26 → 2.26.
    expect(c.fvcManeuverTripleNative).toEqual([null, null, 2.26])
  })

  it('M1/M2/M3 aparecen ANTES de la operación (orden DOM)', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaClinicalCriteriaPanel, {
        extractedData: { parametros: PARAMETROS_FIXTURE },
      })
    )
    const idxFvcManiobras = html.indexOf('data-testid="repetibilidad-fvc-maniobras"')
    const idxFvcOperacion = html.indexOf('data-testid="repetibilidad-fvc-operacion"')
    const idxFev1Maniobras = html.indexOf('data-testid="repetibilidad-fev1-maniobras"')
    const idxFev1Operacion = html.indexOf('data-testid="repetibilidad-fev1-operacion"')
    expect(idxFvcManiobras).toBeGreaterThan(-1)
    expect(idxFvcOperacion).toBeGreaterThan(-1)
    expect(idxFvcManiobras).toBeLessThan(idxFvcOperacion)
    expect(idxFev1Maniobras).toBeGreaterThan(-1)
    expect(idxFev1Operacion).toBeGreaterThan(-1)
    expect(idxFev1Maniobras).toBeLessThan(idxFev1Operacion)
  })

  it('No cambia la fórmula top-2 ni el resultado ml (regresión)', () => {
    const c = resolveCriteria({
      parametros: PARAMETROS_FIXTURE,
    })
    // Regresión: la fórmula y el resultado siguen intactos.
    expect(c.repetibilidadFvcMl).toBeCloseTo(30, 5)
    expect(c.fvcTopTwoNative).toEqual([2.33, 2.3])
    expect(c.repetibilidadFev1Ml).toBeCloseTo(40, 5)
    expect(c.fev1TopTwoNative).toEqual([2.15, 2.11])
  })

  it('No afecta repetibilidad_fvc_ml extraído del texto nativo (foco en audit)', () => {
    // Aunque la repetibilidad venga del texto fuente (`extracted`), el triple
    // sigue mostrándose desde la fila de parametros[] (independiente).
    const c = resolveCriteria({
      calidad: { repetibilidad_fvc_ml: 30, repetibilidad_fev1_ml: 40 },
      parametros: PARAMETROS_FIXTURE,
    })
    expect(c.repetibilidadFvcSource).toBe('extracted')
    expect(c.repetibilidadFvcMl).toBeCloseTo(30, 5)
    expect(c.fvcManeuverTripleNative).toEqual([2.3, 2.33, 2.26])
    expect(c.fev1ManeuverTripleNative).toEqual([2.15, 2.11, 2.09])
  })
})
