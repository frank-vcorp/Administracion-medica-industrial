/**
 * Script para actualizar el prompt de extracción de Audiometría
 * para soportar gráficas audiométricas.
 *
 * IMPL-20260715-05 (SPEC ARCH-20260715-05)
 *
 * USO:
 *   cd frontend && npx tsx scripts/update-audiometria-extraction-prompt.ts
 *
 * EFECTO:
 *   - Busca el MedicalTest cuyo `name` contenga "Audiometría" (case-insensitive)
 *   - Actualiza únicamente `options.aiCalibration.extraction.prompt`
 *     y `options.aiCalibration.extraction.version`
 *   - Preserva intactos todos los demás campos de `options`,
 *     incluyendo prediagnóstico, normalización y guardrails.
 */
import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

const NEW_EXTRACTION_PROMPT = `REGLAS ESPECÍFICAS PARA EXTRACCIÓN DE AUDIOGRAMAS

Este documento contiene gráficas de audiometría (audiogramas) con curvas de vía aérea.

EXTRACCIÓN DE VALORES DESDE GRÁFICAS

1. Identifica los ejes de la gráfica:
   - Eje Y (vertical): dB HL (decibeles de nivel de audición), rango típico -10 a 120
   - Eje X (horizontal): Frecuencia en Hz (125, 250, 500, 1K, 2K, 4K, 8K)

2. Identifica los símbolos de cada oído:
   - O (círculo, típicamente rojo) = Oído Derecho (OD)
   - X (equis, típicamente azul) = Oído Izquierdo (OI)
   - Si hay vía ósea: < (corchete izquierdo) = OD, > (corchete derecho) = OI

3. Extrae los valores de umbral para cada frecuencia visible en la gráfica:
   - Lee el valor de dB HL donde cada símbolo intersecta cada frecuencia
   - Si un símbolo no está presente en una frecuencia, usa null
   - NO inventes valores para frecuencias donde no hay símbolo visible

4. Si hay tabla resumen con PTA (Promedio de Tonos Puros):
   - Captura el PTA reportado para cada oído
   - El PTA típicamente promedia 500, 1000, 2000 Hz

5. Frecuencias canónicas esperadas: 250, 500, 1000, 2000, 3000, 4000, 6000, 8000 Hz
   - Si la gráfica muestra frecuencias adicionales (125, 750, 1500, 3000), captúralas
   - Si la gráfica solo muestra 4 frecuencias (500, 1000, 2000, 3000), captura solo esas

COMPATIBILIDAD CON TABLAS NUMÉRICAS

Si el documento contiene una tabla numérica explícita (en lugar de o además de gráficas):
- La tabla es la fuente primaria de datos numéricos
- Captura EXACTAMENTE las frecuencias y valores visibles en la tabla
- NO inventes valores para frecuencias ausentes

CAMPOS DE SALIDA ESPERADOS

{
  "oido_derecho": {
    "va": {
      "250": null,
      "500": 15,
      "1000": 10,
      "2000": 15,
      "3000": 20,
      "4000": null,
      "6000": null,
      "8000": null
    },
    "pta": 13
  },
  "oido_izquierdo": {
    "va": {
      "250": null,
      "500": 10,
      "1000": 5,
      "2000": 15,
      "3000": 30,
      "4000": null,
      "6000": null,
      "8000": null
    },
    "pta": 15
  },
  "frecuencias_detectadas": ["500", "1000", "2000", "3000"],
  "completitud_documental": "parcial",
  "notas_calidad": "Gráfica audiométrica con 4 frecuencias visibles. PTA calculado automáticamente."
}

REGLAS DE CALIDAD

1. completitud_documental:
   - "suficiente" → ≥6 frecuencias con valor por oído
   - "parcial" → 3-5 frecuencias con valor por oído
   - "no_concluyente" → <3 frecuencias con valor por oído

2. Si la gráfica es ilegible o los símbolos no son claros:
   - Marca completitud_documental como "no_concluyente"
   - Agrega en notas_calidad: "Gráfica ilegible o símbolos no identificables"

3. NO copies el diagnóstico textual del documento (ej. "Hipoacusia Leve")
   - Ese texto fue agregado después por el médico
   - Tu tarea es SOLO extraer valores numéricos de las gráficas/tablas
`

const EXTRACTION_VERSION = 'extract-audio-graficas-v1'

async function main() {
  console.log('=== IMPL-20260715-05: Actualización prompt Audiometría ===\n')
  console.log('Buscando servicio de Audiometría...')

  const audiometria = await prisma.medicalTest.findFirst({
    where: {
      name: {
        contains: 'Audiometr',
        mode: 'insensitive',
      },
    },
  })

  if (!audiometria) {
    console.error('No se encontró el servicio de Audiometría en medical_tests')
    process.exit(1)
  }

  console.log(`Encontrado: "${audiometria.name}" (ID: ${audiometria.id})`)

  // --- Construir el nuevo options preservando todo lo existente ---
  const currentOptions = (audiometria.options as Record<string, unknown>) ?? {}

  const currentAiCalibration =
    (currentOptions.aiCalibration as Record<string, unknown>) ?? {}

  const currentExtraction =
    (currentAiCalibration.extraction as Record<string, unknown>) ?? {}

  const previousVersion =
    typeof currentExtraction.version === 'string'
      ? currentExtraction.version
      : '(sin versión previa)'

  const updatedExtraction = {
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

  // --- Dry-run preview ---
  console.log(`\nVersión previa extraction.version: ${previousVersion}`)
  console.log(`Nueva versión extraction.version:  ${EXTRACTION_VERSION}`)
  console.log(
    `Tamaño del nuevo prompt: ${NEW_EXTRACTION_PROMPT.length} caracteres`,
  )

  // Sanity check: asegurarnos de que NO estamos tocando prediagnóstico ni normalización
  const prediagnosticoKeys = Object.keys(
    (updatedAiCalibration.prediagnostico as object | undefined) ?? {},
  )
  const normalizationKeys = Object.keys(
    (updatedAiCalibration.normalization as object | undefined) ?? {},
  )
  console.log(
    `Claves preservadas en aiCalibration.prediagnostico: [${prediagnosticoKeys.join(
      ', ',
    ) || '∅'}]`,
  )
  console.log(
    `Claves preservadas en aiCalibration.normalization:  [${normalizationKeys.join(
      ', ',
    ) || '∅'}]`,
  )

  // --- Persistir ---
  await prisma.medicalTest.update({
    where: { id: audiometria.id },
    data: { options: updatedOptions as Prisma.InputJsonValue },
  })

  console.log(
    '\nPrompt de extracción actualizado correctamente.',
  )
  console.log(`   → medical_test.id: ${audiometria.id}`)
  console.log(`   → extraction.version: ${EXTRACTION_VERSION}`)
}

main()
  .catch((e: unknown) => {
    console.error('Error durante la actualización:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })