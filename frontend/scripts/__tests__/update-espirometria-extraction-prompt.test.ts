/**
 * Tests focales (V1) del prompt de extracción de Espirometría v7
 * (IMPL-FIX-20260824-04-rev2 — compactación contra regresión M3
 * `EXTRACTION_NOT_JSON` por prompts largos).
 *
 * Cambios vs v6 (FIX-20260824-04-rev2):
 *   - Prompt compactado de ~19.5 KB a 4.8 KB (<5 KB). Era demasiado largo
 *     para que MiniMax M3 devolviera JSON en 4096 tokens; ahora cabe
 *     incluso con margen.
 *   - Reglas críticas PRESERVADAS (cada una con test focal):
 *       AC-1: JSON único, sin markdown ni <think>.
 *       AC-2: layout 9 columnas Sibelmed (PARÁMETRO | M1 | %REF | M2 | %REF
 *              | M3 | %REF | REF | LLN).
 *       AC-3: NO duplicar M1/M2/M3 (prohibición explícita + síntoma).
 *       AC-4: NO usar "Mejor FEV1"/"Mejor FVC" como fila estándar.
 *       AC-5: Validación cruzada mejor_fev1_max ≤ fev1_std_max (transcribir
 *              sin rellenar si inconsistente).
 *       AC-6: FEV1 canónico 2.15/77/2.11/76/2.09/75 + FVC 2.30/69/2.33/70/
 *              2.26/68 como ejemplo de columnas.
 *       AC-7: Visuales null si no claros (pico_maximo, forma_triangular,
 *              libre_artefactos, meseta).
 *       AC-8: tiempo/criterios_para_dx/calidad sólo si EXPLÍCITO.
 *       AC-9: NO calcular repetibilidad en prompt (panel calcula top-2
 *              × 1000, umbral AMI ≤ 150 ml).
 *       AC-10: repetibilidad_<150> SIEMPRE null.
 *       AC-11: prompt compacto (<5 KB / 5000 chars).
 *       AC-12: panel maneja repetibilidad_ats_ers (criterio distinto).
 *
 *       AC-13 (regresión preservada): FEV1 2.15/77/2.11/76/2.09/75 ⇒ 40 ml
 *              y FVC 2.30/69/2.33/70/2.26/68 ⇒ 30 ml (verificable vía
 *              backend TestFIX20260824_04RegresionFEV1_Cero + frontend
 *              EspirometriaClinicalCriteriaPanel.test.ts rev. 1.5).
 *
 * Implementación: vitest puro sin DOM ni red; importa directamente las
 * constantes del script.
 *
 * @id IMPL-FIX-20260824-04-rev2
 * @backup discovery/DECISIONS.md (DEC-20260824-02) +
 *          context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md
 */

import { describe, it, expect } from 'vitest'
import {
  EXTRACTION_VERSION,
  NEW_EXTRACTION_PROMPT,
} from '../update-espirometria-extraction-prompt'

const PROMPT_SIZE_BUDGET_CHARS = 5_000 // <5 KB (FIX-20260824-04-rev2)
const PROMPT_SIZE_STRICT_CHARS = 5_000 // estricto: exacto ≤ 5 KB (FIX-20260824-04-rev2)

describe('update-espirometria-extraction-prompt v7 — AC-0: constantes + tamaño', () => {
  it('EXTRACTION_VERSION es estrictamente v7', () => {
    expect(EXTRACTION_VERSION).toBe('espirometria-sibelmed-v7')
    expect(EXTRACTION_VERSION).toMatch(/^espirometria-sibelmed-v\d+$/)
  })

  it('AC-11: prompt compacto (<5 KB / 5000 chars) — causal fix M3 EXTRACTION_NOT_JSON', () => {
    expect(NEW_EXTRACTION_PROMPT.length).toBeLessThanOrEqual(
      PROMPT_SIZE_STRICT_CHARS
    )
    // Log explícito del tamaño para auditoría (regresión visual si el
    // prompt vuelve a inflarse).
    // eslint-disable-next-line no-console
    console.log(
      `[FIX-20260824-04-rev2] NEW_EXTRACTION_PROMPT v7 size: ${NEW_EXTRACTION_PROMPT.length} chars (budget: ${PROMPT_SIZE_BUDGET_CHARS})`
    )
  })

  it('AC-11 (regresión visual): v6 era ~19500 chars; v7 debe ser al menos 3x más compacto', () => {
    // v6 era ~19.5 KB. v7 debe ser <6500 chars para ser al menos 3x más
    // compacto (FIX-20260824-04-rev2: "compacta a <5 KB" — dejamos margen
    // hasta 6500 por si se añade una regla mínima en el futuro).
    expect(NEW_EXTRACTION_PROMPT.length).toBeLessThan(6_500)
  })
})

describe('update-espirometria-extraction-prompt v7 — AC-1: JSON único', () => {
  it('El prompt instruye devolver SOLO JSON (sin markdown, sin texto, sin <think>)', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(/Devuelve\s+SOLO\s+JSON/i)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/sin markdown/i)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/sin\s+<think>/i)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/JSON único/i)
  })

  it('El prompt instruye devolver JSON que arranca con { y termina con }', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(/arranca con\s+\{/)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/termina con\s+\}/)
  })
})

describe('update-espirometria-extraction-prompt v7 — AC-2: layout Sibelmed 9 columnas', () => {
  it('El prompt cita las 9 columnas en orden', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /PARÁMETRO\s*\|\s*M1\s*\|\s*%REF\s*\|\s*M2\s*\|\s*%REF\s*\|\s*M3\s*\|\s*%REF\s*\|\s*REF\s*\|\s*LLN/
    )
  })

  it('El prompt instruye 6 celdas por fila + ref + lln', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(/6 celdas numéricas/i)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/m1.*m1_pct_ref.*m2.*m2_pct_ref.*m3.*m3_pct_ref/i)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/\bref\b/)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/\blln\b/)
  })

  it('El prompt prohíbe desplazar M1↔M2↔M3 ni %REF entre columnas', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /NUNCA desplaces\s+M1\s*↔\s*M2\s*↔\s*M3/i
    )
  })

  it('El prompt instruye null cuando una celda está vacía', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(/celda está vacía\s*→\s*null/i)
  })
})

describe('update-espirometria-extraction-prompt v7 — AC-3: NO duplicar celdas', () => {
  it('El prompt prohíbe copiar m1 ← m2', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(/m1\s*←\s*m2/)
  })

  it('El prompt prohíbe copiar m1_pct_ref ← m2_pct_ref', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(/m1_pct_ref\s*←\s*m2_pct_ref/)
  })

  it('El prompt menciona el síntoma "(m1 − m2) × 1000 = 0 ml" como diagnóstico', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /\(m1\s*[−-]\s*m2\)\s*[×x]\s*1000\s*=\s*0\s*ml/
    )
  })

  it('El prompt instruye null si M1 está vacía (no copies m2)', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(/M1 está vacía\s*→\s*null/i)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/Nunca copies\s+m2\s+en\s+m1/i)
  })
})

describe('update-espirometria-extraction-prompt v7 — AC-4: NO Mejor X como fila estándar', () => {
  it('El prompt prohíbe usar "Mejor FEV1"/"Mejor FVC" como fila estándar', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /NO USES\s+"Mejor FEV1"\s*\/\s*"Mejor FVC"\s+como fila\s+FEV1\s*\/\s*FVC\s+estándar/i
    )
  })

  it('El prompt explica que "Mejor X" consolida m1=m2=m3', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /"Mejor X"\s+consolida\s+m1\s*=\s*m2\s*=\s*m3/i
    )
  })

  it('El prompt instruye null si la fila estándar no está visible', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /fila estándar no está visible\s*→\s*null/i
    )
  })

  it('El prompt prohíbe explícitamente rellenar con "Mejor X"', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(/NO rellenes\s+con\s+"Mejor X"/i)
  })
})

describe('update-espirometria-extraction-prompt v7 — AC-5: VALIDACIÓN CRUZADA', () => {
  it('El prompt define mejor_fev1_max = mejor_fev1.m1', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /mejor_fev1_max\s*=\s*mejor_fev1\.m1/
    )
  })

  it('El prompt define fev1_std_max = max(fev1.m1, fev1.m2, fev1.m3)', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /fev1_std_max\s*=\s*max\(\s*fev1\.m1,\s*fev1\.m2,\s*fev1\.m3\s*\)/
    )
  })

  it('El prompt exige mejor_fev1_max <= fev1_std_max', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /mejor_fev1_max\s*>\s*fev1_std_max\s*→\s*INCONSISTENCIA/i
    )
  })

  it('El prompt instruye NO rellenar m1 desde "Mejor X" si inconsistente', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /NO rellenes m1 desde\s+"Mejor X"/i
    )
    expect(NEW_EXTRACTION_PROMPT).toMatch(/Transcribe literalmente/i)
  })

  it('El prompt referencia SOSPECHA_INCONSISTENCIA_MEJOR_FEV1 como anotación defensiva backend', () => {
    expect(NEW_EXTRACTION_PROMPT).toContain('SOSPECHA_INCONSISTENCIA_MEJOR_FEV1')
  })

  it('El prompt referencia completitud_documental="no_concluyente" como consecuencia', () => {
    expect(NEW_EXTRACTION_PROMPT).toContain('no_concluyente')
  })

  it('El prompt instruye aplicar el mismo procedimiento a FVC', () => {
    // El texto compacto usa "Mismo procedimiento para FVC" (sin espacio
    // explícito antes de FVC en la frase).
    expect(NEW_EXTRACTION_PROMPT).toMatch(/Mismo procedimiento para\s+FVC/i)
  })
})

describe('update-espirometria-extraction-prompt v7 — AC-6: ejemplo canónico', () => {
  it('FEV1 canónico: m1=2.15, m1_pct_ref=77, m2=2.11, m2_pct_ref=76, m3=2.09, m3_pct_ref=75', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(/FEV1/)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/m1\s*=\s*2\.15/)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/m1_pct_ref\s*=\s*77/)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/m2\s*=\s*2\.11/)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/m2_pct_ref\s*=\s*76/)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/m3\s*=\s*2\.09/)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/m3_pct_ref\s*=\s*75/)
  })

  it('FEV1 canónico: top-2 esperado = 40 ml', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /\(2\.15\s*[−-]\s*2\.11\)\s*[×x]\s*1000\s*=\s*40\s*ml/
    )
  })

  it('FVC canónico: m1=2.30, m1_pct_ref=69, m2=2.33, m2_pct_ref=70, m3=2.26, m3_pct_ref=68', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(/m1\s*=\s*2\.30/)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/m1_pct_ref\s*=\s*69/)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/m2\s*=\s*2\.33/)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/m2_pct_ref\s*=\s*70/)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/m3\s*=\s*2\.26/)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/m3_pct_ref\s*=\s*68/)
  })

  it('FVC canónico: top-2 esperado = 30 ml (no regresa)', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /\(2\.33\s*[−-]\s*2\.30\)\s*[×x]\s*1000\s*=\s*30\s*ml/
    )
  })

  it('El prompt explica "Mejor FEV1"=2.15 y "Mejor FVC"=2.33', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(/"Mejor FEV1"\s*→\s*m1\s*=\s*m2\s*=\s*m3\s*=\s*2\.15/)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/"Mejor FVC"\s*→\s*m1\s*=\s*m2\s*=\s*m3\s*=\s*2\.33/)
  })
})

describe('update-espirometria-extraction-prompt v7 — AC-7/8: visuales null si no claros', () => {
  it('Visuales: SOLO si la gráfica es CLARA; si no → null', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /CRITERIOS VISUALES[\s\S]{0,200}SOLO si la gráfica es CLARA/i
    )
    expect(NEW_EXTRACTION_PROMPT).toMatch(/Si no\s*→\s*null/i)
  })

  it('Lista las 4 visuales canónicas: pico_maximo, forma_triangular, libre_artefactos, meseta', () => {
    for (const key of ['pico_maximo', 'forma_triangular', 'libre_artefactos', 'meseta']) {
      expect(NEW_EXTRACTION_PROMPT).toContain(`"${key}"`)
    }
  })

  it('`tiempo`: SOLO si el reporte declara EXPLÍCITAMENTE', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(/tiempo[\s\S]{0,200}EXPLÍCITAMENTE/i)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/NO derivar de duración/i)
  })

  it('`criterios_para_dx`: SOLO si el reporte declara EXPLÍCITAMENTE', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /criterios_para_dx[\s\S]{0,300}Criterios para Dx:\s*SI\/NO/i
    )
    expect(NEW_EXTRACTION_PROMPT).toMatch(/NO derivar de ATS\/ERS/i)
  })

  it('`calidad` (A/B/C/D/F): SOLO si el reporte declara letra/código EXPLÍCITO', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(/calidad[\s\S]{0,200}EXPLÍCITO/i)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/NO calcular/i)
  })
})

describe('update-espirometria-extraction-prompt v7 — AC-9/10: repetibilidad la calcula panel', () => {
  it('El prompt instruye: NO calcules aquí, panel calcula top-2 × 1000, AMI ≤ 150 ml', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(/NO calcules aquí/i)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/top-2/i)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/AMI\s*≤\s*150\s*ml/i)
  })

  it('`repetibilidad_fvc_menor_150` y `repetibilidad_fev1_menor_150` SIEMPRE null', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(/SIEMPRE\s+null/i)
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /repetibilidad_fvc_menor_150[\s\S]{0,200}SIEMPRE\s+null/i
    )
    expect(NEW_EXTRACTION_PROMPT).toMatch(
      /repetibilidad_fev1_menor_150[\s\S]{0,200}SIEMPRE\s+null/i
    )
  })

  it('`repetibilidad_fvc_ml`/`_fev1_ml`: SOLO si el reporte trae número explícito', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(/repetibilidad_fvc_ml[\s\S]{0,300}texto nativo/i)
    expect(NEW_EXTRACTION_PROMPT).toMatch(/Si no\s*→\s*null/i)
  })

  it('`repetibilidad_ats_ers_fvc/_fev1` son CRITERIO DISTINTO del AMI', () => {
    // El panel renderer maneja el flag ATS/ERS por separado (ver
    // `repetibilidad_ats_ers_fvc` en extractor + renderer). El extractor
    // sólo recibe el flag binario del equipo.
    expect(NEW_EXTRACTION_PROMPT).toContain('repetibilidad_ats_ers_fvc')
    expect(NEW_EXTRACTION_PROMPT).toContain('repetibilidad_ats_ers_fev1')
  })
})

describe('update-espirometria-extraction-prompt v7 — AC: aliases texto fuente médico', () => {
  it('El prompt expone `impresion_diagnostica_texto` y `recomendaciones_texto` (preferidos)', () => {
    expect(NEW_EXTRACTION_PROMPT).toContain('impresion_diagnostica_texto')
    expect(NEW_EXTRACTION_PROMPT).toContain('recomendaciones_texto')
  })

  it('El prompt conserva los aliases históricos para compat', () => {
    expect(NEW_EXTRACTION_PROMPT).toContain('impresion_diagnostica')
    expect(NEW_EXTRACTION_PROMPT).toContain('recomendaciones')
  })

  it('El prompt instruye transcribir literalmente si visible (sin invención)', () => {
    expect(NEW_EXTRACTION_PROMPT).toMatch(/transcribir literalmente/i)
  })
})

describe('update-espirometria-extraction-prompt v7 — AC: estructura JSON skeleton', () => {
  it('El JSON skeleton incluye paciente_detalle, estudio, condiciones, parametros, calidad, graficas', () => {
    for (const key of [
      'paciente_detalle',
      'estudio',
      'condiciones',
      'parametros',
      'calidad',
      'graficas',
    ]) {
      expect(NEW_EXTRACTION_PROMPT).toContain(`"${key}"`)
    }
  })

  it('El JSON skeleton incluye las 4 filas principales de parametros[]', () => {
    for (const row of ['Mejor FVC', 'Mejor FEV1', 'FVC', 'FEV1']) {
      expect(NEW_EXTRACTION_PROMPT).toContain(`"label":"${row}"`)
    }
  })

  it('El JSON skeleton incluye las claves críticas de calidad (regresión)', () => {
    for (const key of [
      'pico_maximo',
      'forma_triangular',
      'libre_artefactos',
      'meseta',
      'tiempo',
      'criterios_para_dx',
      'calidad',
      'repetibilidad_fvc_menor_150',
      'repetibilidad_fev1_menor_150',
      'repetibilidad_ats_ers_fvc',
      'repetibilidad_ats_ers_fev1',
      'pruebas_aceptables',
      'impresion_diagnostica_texto',
      'impresion_diagnostica',
      'recomendaciones_texto',
      'recomendaciones',
      'es_interpretable',
      'completitud_documental',
      'repetibilidad_fvc_ml',
      'repetibilidad_fev1_ml',
      'notas_calidad',
    ]) {
      expect(NEW_EXTRACTION_PROMPT).toContain(`"${key}"`)
    }
  })
})

describe('update-espirometria-extraction-prompt v7 — contrato del script', () => {
  it('EXTRACTION_VERSION sigue la convención `espirometria-sibelmed-vN`', () => {
    expect(EXTRACTION_VERSION).toMatch(/^espirometria-sibelmed-v\d+$/)
  })

  it('El prompt es una cadena no vacía', () => {
    expect(typeof NEW_EXTRACTION_PROMPT).toBe('string')
    expect(NEW_EXTRACTION_PROMPT.length).toBeGreaterThan(1000)
  })

  it('El prompt referencia FIX-20260824-04-rev2 (trazabilidad)', () => {
    expect(NEW_EXTRACTION_PROMPT).toContain('IMPL-FIX-20260824-04-rev2')
  })
})