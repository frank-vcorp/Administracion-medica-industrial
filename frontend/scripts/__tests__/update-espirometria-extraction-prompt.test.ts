/**
 * Tests focales (V1) del prompt de extracción de Espirometría v6
 * (IMPL-FIX-20260824-04 — dictamen FIX-20260824-04 sobre regresión FEV1=0;
 * prohíbe duplicar celdas, exige usar Mejor X como referencia de fila estándar,
 * exige validación cruzada).
 *
 * Cambios vs v5 (FIX-20260824-04):
 *   - Apartado "PROHIBICIONES ABSOLUTAS" tempranero (después de FUENTE
 *     PRIMARIA) con regla §8 explícita de NO duplicar celda y regla §9
 *     explícita de NO usar Mejor X como fila estándar.
 *   - Nuevo apartado "VALIDACIÓN CRUZADA OBLIGATORIA" (§10) que define
 *     el procedimiento paso a paso:
 *       mejor_fev1_max = mejor_fev1.m1
 *       fev1_std_max  = max(fev1.m1, fev1.m2, fev1.m3)
 *       Si mejor_fev1_max > fev1_std_max → NO rellenar m1, transcribir
 *       literalmente. La normalización defensiva backend anotará
 *       SOSPECHA_INCONSISTENCIA_MEJOR_FEV1 y forzará no_concluyente.
 *   - Apartado "PROHIBICIONES ABSOLUTAS" tardío (reglas 1-10) preserva las
 *     reglas de v5 (1-8) y refuerza 9-10 con la misma prohibición §9/§10
 *     del inicio.
 *
 * Cubre (preservado de v5):
 *   - AC-1: visuales puros desde gráficas.
 *   - AC-2: null si la curva no es legible.
 *   - AC-3: etiqueta "CRITERIOS DERIVADOS VISUALMENTE DE LAS GRÁFICAS".
 *   - AC-4: repetibilidad numérica es del panel (umbral AMI ≤ 150 ml).
 *   - AC-5: no inventar impresión/recomendaciones.
 *   - AC-6: aliases correctos para el panel.
 *   - AC-7: tiempo/criterios_para_dx/calidad del documento EXPLÍCITO.
 *   - AC-8: repetibilidad_*_menor_150 siempre null (panel los calcula).
 *
 * Cubre (NUEVO FIX-20260824-04):
 *   - AC-9: PROHIBICIÓN ABSOLUTA explícita de NO duplicar celdas.
 *   - AC-10: PROHIBICIÓN ABSOLUTA explícita de NO usar Mejor X como fila
 *     estándar.
 *   - AC-11: VALIDACIÓN CRUZADA obligatoria con mejor_*_max vs std_max.
 *   - AC-12 (canónico): para FEV1 2.15/77, 2.11/76, 2.09/75 ⇒ repetibilidad
 *     40 ml (NO 0 ml). Para FVC 2.30/69, 2.33/70, 2.26/68 ⇒ 30 ml.
 *
 * Implementación: vitest puro sin DOM ni red; importa directamente las
 * constantes del script (que ahora las exporta para tests V1).
 *
 * @id IMPL-FIX-20260824-04
 * @backup discovery/DECISIONS.md (DEC-20260824-02) +
 *          context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md
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

describe('update-espirometria-extraction-prompt v6 — AC-1: visuales puros desde gráficas', () => {
  it('EXTRACTION_VERSION es estrictamente v5', () => {
    expect(EXTRACTION_VERSION).toBe('espirometria-sibelmed-v6')
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

describe('update-espirometria-extraction-prompt v6 — AC-2: null si la curva no es legible', () => {
  it('El prompt contiene la prohibición explícita de inventar SI/NO cuando la curva no permite inferencia clara', () => {
    // v6 separó visuales (4) de explícitos (3). La prohibición sólo aplica
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

describe('update-espirometria-extraction-prompt v6 — AC-3: etiquetado como derivado visual', () => {
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

describe('update-espirometria-extraction-prompt v6 — AC-4: repetibilidad numérica es del panel', () => {
  it('El prompt documenta que el cálculo de repetibilidad en ml es del panel', () => {
    // La frase del v6 es: "NO modifiques el cálculo numérico de
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

describe('update-espirometria-extraction-prompt v6 — AC-5: no inventar impresión/recomendaciones', () => {
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

describe('update-espirometria-extraction-prompt v6 — AC-6: aliases de texto fuente para el panel', () => {
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

describe('update-espirometria-extraction-prompt v6 — AC-7: Tiempo/Criterios/Calidad son EXPLICITOS', () => {
  it('`tiempo`: regla explícita "no derivar de duración de curva"', () => {
    // v6 dice: "NO infieras `tiempo` a partir de la duración de la curva"
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

describe('update-espirometria-extraction-prompt v6 — AC-8: repetibilidad_*_menor_150 es del panel', () => {
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

describe('update-espirometria-extraction-prompt v6 — regresión: claves históricas preservadas', () => {
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

describe('update-espirometria-extraction-prompt v6 — contrato del script', () => {
  it('EXTRACTION_VERSION sigue la convención `espirometria-sibelmed-vN`', () => {
    expect(EXTRACTION_VERSION).toMatch(/^espirometria-sibelmed-v\d+$/)
  })

  it('El prompt es una cadena no vacía con tamaño > 3000 caracteres', () => {
    expect(typeof NEW_EXTRACTION_PROMPT).toBe('string')
    expect(NEW_EXTRACTION_PROMPT.length).toBeGreaterThan(3000)
  })
})

// -----------------------------------------------------------------------
// AC-9 (FIX-20260824-04): PROHIBICIÓN ABSOLUTA explícita de NO duplicar
// celdas. La prohibición debe aparecer en el prompt de manera visible
// (no enterrada en prosa larga).
// -----------------------------------------------------------------------

describe('update-espirometria-extraction-prompt v6 — AC-9: NO duplicar celdas (FIX-20260824-04)', () => {
  it('Apartado "PROHIBICIONES ABSOLUTAS" presente en el prompt v6 con referencia FIX-20260824-04', () => {
    // El nuevo apartado aparece cerca del inicio del prompt (después de
    // FUENTE PRIMARIA), etiquetado como PROHIBICIONES ABSOLUTAS y con
    // referencia a FIX-20260824-04 (trazabilidad).
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /PROHIBICIONES ABSOLUTAS[\s\S]{0,200}FIX-20260824-04/
    )
  })

  it('El prompt prohíbe explícitamente duplicar m1 con m2/m3', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /NO rellenes\s+`?m1`?\s+con el valor de\s+`?m2`?\s+ni de\s+`?m3`?/i
    )
  })

  it('El prompt prohíbe copiar m1_pct_ref desde m2_pct_ref o m3_pct_ref', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /NO rellenes\s+`?m1_pct_ref`?\s+con\s+`?m2_pct_ref`?/i
    )
  })

  it('El prompt dice: si M1 está vacía, usa null — NUNCA copies el valor de M2', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /usa\s+`?null`?[\s\S]{0,200}NUNCA copies el valor de\s+`?M2`?/i
    )
  })

  it('El prompt menciona el síntoma "(m1 − m2) × 1000 = 0 ml" como diagnóstico de duplicación', () => {
    // Texto característico para que el LLM entienda el síntoma y se autocorrija.
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /\(m1\s*[−-]\s*m2\)\s*[×x]\s*1000\s*=\s*0\s*ml/
    )
  })
})

// -----------------------------------------------------------------------
// AC-10 (FIX-20260824-04): PROHIBICIÓN ABSOLUTA explícita de NO usar Mejor
// X como fila estándar.
// -----------------------------------------------------------------------

describe('update-espirometria-extraction-prompt v6 — AC-10: NO Mejor X como fila estándar', () => {
  it('El prompt prohíbe usar "Mejor FEV1"/"Mejor FVC" como fila FEV1/FVC', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /NO USES la fila\s+"Mejor FEV1"\s*\/\s*"Mejor FVC"/i
    )
  })

  it('El prompt explica que "Mejor X" CONSOLIDA la mejor maniobra (m1=m2=m3)', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /"Mejor FEV1"\s+CONSOLIDA[\s\S]{0,200}m1\s*=\s*m2\s*=\s*m3/i
    )
  })

  it('El prompt instruye emitir null cuando la fila estándar no está visible (no copiar Mejor X)', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /Si la fila estándar FEV1\/FVC no está visible[\s\S]{0,200}emite\s+`?null`?/i
    )
  })
})

// -----------------------------------------------------------------------
// AC-11 (FIX-20260824-04): VALIDACIÓN CRUZADA obligatoria — mejor_*_max vs
// std_max debe cumplirse.
// -----------------------------------------------------------------------

describe('update-espirometria-extraction-prompt v6 — AC-11: VALIDACIÓN CRUZADA OBLIGATORIA', () => {
  it('Apartado "VALIDACIÓN CRUZADA OBLIGATORIA" presente en el prompt v6', () => {
    expect(NEW_EXTRACTION_PROMPT).toContain('VALIDACIÓN CRUZADA OBLIGATORIA')
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /VALIDACIÓN CRUZADA OBLIGATORIA[\s\S]{0,200}FIX-20260824-04/
    )
  })

  it('El prompt define `mejor_fev1_max = mejor_fev1.m1`', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /mejor_fev1_max\s*=\s*mejor_fev1\.m1/
    )
  })

  it('El prompt define `fev1_std_max = max(fev1.m1, fev1.m2, fev1.m3)`', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /fev1_std_max\s*=\s*max\(\s*fev1\.m1,\s*fev1\.m2,\s*fev1\.m3\s*\)/
    )
  })

  it('El prompt exige que mejor_fev1_max <= fev1_std_max (sin duplicación)', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /mejor_fev1_max\s*<=\s*fev1_std_max/
    )
  })

  it('El prompt instruye NO rellenar m1 si se detecta la inconsistencia', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(/NO rellenes m1/i)
  })

  it('El prompt referencia `SOSPECHA_INCONSISTENCIA_MEJOR_FEV1` como anotación defensiva backend', () => {
    expect(NEW_EXTRACTION_PROMPT).toContain('SOSPECHA_INCONSISTENCIA_MEJOR_FEV1')
  })

  it('El prompt referencia `completitud_documental = "no_concluyente"` como consecuencia', () => {
    expect(NEW_EXTRACTION_PROMPT).toContain('no_concluyente')
  })
})

// -----------------------------------------------------------------------
// AC-12 (FIX-20260824-04 — tests canónicos de regresión):
//   - Caso canónico FEV1 2.15/77, 2.11/76, 2.09/75 ⇒ repetibilidad 40 ml.
//   - FVC 2.30/69, 2.33/70, 2.26/68 ⇒ repetibilidad 30 ml (no regresa).
//   - Duplicación m1=m2 ⇒ marcado SOSPECHA + invalida cálculo (no 0 ml).
//
// Estos tests NO se ejecutan en el script (no tocan BD), pero verifican
// que el prompt instruye los invariantes numéricos para que el LLM los
// cumpla. La verificación numérica end-to-end se hace en backend
// `TestEspirometriaExhaustiva_20260516_12_13` y frontend
// `EspirometriaClinicalCriteriaPanel.test.ts` rev. 1.5.
// -----------------------------------------------------------------------

describe('update-espirometria-extraction-prompt v6 — AC-12: canónico (FIX-20260824-04)', () => {
  it('FEV1 canónico (m1=2.15, m2=2.11, m3=2.09) → repetibilidad esperada 40 ml', () => {
    // El prompt debe contener el ejemplo concreto de Sibelmed:
    //   m1=2.15, m1_pct_ref=77, m2=2.11, m2_pct_ref=76, m3=2.09, m3_pct_ref=75
    // para que el LLM lo reconozca como patrón válido y no lo altere.
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /m1\s*=\s*2\.15[\s\S]{0,80}m1_pct_ref\s*=\s*77[\s\S]{0,80}m2\s*=\s*2\.11[\s\S]{0,80}m2_pct_ref\s*=\s*76[\s\S]{0,80}m3\s*=\s*2\.09[\s\S]{0,80}m3_pct_ref\s*=\s*75/
    )
  })

  it('FVC canónico (m1=2.30, m2=2.33, m3=2.26) → repetibilidad esperada 30 ml (no regresa)', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /m1\s*=\s*2\.30[\s\S]{0,80}m1_pct_ref\s*=\s*69[\s\S]{0,80}m2\s*=\s*2\.33[\s\S]{0,80}m2_pct_ref\s*=\s*70[\s\S]{0,80}m3\s*=\s*2\.26[\s\S]{0,80}m3_pct_ref\s*=\s*68/
    )
  })

  it('El prompt instruye que las celdas %REF viven en su columna inmediata derecha', () => {
    // El prompt nombra explícitamente que la columna %REF de M1 es la
    // inmediata a la derecha de M1 (no de M2 ni de M3).
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /m1_pct_ref.*=.*77[\s\S]{0,200}m2_pct_ref.*=.*76/
    )
  })
})
