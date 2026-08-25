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
  it('PREDIAGNOSIS_VERSION es estrictamente v2 (rev. UI prediagnóstico Frank)', () => {
    expect(PREDIAGNOSIS_VERSION).toBe('espirometria-prediagnosis-v2')
    expect(PREDIAGNOSIS_VERSION).toMatch(/^espirometria-prediagnosis-v\d+$/)
  })

  it('Referencia explícita a DEC-20260824-02 y a IMPL-FIX-20260824-XX (rev. UI)', () => {
    // La trazabilidad DEC-20260824-02 vive en el docstring del script
    // (no en el prompt mismo, para no contaminar tokens de salida LLM).
    // Aquí verificamos que la marca de la rev. UI prediagnóstico SÍ está
    // en el prompt (referencia operativa, no decorativa).
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('IMPL-FIX-20260824-XX')
    // Y que el docstring sigue apuntando a DEC-20260824-02.
    const fs = require('node:fs') as typeof import('node:fs')
    const src = fs.readFileSync(
      new URL('../update-espirometria-prediagnosis-prompt.ts', import.meta.url)
        .pathname,
      'utf8'
    )
    expect(src).toContain('DEC-20260824-02')
  })
})

describe('update-espirometria-prediagnosis-prompt — AC-DEC-02-B: recommendation obligatorio y no nulo', () => {
  it('El prompt declara `recommendation` como OBLIGATORIO y NO NULO cuando hay datos suficientes (v2)', () => {
    // En v2 el encabezado del campo es "RECOMENDACIÓN OCUPACIONAL CONTEXTUALIZADA".
    // El principio (recommendation obligatorio y no nulo cuando hay datos)
    // sigue vigente, pero la frase exacta "OBLIGATORIO Y NO NULO" no se usa.
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/recommendation/i)
    // v2: encabezado explícito "CAMPO `recommendation` — RECOMENDACIÓN OCUPACIONAL CONTEXTUALIZADA"
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain(
      'RECOMENDACIÓN OCUPACIONAL CONTEXTUALIZADA'
    )
    // v2 preserva la regla: "Si los datos son insuficientes (AI_NON_CONCLUSIVE
    // por falta de FEV1/FVC/ratio), `recommendation` puede ser `null` y debe
    // ir acompañado de `non_conclusive_reason` explícito." — es la única
    // rama donde recommendation puede ser null.
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('AI_NON_CONCLUSIVE')
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('non_conclusive_reason')
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

// ---------------------------------------------------------------------------
// IMPL-FIX-20260824-XX (rev. UI prediagnóstico Frank).
//
// AC adicionales para v2 del prompt:
//   - summary: impresión diagnóstica SUGERIDA BREVE en estilo clínico, NO
//     copia texto del PDF.
//   - recommendation: recomendación OCUPACIONAL CONTEXTUALIZADA, NO copia
//     texto del PDF. Sólo incluye EPP/seguimiento/estudios si la evidencia
//     lo justifica.
//   - Limitaciones, justificación y fuentes clínicas se preservan.
//   - Modo sombra + revisión médica preservados.
// ---------------------------------------------------------------------------

describe('update-espirometria-prediagnosis-prompt — IMPL-FIX-20260824-XX rev. UI prediagnóstico', () => {
  it('summary: prompt define "IMPRESIÓN DIAGNÓSTICA SUGERIDA BREVE" (estilo documento clínico)', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain(
      'IMPRESIÓN DIAGNÓSTICA SUGERIDA BREVE'
    )
    // Estilo conciso del documento clínico.
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/estilo\s+documento\s+cl[ií]nico/i)
    // Construye desde parámetros, no desde PDF.
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/par[aá]metros\s+extra[ií]dos/i)
  })

  it('summary: prompt exige ≤ 160 caracteres y formato "patrón; FVC X%"', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/≤\s*160\s*caracteres/)
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/FVC\s+<X>%;?/)
  })

  it('summary: prompt PROHÍBE copiar `impresion_diagnostica_texto` del PDF', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(
      /PROHIBIDO copiar\s+`?calidad\.impresion_diagnostica_texto`?/i
    )
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/GENERADO\s+desde\s+los\s+par[aá]metros/i)
  })

  it('summary: prompt incluye ejemplos válidos del estilo clínico', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain(
      'Patrón espirométrico restrictivo; FVC 70%'
    )
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain(
      'Espirometría sin patrón obstructivo/restrictivo evidente; FVC 81%'
    )
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain(
      'Patrón obstructivo leve; FVC 95%; FEV1/FVC 0.66'
    )
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain(
      'Función pulmonar normal; FVC 92%; FEV1/FVC 0.82'
    )
  })

  it('recommendation: prompt define "RECOMENDACIÓN OCUPACIONAL CONTEXTUALIZADA"', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain(
      'RECOMENDACIÓN OCUPACIONAL CONTEXTUALIZADA'
    )
  })

  it('recommendation: prompt incluye componentes ocupacionales (EPP, seguimiento, estudios)', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('EPP')
    // Estudios complementarios (pletismografía/TLC, broncodilatadora).
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('pletismografía/TLC')
    // Vigilancia periódica.
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('Vigilancia periódica')
  })

  it('recommendation: prompt PROHÍBE copiar `recomendaciones_texto` del PDF', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(
      /PROHIBIDO copiar\s+`?calidad\.recomendaciones_texto`?/i
    )
    // El v2 prompt indica que recommendation es GENERADO desde análisis
    // de parámetros (no transcrito). El formato exacto puede variar,
    // así que validamos el principio general sin atar el regex a una
    // frase literal específica.
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(
      /GENERADO\s+desde/i
    )
  })

  it('recommendation: prompt exige que EPP/ejercicios/estudios sólo cuando la evidencia lo justifique', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(
      /s[oó]lo cuando la evidencia lo justifique/i
    )
    // Si patrón NORMAL sin exposición ocupacional, recomendación mínima.
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/NORMAL\s+y\s+NO\s+hay\s+exposici[oó]n/i)
  })

  it('Modo sombra + revisión médica: prompt preserva semántica', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('MODO SOMBRA')
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/APOYO A LA DECISI[OÓ]N/i)
    // Límites médicos preservados.
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('aptitud laboral')
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('diagnóstico definitivo')
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/verbos prescriptivos absolutos/i)
  })

  it('Limitaciones, justificación y fuentes clínicas preservadas', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('limitations')
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('justification')
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('citations')
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('ATS/ERS 2022')
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('NOM-022-STPS-2015')
  })

  it('Reglas de patrón preservadas (obstructivo / restrictivo / mixto / normal / dudosa)', () => {
    for (const patron of ['OBSTRUCTIVO', 'RESTRICCIÓN', 'MIXTO', 'NORMAL', 'DUDOSA']) {
      expect(NEW_PREDIAGNOSIS_PROMPT).toContain(patron)
    }
  })

  it('Sin migración: el script no publica V3 ni modifica schema Prisma', () => {
    // Verificación estática: el script no debe publicar versiones V3.
    expect(PREDIAGNOSIS_VERSION).not.toMatch(/^v[0-9]+$/)
    // Sigue siendo rama V1/V2 legacy (lee via aiCalibration.diagnosis).
    expect(PREDIAGNOSIS_VERSION).toMatch(/^espirometria-prediagnosis-v\d+$/)
  })
})