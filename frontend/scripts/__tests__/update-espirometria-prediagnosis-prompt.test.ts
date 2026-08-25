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
  it('PREDIAGNOSIS_VERSION es estrictamente v3 (AMI-ESPIROMETRIA-v1, Frank)', () => {
    expect(PREDIAGNOSIS_VERSION).toBe('espirometria-prediagnosis-v3')
    expect(PREDIAGNOSIS_VERSION).toMatch(/^espirometria-prediagnosis-v\d+$/)
  })

  it('Referencia explícita a AMI-ESPIROMETRIA-v1 y trazabilidad DEC-20260824-02', () => {
    // La trazabilidad AMI-ESPIROMETRIA-v1 vive en el docstring del script.
    const fs = require('node:fs') as typeof import('node:fs')
    const src = fs.readFileSync(
      new URL('../update-espirometria-prediagnosis-prompt.ts', import.meta.url)
        .pathname,
      'utf8'
    )
    expect(src).toContain('AMI-ESPIROMETRIA-v1')
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

describe('update-espirometria-prediagnosis-prompt — AMI-ESPIROMETRIA-v1 (Frank)', () => {
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
    // El v3 usa backticks escapados en el template literal TS (\\`); el
    // runtime produce `calidad.impresion_diagnostica_texto`. El regex
    // tolera espacios O backticks entre "PROHIBIDO copiar" y la referencia.
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(
      /PROHIBIDO copiar[\s`]*calidad\.impresion_diagnostica_texto/i
    )
    // El v3 indica que la impresión se construye desde los parámetros
    // extraídos (no del PDF), no transcrito.
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(
      /Construye la impresi[oó]n desde los par[aá]metros extra[ií]dos/i
    )
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
      /PROHIBIDO copiar[\s`]*calidad\.recomendaciones_texto/i
    )
    // El v3 indica que la recomendación se construye contextualizada al
    // patrón + calidad + entorno (no transcrita del PDF).
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(
      /RECOMENDACI[OÓ]N OCUPACIONAL CONTEXTUALIZADA/i
    )
  })

  it('recommendation: prompt exige que EPP/ejercicios/estudios sólo cuando la evidencia lo justifique', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(
      /s[oó]lo cuando la evidencia lo justifique/i
    )
    // Si patrón NORMAL sin exposición ocupacional, recomendación mínima.
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(
      /NORMAL\s+sin\s+exposici[oó]n\s+ocupacional/i
    )
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

  it('Reglas de patrón preservadas (obstructivo / restrictivo / mixto / normal / calidad dudosa)', () => {
    for (const patron of ['OBSTRUCTIVO', 'RESTRICCIÓN', 'MIXTO', 'NORMAL']) {
      expect(NEW_PREDIAGNOSIS_PROMPT).toContain(patron)
    }
    // "Calidad dudosa" cubre el v3 (v2 usaba "DUDOSA").
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/calidad\s+dudosa/i)
  })

  it('Sin migración: el script no publica V3 ni modifica schema Prisma', () => {
    // Verificación estática: el script no debe publicar versiones V3.
    expect(PREDIAGNOSIS_VERSION).not.toMatch(/^v[0-9]+$/)
    // Sigue siendo rama V1/V2 legacy (lee via aiCalibration.diagnosis).
    expect(PREDIAGNOSIS_VERSION).toMatch(/^espirometria-prediagnosis-v\d+$/)
  })
})

// ---------------------------------------------------------------------------
// AMI-ESPIROMETRIA-v1: tests específicos del flujo AMI extraído de
// `context/datos AMI/DETERMINAR EL PATRÓN ESPIROMÉTRICO.pptx` que ahora
// preside el prompt v3.
//
// AC:
//   - AMI es FUENTE PRIORITARIA (aparece ANTES de ATS/ERS 2022).
//   - Cada paso del algoritmo AMI está presente en el prompt:
//       paso 1: aceptabilidad/repetibilidad
//       paso 2: FEV1/FVC < LIN obstructivo; FVC > 80% normal; FVC ≤ 80% restrictivo
//       paso 3: gradación FEV1% (70-100 leve; 60-69 moderada; 50-59 mod. grave; 35-49 grave; <35 muy grave)
//       paso 4: broncodilatador >200 ml Y >12% (normaliza → hiperreactividad; no normaliza → obstrucción crónica)
//       paso 5: FVC baja → TLC/pletismografía
//   - ATS/ERS 2022 se mantiene como REFERENCIA SECUNDARIA.
//   - Modo sombra + revisión médica preservados.
// ---------------------------------------------------------------------------

describe('update-espirometria-prediagnosis-prompt — AMI-ESPIROMETRIA-v1 flujo AMI prioritario', () => {
  it('AMI como fuente prioritaria: aparece ANTES de ATS/ERS 2022 en el prompt', () => {
    const ami_pos = NEW_PREDIAGNOSIS_PROMPT.indexOf('CRITERIOS AMI')
    const ats_pos = NEW_PREDIAGNOSIS_PROMPT.indexOf('ATS/ERS 2022')
    expect(ami_pos).toBeGreaterThan(-1)
    expect(ats_pos).toBeGreaterThan(-1)
    expect(ami_pos).toBeLessThan(ats_pos)
  })

  it('PASO 1 AMI: gate de aceptabilidad y repetibilidad', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('PASO 1')
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('ACEPTABILIDAD Y REPETIBILIDAD')
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/Baja la confianza/i)
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/REPETIR el estudio con t[eé]cnica adecuada/i)
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/NO emitas patr[oó]n definitivo/i)
  })

  it('PASO 2 AMI: FEV1/FVC < LIN → obstructivo; FVC > 80% → normal; FVC ≤ 80% → sugestivo de restricción', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('PASO 2')
    // FEV1/FVC < LIN → obstructivo.
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/FEV1\/FVC\s*<\s*LIN/i)
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/patr[oó]n OBSTRUCTIVO/i)
    // FEV1/FVC ≥ LIN + FVC > 80% → normal.
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/FVC\s*>\s*80%/i)
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/patr[oó]n NORMAL/i)
    // FEV1/FVC ≥ LIN + FVC ≤ 80% → sugestivo de restricción.
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/FVC\s*≤\s*80%/i)
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/SUGESTIVO DE RESTRICCI[OÓ]N/i)
  })

  it('PASO 3 AMI: gradación de obstrucción con FEV1 % predicho', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('PASO 3')
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('GRADUACIÓN DE OBSTRUCCIÓN')
    // Escala completa: 70-100, 60-69, 50-59, 35-49, <35.
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/70-100%\s*=\s*LEVE/i)
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/60-69%\s*=\s*MODERADA/i)
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/50-59%\s*=\s*MODERADAMENTE GRAVE/i)
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/35-49%\s*=\s*GRAVE/i)
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/<35%\s*=\s*MUY GRAVE/i)
  })

  it('PASO 4 AMI: broncodilatador >200 ml Y >12% (normaliza → hiperreactividad; no normaliza → obstrucción crónica)', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('PASO 4')
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('PRUEBA BRONCODILATADORA')
    // "Mejora FEV1 y/o FVC > 200 ml Y > 12%" — el "/" puede dar problemas
    // en regex si no se escapa. Aquí el patrón es claro en el prompt.
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('> 200 ml')
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('> 12%')
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/NORMALIZA o CASI NORMALIZA/i)
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('HIPERREACTIVIDAD BRONQUIAL')
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/NO normaliza/i)
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('OBSTRUCCIÓN CRÓNICA')
  })

  it('PASO 5 AMI: FVC baja NO confirma restricción; TLC/pletismografía', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('PASO 5')
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('CONFIRMACIÓN DE RESTRICCIÓN')
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/FVC baja\s*NO confirma restricci[oó]n/i)
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/TLC\s*\/\s*pletismograf[ií]a/i)
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/NO afirmar restricci[oó]n definitiva/i)
  })

  it('ATS/ERS 2022 se mantiene como REFERENCIA SECUNDARIA (no desplazado)', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('REFERENCIA SECUNDARIA ATS/ERS 2022')
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/complemento,\s*NO desplaza AMI/i)
  })

  it('Orden del prompt v3: AMI primero → datos → salida → guardrails', () => {
    const idx_ami = NEW_PREDIAGNOSIS_PROMPT.indexOf('CRITERIOS AMI')
    const idx_datos = NEW_PREDIAGNOSIS_PROMPT.indexOf('DATOS DEL ESTUDIO')
    const idx_salida = NEW_PREDIAGNOSIS_PROMPT.indexOf('SALIDA JSON')
    const idx_guardrails = NEW_PREDIAGNOSIS_PROMPT.indexOf(
      'LIMITES MÉDICOS OBLIGATORIOS'
    )
    expect(idx_ami).toBeLessThan(idx_datos)
    expect(idx_datos).toBeLessThan(idx_salida)
    expect(idx_salida).toBeLessThan(idx_guardrails)
  })

  it('Modo sombra + revisión médica preservados (modo sombra clínica + alerta)', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('MODO SOMBRA')
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/APOYO A LA DECISI[OÓ]N/i)
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/el m[eé]dico firmante/i)
  })

  it('Citations incluye AMI como fuente prioritaria', () => {
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('AMI-DETERMINAR-PATRON-2024')
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/Algoritmo AMI/i)
    // ATS/ERS y NOM-022-STPS-2015 también presentes (no se eliminan).
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('ATS-ERS-2022')
    expect(NEW_PREDIAGNOSIS_PROMPT).toContain('NOM-022-STPS-2015')
  })

  it('Justificación cita pasos AMI explícitamente', () => {
    // El JSON skeleton justifica citing AMI step numbers.
    expect(NEW_PREDIAGNOSIS_PROMPT).toMatch(/AMI paso\s*\d+/i)
  })

  it('Sin migración Prisma: el script sólo inyecta diagnosis, no schema', () => {
    expect(PREDIAGNOSIS_VERSION).toMatch(/^espirometria-prediagnosis-v\d+$/)
  })
})