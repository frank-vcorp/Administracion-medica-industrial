/**
 * Tests focales (V1) del prompt de extracción de Espirometría v5
 * (IMPL-20260824-05 — BR-20260824-01 + BR-20260824-02, separación criterios
 * AMI vs ATS/ERS; fix defecto v6 captura Sibelmed).
 *
 * Cambios vs v4 (IMPL-20260824-05):
 *   - 4 visuales puros (Pico, Forma, Libre, Meseta): inferencia visual
 *     desde las curvas (regla v4 preservada).
 *   - 3 criterios EXPLICITOS del documento (Tiempo, Criterios para Dx,
 *     Calidad): SOLO si el reporte los declara como texto/letra visible.
 *     NUNCA inferir desde duración de curva, ATS/ERS, ni heurística.
 *   - 2 repetibilidad booleanas (repetibilidad_*_menor_150): SIEMPRE null
 *     en el payload; el panel frontend las calcula desde el numérico con
 *     umbral AMI ≤ 150 ml (BR-20260824-01). NO copiar del flag ATS/ERS
 *     embebido (criterio distinto).
 *   - 2 repetibilidad ATS/ERS (repetibilidad_ats_ers_fvc/_fev1): sí reciben
 *     el flag binario del equipo (criterio aparte visible en renderer).
 *
 * Cubre:
 *   - AC-1: el prompt v5 instruye a inferir VISUALMENTE los 4 criterios
 *     visuales (pico_maximo, forma_triangular, libre_artefactos, meseta).
 *   - AC-2: el prompt v5 instruye a devolver SI/NO sólo cuando la curva
 *     permita inferencia clara; en caso contrario, `null`.
 *   - AC-3: el prompt v5 etiqueta explícitamente los visuales como
 *     "CRITERIOS DERIVADOS VISUALMENTE DE LAS GRÁFICAS".
 *   - AC-4: el prompt v5 NO cambia la fórmula de cálculo de repetibilidad
 *     FVC/FEV1 en ml; sólo documenta que es responsabilidad del panel
 *     (umbral AMI ≤ 150 ml, BR-20260824-01).
 *   - AC-5: el prompt v5 prohíbe inventar impresión diagnóstica o
 *     recomendaciones; las marca explícitamente como TEXTO FUENTE del
 *     documento médico, no salida IA.
 *   - AC-6: el prompt v5 expone los aliases correctos para el panel
 *     (`impresion_diagnostica_texto` / `recomendaciones_texto`).
 *   - AC-7 (IMPL-20260824-05): `tiempo`, `criterios_para_dx` y `calidad`
 *     son del documento EXPLÍCITO; nunca inferir desde duración de curva
 *     ni desde ATS/ERS ni desde heurística.
 *   - AC-8 (IMPL-20260824-05): `repetibilidad_fvc_menor_150` y
 *     `repetibilidad_fev1_menor_150` los calcula el panel; el extractor
 *     SIEMPRE devuelve `null` y NUNCA copia del flag ATS/ERS embebido.
 *
 * Implementación: vitest puro sin DOM ni red; importa directamente las
 * constantes del script (que ahora las exporta para tests V1).
 *
 * @id IMPL-20260824-05
 * @backup discovery/BUSINESS-RULES.md (BR-20260824-01 + BR-20260824-02)
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
] as const

const EXPLICIT_DOCUMENT_CRITERIA_KEYS = [
  'tiempo',
  'criterios_para_dx',
  'calidad',
] as const

// -----------------------------------------------------------------------
// AC-1: el prompt instruye a inferir visualmente los 4 visuales puros
// (Pico, Forma, Libre, Meseta). Tiempo/Criterios/Calidad NO son visuales
// (IMPL-20260824-05).
// -----------------------------------------------------------------------

describe('update-espirometria-extraction-prompt v5 — AC-1: visuales puros desde gráficas', () => {
  it('EXTRACTION_VERSION es estrictamente v5', () => {
    expect(EXTRACTION_VERSION).toBe('espirometria-sibelmed-v5')
    expect(EXTRACTION_VERSION).toMatch(/^espirometria-sibelmed-v\d+$/)
  })

  it('Referencia explícita a BR-20260824-02 y a IMPL-20260824-05', () => {
    expect(NEW_EXTRACTION_PROMPT).toContain('BR-20260824-02')
    expect(NEW_EXTRACTION_PROMPT).toContain('IMPL-20260824-05')
  })

  it('Menciona las curvas flujo-volumen y volumen-tiempo como fuente de la inferencia visual', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(/flujo[-\s]volumen/)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/volumen[-\s]tiempo/)
  })

  it('Lista los 4 visuales puros como claves exactas de la salida JSON', () => {
    for (const key of VISUAL_CRITERIA_KEYS) {
      expect(NEW_EXTRACTION_PROMPT).toContain(`\`${key}\``)
    }
  })

  it('Declara el dominio de salida "SI" | "NO" | null para los visuales puros', () => {
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
// -----------------------------------------------------------------------

describe('update-espirometria-extraction-prompt v5 — AC-2: null si la curva no es legible', () => {
  it('El prompt contiene la prohibición explícita de inventar SI/NO cuando la curva no permite inferencia clara', () => {
    // v5 separó visuales (4) de explícitos (3). La prohibición sólo aplica
    // a los visuales puros; verificamos que el texto está literalmente.
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /NUNCA devuelvas SI\/NO[\s\S]*?si la curva no permite inferencia clara/
    )
  })

  it('El prompt exige `null` para criterios ambiguos', () => {
    // La regla de null-debe-salir está en al menos uno de los apartados.
    expect(NEW_EXTRACTION_PROMPT).toMatch(/devuelve.*null|NUNCA inventes/)
  })
})

// -----------------------------------------------------------------------
// AC-3: el prompt etiqueta los visuales como derivados de la gráfica,
// no como texto del médico ni diagnóstico IA.
// -----------------------------------------------------------------------

describe('update-espirometria-extraction-prompt v5 — AC-3: etiquetado como derivado visual', () => {
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

describe('update-espirometria-extraction-prompt v5 — AC-4: repetibilidad numérica es del panel', () => {
  it('El prompt documenta que el cálculo de repetibilidad en ml es del panel', () => {
    // La frase del v5 es: "NO modifiques el cálculo numérico de
    // repetibilidad FVC/FEV1 en ml. Eso lo calcula el panel desde
    // `parametros[]` (top-2 sobre m1/m2/m3 × 1000)..."
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /cálculo numérico de repetibilidad FVC\/FEV1[\s\S]*?lo calcula el panel/i
    )
  })

  it('El prompt referencia el umbral AMI ≤ 150 ml y la regla BR-20260824-01', () => {
    expect(NEW_EXTRACTION_PROMPT).toContain('BR-20260824-01')
    expect(NEW_EXTRACTION_PROMPT).toMatch(/150 ml/)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/umbral AMI/i)
  })

  it('El prompt prohíbe al extractor calcular o multiplicar unidades', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /NO modifiques el cálculo numérico de repetibilidad FVC\/FEV1 en ml/
    )
  })
})

// -----------------------------------------------------------------------
// AC-5: el prompt prohíbe inventar impresión diagnóstica o recomendaciones.
// -----------------------------------------------------------------------

describe('update-espirometria-extraction-prompt v5 — AC-5: no inventar impresión/recomendaciones', () => {
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
// AC-6: el prompt expone los aliases correctos para el panel.
// -----------------------------------------------------------------------

describe('update-espirometria-extraction-prompt v5 — AC-6: aliases de texto fuente para el panel', () => {
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
// AC-7 (IMPL-20260824-05): Tiempo, Criterios para Dx, Calidad son del
// documento EXPLÍCITO. Nunca inferir desde duración de curva, ni desde
// ATS/ERS, ni desde heurística del modelo.
// -----------------------------------------------------------------------

describe('update-espirometria-extraction-prompt v5 — AC-7: Tiempo/Criterios/Calidad son EXPLICITOS', () => {
  it('`tiempo`: regla explícita "no derivar de duración de curva"', () => {
    // v5 dice: "NO infieras `tiempo` a partir de la duración de la curva"
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /NO infieras\s+`?tiempo`?\s+a partir de la duración/i
    )
  })

  it('`tiempo`: regla "NO desde duración" en prohibiciones', () => {
    // Regla 3 de PROHIBICIONES ABSOLUTAS
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /NUNCA infieras\s+`?tiempo`?\s+desde la duración de la curva/i
    )
  })

  it('`tiempo`: requiere etiqueta textual EXPLÍCITA del reporte', () => {
    // El prompt exige "EXPLÍCITAMENTE" para `tiempo`.
    expect(NEW_EXTRACTION_PROMPT).toMatch(/EXPLÍCITAMENTE[\s\S]{0,200}`tiempo`/)
  })

  it('`criterios_para_dx`: regla explícita "no derivar de ATS/ERS"', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /NO derives\s+`?criterios_para_dx`?\s+del\s+flag\s+ATS\/ERS/i
    )
  })

  it('`criterios_para_dx`: regla en prohibiciones "NO desde ATS/ERS ni visuales"', () => {
    // Regla 4 de PROHIBICIONES ABSOLUTAS
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /NUNCA infieras\s+`?criterios_para_dx`?\s+desde ATS\/ERS/i
    )
  })

  it('`criterios_para_dx`: requiere etiqueta textual EXPLÍCITA "Criterios para Dx: SI/NO"', () => {
    // El prompt exige el texto literal "Criterios para Dx: SI/NO".
    expect(NEW_EXTRACTION_PROMPT).toMatch(/Criterios para Dx:\s*SI\/NO/i)
  })

  it('`calidad`: regla "NO inferir desde los visuales"', () => {
    // Regla 5 de PROHIBICIONES ABSOLUTAS
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /NUNCA infier[ae]s?\s+`?calidad`?\s+desde\s+los\s+visuales/i
    )
  })

  it('`calidad`: sólo letra/código explícito del documento', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /letra\/código[\s\S]{0,200}EXPLÍCITAMENTE/i
    )
  })

  it('Apartado dedicado "CRITERIOS EXPLÍCITOS DEL DOCUMENTO" lista los 3 criterios', () => {
    expect(NEW_EXTRACTION_PROMPT).toContain(
      'CRITERIOS EXPLÍCITOS DEL DOCUMENTO'
    )
    for (const key of EXPLICIT_DOCUMENT_CRITERIA_KEYS) {
      expect(NEW_EXTRACTION_PROMPT).toContain(`\`${key}\``)
    }
  })
})

// -----------------------------------------------------------------------
// AC-8 (IMPL-20260824-05): repetibilidad_*_menor_150 SIEMPRE null;
// el panel los calcula. NO copiar del flag ATS/ERS embebido.
// -----------------------------------------------------------------------

describe('update-espirometria-extraction-prompt v5 — AC-8: repetibilidad_*_menor_150 es del panel', () => {
  it('El prompt instruye devolver SIEMPRE null para `repetibilidad_fvc_menor_150`', () => {
    // El apartado "REPETIBILIDAD (NO fuente de verdad)" declara explícitamente
    // que el extractor SIEMPRE devuelve null y que el panel los calcula.
    expect(NEW_EXTRACTION_PROMPT).toContain(
      'REPETIBILIDAD (NO fuente de verdad'
    )
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /`repetibilidad_fvc_menor_150`:\s*SIEMPRE\s+`null`/
    )
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /`repetibilidad_fev1_menor_150`:\s*SIEMPRE\s+`null`/
    )
  })

  it('El prompt prohíbe copiar "Repetibilidad ATS/ERS: FVC: No/SI" en `repetibilidad_*_menor_150`', () => {
    // Regla 6 de PROHIBICIONES ABSOLUTAS
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /NUNCA copies[\s\S]*?Repetibilidad ATS\/ERS[\s\S]*?en\s+`?repetibilidad_(?:fvc|fev1)_menor_150`/i
    )
  })

  it('El prompt afirma que el PANEL frontend los DERIVA con umbral AMI ≤ 150 ml', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(/DERIVA el panel frontend/i)
  })

  it('El prompt aclara que ATS/ERS es un criterio distinto y NO debe sobrescribir el AMI', () => {
    // La frase clave está en REPETIBILIDAD (NO fuente de verdad):
    // "ese es un criterio distinto [...] y NO debe\nsobrescribir el criterio AMI del panel"
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /criterio distinto[\s\S]*?NO debe[\s\S]*?sobrescribir/i
    )
  })
})

// -----------------------------------------------------------------------
// Tests de regresión: claves históricas preservadas.
// -----------------------------------------------------------------------

describe('update-espirometria-extraction-prompt v5 — regresión: claves históricas preservadas', () => {
  const HISTORICAL_KEYS = [
    'repetibilidad_ats_ers_fvc',
    'repetibilidad_ats_ers_fev1',
    'es_interpretable',
    'completitud_documental',
    'repetibilidad_fvc_ml',
    'repetibilidad_fev1_ml',
    'pruebas_aceptables',
    'notas_calidad',
  ] as const

  it('Todas las claves históricas del esquema siguen presentes en el JSON skeleton', () => {
    for (const key of HISTORICAL_KEYS) {
      expect(NEW_EXTRACTION_PROMPT).toContain(`\`${key}\``)
    }
  })

  it('Las claves `repetibilidad_fvc_menor_150` y `repetibilidad_fev1_menor_150` SIGUEN en el JSON skeleton (compat)', () => {
    // Aunque el extractor siempre las pone en null, el esquema del JSON las
    // expone para retrocompat con consumidores downstream.
    expect(NEW_EXTRACTION_PROMPT).toContain('`repetibilidad_fvc_menor_150`')
    expect(NEW_EXTRACTION_PROMPT).toContain('`repetibilidad_fev1_menor_150`')
  })

  it('Las filas FVC y FEV1 siguen siendo la fuente numérica primaria', () => {
    expect(NEW_EXTRACTION_PROMPT).toContain('"INFORME DE FVC"')
    expect(NEW_EXTRACTION_PROMPT).toMatch(/PARÁMETRO \| M1 \| %REF \| M2 \| %REF \| M3 \| %REF \| REF \| LLN/)
  })
})

// -----------------------------------------------------------------------
// Tests del contrato del script.
// -----------------------------------------------------------------------

describe('update-espirometria-extraction-prompt v5 — contrato del script', () => {
  it('EXTRACTION_VERSION sigue la convención `espirometria-sibelmed-vN`', () => {
    expect(EXTRACTION_VERSION).toMatch(/^espirometria-sibelmed-v\d+$/)
  })

  it('El prompt es una cadena no vacía con tamaño > 3000 caracteres', () => {
    expect(typeof NEW_EXTRACTION_PROMPT).toBe('string')
    expect(NEW_EXTRACTION_PROMPT.length).toBeGreaterThan(3000)
  })
})
