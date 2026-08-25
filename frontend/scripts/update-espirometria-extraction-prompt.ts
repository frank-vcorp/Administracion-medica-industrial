/**
 * Script para actualizar el prompt de extracción de Espirometría a v7
 * (IMPL-FIX-20260824-04-rev2 — compactación contra regresión M3
 * `EXTRACTION_NOT_JSON` por prompts largos).
 *
 * USO:
 *   DATABASE_URL=<railway_url> npx tsx scripts/update-espirometria-extraction-prompt.ts
 *
 * EFECTO:
 *   - Busca el MedicalTest cuyo `name` sea "ESPIROMETRIA" (case-insensitive).
 *   - Actualiza únicamente `options.aiCalibration.extraction.prompt` y
 *     `options.aiCalibration.extraction.version` → 'espirometria-sibelmed-v7'.
 *   - Preserva intactos los los campos de `options`, incluyendo:
 *       * `aiCalibration.enabled`
 *       * `aiCalibration.canonicalStudyType`
 *       * `aiCalibration.diagnosis`
 *       * `aiCalibration.extraction.{model, provider, schemaVersion}`
 *     Sin crear/modificar `aiCalibration.prediagnostico` ni
 *     `aiCalibration.normalization`.
 *
 * CONTRATO INTACTO:
 *   - El cálculo numérico de repetibilidad FVC/VVC1 (ml) sigue siendo
 *     responsabilidad del panel (top-2 sobre m1_m2_m3 × 1000).
 *     Umbral AMI ≤ 150 ml (BR-20260824-01). El extractor NO calcula.
 *   - `repetibilidad_fvc_menor_150` y `repetibilidad_fev1_menor_150` SIEMPRE
 *     null en extractor; los deriva el panel.
 *   - `tiempo`/`criterios_para_dx`/`calidad`: sólo si el reporte los declara
 *     EXPLÍCITITAMENTE. Sin inferencia.
 *   - `pico_maximo`, `forma_triangular`, `libre_artefactos`, `meseta`:
 *     inferencia visual clara SI/NO sólo si la gráfica es legible.
 *   - `impresion_diagnostica_texto` y `recomendaciones_texto`: texto
 *     fuente del médico, sin invención.
 *
 * CAMBIOS vs v6 (FIX-20260824-04-rev2):
 *   - PROMPT COMPACTADO A <5 KB (era ~19.5 KB en v6).
 *   - Causa: MiniMax M3 con v6 (~15 KB al pasarlo al SDK) responde con
 *     bloques `<think>...` y no alcanza a devolver JSON en 4096 tokens.
 *     El parser tolerante no puede recuperar JSON inexistente/truncado.
 *   - Defensa: el script `M3VisionBase.call_m3` aumenta `max_tokens`
 *     (4096 → 8192) y pasa `response_format={"type":"json_object"}`
 *     (soportado por M3 vía OpenAI SDK; no oculta errores ni agrega
 *     reintentos ciegos).
 *   - Reglas críticas preservadas (todas verificadas por test):
 *       1. JSON único (sin markdown, sin <think>).
 *       2. Layout 9 columnas PARÁMETRO|M1|%REF|M2|%REF|M3|%REF|REF|LLN.
 *       3. NO duplicar M1/M2/M3 (prohibición explícita + síntoma).
 *       4. NO usar "Mejor FEV1"/"Mejor FVC" como fila estándar.
 *       5. Validación cruzada mejor_*_max ≤ std_max; transcribir sin
 *          rellenar si inconsistente (defensa backend marca SOSPECHA).
 *       6. Ejemplo canónico FEV1 2.15/77,2.11/76,2.09/75 + FVC 2.30/69,
 *          2.33/70,2.26/68.
 *       7. Visuales null si no claros.
 *       8. Repetibilidad NO se calcula aquí (panel: top-2 × 1000 ≤ 150).
 *   - Documentación y tablas completas viven en el docstring del script
 *     y en los tests focales (no en el prompt mismo).
 */
import { Prisma, PrismaClient } from '@prisma/client'
import { fileURLToPath } from 'node:url'

// Constantes exportadas para que los tests focales del prompt (V1) puedan
// inspeccionarlas sin tener que leer el archivo fuente ni ejecutarlo contra
// la BD. NO son parte del contrato público: son internas al script de
// mantenimiento del prompt de extracción de Espirometría.
export const EXTRACTION_VERSION = 'espirometria-sibelmed-v7'

export const NEW_EXTRACTION_PROMPT = `ESPIROMETRÍA Sibelmed W20s — extracción v7 (IMPL-FIX-20260824-04-rev2; <5KB).

Devuelve SOLO JSON válido. Sin markdown, sin texto, sin bloques <think>. JSON único que arranca con { y termina con }.

TABLA INFORME DE FVC — fuente primaria. 9 columnas exactas:
PARÁMETRO | M1 | %REF | M2 | %REF | M3 | %REF | REF | LLN
Cada fila = 6 celdas numéricas: m1, m1_pct_ref, m2, m2_pct_ref, m3, m3_pct_ref + ref, lln.
Si una celda está vacía → null. NUNCA desplaces M1↔M2↔M3 ni %REF entre columnas.

PROHIBICIONES ABSOLUTAS:
- NO DUPLIQUES UNA CELDA: m1←m2, m1_pct_ref←m2_pct_ref, etc. Si M1 está vacía → null. Nunca copies m2 en m1. Síntoma: m1=m2 ⇒ (m1−m2)×1000=0 ml (duplicación, no repetibilidad).
- NO USES "Mejor FEV1"/"Mejor FVC" como fila FEV1/FVC estándar. "Mejor X" consolida m1=m2=m3=mejor valor. La fila estándar contiene las 3 maniobras separadas (m1,m2,m3 pueden diferir). Si la fila estándar no está visible → null. NO rellenes con "Mejor X".

VALIDACIÓN CRUZADA OBLIGATORIA (antes de cerrar el JSON):
mejor_fev1_max = mejor_fev1.m1
fev1_std_max = max(fev1.m1, fev1.m2, fev1.m3)
Si mejor_fev1_max > fev1_std_max → INCONSISTENCIA. NO rellenes m1 desde "Mejor X". Transcribe literalmente. Backend marcará SOSPECHA_INCONSISTENCIA_MEJOR_FEV1 + completitud_documental="no_concluyente". Mismo procedimiento para FVC.

EJEMPLO CANÓNICO (Sibelmed, layout de 9 columnas):
FEV1 → m1=2.15, m1_pct_ref=77, m2=2.11, m2_pct_ref=76, m3=2.09, m3_pct_ref=75 → top-2=(2.15−2.11)×1000=40 ml
FVC  → m1=2.30, m1_pct_ref=69, m2=2.33, m2_pct_ref=70, m3=2.26, m3_pct_ref=68 → top-2=(2.33−2.30)×1000=30 ml
"Mejor FEV1" → m1=m2=m3=2.15. "Mejor FVC" → m1=m2=m3=2.33. NO uses estas filas como estándar.

CRITERIOS VISUALES (calidad.*): SOLO si la gráfica es CLARA. Si no → null.
- pico_maximo, forma_triangular, libre_artefactos, meseta: "SI"|"NO"|null (inferir de curva flujo-volumen / volumen-tiempo).
- tiempo: SOLO si el reporte declara EXPLÍCITAMENTE "FET: cumple/no cumple" o similar. NO derivar de duración.
- criterios_para_dx: SOLO si el reporte declara "Criterios para Dx: SI/NO". NO derivar de ATS/ERS.
- calidad (A/B/C/D/F): SOLO si el reporte declara letra/código EXPLÍCITO. NO calcular.

REPETIBILIDAD:
- El panel la calcula (top-2 sobre m1/m2/m3 × 1000, umbral AMI ≤ 150 ml). NO calcules aquí.
- repetibilidad_fvc_menor_150 / repetibilidad_fev1_menor_150: SIEMPRE null.
- repetibilidad_fvc_ml / repetibilidad_fev1_ml: SOLO si el reporte trae el número explícito en texto nativo ("Repetibilidad FVC: 30 ml"). Si no → null.

ALIASES para texto fuente del médico (transcribir literalmente si visible):
- impresion_diagnostica_texto, recomendaciones_texto (preferidos) — también impresion_diagnostica, recomendaciones (compat).

SALIDA JSON (estructura exacta, todas las claves con null por defecto):

{
  "paciente_detalle": {"nombre_completo": null, "sexo": null, "edad_anios": null, "talla_cm": null, "peso_kg": null, "imc": null, "fuma": null, "motivo": null, "procedencia": null},
  "estudio": {"referencia": null, "fecha_estudio": null, "hora_estudio": null, "tipo_reporte": null, "equipo_modelo": null, "version_software": null},
  "condiciones": {"temperatura_c": null, "presion_mmhg": null, "humedad_pct": null, "tecnico": null, "transductor": null, "referencia_ecuacion": null, "factor_etnico": null, "factor_btps": null},
  "parametros": [
    {"label":"Mejor FVC","key":"mejor_fvc_l","unidad":"L","m1":null,"m1_pct_ref":null,"m2":null,"m2_pct_ref":null,"m3":null,"m3_pct_ref":null,"ref":null,"lln":null},
    {"label":"Mejor FEV1","key":"mejor_fev1_l","unidad":"L","m1":null,"m1_pct_ref":null,"m2":null,"m2_pct_ref":null,"m3":null,"m3_pct_ref":null,"ref":null,"lln":null},
    {"label":"FVC","key":"fvc_l","unidad":"L","m1":null,"m1_pct_ref":null,"m2":null,"m2_pct_ref":null,"m3":null,"m3_pct_ref":null,"ref":null,"lln":null},
    {"label":"FEV1","key":"fev1_l","unidad":"L","m1":null,"m1_pct_ref":null,"m2":null,"m2_pct_ref":null,"m3":null,"m3_pct_ref":null,"ref":null,"lln":null}
  ],
  "calidad": {
    "pico_maximo": null, "forma_triangular": null, "libre_artefactos": null, "meseta": null,
    "tiempo": null, "criterios_para_dx": null, "calidad": null,
    "repetibilidad_fvc_menor_150": null, "repetibilidad_fev1_menor_150": null,
    "pruebas_aceptables": null,
    "impresion_diagnostica_texto": null, "impresion_diagnostica": null,
    "recomendaciones_texto": null, "recomendaciones": null,
    "repetibilidad_ats_ers_fvc": null, "repetibilidad_ats_ers_fev1": null,
    "es_interpretable": null, "completitud_documental": null,
    "repetibilidad_fvc_ml": null, "repetibilidad_fev1_ml": null,
    "notas_calidad": null
  },
  "graficas": {"curva_flujo_volumen_presente": null, "curva_volumen_tiempo_presente": null, "maniobras_graficadas": null, "observaciones_grafica": null}
}

Devuelve SOLO el JSON anterior (con valores poblados donde estén visibles). Sin markdown, sin <think>, sin explicaciones.`

// Cliente Prisma instanciado lazy (no se conecta hasta el primer uso; la
// conexión ocurre al ejecutar el script con DATABASE_URL). (no se conecta hasta el primer uso; la
// conexión ocurre al ejecutar el script con DATABASE_URL).
const prisma = new PrismaClient()

async function main() {
  console.log(
    '=== IMPL-FIX-20260824-04-rev2 (FIX-20260824-04 — Espirometría v7, compactación <5KB contra EXTRACTION_NOT_JSON M3) ===\n'
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

  const currentOptions = (test.options as Record<string, unknown> | null) ?? {}
  const currentAiCalibration =
    (currentOptions.aiCalibration as Record<string, unknown> | null) ?? {}
  const currentExtraction =
    (currentAiCalibration.extraction as Record<string, unknown> | null) ?? {}

  const previousVersion =
    typeof currentExtraction.version === 'string'
      ? currentExtraction.version
      : '(sin versión previa)'

  const previousPromptChars =
    typeof currentExtraction.prompt === 'string'
      ? currentExtraction.prompt.length
      : 0

  // --- Preservar TODO lo demás intacto ---
  const updatedExtraction: Record<string, unknown> = {
    ...currentExtraction,
    prompt: NEW_EXTRACTION_PROMPT,
    version: EXTRACTION_VERSION,
  }

  const updatedAiCalibration: Record<string, unknown> = {
    ...currentAiCalibration,
    extraction: updatedExtraction,
  }

  const updatedOptions: Record<string, unknown> = {
    ...currentOptions,
    aiCalibration: updatedAiCalibration,
  }

  // --- Reporte pre-update ---
  console.log(`Versión previa extraction.version: ${previousVersion}`)
  console.log(`Nueva versión extraction.version:  ${EXTRACTION_VERSION}`)
  console.log(`Tamaño prompt previo:  ${previousPromptChars} chars`)
  console.log(`Tamaño prompt nuevo:   ${NEW_EXTRACTION_PROMPT.length} chars`)
  console.log(
    `Claves preservadas en aiCalibration (top-level): [${Object.keys(
      updatedAiCalibration
    ).join(', ')}]`
  )
  console.log(
    `Claves preservadas en aiCalibration.extraction:  [${Object.keys(
      updatedExtraction
    ).join(', ')}]`
  )
  const prediagnosticoKeys = Object.keys(
    (updatedAiCalibration.prediagnostico as object | undefined) ?? {}
  )
  const normalizationKeys = Object.keys(
    (updatedAiCalibration.normalization as object | undefined) ?? {}
  )
  console.log(
    `Claves en aiCalibration.prediagnostico: [${prediagnosticoKeys.join(', ') || '∅'}] (preservadas, sin creación)`
  )
  console.log(
    `Claves en aiCalibration.normalization:  [${normalizationKeys.join(', ') || '�'}] (preservadas, sin creación)`
  )

  // --- Persistir ---
  await prisma.medicalTest.update({
    where: { id: test.id },
    data: { options: updatedOptions as Prisma.InputJsonValue },
  })

  console.log('\nPrompt de extracción actualizado correctamente.')
  console.log(`   → medical_test.id:        ${test.id}`)
  console.log(`   → extraction.version:     ${EXTRACTION_VERSION}`)
  console.log(`   → extraction.prompt size: ${NEW_EXTRACTION_PROMPT.length} chars`)
}

// Guardia entry-point: sólo ejecuta `main()` cuando el archivo se ejecuta
// directamente (no cuando se importa desde los tests focales V1).
const isMainModule =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  (fileURLToPath(import.meta.url) === process.argv[1] ||
    process.argv[1].endsWith('update-espirometria-extraction-prompt.ts'))

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
