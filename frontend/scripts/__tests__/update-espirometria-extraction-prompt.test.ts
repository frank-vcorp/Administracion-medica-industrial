/**
 * Tests focales (V1) del prompt de extracción de Espirometría v4
 * (IMPL-20260824-04 — BR-20260824-02, inferencia visual de criterios de
 * calidad desde las gráficas flujo-volumen y volumen-tiempo).
 *
 * Cubre:
 *   - AC-1: el prompt v4 instruye a inferir VISUALMENTE, desde las curvas
 *     flujo-volumen y volumen-tiempo, los 7 criterios:
 *     `pico_maximo`, `forma_triangular`, `libre_artefactos`, `meseta`,
 *     `tiempo`, `criterios_para_dx`, `calidad`.
 *   - AC-2: el prompt v4 instruye a devolver SI/NO (o A/B/C/D/F para
 *     `calidad`) sólo cuando la curva permita inferencia clara; en caso
 *     contrario, `null`.
 *   - AC-3: el prompt v4 etiqueta explícitamente estos valores como
 *     "CRITERIOS DERIVADOS VISUALMENTE DE LAS GRÁFICAS", no como texto del
 *     médico ni como diagnóstico IA.
 *   - AC-4: el prompt v4 NO cambia la fórmula de cálculo de repetibilidad
 *     FVC/FEV1 en ml; sólo documenta que es responsabilidad del panel
 *     (umbral AMI ≤ 150 ml, BR-20260824-01).
 *   - AC-5: el prompt v4 prohíbe inventar impresión diagnóstica o
 *     recomendaciones; las marca explícitamente como TEXTO FUENTE del
 *     documento médico, no salida IA.
 *   - AC-6: el prompt v4 expone el alias correcto para el panel
 *     (`impresion_diagnostica_texto` / `recomendaciones_texto`) además del
 *     nombre histórico (`impresion_diagnostica` / `recomendaciones`).
 *   - AC-7 (comportamiento simulado): dado un escenario de gráfica no
 *     legible, las reglas del prompt producirían `null` para los 7
 *     criterios visuales. Dado un escenario de gráfica clara con todos los
 *     criterios visibles, las reglas producirían valores SI/NO/A
 *     coherentes.
 *
 * Implementación: vitest puro sin DOM ni red; importa directamente las
 * constantes del script (que ahora las exporta para tests V1).
 *
 * @id IMPL-20260824-04
 * @backup discovery/BUSINESS-RULES.md (BR-20260824-02)
 */

import { describe, it, expect } from 'vitest'
import {
  EXTRACTION_VERSION,
  NEW_EXTRACTION_PROMPT,
} from '../update-espirometria-extraction-prompt'

const VISUAL_CRITERIA_KEYS = [
  'pico_maximo',
  'forma_triangular',
  'libre_artefactos',
  'meseta',
  'tiempo',
  'criterios_para_dx',
] as const

const VISUAL_CALIDAD_KEYS = ['calidad'] as const

// -----------------------------------------------------------------------
// AC-1: el prompt instruye a inferir visualmente desde las curvas
// flujo-volumen y volumen-tiempo los 7 criterios visuales.
// -----------------------------------------------------------------------

describe('update-espirometria-extraction-prompt v4 — AC-1: inferencia visual desde gráficas', () => {
  it('Referencia explícita a BR-20260824-02', () => {
    expect(NEW_EXTRACTION_PROMPT).toContain('BR-20260824-02')
    expect(EXTRACTION_VERSION).toBe('espirometria-sibelmed-v4')
  })

  it('Menciona las curvas flujo-volumen y volumen-tiempo como fuente de la inferencia', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(/flujo[-\s]volumen/)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/volumen[-\s]tiempo/)
  })

  it('Lista los 7 criterios visuales como claves exactas de la salida JSON', () => {
    for (const key of VISUAL_CRITERIA_KEYS) {
      // Cada clave aparece como `` `key` `` con backticks (skeleton JSON).
      expect(NEW_EXTRACTION_PROMPT).toContain(`\`${key}\``)
    }
    for (const key of VISUAL_CALIDAD_KEYS) {
      expect(NEW_EXTRACTION_PROMPT).toContain(`\`${key}\``)
    }
  })

  it('Declara el dominio de salida "SI" | "NO" | null para los 6 criterios booleanos', () => {
    // "SI" | "NO" | null aparece en múltiples sitios pero basta un check
    // general del dominio permitido.
    expect(NEW_EXTRACTION_PROMPT).toMatch(/"SI"\s*\|\s*"NO"\s*\|\s*null/)
  })

  it('Declara el dominio de salida "A" | "B" | "C" | "D" | "F" | null para `calidad`', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /"A"\s*\|\s*"B"\s*\|\s*"C"\s*\|\s*"D"\s*\|\s*"F"\s*\|\s*null/
    )
  })
})

// -----------------------------------------------------------------------
// AC-2: el prompt exige devolver null cuando la curva no es legible.
// AC-7: simulador de comportamiento del LLM siguiendo las reglas del prompt.
// -----------------------------------------------------------------------

/**
 * Simula lo que un LLM que SIGUE las reglas del prompt debería producir
 * para los 7 criterios visuales, dado un escenario de legibilidad de la
 * gráfica. NO es un LLM real; es un espejo literal de las reglas declaradas
 * en `NEW_EXTRACTION_PROMPT`. Sirve para que el test V1 valide que las
 * reglas producen `null` cuando corresponde y SI/NO/A cuando hay inferencia
 * clara.
 *
 * El simulador vive en el test para que cualquier cambio al prompt que
 * mantenga los nombres de las claves + las reglas documentadas NO rompa el
 * test sin querer. Si el prompt cambia el dominio de salida, este
 * simulador debe actualizarse en el mismo PR.
 */
type GraphLegibility = {
  pico_maximo: boolean | null // null = ilegible
  forma_triangular: boolean | null
  libre_artefactos: boolean | null
  meseta: boolean | null
  tiempo: boolean | null
  criterios_para_dx: boolean | null
}

function simulateVisualExtraction(
  graph: GraphLegibility
): {
  pico_maximo: 'SI' | 'NO' | null
  forma_triangular: 'SI' | 'NO' | null
  libre_artefactos: 'SI' | 'NO' | null
  meseta: 'SI' | 'NO' | null
  tiempo: 'SI' | 'NO' | null
  criterios_para_dx: 'SI' | 'NO' | null
  calidad: 'A' | 'B' | 'C' | 'D' | 'F' | null
} {
  function tri(v: boolean | null): 'SI' | 'NO' | null {
    if (v === null) return null
    return v ? 'SI' : 'NO'
  }
  const pico = tri(graph.pico_maximo)
  const forma = tri(graph.forma_triangular)
  const libre = tri(graph.libre_artefactos)
  const meseta = tri(graph.meseta)
  const tiempo = tri(graph.tiempo)
  const criterios = tri(graph.criterios_para_dx)

  // `calidad` global: A=todo OK; F=nada OK; baja un grado por cada uno
  // ambiguo. Si varios son ilegibles → null.
  const booleanValues = [pico, forma, libre, meseta, tiempo, criterios]
  const illegibleCount = booleanValues.filter((v) => v === null).length
  let calidad: 'A' | 'B' | 'C' | 'D' | 'F' | null
  if (illegibleCount >= 2) {
    calidad = null
  } else {
    // Cuenta los NO como "baja un grado".
    const noCount = booleanValues.filter((v) => v === 'NO').length
    const grades: Array<'A' | 'B' | 'C' | 'D' | 'F'> = ['A', 'B', 'C', 'D', 'F']
    // Si uno es ambiguo (null), baja un grado extra (equivalente a tratar
    // null como NO para el cómputo del grado, según el prompt: "si uno es
    // ambiguo, baja un grado").
    const penalty = noCount + (illegibleCount === 1 ? 1 : 0)
    const idx = Math.min(penalty, grades.length - 1)
    calidad = grades[idx]
  }
  return {
    pico_maximo: pico,
    forma_triangular: forma,
    libre_artefactos: libre,
    meseta: meseta,
    tiempo: tiempo,
    criterios_para_dx: criterios,
    calidad,
  }
}

describe('update-espirometria-extraction-prompt v4 — AC-2: null si la curva no es legible', () => {
  it('El prompt contiene la prohibición explícita de inventar SI/NO/A/B/C/D/F cuando la curva no permite inferencia clara', () => {
    // La regla de null-debe-salir está en al menos uno de los apartados:
    // "INFERENCIA VISUAL", "PROHIBICIONES ABSOLUTAS" o "REGLAS CRÍTICAS".
    // El texto prompt dice "Si una curva no es legible... devuelve `null`";
    // verificamos que aparecen las palabras clave de ilegibilidad y la
    // mención explícita de `null` en ese contexto.
    expect(NEW_EXTRACTION_PROMPT).toMatch(/(ilegible|cortada|borrosa|ambigua|no es clara)[^\n]*\bnull\b/i)
    expect(NEW_EXTRACTION_PROMPT).toContain('NUNCA inventes')
    // Regla 1 de PROHIBICIONES ABSOLUTAS: "NUNCA devuelvas SI/NO/A/B/C/D/F
    // si la curva no permite inferencia clara".
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /NUNCA devuelvas SI\/NO\/A\/B\/C\/D\/F si la curva no permite inferencia clara/
    )
  })

  it('Simulación: gráfica completamente ilegible → null para los 7 campos visuales', () => {
    const legibleGraph: GraphLegibility = {
      pico_maximo: null,
      forma_triangular: null,
      libre_artefactos: null,
      meseta: null,
      tiempo: null,
      criterios_para_dx: null,
    }
    const out = simulateVisualExtraction(legibleGraph)
    expect(out.pico_maximo).toBeNull()
    expect(out.forma_triangular).toBeNull()
    expect(out.libre_artefactos).toBeNull()
    expect(out.meseta).toBeNull()
    expect(out.tiempo).toBeNull()
    expect(out.criterios_para_dx).toBeNull()
    expect(out.calidad).toBeNull()
  })

  it('Simulación: gráfica clara con todos los criterios cumplidos → SI/SI/SI/SI/SI/SI/A', () => {
    const legibleGraph: GraphLegibility = {
      pico_maximo: true,
      forma_triangular: true,
      libre_artefactos: true,
      meseta: true,
      tiempo: true,
      criterios_para_dx: true,
    }
    const out = simulateVisualExtraction(legibleGraph)
    expect(out.pico_maximo).toBe('SI')
    expect(out.forma_triangular).toBe('SI')
    expect(out.libre_artefactos).toBe('SI')
    expect(out.meseta).toBe('SI')
    expect(out.tiempo).toBe('SI')
    expect(out.criterios_para_dx).toBe('SI')
    expect(out.calidad).toBe('A')
  })

  it('Simulación: gráfica clara con criterios parciales → NO sólo en los que NO se cumplen; calidad baja un grado', () => {
    // 2 NO, 0 null → calidad = C (índice 2).
    const legibleGraph: GraphLegibility = {
      pico_maximo: true,
      forma_triangular: true,
      libre_artefactos: false, // NO
      meseta: false, // NO
      tiempo: true,
      criterios_para_dx: true,
    }
    const out = simulateVisualExtraction(legibleGraph)
    expect(out.libre_artefactos).toBe('NO')
    expect(out.meseta).toBe('NO')
    expect(out.calidad).toBe('C')
  })

  it('Simulación: gráfica parcialmente legible (1 criterio ambiguo, resto OK) → null sólo en el ambiguo', () => {
    const legibleGraph: GraphLegibility = {
      pico_maximo: true,
      forma_triangular: true,
      libre_artefactos: true,
      meseta: null, // ilegible
      tiempo: true,
      criterios_para_dx: true,
    }
    const out = simulateVisualExtraction(legibleGraph)
    expect(out.meseta).toBeNull()
    expect(out.pico_maximo).toBe('SI')
    // calidad: 1 ilegible → "baja un grado" → B.
    expect(out.calidad).toBe('B')
  })

  it('Simulación: gráfica parcialmente legible (2 criterios ilegibles) → calidad null', () => {
    const legibleGraph: GraphLegibility = {
      pico_maximo: true,
      forma_triangular: null,
      libre_artefactos: null,
      meseta: true,
      tiempo: true,
      criterios_para_dx: true,
    }
    const out = simulateVisualExtraction(legibleGraph)
    expect(out.forma_triangular).toBeNull()
    expect(out.libre_artefactos).toBeNull()
    expect(out.calidad).toBeNull()
  })
})

// -----------------------------------------------------------------------
// AC-3: el prompt etiqueta los criterios visuales como derivados de la
// gráfica, no como texto del médico ni diagnóstico IA.
// -----------------------------------------------------------------------

describe('update-espirometria-extraction-prompt v4 — AC-3: etiquetado como derivado visual', () => {
  it('El prompt contiene la etiqueta explícita "CRITERIOS DERIVADOS VISUALMENTE DE LAS GRÁFICAS"', () => {
    expect(NEW_EXTRACTION_PROMPT).toContain(
      'CRITERIOS DERIVADOS VISUALMENTE DE LAS GRÁFICAS'
    )
  })

  it('El prompt afirma explícitamente que NO son texto del médico ni diagnóstico IA', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(/NO son texto escrito por el médico/)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/NO son diagnóstico IA/)
  })
})

// -----------------------------------------------------------------------
// AC-4: el prompt NO cambia el cálculo de repetibilidad FVC/FEV1 en ml;
// sólo documenta que es responsabilidad del panel (BR-20260824-01, AMI 150 ml).
// -----------------------------------------------------------------------

describe('update-espirometria-extraction-prompt v4 — AC-4: repetibilidad FVC/FEV1 sigue siendo del panel', () => {
  it('El prompt documenta que el cálculo de repetibilidad en ml es del panel', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /cálculo.*repetibilidad.*FVC\/FEV1.*panel/i
    )
  })

  it('El prompt referencia el umbral AMI ≤ 150 ml y la regla BR-20260824-01', () => {
    expect(NEW_EXTRACTION_PROMPT).toContain('BR-20260824-01')
    expect(NEW_EXTRACTION_PROMPT).toMatch(/150 ml/)
    expect(NEW_EXTRACTION_PROMPT).toContain('0.15 L')
  })

  it('El prompt prohíbe al extractor calcular o multiplicar unidades', () => {
    // Regla 4 de PROHIBICIONES ABSOLUTAS: "NO modifiques el cálculo
    // numérico de repetibilidad FVC/FEV1 en ml... (top-2 sobre m1/m2/m3 ×
    // 1000) con umbral AMI ≤ 150 ml".
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /NO modifiques el cálculo numérico de repetibilidad FVC\/FEV1 en ml/
    )
  })
})

// -----------------------------------------------------------------------
// AC-5: el prompt prohíbe inventar impresión diagnóstica o recomendaciones.
// -----------------------------------------------------------------------

describe('update-espirometria-extraction-prompt v4 — AC-5: no inventar impresión/recomendaciones', () => {
  it('El prompt marca `impresion_diagnostica*` como TEXTO FUENTE del documento, no salida IA', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(/impresion_diagnostica.*TEXTO FUENTE/i)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/NO son salida IA/)
  })

  it('El prompt marca `recomendaciones*` como TEXTO FUENTE del documento, no salida IA', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(/recomendaciones.*TEXTO FUENTE/i)
  })

  it('El prompt contiene la prohibición explícita de inventar impresión diagnóstica o recomendaciones', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /NUNCA inventes.*impresion_diagnostica.*recomendaciones/
    )
  })
})

// -----------------------------------------------------------------------
// AC-6: el prompt expone los aliases correctos para el panel
// (`impresion_diagnostica_texto` / `recomendaciones_texto`) además del
// nombre histórico.
// -----------------------------------------------------------------------

describe('update-espirometria-extraction-prompt v4 — AC-6: aliases de texto fuente para el panel', () => {
  it('El JSON skeleton incluye `impresion_diagnostica_texto` (alias del panel)', () => {
    expect(NEW_EXTRACTION_PROMPT).toContain('`impresion_diagnostica_texto`')
  })

  it('El JSON skeleton incluye `recomendaciones_texto` (alias del panel)', () => {
    expect(NEW_EXTRACTION_PROMPT).toContain('`recomendaciones_texto`')
  })

  it('El JSON skeleton conserva los nombres históricos para no romper esquemas previos', () => {
    expect(NEW_EXTRACTION_PROMPT).toContain('`impresion_diagnostica`')
    expect(NEW_EXTRACTION_PROMPT).toContain('`recomendaciones`')
  })

  it('El prompt instruye a poblar ambos aliases con el mismo valor', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(/POBLAR AMBOS/)
  })
})

// -----------------------------------------------------------------------
// Tests de regresión: el prompt mantiene claves históricas que el esquema
// y el panel siguen consumiendo.
// -----------------------------------------------------------------------

describe('update-espirometria-extraction-prompt v4 — regresión: claves históricas preservadas', () => {
  const HISTORICAL_KEYS = [
    'repetibilidad_fvc_menor_150',
    'repetibilidad_fev1_menor_150',
    'pruebas_aceptables',
    'repetibilidad_ats_ers_fvc',
    'repetibilidad_ats_ers_fev1',
    'es_interpretable',
    'completitud_documental',
    'repetibilidad_fvc_ml',
    'repetibilidad_fev1_ml',
    'notas_calidad',
  ] as const

  it('Todas las claves históricas del esquema siguen presentes en el JSON skeleton', () => {
    for (const key of HISTORICAL_KEYS) {
      expect(NEW_EXTRACTION_PROMPT).toContain(`\`${key}\``)
    }
  })

  it('Las filas FVC y FEV1 siguen siendo la fuente numérica primaria', () => {
    expect(NEW_EXTRACTION_PROMPT).toContain('"INFORME DE FVC"')
    expect(NEW_EXTRACTION_PROMPT).toMatch(/PARÁMETRO \| M1 \| %REF \| M2 \| %REF \| M3 \| %REF \| REF \| LLN/)
  })
})

// -----------------------------------------------------------------------
// Tests del contrato del script (no del prompt en sí): la versión y el
// script mantienen la convención `espirometria-sibelmed-vN`.
// -----------------------------------------------------------------------

describe('update-espirometria-extraction-prompt v4 — contrato del script', () => {
  it('EXTRACTION_VERSION sigue la convención `espirometria-sibelmed-vN`', () => {
    expect(EXTRACTION_VERSION).toMatch(/^espirometria-sibelmed-v\d+$/)
  })

  it('EXTRACTION_VERSION es estrictamente v4', () => {
    expect(EXTRACTION_VERSION).toBe('espirometria-sibelmed-v4')
  })

  it('El prompt es una cadena no vacía con tamaño > 3000 caracteres', () => {
    expect(typeof NEW_EXTRACTION_PROMPT).toBe('string')
    expect(NEW_EXTRACTION_PROMPT.length).toBeGreaterThan(3000)
  })
})
