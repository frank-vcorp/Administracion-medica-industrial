/**
 * Script para actualizar el prompt de extracción de Espirometría a v4
 * (IMPL-20260824-04 — BR-20260824-02, inferencia visual de criterios de
 * calidad desde las gráficas flujo-volumen y volumen-tiempo).
 *
 * USO:
 *   DATABASE_URL=<railway_url> npx tsx scripts/update-espirometria-extraction-prompt.ts
 *
 * EFECTO:
 *   - Busca el MedicalTest cuyo `name` sea "ESPIROMETRIA" (case-insensitive).
 *   - Actualiza únicamente `options.aiCalibration.extraction.prompt` y
 *     `options.aiCalibration.extraction.version` → 'espirometria-sibelmed-v4'.
 *   - Preserva intactos los demás campos de `options`, incluyendo:
 *       * `aiCalibration.enabled`
 *       * `aiCalibration.canonicalStudyType`
 *       * `aiCalibration.diagnosis`
 *       * `aiCalibration.extraction.{model, provider, schemaVersion}`
 *     Sin crear/modificar `aiCalibration.prediagnostico` ni
 *     `aiCalibration.normalization`.
 *
 * CONTRATO INTACTO:
 *   - El cálculo numérico de repetibilidad FVC/FEV1 (ml) sigue siendo
 *     responsabilidad del panel, que toma los dos valores más altos de
 *     `parametros[].m1/m2/m3` y aplica `(max − second) × 1000`.
 *     Umbral AMI ≤ 150 ml (BR-20260824-01). El extractor NO debe multiplicar
 *     ni convertir unidades.
 *   - `pico_maximo`, `forma_triangular`, `libre_artefactos`, `meseta`,
 *     `tiempo`, `criterios_para_dx`, `calidad` pasan a la regla BR-20260824-02:
 *     inferencia visual desde las curvas legibles, nunca desde la tabla
 *     numérica. Null si la curva no es legible.
 *   - Aliases para texto fuente del médico: el panel lee `impresion_diagnostica_texto`
 *     y `recomendaciones_texto`; el prompt v3 emitía `impresion_diagnostica` y
 *     `recomendaciones` sin sufijo. v4 acepta ambos nombres en el JSON (los
 *     poblará con el mismo texto si está visible). Sin invención.
 */
import { Prisma, PrismaClient } from '@prisma/client'
import { fileURLToPath } from 'node:url'

// Constantes exportadas para que los tests focales del prompt (V1) puedan
// inspeccionarlas sin tener que leer el archivo fuente ni ejecutarlo contra
// la BD. NO son parte del contrato público: son internas al script de
// mantenimiento del prompt de extracción de Espirometría.
export const EXTRACTION_VERSION = 'espirometria-sibelmed-v4'

export const NEW_EXTRACTION_PROMPT = `REGLAS ESPECÍFICAS PARA EXTRACCIÓN DE ESPIROMETRÍA (v4 — BR-20260824-02)

El documento contiene un estudio de función pulmonar. Devuelve ÚNICAMENTE un objeto JSON válido, sin markdown, sin texto adicional y sin bloques <think>.

FUENTE PRIMARIA (DATOS NUMÉRICOS)

1. La tabla "INFORME DE FVC" es la fuente primaria de los datos numéricos.
2. Cada fila tiene exactamente estas columnas: PARÁMETRO | M1 | %REF | M2 | %REF | M3 | %REF | REF | LLN.
3. Conserva cada celda en su columna correspondiente. Nunca desplaces M1 a M2 ni mezcles un %REF con otra maniobra.
4. Si una celda está vacía, usa null. Nunca inventes ni completes valores.
5. Extrae las filas FVC y FEV1 con sus valores absolutos M1/M2/M3 y sus porcentajes %REF.
6. También extrae Mejor FVC, Mejor FEV1, FEV1/FVC, FEF25%-75%, FET100%, Vext. y Edad del pulmón cuando estén visibles.
7. Extrae los datos del paciente, estudio, condiciones técnicas y de las gráficas.

INFERENCIA VISUAL DE CRITERIOS DE CALIDAD (BR-20260824-02)

Las gráficas flujo-volumen y volumen-tiempo del reporte, cuando sean legibles y las maniobras identificables, permiten INFERIR VISUALMENTE los siguientes criterios. Devuelve SI/NO (o A/B/C/D/F para \`calidad\`) sólo cuando la curva permita inferencia clara. Si una curva no es legible, está cortada, no distingue las maniobras, o el criterio es ambiguo, devuelve \`null\`. NUNCA inventes.

Claves dentro de \`calidad\`:

- \`pico_maximo\`       : "SI" | "NO" | null
- \`forma_triangular\`  : "SI" | "NO" | null
- \`libre_artefactos\`  : "SI" | "NO" | null
- \`meseta\`            : "SI" | "NO" | null
- \`tiempo\`            : "SI" | "NO" | null
- \`criterios_para_dx\` : "SI" | "NO" | null
- \`calidad\`           : "A" | "B" | "C" | "D" | "F" | null

REFERENCIA VISUAL (criterios ATS/ERS inferidos de las curvas):
- \`pico_maximo\`: el flujo espiratorio pico (PEF) aparece claro en el vértice de la curva flujo-volumen sin truncamiento ni amputación.
- \`forma_triangular\`: la curva flujo-volumen describe aproximadamente un triángulo isósceles desde PEF hasta el cruce con el eje de volumen (sin concavidades marcadas).
- \`libre_artefactos\`: no se observan tos al inicio, cierre de glotis, fuga, terminación prematura por esfuerzo variable ni obstrucción extratorácica variable.
- \`meseta\`: la curva volumen-tiempo muestra una meseta final (plateau) ≥ 1 segundo antes del término de la maniobra.
- \`tiempo\`: el tiempo espiratorio forzado (FET) cumple el criterio ATS/ERS (≥ 6 s en adultos; ≥ 3 s en niños).
- \`criterios_para_dx\`: las curvas cumplen los criterios de aceptabilidad y repetibilidad suficientes para emitir un patrón diagnóstico.
- \`calidad\`: grado global inferido de los anteriores. A = todos cumplen claramente; F = ninguno cumple. Si uno es ambiguo, baja un grado (A→B, B→C, etc.). Si varios son ilegibles, \`null\`.

ETIQUETA OBLIGATORIA (BR-20260824-02):

Estos valores son \`CRITERIOS DERIVADOS VISUALMENTE DE LAS GRÁFICAS\`. NO son texto escrito por el médico, NO son diagnóstico IA, NO sustituyen la revisión médica ocupacional. La inferencia visual es una ayuda al médico; cuando una curva no es clara, devuelve \`null\` y deja que el médico lo determine.

PROHIBICIONES ABSOLUTAS (BR-20260824-02):

1. NUNCA devuelvas SI/NO/A/B/C/D/F si la curva no permite inferencia clara. Si la curva está borrosa, cortada, con leyendas no visibles, o las maniobras no se distinguen → \`null\`.
2. NUNCA derives \`pico_maximo\`, \`forma_triangular\`, \`libre_artefactos\`, \`meseta\`, \`tiempo\`, \`criterios_para_dx\` o \`calidad\` desde la tabla numérica. Sólo desde las curvas legibles.
3. NUNCA inventes \`impresion_diagnostica\`/\`recomendaciones\`. Esos campos son TEXTO FUENTE del documento médico (transcríbelo literalmente sólo si está visible); NO son salida IA ni diagnóstico generado por el modelo.
4. NO modifiques el cálculo numérico de repetibilidad FVC/FEV1 en ml. Eso lo calcula el panel desde \`parametros[]\` (top-2 sobre m1/m2/m3 × 1000) con umbral AMI ≤ 150 ml (BR-20260824-01). Tu trabajo aquí es transcribir M1/M2/M3 y, opcionalmente, los Sí/No cualitativos del reporte cuando aparezcan.

ALIASES PARA REPETIBILIDAD Y ACEPTABILIDAD (compatibilidad con el esquema existente)

- \`repetibilidad_fvc_menor_150\`: "SI" | "NO" | null
   Criterio AMI: la repetibilidad FVC cumple cuando la diferencia entre los dos
   valores FVC más altos (en ml) es menor o igual a 150 ml (0.15 L). Si el
   reporte trae la diferencia numérica (ml), transcribe directamente "SI" o
   "NO" según corresponda; si no trae la diferencia, transcribe el Sí/No
   textual cuando aparezca. Si no hay información visible, null.
- \`repetibilidad_fev1_menor_150\`: idem para FEV1.
- \`pruebas_aceptables\`: entero con el número de maniobras válidas listadas
   (típicamente 3 cuando M1/M2/M3 están presentes); null si no es visible.

TEXTO FUENTE DEL MÉDICO (no IA; sólo transcripción literal cuando esté visible)

- \`impresion_diagnostica_texto\` y/o \`impresion_diagnostica\`: transcripción
   literal del texto que el médico escribió como impresión diagnóstica, si
   está visible. Si no, null. POBLAR AMBOS con el mismo valor cuando lo
   transcribas (el panel lee cualquiera de los dos nombres).
- \`recomendaciones_texto\` y/o \`recomendaciones\`: idem para las
   recomendaciones del médico. POBLAR AMBOS con el mismo valor.
   NO son salida IA.

COMPATIBILIDAD HISTÓRICA (no romper esquema existente)

- \`repetibilidad_ats_ers_fvc\`, \`repetibilidad_ats_ers_fev1\`,
   \`es_interpretable\`, \`completitud_documental\`,
   \`repetibilidad_fvc_ml\`, \`repetibilidad_fev1_ml\`,
   \`notas_calidad\`: mantener como antes. Si el reporte trae valores
   numéricos explícitos en ml, transcríbelos; si no, null.

REGLAS CRÍTICAS (resumen)

1. Los 7 campos visuales (\`pico_maximo\`, \`forma_triangular\`, \`libre_artefactos\`,
   \`meseta\`, \`tiempo\`, \`criterios_para_dx\`, \`calidad\`) son INFERIDOS
   VISUALMENTE de las curvas. Si la curva no es legible → null.
2. \`repetibilidad_fvc_menor_150\`/\`repetibilidad_fev1_menor_150\` son
   cualitativos Sí/No derivados del reporte (umbral AMI ≤ 150 ml). No
   calcules ml aquí.
3. \`impresion_diagnostica*\`/\`recomendaciones*\` son TEXTO FUENTE del documento.
   NUNCA los promociones como salida IA ni los inventes.
4. Si una clave aparece tanto en una bandera Sí/No como en texto narrativo,
   transcribe sólo la bandera estructurada; deja el texto narrativo dentro
   de \`notas_calidad\` cuando aplique.

SALIDA JSON MÍNIMA

{
  "paciente_detalle": {"nombre_completo": null, "sexo": null, "edad_anios": null, "talla_cm": null, "peso_kg": null, "imc": null, "fuma": null, "motivo": null, "procedencia": null},
  "estudio": {"referencia": null, "fecha_estudio": null, "hora_estudio": null, "tipo_reporte": null, "equipo_modelo": null, "version_software": null},
  "condiciones": {"temperatura_c": null, "presion_mmhg": null, "humedad_pct": null, "tecnico": null, "transductor": null, "referencia_ecuacion": null, "factor_etnico": null, "factor_btps": null},
  "parametros": [{"label": "FVC", "key": "fvc_l", "unidad": "L", "m1": null, "m1_pct_ref": null, "m2": null, "m2_pct_ref": null, "m3": null, "m3_pct_ref": null, "ref": null, "lln": null}, {"label": "FEV1", "key": "fev1_l", "unidad": "L", "m1": null, "m1_pct_ref": null, "m2": null, "m2_pct_ref": null, "m3": null, "m3_pct_ref": null, "ref": null, "lln": null}],
  "calidad": {
    "pico_maximo": null,
    "forma_triangular": null,
    "libre_artefactos": null,
    "meseta": null,
    "tiempo": null,
    "criterios_para_dx": null,
    "calidad": null,
    "repetibilidad_fvc_menor_150": null,
    "repetibilidad_fev1_menor_150": null,
    "pruebas_aceptables": null,
    "impresion_diagnostica_texto": null,
    "impresion_diagnostica": null,
    "recomendaciones_texto": null,
    "recomendaciones": null,
    "repetibilidad_ats_ers_fvc": null,
    "repetibilidad_ats_ers_fev1": null,
    "es_interpretable": null,
    "completitud_documental": null,
    "repetibilidad_fvc_ml": null,
    "repetibilidad_fev1_ml": null,
    "notas_calidad": null
  },
  "graficas": {"curva_flujo_volumen_presente": null, "curva_volumen_tiempo_presente": null, "maniobras_graficadas": null, "observaciones_grafica": null}
}

No copies diagnósticos ni recomendaciones médicas como diagnóstico IA. Devuelve sólo JSON.`

// Cliente Prisma instanciado lazy (no se conecta hasta el primer uso; la
// conexión ocurre al ejecutar el script con DATABASE_URL).
const prisma = new PrismaClient()

async function main() {
  console.log(
    '=== IMPL-20260824-04 (BR-20260824-02 — Espirometría inferencia visual v4) ===\n'
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
