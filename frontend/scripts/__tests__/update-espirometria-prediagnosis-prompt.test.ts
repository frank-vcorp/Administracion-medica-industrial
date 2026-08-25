/**
 * Tests focales (V1) del prompt clínico (prediagnóstico) de Espirometría
 * (IMPL-20260824-06 / DEC-20260824-02) — script
 * `update-espirometria-prediagnosis-prompt.ts`.
 *
 * Valida:
 *   - AC-DEC-02-A: el script exporta `PREDIAGNOSIS_VERSION` y
 *     `NEW_PREDIAGNOSIS_PROMPT`.
 *   - AC-DEC-02-B: el prompt clínico exige `recommendation` singular no
 *     nulo cuando hay datos suficientes.
 *   - AC-DEC-02-C: el prompt clínico contextualiza por patrón (obstructivo,
 *     restrictivo, mixto, normal) + calidad + entorno ocupacional.
 *   - AC-DEC-02-D: el prompt prohíbe declaración de aptitud, incapacidad,
 *     tratamiento, dictamen final y diagnóstico definitivo.
 *   - AC-DEC-02-E: el prompt prohíbe verbos prescriptivos absolutos.
 *   - AC-DEC-02-F: el prompt instruye repetir el estudio cuando la calidad
 *     es insuficiente.
 *   - AC-DEC-02-G: el prompt clínico NO se mezcla con M3/Minimax (sólo se
 *     usa en extracción, NUNCA en prediagnóstico).
 *
 * Implementación: vitest puro sin DOM ni red; importa directamente las
 * constantes del script.
 *
 * @id IMPL-20260824-06
 * @backup discovery/DECISIONS.md (DEC-20260824-02)
 */

import { describe, it, expect } from 'vitest'
import {
  PREDIAGNOSIS_VERSION,
  NEW_PREDIAGNOSIS_PROMPT,
} from '../update-espirometria-prediagnosis-prompt'

describe('update-espirometria-prediagnosis-prompt — AC-DEC-02-A: constantes exportadas', () => {
  it('PREDIAGNOSIS_VERSION es estrictamente v1 y bien formado', () => {
    expect(PREDIAGNOSIS_VERSION).toBe('espirometria-prediagnosis-v1')
    expect(PREDIAGNOSIS_VERSION).toMatch(/^espirometria-prediagnosis-v\d+$/)
  })

  it('Referencia explícita a DEC-20260824-02 y a IMPL-20260824-06', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('DEC-20260824-02')
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('IMPL-20260824-06')
  })
})

describe('update-espirometria-prediagnosis-prompt — AC-DEC-02-B: recommendation obligatorio y no nulo', () => {
  it('El prompt declara `recommendation` como OBLIGATORIO y NO NULO cuando hay datos suficientes', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/OBLIGATORIO Y NO NULO/i)
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/recommendation/i)
  })

  it('El prompt permite `recommendation: null` sólo si los datos son insuficientes (AI_NON_CONCLUSIVE)', () => {
    // El campo puede ser null pero DEBE ir acompañado de `non_conclusive_reason`.
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('AI_NON_CONCLUSIVE')
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/non_conclusive_reason/)
  })

  it('El contrato sigue siendo SINGULAR (no introduce `recommendations: string[]` en backend)', () => {
    // El frontend acepta aliases; el backend sigue siendo singular.
    // Esta es una decisión arquitectónica explícita.
    expect(NEW_PREDIAGNOSIS_PROMPT).not.toMatch(/recommendations\??:\s*string\[\]/)
  })
})

describe('update-espirometria-prediagnosis-prompt — AC-DEC-02-C: contextualización por patrón/calidad/entorno', () => {
  it('Cubre los 4 patrones espirométricos principales', () => {
    for (const patron of ['OBSTRUCTIVO', 'RESTRICCIÓN', 'MIXTO', 'NORMAL']) {
      expect(NEW_PREDIAGNOSIS_PROMPT).toContain(patron)
    }
  })

  it('Menciona entorno ocupacional y EPP', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/EPP|exposición|ocupacional/i)
  })

  it('Menciona estudios complementarios (pletismografía/TLC)', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/pletismografía|TLC/i)
  })

  it('Menciona broncodilatador cuando aplica a patrón obstructivo', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/broncodilatador/i)
  })

  it('Calidad dudosa → recomendar repetir el estudio', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/Calidad DUDOSA/i)
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/REPETIR/i)
  })
})

describe('update-espirometria-prediagnosis-prompt — AC-DEC-02-D: límites médicos PROHIBIDOS', () => {
  it('PROHIBIDO declarar aptitud laboral', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/PROHIBIDO declarar aptitud/i)
  })

  it('PROHIBIDO declarar incapacidad', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/incapacidad/i)
  })

  it('PROHIBIDO tratamiento farmacológico', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/tratamiento farmacológico/i)
  })

  it('PROHIBIDO dictamen final', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/dictamen final/i)
  })

  it('PROHIBIDO diagnóstico definitivo', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/diagnóstico definitivo/i)
  })

  it('Lenguaje prudente obligatorio', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/prudente/i)
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/compatible con|sugiere evaluación/i)
  })
})

describe('update-espirometria-prediagnosis-prompt — AC-DEC-02-E: verbos prescriptivos absolutos prohibidos', () => {
  it('El prompt prohíbe explícitamente "debe" / "deberá"', () => {
    // El texto del prompt incluye la prohibición:
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/PROHIBIDO usar verbos prescriptivos absolutos/i)
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/["']debe["']/)
  })
})

describe('update-espirometria-prediagnosis-prompt — AC-DEC-02-G: cero M3/Minimax en prediagnóstico', () => {
  it('El prompt clínico NO menciona M3 ni Minimax', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).not.toMatch(/M3|Minimax|m3/)
  })
})

describe('update-espirometria-prediagnosis-prompt — AC-DEC-02-H: jerarquía ATS/ERS 2022 + LLN preservada', () => {
  it('Referencia normativa ATS/ERS 2022 presente', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/ATS\/ERS 2022/)
  })

  it('Jerarquía LLN → predicho → ratio preservada', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/LLN/)
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/predicho/i)
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/FEV1\/FVC/)
  })
})

describe('update-espirometria-prediagnosis-prompt — AC-DEC-02-I: contrato no rompe la regla A-D', () => {
  it('REGLA A presente: si FEV1/FVC conservado y FVC reducida → NO cerrar como obstructivo', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/REGLA A/i)
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/NO cierres como patrón obstructivo/i)
  })

  it('REGLA B presente: ratio bajo + FVC baja → considerar mixto/no concluyente', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/REGLA B/i)
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/mixto|ambigüedad/i)
  })

  it('REGLA C presente: repetibilidad negativa NO anula automáticamente la sugerencia', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/REGLA C/i)
  })

  it('REGLA D presente: inconsistencia numérica → AI_NON_CONCLUSIVE', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/REGLA D/i)
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/AI_NON_CONCLUSIVE/i)
  })
})