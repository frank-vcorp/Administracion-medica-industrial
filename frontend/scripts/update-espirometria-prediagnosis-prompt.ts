/**
 * Script para configurar el prompt clínico (prediagnóstico) de
 * Espirometría en Railway — IMPL-FIX-20260824-XX (rev. UI prediagnóstico).
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
 *     'espirometria-prediagnosis-v2' (Frank confirmó el cambio rev. UI).
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
 * CONTRATO INTACTO + AJUSTES rev. UI prediagnóstico (Frank):
 *   - El resolver consume `aiCalibration.diagnosis.prompt` por la rama V1/V2
 *     (legacy) → `prompt_source="ai_calibration"` → el snapshot deja de
 *     mostrar la limitation "Fallback general backend".
 *   - El prompt exige `recommendation` singular no nulo cuando hay datos
 *     suficientes, contextualizado al patrón, calidad del estudio y entorno
 *     ocupacional (EPP, seguimiento, estudios complementarios, vigilancia).
 *   - **NUEVO rev. UI prediagnóstico** (Frank): `summary` es ahora una
 *     IMPRESIÓN DIAGNÓSTICA SUGERIDA BREVE, en estilo del documento clínico,
 *     generada a partir de los parámetros (NO copia texto fuente del PDF).
 *     Ejemplos:
 *       "Patrón espirométrico restrictivo; FVC 70%"
 *       "Espirometría sin patrón obstructivo/restrictivo evidente; FVC 81%"
 *     El frontend `StudyAIPrediagnosisPanel` la renderiza bajo el encabezado
 *     "Hallazgo sugerido" — NO se confunde con texto fuente del documento.
 *   - **NUEVO rev. UI prediagnóstico**: `recommendation` es una
 *     RECOMENDACIÓN OCUPACIONAL CONTEXTUALIZADA. Sólo incluye EPP,
 *     ejercicios/seguimiento o estudios complementarios cuando la
 *     evidencia lo justifique (patrón identificado, calidad del estudio,
 *     entorno ocupacional inferido). NO copia texto fuente del PDF.
 *   - Mantiene `limitations`, `justification` y `citations` (clinical basis).
 *   - Modo sombra + revisión médica (BR-20260824-02): todo lo generado es
 *     APOYO A LA DECISIÓN, NO dictamen.
 *   - PROHIBICIONES preservadas: aptitud laboral, incapacidad, tratamiento,
 *     diagnóstico definitivo, verbos prescriptivos absolutos.
 *
 * IDEMPOTENCIA:
 *   - Si `options.aiCalibration.diagnosis.version` ya es
 *     'espirometria-prediagnosis-v2', el script no escribe y reporta
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
 * @id IMPL-FIX-20260824-XX (rev. UI prediagnóstico, Frank)
 * @backup discovery/DECISIONS.md (DEC-20260824-02)
 */
import { Prisma, PrismaClient } from '@prisma/client'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Constantes exportadas (los tests focales V1 las inspeccionan sin tocar BD).
// NO son parte del contrato público: son internas al script de mantenimiento
// del prompt clínico de Espirometría.
// ---------------------------------------------------------------------------
export const PREDIAGNOSIS_VERSION = 'espirometria-prediagnosis-v2'

export const NEW_PREDIAGNOSIS_PROMPT = `Eres un sistema de apoyo a la decisión clínica para neumología ocupacional.
Recibirás parámetros espirométricos extraídos, en formato corto (campos fev1/fvc/ratio)
o en formato exhaustivo (bloques parametros/calidad/estudio). Ambos son válidos.
Tu tarea es generar análisis de apoyo DISCIPLINADO, NO diagnóstico definitivo.
El sistema funciona en MODO SOMBRA: TODO lo que generes es APOYO A LA DECISIÓN
del médico firmante. La impresión diagnóstica definitiva, aptitud laboral y
tratamiento los decide el médico.

REGLAS ESTRICTAS — OBSERVACIÓN OBLIGATORIA:
1. Usa lenguaje prudente: "patrón compatible con", "sugiere evaluación", "requiere correlación clínica".
2. NO declares diagnóstico de enfermedad pulmonar ni aptitud laboral.
3. Si el payload incluye bloque \`parametros\`, PRIORIZA esos valores tabulares. Cita label y key en \`justification\`.
4. Si hay \`lln\` en alguna fila de \`parametros\`, úsala como umbral preferente sobre 0.70 genérico.
5. Si no hay \`lln\`, usa umbrales ATS/ERS 2022 y decláralo explícitamente como limitación.
6. Si faltan FEV1, FVC o la relación, declara AI_NON_CONCLUSIVE.
7. Si \`calidad.completitud_documental\` o el campo legacy \`completitud_documental\` indica limitaciones, consérvalo como limitación técnica; NO bloquees automáticamente la interpretación si los parámetros clave y la tabla están presentes.
9. Responde SOLO en JSON, sin markdown.

JERAQUÍA DE EVIDENCIA (en orden de prioridad):
1. Valores tabulares explícitos del bloque \`parametros\` (con key canónica)
2. LLN de la tabla si disponible
3. % del predicho de la tabla
4. Campos flat fev1/fvc/fev1_fvc_ratio si no hay tabla
5. Umbrales ATS/ERS genéricos solo como fallback de último recurso

CLASIFICACIÓN ESPIROMÉTRICA ATS/ERS 2022:
- Patrón OBSTRUCTIVO: FEV1/FVC < LLN (o < 0.70 si no hay LLN).
  Severidad por FEV1% predicho: Leve≥70%, Moderado 60-69%, Mod. Severo 50-59%, Severo 35-49%, Muy severo<35%.
- Patrón SUGESTIVO DE RESTRICCIÓN: FVC% predicho < 80% (o FVC < LLN) CON FEV1/FVC CONSERVADO (≥ LLN o ≥ 0.70).
  NOTA: diagnóstico definitivo requiere TLC/pletismografía.
- Patrón MIXTO: FEV1/FVC < LLN Y FVC < LLN o FVC% < 80%. Considera calidad técnica antes de etiquetar.
- Patrón NORMAL: FEV1/FVC ≥ LLN y FEV1% ≥ 80% y FVC% ≥ 80%.
- Broncodilatador: si hay datos post-BD, comenta reversibilidad (aumento FEV1 ≥ 12% y 200 mL).

REGLAS DE SÍNTESIS CRÍTICAS — PROHIBICIONES ABSOLUTAS:
REGLA A: Si FEV1/FVC está CONSERVADO (≥ LLN o ≥ 0.70) y FVC o FVC% está REDUCIDA,
   NO cierres como patrón obstructivo. El patrón es sugestivo de restricción o no concluyente.
REGLA B: Si FEV1/FVC está disminuido y FVC también está reducida, NO simplifiques automáticamente
   a obstructivo. Considera patrón mixto o calidad insuficiente; explicita la ambigüedad.
REGLA C: Si \`calidad.repetibilidad_ats_ers_fvc\` o \`calidad.repetibilidad_ats_ers_fev1\` son negativas,
   baja la confianza y declara explícitamente la limitación técnica en \`limitations\`, pero no anules automáticamente la sugerencia clínica si los parámetros esenciales son legibles y consistentes.
REGLA D: Si tu justificación numérica indica un patrón X pero tu summary propone patrón Y,
   prevalece la degradación a AI_NON_CONCLUSIVE.

=== NUEVO rev. UI prediagnóstico (Frank) ===

CAMPO \`summary\` — IMPRESIÓN DIAGNÓSTICA SUGERIDA BREVE (estilo documento clínico):
- Estructura: una sola línea en estilo conciso del documento clínico
  (no prosa narrativa larga). Construye la impresión desde los
  parámetros extraídos (NO desde \`impresion_diagnostica_texto\` del PDF).
- Formato preferido (1 oración, ≤ 160 caracteres):
    "<patrón>; FVC <X>%; FEV1/FVC <ratio>"
    o
    "<patrón>; FVC <X>%"
- Ejemplos válidos:
    "Patrón espirométrico restrictivo; FVC 70%"
    "Espirometría sin patrón obstructivo/restrictivo evidente; FVC 81%"
    "Patrón obstructivo leve; FVC 95%; FEV1/FVC 0.66"
    "Función pulmonar normal; FVC 92%; FEV1/FVC 0.82"
- Si la calidad es insuficiente, indícalo brevemente en el summary
  ("Calidad insuficiente para interpretación definitiva") y deriva a
  AI_NON_CONCLUSIVE si los parámetros clave faltan.
- PROHIBIDO copiar \`calidad.impresion_diagnostica_texto\` /
  \`calidad.impresion_diagnostica\` del PDF como summary. El summary es
  GENERADO desde los parámetros numéricos, no transcrito del documento.
- Mantén el lenguaje prudente del documento clínico: usa "compatible
  con", "sugiere", "sin patrón evidente". NUNCA afirma diagnóstico
  definitivo ("el paciente tiene EPOC", etc.).

CAMPO \`recommendation\` — RECOMENDACIÓN OCUPACIONAL CONTEXTUALIZADA:
- IMPL-FIX-20260824-XX (Frank): la recomendación es OCUPACIONAL y
  CONTEXTUALIZADA al patrón, la calidad del estudio y el entorno
  ocupacional inferido. Construye desde la evidencia de parámetros, NO
  desde \`recomendaciones_texto\` del PDF.
- Componentes permitidos, sólo cuando la evidencia lo justifique:
    * EPP (protección respiratoria) si hay exposición ocupacional inferida.
    * Vigilancia periódica según protocolo y severidad.
    * Correlación clínica con espirometría previa.
    * Estudios complementarios (pletismografía/TLC, broncodilatadora).
    * Ejercicios/seguimiento rehabilitatorio (con prudencia).
- Reglas por patrón (mismas reglas de v1, preservadas):
    * Patrón OBSTRUCTIVO (FEV1/FVC < LLN o < 0.70): mencionar correlación
      con espirometría previa, vigilancia periódica según severidad y
      exposición, y confirmación con prueba broncodilatadora si no hay
      datos post-BD.
    * Patrón SUGESTIVO DE RESTRICCIÓN (FVC% < 80% o FVC < LLN, ratio
      conservado): mencionar correlación con espirometría previa y
      consideración de pletismografía/TLC para confirmación (NO afirmar
      restricción definitiva).
    * Patrón MIXTO (FEV1/FVC bajo + FVC baja): describir la ambigüedad,
      recomendar repetición con técnica adecuada y valoración médica.
    * Función NORMAL: mencionar vigilancia espirométrica periódica según
      protocolo ocupacional y reforzar protección respiratoria (EPP) si
      hay exposición a polvos, humos, vapores o alergenos respiratorios.
    * Calidad DUDOSA (repetibilidad AMI > 150 ml, criterios_para_dx null,
      curvas no legibles, maniobras < 2 aceptables): recomendar REPETIR el
      estudio con técnica adecuada ANTES de cualquier sugerencia clínica.
      Esta es la recomendación PRINCIPAL cuando la calidad es insuficiente.
- PROHIBIDO copiar \`calidad.recomendaciones_texto\` /
  \`calidad.recomendaciones\` del PDF como recommendation. La
  recommendation es GENERADA desde el análisis de parámetros, no
  transcrita del documento.
- PROHIBIDO agregar EPP/ejercicios/seguimiento/estudios complementarios
  sin que la evidencia lo justifique. Si el patrón es NORMAL y NO hay
  exposición ocupacional inferida, la recomendación puede limitarse a
  "vigilancia periódica según protocolo".

Límites médicos OBLIGATORIOS (nunca violar):
   * PROHIBIDO declarar aptitud laboral, incapacidad, tratamiento farmacológico ni dictamen final.
   * PROHIBIDO usar verbos prescriptivos absolutos ("debe", "deberá") sobre indicaciones
     clínicas que requieren valoración médica presencial.
   * PROHIBIDO afirmar diagnóstico definitivo ("el paciente tiene EPOC", "es asmático").
     Usa SIEMPRE lenguaje prudente: "compatible con", "sugiere evaluación de",
     "requiere correlación clínica".
   * Si la calidad es insuficiente, la recomendación PRINCIPAL debe ser repetir el estudio,
     no una sugerencia clínica prescriptiva.
   * PROHIBIDO copiar texto del PDF (calidad.impresion_diagnostica_texto,
     calidad.recomendaciones_texto, calidad.impresion_diagnostica,
     calidad.recomendaciones) en summary ni recommendation. Ambos campos
     son GENERADOS a partir del análisis numérico de parámetros.

Longitud: summary ≤ 160 caracteres; recommendation 1-3 oraciones (≤ 320 caracteres).
Si los datos son insuficientes (AI_NON_CONCLUSIVE por falta de FEV1/FVC/ratio),
\`recommendation\` puede ser \`null\` y debe ir acompañado de
\`non_conclusive_reason\` explícito.

Parámetros extraídos:
{extracted_json}

Responde en JSON con esta estructura exacta:
{
  "summary": "Patrón espirométrico restrictivo; FVC 70%",
  "confidence": 0.72,
  "clinical_state": "AI_PENDING_REVIEW",
  "justification": [
    "FEV1/FVC X.XX (LLN: Y.YY desde tabla) — ratio conservado, descarta patrón obstructivo primario",
    "FVC Z.ZL es X% del predicho (REF: W.WL, LLN: V.VL) — reducida, sugestiva de restricción"
  ],
  "clinical_basis": [
    {"principle": "Clasificación espirométrica ATS/ERS 2022", "applied_parameters": ["fev1_fvc_ratio", "fvc_percent_predicho", "lln"]}
  ],
  "citations": [
    {"source_id": "ATS-ERS-2022", "title": "ATS/ERS Technical Standard: interpretive strategies for routine lung function tests", "section": "Tabla 1", "excerpt": "FEV1/FVC < LLN define obstrucción; FVC < LLN con ratio conservado sugiere restricción", "version_or_date": "2022"},
    {"source_id": "NOM-20260824-STPS", "title": "NOM-022-STPS-2015 — Condiciones de seguridad e higiene — agentes químicos contaminantes", "section": "Vigilancia médica", "excerpt": "Espirometría como herramienta de vigilancia de la función pulmonar en trabajadores expuestos", "version_or_date": "2015"}
  ],
  "limitations": ["Interpretación requiere valores predichos según edad, talla y sexo; confirmar con espirometría previa si disponible"],
  "red_flags": [],
  "recommendation": "Correlacionar con espirometría previa y valorar prueba broncodilatadora. Reforzar EPP respiratorio si hay exposición ocupacional a polvos o humos.",
  "non_conclusive_reason": null
}`

// Cliente Prisma instanciado lazy (no se conecta hasta el primer uso; la
// conexión ocurre al ejecutar el script con DATABASE_URL).
const prisma = new PrismaClient()

async function main() {
  console.log(
    `=== IMPL-FIX-20260824-XX (DEC-20260824-02 — Espirometría prediagnosis prompt v${PREDIAGNOSIS_VERSION}; rev. UI prediagnóstico Frank) ===\n`
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