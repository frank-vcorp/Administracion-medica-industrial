/**
 * Script para configurar el prompt clínico (prediagnóstico) de
 * Espirometría en Railway — IMPL-20260824-06 / DEC-20260824-02.
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
 *     'espirometria-prediagnosis-v1' (versión DEC-20260824-02).
 *   - Preserva intactos los demás campos de `options.aiCalibration`,
 *     incluyendo:
 *       * `aiCalibration.enabled`
 *       * `aiCalibration.canonicalStudyType`
 *       * `aiCalibration.extraction.{prompt,version,model,provider,schemaVersion}`
 *         (NO se sobreescribe el prompt de extracción v5 de IMPL-20260824-05)
 *       * `aiCalibration.normalization` (si existe)
 *       * `aiCalibration.presentation` (si existe)
 *       * Cualquier otra clave de primer nivel bajo `aiCalibration`.
 *
 * CONTRATO INTACTO:
 *   - El resolver consume `aiCalibration.diagnosis.prompt` por la rama V1/V2
 *     (legacy) → `prompt_source="ai_calibration"` → el snapshot deja de
 *     mostrar la limitation "Prompt clínico resuelto desde Fallback general
 *     backend (aiCalibration.clinicalCriteria.prompt no configurado)".
 *   - El prompt exige `recommendation` singular no nulo cuando hay datos
 *     suficientes, contextualizado al patrón (obstructivo/restrictivo/
 *     mixto/normal), calidad del estudio y entorno ocupacional, con
 *     recomendaciones prudentes (seguimiento, correlación clínica, estudios
 *     complementarios, EPP) y PROHIBICIONES absolutas (sin aptitud,
 *     incapacidad, tratamiento farmacológico, dictamen final ni
 *     diagnóstico definitivo).
 *   - Si la calidad es insuficiente, la recomendación PRINCIPAL es repetir
 *     el estudio con técnica adecuada.
 *
 * IDEMPOTENCIA:
 *   - Si `options.aiCalibration.diagnosis.version` ya es
 *     'espirometria-prediagnosis-v1', el script no escribe y reporta
 *     "ya configurado". Esto permite re-ejecución segura.
 *   - Si `aiCalibration.diagnosis` está ausente, lo crea preservando
 *     `enabled`, `canonicalStudyType` y `extraction` intactos.
 *
 * SIN CAMBIOS DE ESQUEMA / MIGRACIÓN:
 *   - No se modifica `prisma/schema.prisma`.
 *   - No se ejecuta ninguna migración.
 *   - No se publica V3 (`status='published'` se maneja en el editor; este
 *     script sólo inyecta el prompt para que el resolver V1/V2 lo consuma).
 *
 * @id IMPL-20260824-06
 * @backup discovery/DECISIONS.md (DEC-20260824-02)
 */
import { Prisma, PrismaClient } from '@prisma/client'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Constantes exportadas (los tests focales V1 las inspeccionan sin tocar BD).
// NO son parte del contrato público: son internas al script de mantenimiento
// del prompt clínico de Espirometría.
// ---------------------------------------------------------------------------
export const PREDIAGNOSIS_VERSION = 'espirometria-prediagnosis-v1'

export const NEW_PREDIAGNOSIS_PROMPT = `Eres un sistema de apoyo a la decisión clínica para neumología ocupacional.
Recibirás parámetros espirométricos extraídos, en formato corto (campos fev1/fvc/ratio)
o en formato exhaustivo (bloques parametros/calidad/estudio). Ambos son válidos.
Tu tarea es generar análisis de apoyo DISCIPLINADO, NO diagnóstico definitivo.

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

CAMPO \`recommendation\` — OBLIGATORIO Y NO NULO cuando hay datos suficientes (FEV1, FVC y FEV1/FVC presentes):
- IMPL-20260824-06 (DEC-20260824-02): la recomendación debe estar CONTEXTUALIZADA con el
  patrón identificado, la calidad del estudio y el entorno ocupacional del paciente
  (hallazgo restrictivo/obstructivo, calidad, seguimiento, estudios complementarios, EPP).
  El frontend la muestra bajo el encabezado "Recomendaciones sugeridas".

Reglas de contenido (prudente, ocupacional, no prescriptiva):
   * Patrón OBSTRUCTIVO (FEV1/FVC < LLN o < 0.70): mencionar correlación con espirometría previa,
     vigilancia periódica según severidad y exposición, y confirmación con prueba broncodilatadora
     si no hay datos post-BD.
   * Patrón SUGESTIVO DE RESTRICCIÓN (FVC% < 80% o FVC < LLN, ratio conservado): mencionar
     correlación con espirometría previa y consideración de pletismografía/TLC para confirmación
     (NO afirmar restricción definitiva).
   * Patrón MIXTO (FEV1/FVC bajo + FVC baja): describir la ambigüedad, recomendar repetición
     con técnica adecuada y valoración médica.
   * Función NORMAL: mencionar vigilancia espirométrica periódica según protocolo ocupacional
     y reforzar protección respiratoria (EPP) si hay exposición a polvos, humos, vapores o
     alergenos respiratorios.
   * Calidad DUDOSA (repetibilidad AMI > 150 ml, criterios_para_dx null, curvas no legibles,
     maniobras < 2 aceptables): recomendar REPETIR el estudio con técnica adecuada ANTES
     de cualquier sugerencia clínica. Esta es la recomendación PRINCIPAL cuando la calidad
     es insuficiente.

Límites médicos OBLIGATORIOS (nunca violar):
   * PROHIBIDO declarar aptitud laboral, incapacidad, tratamiento farmacológico ni dictamen final.
   * PROHIBIDO usar verbos prescriptivos absolutos ("debe", "deberá") sobre indicaciones
     clínicas que requieren valoración médica presencial.
   * PROHIBIDO afirmar diagnóstico definitivo ("el paciente tiene EPOC", "es asmático").
     Usa SIEMPRE lenguaje prudente: "compatible con", "sugiere evaluación de",
     "requiere correlación clínica".
   * Si la calidad es insuficiente, la recomendación PRINCIPAL debe ser repetir el estudio,
     no una sugerencia clínica prescriptiva.

Longitud: una a tres oraciones (≤ 320 caracteres). El frontend la renderiza tal cual.
Si los datos son insuficientes (AI_NON_CONCLUSIVE por falta de FEV1/FVC/ratio), \`recommendation\`
puede ser \`null\` y debe ir acompañado de \`non_conclusive_reason\` explícito.

Parámetros extraídos:
{extracted_json}

Responde en JSON con esta estructura exacta:
{
  "summary": "Texto prudente de máx. 2 oraciones",
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
  "recommendation": "Correlacionar con espirometría previa y valoración médica complementaria. Considerar pletismografía si se confirma patrón sugestivo de restricción.",
  "non_conclusive_reason": null
}`

// Cliente Prisma instanciado lazy (no se conecta hasta el primer uso; la
// conexión ocurre al ejecutar el script con DATABASE_URL).
const prisma = new PrismaClient()

async function main() {
  console.log(
    `=== IMPL-20260824-06 (DEC-20260824-02 — Espirometría prediagnosis prompt v${PREDIAGNOSIS_VERSION}) ===\n`
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