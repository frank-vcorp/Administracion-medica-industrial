/**
 * Script para configurar el prompt clínico (prediagnóstico) de
 * Espirometría en Railway — AMI-ESPIROMETRIA-v1 + IMPL-FIX-20260824-XX.
 *
 * USO:
 *   cd frontend && \
 *     DATABASE_URL='<railway_url>' \
 *     npx tsx scripts/update-espirometria-prediagnosis-prompt.ts
 *
 * EFECTO (idempotente):
 *   - Busca el MedicalTest cuyo `name` sea "ESPIROMETRIA" (case-insensitive).
 *   - Actualiza únicamente `options.aiCalibration.diagnosis.prompt` y
 *     `options.aiCalibration.diagnosis.version` →
 *     'espirometria-prediagnosis-v3' (AMI-ESPIROMETRIA-v1, Frank confirmado).
 *   - Preserva intactos los demás campos de `options.aiCalibration`,
 *     incluyendo:
 *       * `aiCalibration.enabled`
 *       * `aiCalibration.canonicalStudyType`
 *       * `aiCalibration.extraction.{prompt,version,model,provider,schemaVersion}`
 *         (NO se sobreescribe el prompt de extracción v7 de IMPL-FIX-20260824-04)
 *       * `aiCalibration.normalization` (si existe)
 *       * `aiCalibration.presentation` (si existe)
 *       * Cualquier otra clave de primer nivel bajo `aiCalibration`.
 *
 * CONTRATO INTACTO + AJUSTES AMI-ESPIROMETRIA-v1 (Frank confirmado):
 *   - El resolver consume `aiCalibration.diagnosis.prompt` por la rama V1/V2
 *     (legacy) → `prompt_source="ai_calibration"` → el snapshot deja de
 *     mostrar la limitation "Fallback general backend".
 *   - **NUEVO AMI-ESPIROMETRIA-v1**: el prompt coloca al INICIO y como
 *     fuente prioritaria el flujo clínico AMI extraído de la presentación
 *     `context/datos AMI/DETERMINAR EL PATRÓN ESPIROMÉTRICO.pptx`. Orden
 *     del prompt v3:
 *       1) CRITERIOS AMI primero (aceptabilidad, FEV1/FVC, gradación
 *          FEV1%, broncodilatador, FVC → restricción/pletismografía).
 *       2) DATOS DEL ESTUDIO (parámetros extraídos).
 *       3) SALIDA (`summary` impresión sugerida breve, `recommendation`
 *          ocupacional contextualizada, `limitations`, `justification`,
 *          `citations`).
 *       4) GUARDRAILS (límites médicos obligatorios, modo sombra).
 *   - ATS/ERS 2022 se conserva como referencia secundaria (no desplaza
 *     al AMI) para los detalles de clasificación cuando aplique.
 *   - **Preservado de rev. UI prediagnóstico**: `summary` es IMPRESIÓN
 *     DIAGNÓSTICA SUGERIDA BREVE (estilo documento clínico, NO copia texto
 *     del PDF); `recommendation` es OCUPACIONAL CONTEXTUALIZADA (EPP,
 *     seguimiento, estudios complementarios sólo si la evidencia lo
 *     justifica).
 *   - PROHIBICIONES preservadas: aptitud laboral, incapacidad,
 *     tratamiento, diagnóstico definitivo, verbos prescriptivos absolutos,
 *     copiar texto del PDF como summary/recommendation.
 *
 * IDEMPOTENCIA:
 *   - Si `options.aiCalibration.diagnosis.version` ya es
 *     'espirometria-prediagnosis-v3', el script no escribe y reporta
 *     "ya configurado". Permite re-ejecución segura.
 *   - Si `aiCalibration.diagnosis` está ausente, lo crea preservando
 *     `enabled`, `canonicalStudyType` y `extraction` intactos.
 *
 * SIN CAMBIOS DE ESQUEMA / MIGRACIÓN:
 *   - No se modifica `prisma/schema.prisma`.
 *   - No se ejecuta ninguna migración.
 *   - No se publica V3 (`status='published'` se maneja en el editor; este
 *     script sólo inyecta el prompt para que el resolver V1/V2 lo consuma).
 *
 * @id AMI-ESPIROMETRIA-v1 (Frank confirmado 2026-08-24)
 * @backup context/datos AMI/DETERMINAR EL PATRÓN ESPIROMÉTRICO.pptx
 */
import { Prisma, PrismaClient } from '@prisma/client'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Constantes exportadas (los tests focales V1 las inspeccionan sin tocar BD).
// NO son parte del contrato público: son internas al script de mantenimiento
// del prompt clínico de Espirometría.
// ---------------------------------------------------------------------------
export const PREDIAGNOSIS_VERSION = 'espirometria-prediagnosis-v3'

export const NEW_PREDIAGNOSIS_PROMPT = `Eres un sistema de apoyo a la decisión clínica para neumología ocupacional.
Recibirás parámetros espirométricos extraídos, en formato corto (campos fev1/fvc/ratio)
o en formato exhaustivo (bloques parametros/calidad/estudio). Ambos son válidos.
Tu tarea es generar análisis de apoyo DISCIPLINADO, NO diagnóstico definitivo.
El sistema funciona en MODO SOMBRA: TODO lo que generes es APOYO A LA DECISIÓN
del médico firmante. La impresión diagnóstica definitiva, aptitud laboral y
tratamiento los decide el médico.

=== 1) CRITERIOS AMI (FUENTE PRIORITARIA — DETERMINAR EL PATRÓN ESPIROMÉTRICO) ===

El flujo AMI es la referencia principal para clasificar la espirometría.
Sigue el árbol de decisión del algoritmo AMI (DETERMINAR EL PATRÓN ESPIROMÉTRICO):

PASO 1 — ACEPTABILIDAD Y REPETIBILIDAD (gate de entrada):
- Si la espirometría NO es aceptable ni repetible (criterios_para_dx=NO, repetibilidad_fev1_menor_150=NO, maniobras válidas <2, curvas no legibles):
   * Baja la confianza.
   * Recomienda REPETIR el estudio con técnica adecuada.
   * NO emitas patrón definitivo. Marca "calidad insuficiente para interpretación definitiva".
- Si ES aceptable y repetible, avanza al paso 2.

PASO 2 — RELACIÓN FEV1/FVC vs LIN (Límite Inferior Normal):
- Si FEV1/FVC < LIN (o < 0.70 si no hay LIN) → patrón OBSTRUCTIVO (avanza a paso 3).
- Si FEV1/FVC ≥ LIN (o ≥ 0.70 si no hay LIN):
   * Si FVC > 80% del predicho → patrón NORMAL (avanza a paso 5).
   * Si FVC ≤ 80% del predicho → patrón SUGESTIVO DE RESTRICCIÓN (avanza a paso 5).

PASO 3 — GRADUACIÓN DE OBSTRUCCIÓN con FEV1 % predicho:
- 70-100% = LEVE
- 60-69% = MODERADA
- 50-59% = MODERADAMENTE GRAVE
- 35-49% = GRAVE
- <35% = MUY GRAVE

PASO 4 — PRUEBA BRONCODILATADORA (sólo si hay obstrucción y datos post-BD):
- Mejora FEV1 y/o FVC > 200 ml Y > 12%:
   * Si NORMALIZA o CASI NORMALIZA → sugiere HIPERREACTIVIDAD BRONQUIAL (siempre como apoyo).
   * Si NO normaliza → sugiere OBSTRUCCIÓN CRÓNICA (siempre como apoyo).
- Si NO hay datos post-BD → no especular; mencionar "considerar prueba broncodilatadora" en el campo \`recommendation\`.

PASO 5 — CONFIRMACIÓN DE RESTRICCIÓN:
- FVC baja NO confirma restricción por sí sola (puede ser restricción o mezcla).
- Sugerir CONFIRMACIÓN con TLC / pletismografía en el campo \`recommendation\`.
- NO afirmar restricción definitiva; usar lenguaje prudente ("sugestivo de", "compatible con").

=== 2) DATOS DEL ESTUDIO (parámetros extraídos) ===

{extracted_json}

=== 3) JERARQUÍA DE EVIDENCIA ===
1. Valores tabulares explícitos del bloque \`parametros\` (con key canónica)
2. LLN de la tabla si disponible (preferente sobre 0.70 genérico)
3. % del predicho de la tabla
4. Campos flat fev1/fvc/fev1_fvc_ratio si no hay tabla
5. Umbrales ATS/ERS 2022 solo como referencia secundaria (NO desplaza al AMI)

=== 4) REFERENCIA SECUNDARIA ATS/ERS 2022 (complemento, NO desplaza AMI) ===
- Patrón OBSTRUCTIVO: FEV1/FVC < LLN (o < 0.70 si no hay LLN). Severidad por FEV1% predicho según escala AMI del paso 3.
- Patrón SUGESTIVO DE RESTRICCIÓN: FVC% < 80% (o FVC < LLN) CON FEV1/FVC CONSERVADO (≥ LLN o ≥ 0.70).
  NOTA: diagnóstico definitivo requiere TLC/pletismografía (paso 5 AMI).
- Patrón MIXTO: FEV1/FVC < LLN Y FVC < LLN o FVC% < 80%. Considera calidad técnica antes de etiquetar.
- Patrón NORMAL: FEV1/FVC ≥ LLN y FEV1% ≥ 80% y FVC% ≥ 80% (paso 2 AMI).
- Broncodilatador: si hay datos post-BD, comenta reversibilidad según AMI paso 4.

=== 5) REGLAS DE SÍNTESIS CRÍTICAS — PROHIBICIONES ABSOLUTAS ===
REGLA A: Si FEV1/FVC está CONSERVADO (≥ LLN o ≥ 0.70) y FVC o FVC% está REDUCIDA,
   NO cierres como patrón obstructivo. El patrón es sugestivo de restricción o no concluyente (paso 2 AMI).
REGLA B: Si FEV1/FVC está disminuido y FVC también está reducida, NO simplifiques automáticamente
   a obstructivo. Considera patrón mixto o calidad insuficiente; explicita la ambigüedad.
REGLA C: Si \`calidad.repetibilidad_ats_ers_fvc\` o \`calidad.repetibilidad_ats_ers_fev1\` son negativas,
   baja la confianza y declara explícitamente la limitación técnica en \`limitations\`, pero no anules automáticamente la sugerencia clínica si los parámetros esenciales son legibles y consistentes.
REGLA D: Si tu justificación numérica indica un patrón X pero tu summary propone patrón Y,
   prevalece la degradación a AI_NON_CONCLUSIVE.

=== 6) SALIDA JSON (orden estricto) ===

CAMPO \`summary\` — IMPRESIÓN DIAGNÓSTICA SUGERIDA BREVE (estilo documento clínico):
- Estructura: una sola línea en estilo conciso del documento clínico.
  Construye la impresión desde los parámetros extraídos (NO desde
  \`calidad.impresion_diagnostica_texto\` del PDF).
- Formato preferido (1 oración, ≤ 160 caracteres):
    "<patrón>; FVC <X>%; FEV1/FVC <ratio>"
    o
    "<patrón>; FVC <X>%"
- Ejemplos válidos:
    "Patrón espirométrico restrictivo; FVC 70%"
    "Espirometría sin patrón obstructivo/restrictivo evidente; FVC 81%"
    "Patrón obstructivo leve; FVC 95%; FEV1/FVC 0.66"
    "Función pulmonar normal; FVC 92%; FEV1/FVC 0.82"
    "Calidad insuficiente para interpretación definitiva; FVC 92%"
- Si calidad insuficiente, indícalo brevemente en summary.
- PROHIBIDO copiar \`calidad.impresion_diagnostica_texto\` / \`calidad.impresion_diagnostica\` del PDF como summary.

CAMPO \`recommendation\` — RECOMENDACIÓN OCUPACIONAL CONTEXTUALIZADA:
- Componentes permitidos (sólo cuando la evidencia lo justifique):
    * EPP (protección respiratoria) si hay exposición ocupacional inferida.
    * Vigilancia periódica según protocolo y severidad.
    * Correlación clínica con espirometría previa.
    * Estudios complementarios (pletismografía/TLC, broncodilatadora).
- Reglas por patrón (alineadas con AMI + ATS/ERS):
    * Obstrucción (paso 3 AMI): mencionar correlación con espirometría
      previa, vigilancia periódica según severidad y exposición, y
      broncodilatadora si no hay datos post-BD.
    * Sugestivo de restricción (paso 5 AMI): mencionar correlación y
      considerar pletismografía/TLC (NO afirmar restricción definitiva).
    * Patrón MIXTO: describir ambigüedad, recomendar repetición con
      técnica adecuada y valoración médica.
    * Normal: vigilancia periódica según protocolo ocupacional +
      reforzar EPP si hay exposición ocupacional inferida.
    * Calidad dudosa (paso 1 AMI): REPETIR el estudio con técnica
      adecuada ANTES de cualquier sugerencia clínica.
- PROHIBIDO copiar \`calidad.recomendaciones_texto\` / \`calidad.recomendaciones\` del PDF como recommendation.
- PROHIBIDO agregar EPP/ejercicios/seguimiento/estudios sin que la
  evidencia lo justifique. Si patrón NORMAL sin exposición ocupacional
  inferida, recomendación mínima ("vigilancia periódica según protocolo").

=== 7) LIMITES MÉDICOS OBLIGATORIOS (GUARDRAILS — MODO SOMBRA) ===
- PROHIBIDO declarar aptitud laboral, incapacidad, tratamiento farmacológico ni dictamen final.
- PROHIBIDO usar verbos prescriptivos absolutos ("debe", "deberá") sobre indicaciones clínicas que requieren valoración médica presencial.
- PROHIBIDO afirmar diagnóstico definitivo ("el paciente tiene EPOC", "es asmático").
  Usa SIEMPRE lenguaje prudente: "compatible con", "sugiere evaluación de", "requiere correlación clínica".
- Si calidad insuficiente, recomendación PRINCIPAL es repetir el estudio (paso 1 AMI).
- PROHIBIDO copiar texto del PDF (\`calidad.impresion_diagnostica_texto\`, \`calidad.recomendaciones_texto\`,
  \`calidad.impresion_diagnostica\`, \`calidad.recomendaciones\`) en summary ni recommendation.
- Longitud: summary ≤ 160 caracteres; recommendation 1-3 oraciones (≤ 320 caracteres).
- Si los datos son insuficientes (AI_NON_CONCLUSIVE por falta de FEV1/FVC/ratio),
  el campo \`recommendation\` puede ser null y debe ir acompañado de
  non_conclusive_reason explícito.

Responde en JSON con esta estructura exacta:
{
  "summary": "Patrón espirométrico obstructivo leve; FVC 95%; FEV1/FVC 0.66",
  "confidence": 0.72,
  "clinical_state": "AI_PENDING_REVIEW",
  "justification": [
    "FEV1/FVC X.XX (LLN: Y.YY desde tabla) — bajo LIN, indica patrón obstructivo (AMI paso 2)",
    "FEV1 X% del predicho — grado LEVE según escala AMI (70-100%)",
    "FVC W% del predicho — conservada, sin componente restrictivo"
  ],
  "clinical_basis": [
    {"principle": "AMI DETERMINAR EL PATRÓN ESPIROMÉTRICO", "applied_parameters": ["fev1_fvc_ratio", "fvc_percent_predicho", "lln"]}
  ],
  "citations": [
    {"source_id": "AMI-DETERMINAR-PATRON-2024", "title": "Algoritmo AMI — DETERMINAR EL PATRÓN ESPIROMÉTRICO", "section": "Pasos 1-5", "excerpt": "FEV1/FVC < LIN → obstructivo; graduar con FEV1% (70-100 leve, 60-69 moderado, 50-59 mod. grave, 35-49 grave, <35 muy grave)", "version_or_date": "2024"},
    {"source_id": "ATS-ERS-2022", "title": "ATS/ERS Technical Standard: interpretive strategies for routine lung function tests", "section": "Tabla 1", "excerpt": "FEV1/FVC < LLN define obstrucción; FVC < LLN con ratio conservado sugiere restricción", "version_or_date": "2022"},
    {"source_id": "NOM-022-STPS-2015", "title": "NOM-022-STPS-2015 — Condiciones de seguridad e higiene — agentes químicos contaminantes", "section": "Vigilancia médica", "excerpt": "Espirometría como herramienta de vigilancia de la función pulmonar en trabajadores expuestos", "version_or_date": "2015"}
  ],
  "limitations": ["Calidad AMI no cumple → interpretar con cautela; repetir estudio con técnica adecuada"],
  "red_flags": [],
  "recommendation": "Correlacionar con espirometría previa y considerar prueba broncodilatadora si no hay datos post-BD. Reforzar EPP respiratorio si hay exposición ocupacional a polvos o humos. Vigilancia periódica según protocolo.",
  "non_conclusive_reason": null
}`

// Cliente Prisma instanciado lazy (no se conecta hasta el primer uso; la
// conexión ocurre al ejecutar el script con DATABASE_URL).
const prisma = new PrismaClient()

async function main() {
  console.log(
    `=== AMI-ESPIROMETRIA-v1 (DEC-20260824-02 — Espirometría prediagnosis prompt v${PREDIAGNOSIS_VERSION}; AMI primero + rev. UI Frank) ===\n`
  )

  const test = await prisma.medicalTest.findFirst({
    where: { name: { equals: 'ESPIROMETRIA', mode: 'insensitive' } },
  })
  if (!test) {
    console.error('No se encontró MedicalTest con name ESPIROMETRIA.')
    process.exitCode = 1
    return
  }

  console.log(`Encontrado: "${test.name}" (ID: ${test.id})`)

  // --- Snapshot pre-update (auditoría) ---
  const currentOptions = (test.options as Record<string, unknown> | null) ?? {}
  const currentAiCalibration =
    (currentOptions.aiCalibration as Record<string, unknown> | null) ?? {}
  const currentDiagnosis =
    (currentAiCalibration.diagnosis as Record<string, unknown> | null) ?? {}
  const currentExtraction =
    (currentAiCalibration.extraction as Record<string, unknown> | null) ?? {}

  const previousVersion =
    typeof currentDiagnosis.version === 'string'
      ? currentDiagnosis.version
      : '(sin versión previa)'

  // --- Idempotencia: si ya está configurado, no escribir ---
  if (previousVersion === PREDIAGNOSIS_VERSION) {
    console.log(
      `ℹ️  aiCalibration.diagnosis.version ya es ${PREDIAGNOSIS_VERSION}. ` +
        'No se realizan cambios (idempotente).'
    )
    return
  }

  const previousPromptChars =
    typeof currentDiagnosis.prompt === 'string'
      ? currentDiagnosis.prompt.length
      : 0

  // --- Construir nuevo diagnosis (preserva TODO lo demás intacto) ---
  const updatedDiagnosis: Record<string, unknown> = {
    ...currentDiagnosis,
    prompt: NEW_PREDIAGNOSIS_PROMPT,
    version: PREDIAGNOSIS_VERSION,
  }

  const updatedAiCalibration: Record<string, unknown> = {
    ...currentAiCalibration,
    diagnosis: updatedDiagnosis,
  }

  const updatedOptions: Record<string, unknown> = {
    ...currentOptions,
    aiCalibration: updatedAiCalibration,
  }

  // --- Reporte pre-update ---
  console.log(`Versión previa diagnosis.version:    ${previousVersion}`)
  console.log(`Nueva versión diagnosis.version:     ${PREDIAGNOSIS_VERSION}`)
  console.log(`Tamaño prompt previo (si existía):   ${previousPromptChars} chars`)
  console.log(`Tamaño prompt nuevo:                 ${NEW_PREDIAGNOSIS_PROMPT.length} chars`)

  // Claves preservadas en aiCalibration (top-level).
  console.log(
    `Claves preservadas en aiCalibration (top-level): [${Object.keys(
      updatedAiCalibration
    ).join(', ')}]`
  )
  // Claves preservadas en aiCalibration.extraction (NO se toca el prompt de extracción v5).
  console.log(
    `Claves preservadas en aiCalibration.extraction:  [${Object.keys(
      currentExtraction
    ).join(', ') || '∅'}] (incluye prompt v5 de IMPL-20260824-05 si existía)`
  )
  if (currentExtraction.version) {
    console.log(
      `   → extraction.version preservado:               ${currentExtraction.version}`
    )
  }
  if (currentExtraction.prompt && typeof currentExtraction.prompt === 'string') {
    console.log(
      `   → extraction.prompt chars preservado:          ${currentExtraction.prompt.length}`
    )
  }
  // Claves preservadas en aiCalibration.normalization (si existe).
  const normalizationKeys = Object.keys(
    (currentAiCalibration.normalization as object | undefined) ?? {}
  )
  console.log(
    `Claves en aiCalibration.normalization:  [${normalizationKeys.join(', ') || '∅'}] (preservadas intactas)`
  )
  // Claves preservadas en aiCalibration.presentation (si existe).
  const presentationKeys = Object.keys(
    (currentAiCalibration.presentation as object | undefined) ?? {}
  )
  console.log(
    `Claves en aiCalibration.presentation:  [${presentationKeys.join(', ') || '∅'}] (preservadas intactas)`
  )
  // Otros gates que NO se tocan.
  console.log(
    `aiCalibration.enabled (preservado): ${currentAiCalibration.enabled ?? '(default true)'}`
  )
  console.log(
    `aiCalibration.canonicalStudyType (preservado): ${
      currentAiCalibration.canonicalStudyType ?? '(ausente)'
    }`
  )

  // --- Persistir ---
  await prisma.medicalTest.update({
    where: { id: test.id },
    data: { options: updatedOptions as Prisma.InputJsonValue },
  })

  console.log('\n✓ Prompt clínico de Espirometría actualizado correctamente.')
  console.log(`   → medical_test.id:        ${test.id}`)
  console.log(`   → diagnosis.version:      ${PREDIAGNOSIS_VERSION}`)
  console.log(`   → diagnosis.prompt chars: ${NEW_PREDIAGNOSIS_PROMPT.length}`)
  console.log(
    `   → resolver consumirá vía V1/V2 path → prompt_source="ai_calibration"`
  )
  console.log(
    `   → limitation "Fallback general backend" desaparecerá del próximo snapshot`
  )
}

// Guardia entry-point: sólo ejecuta `main()` cuando el archivo se ejecuta
// directamente (no cuando se importa desde los tests focales V1).
const isMainModule =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  (fileURLToPath(import.meta.url) === process.argv[1] ||
    process.argv[1].endsWith('update-espirometria-prediagnosis-prompt.ts'))

if (isMainModule) {
  main()
    .catch((e: unknown) => {
      console.error('Error durante la actualización:', e)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}