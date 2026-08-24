/**
 * Script para actualizar el prompt de extracción de Espirometría para
 * que el extractor devuelva las claves cualitativas que el panel
 * `EspirometriaClinicalCriteriaPanel` necesita mostrar (FEATURE-20260824-01
 * rev. 1.4 / mini-corte).
 *
 * IMPL-20260824-01 (FEATURE-20260824-01 — Espirometría cualitativos)
 *
 * USO:
 *   DATABASE_URL=<railway_url> npx tsx scripts/update-espirometria-extraction-prompt.ts
 *
 * EFECTO:
 *   - Busca el MedicalTest cuyo `name` sea "ESPIROMETRIA" (case-insensitive).
 *   - Actualiza únicamente `options.aiCalibration.extraction.prompt` y
 *     `options.aiCalibration.extraction.version` → 'espirometria-sibelmed-v3'.
 *   - Preserva intactos los demás campos de `options`, incluyendo:
 *       * `aiCalibration.enabled` (enabled=false actual).
 *       * `aiCalibration.canonicalStudyType`.
 *       * `aiCalibration.diagnosis` (prediagnóstico).
 *       * `aiCalibration.extraction.{model, provider, schemaVersion}`.
 *     Sin crear/modificar `aiCalibration.prediagnostico` ni
 *     `aiCalibration.normalization` (no existían previamente).
 *   - El nuevo prompt añade, dentro de `calidad`, las claves cualitativas
 *     que el panel `EspirometriaClinicalCriteriaPanel` lee del snapshot:
 *       * pico_maximo, forma_triangular, libre_artefactos, meseta, tiempo
 *       * repetibilidad_fvc_menor_150, repetibilidad_fev1_menor_150
 *         (Sí/No derivados del umbral AMI de 150 ml — BR-20260824-01;
 *         el panel también los recalcula desde `parametros[]` si el
 *         extractor emite null aquí).
 *       * pruebas_aceptables (nº de maniobras válidas, 3 cuando
 *         m1/m2/m3 presentes; el panel también lo recalcula si es null).
 *       * criterios_para_dx, calidad
 *       * impresion_diagnostica, recomendaciones (texto fuente del
 *         documento; NO se promueve como salida IA).
 *     Regla explícita: null si no es visible en el reporte; nunca inventar.
 *
 * CONTRATO INTACTO:
 *   - El cálculo numérico de repetibilidad FVC/FEV1 (ml) sigue siendo
 *     responsabilidad del panel, que toma los dos valores más altos
 *     de `parametros[].m1/m2/m3` y aplica `(max − second) × 1000`.
 *     El extractor NO debe multiplicar ni convertir unidades.
 */
import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const EXTRACTION_VERSION = 'espirometria-sibelmed-v3'

const NEW_EXTRACTION_PROMPT = `REGLAS ESPECÍFICAS PARA EXTRACCIÓN DE ESPIROMETRÍA

El documento contiene un estudio de función pulmonar. Devuelve ÚNICAMENTE un objeto JSON válido, sin markdown, sin texto adicional y sin bloques <think>.

FUENTE PRIMARIA

1. La tabla "INFORME DE FVC" es la fuente primaria de los datos numéricos.
2. Cada fila tiene exactamente estas columnas: PARÁMETRO | M1 | %REF | M2 | %REF | M3 | %REF | REF | LLN.
3. Conserva cada celda en su columna correspondiente. Nunca desplaces M1 a M2 ni mezcles un %REF con otra maniobra.
4. Si una celda está vacía, usa null. Nunca inventes ni completes valores.
5. Extrae las filas FVC y FEV1 con sus valores absolutos M1/M2/M3 y sus porcentajes %REF.
6. También extrae Mejor FVC, Mejor FEV1, FEV1/FVC, FEF25%-75%, FET100%, Vext. y Edad del pulmón cuando estén visibles.
7. Extrae los datos del paciente, estudio, condiciones técnicas y gráficas.

CRITERIOS CLÍNICOS VISIBLES (cuando aparezcan en el reporte)

Después de las gráficas y los indicadores, el reporte puede incluir una sección con banderas/criterios de aceptabilidad ATS/ERS y texto del médico. Si esos elementos están visibles, transcríbelos en \`calidad\` usando exactamente estas claves:

- \`pico_maximo\`: "SI" | "NO" | null
- \`forma_triangular\`: "SI" | "NO" | null
- \`libre_artefactos\`: "SI" | "NO" | null
- \`meseta\`: "SI" | "NO" | null
- \`tiempo\`: "SI" | "NO" | null
- \`repetibilidad_fvc_menor_150\`: "SI" | "NO" | null
   Criterio AMI: la repetibilidad FVC cumple cuando la diferencia entre los dos
   valores FVC más altos (en ml) es menor o igual a 150 ml (0.15 L). Si el
   reporte trae la diferencia numérica (ml), transcribe directamente "SI" o
   "NO" según corresponda; si no trae la diferencia, transcribe el Sí/No
   textual cuando aparezca. Si no hay información visible, null.
- \`repetibilidad_fev1_menor_150\`: idem para FEV1.
- \`pruebas_aceptables\`: entero con el número de maniobras válidas listadas
  (típicamente 3 cuando M1/M2/M3 están presentes); null si no es visible.
- \`criterios_para_dx\`: "SI" | "NO" | null
- \`calidad\`: letra o código de calidad global ("A", "B", "C", "D", "F") si
  el reporte lo muestra, si no null.
- \`impresion_diagnostica\`: transcripción literal del texto que el médico
  escribió como impresión diagnóstica, si está visible. Si no, null.
  NO es diagnóstico IA; es texto fuente del documento.
- \`recomendaciones\`: transcripción literal del texto de recomendaciones
  del médico, si está visible. Si no, null. NO es salida IA.
- \`repetibilidad_ats_ers_fvc\`, \`repetibilidad_ats_ers_fev1\`,
  \`es_interpretable\`, \`completitud_documental\`,
  \`repetibilidad_fvc_ml\`, \`repetibilidad_fev1_ml\`,
  \`notas_calidad\`: mantener como antes (compatibilidad con el esquema
  existente). Si el reporte trae valores numéricos explícitos en ml,
  transcríbelos; si no, null.

REGLAS CRÍTICAS

1. Ninguna clave cualitativa se infiere desde la tabla numérica. Si no
   está visible en el reporte, usa null. NUNCA inventes Sí/No.
2. El cálculo numérico de repetibilidad en ml es responsabilidad del panel
   que recibe el snapshot: NO calcules diff en ml aquí, sólo transcribe
   los valores M1/M2/M3 de las filas FVC y FEV1 en \`parametros[]\`.
3. \`impresion_diagnostica\` y \`recomendaciones\` son TEXTO FUENTE del
   documento médico, no salida IA. Nunca los promociones como diagnóstico
   generado por el modelo.
4. Si una clave aparece tanto en una bandera Sí/No como en texto narrativo,
   transcribe sólo la bandera estructurada; deja el texto narrativo dentro
   de \`notas_calidad\` cuando aplique.

MAPEO OBLIGATORIO PARA EL REPORTE SIBELMED W20s DE PRUEBA

Para la fila FEV1: m1=2.15, m1_pct_ref=77, m2=2.11, m2_pct_ref=76, m3=2.09, m3_pct_ref=75.
Para la fila FVC: m1=2.30, m1_pct_ref=69, m2=2.33, m2_pct_ref=70, m3=2.26, m3_pct_ref=68.
Estos números son un ejemplo de correspondencia de columnas del layout, no deben copiarse a otros documentos si no son visibles.

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
    "repetibilidad_fvc_menor_150": null,
    "repetibilidad_fev1_menor_150": null,
    "pruebas_aceptables": null,
    "criterios_para_dx": null,
    "calidad": null,
    "impresion_diagnostica": null,
    "recomendaciones": null,
    "repetibilidad_ats_ers_fvc": null,
    "repetibilidad_ats_ers_fev1": null,
    "es_interpretable": null,
    "completitud_documental": null,
    "notas_calidad": null
  },
  "graficas": {"curva_flujo_volumen_presente": null, "curva_volumen_tiempo_presente": null, "maniobras_graficadas": null, "observaciones_grafica": null}
}

No copies diagnósticos ni recomendaciones médicas como diagnóstico IA. Devuelve sólo JSON.`

async function main() {
  console.log(
    '=== IMPL-20260824-01 (FEATURE-20260824-01 — Espirometría cualitativos) ===\n'
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
    `Claves en aiCalibration.normalization:  [${normalizationKeys.join(', ') || '∅'}] (preservadas, sin creación)`
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

main()
  .catch((e: unknown) => {
    console.error('Error durante la actualización:', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })