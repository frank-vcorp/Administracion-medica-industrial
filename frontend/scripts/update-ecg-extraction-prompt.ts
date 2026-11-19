/**
 * Persiste prompt de extracción ECG en el catálogo (MedicalTest).
 *
 * USO:
 *   cd frontend && DATABASE_URL=... npx tsx scripts/update-ecg-extraction-prompt.ts
 */
import { Prisma, PrismaClient } from '@prisma/client'

const ECG_EXTRACTION_VERSION = 'ecg-ami-bootstrap-v1'

const ECG_EXTRACTION_PROMPT = `EXTRACCIÓN DE ELECTROCARDIOGRAMA (ECG / Electrocardiograma)

Devuelve SOLO un objeto JSON válido. Sin markdown, sin comentarios, sin bloques <think>. JSON único que empieza con { y termina con }.

Campos esperados:
{
  "paciente": "nombre del paciente en el reporte",
  "fecha_estudio": "fecha del estudio tal como aparece",
  "ritmo": "ej. Sinusal, Fibrilación auricular, o null",
  "frecuencia_bpm": número entero o null,
  "intervalo_pr_ms": número entero o null,
  "duracion_qrs_ms": número entero o null,
  "qtc_ms": número entero o null,
  "eje_electrico": "Normal, Desviación izquierda/derecha, o null",
  "hallazgos": ["descripción objetiva del trazado, sin diagnóstico definitivo"],
  "profesional": "médico o firmante si aparece, o null",
  "notas_calidad": "calidad del documento o null"
}

REGLAS:
- NO inventes valores; usa null si no son legibles.
- NO incluyas diagnóstico final, aptitud laboral ni tratamiento.
- "hallazgos" = descripciones del trazado (ondas, bloqueos, ST-T, etc.).
- frecuencia_bpm, intervalos y qtc deben ser números (no strings) cuando sean legibles.
`

const prisma = new PrismaClient()

async function main() {
  const ecg = await prisma.medicalTest.findFirst({
    where: {
      OR: [
        { code: 'CARD-ECG' },
        { name: { contains: 'Electrocardiograma', mode: 'insensitive' } },
        { name: { contains: 'ECG', mode: 'insensitive' } },
      ],
    },
  })

  if (!ecg) {
    console.error('No se encontró prueba de Electrocardiograma en medical_tests')
    process.exit(1)
  }

  console.log(`Encontrado: "${ecg.name}" (${ecg.code}) id=${ecg.id}`)

  const currentOptions = (ecg.options as Record<string, unknown>) ?? {}
  const currentAiCalibration =
    (currentOptions.aiCalibration as Record<string, unknown>) ?? {}
  const currentExtraction =
    (currentAiCalibration.extraction as Record<string, unknown>) ?? {}

  const updatedOptions: Record<string, unknown> = {
    ...currentOptions,
    aiCalibration: {
      ...currentAiCalibration,
      enabled: currentAiCalibration.enabled ?? true,
      canonicalStudyType: currentAiCalibration.canonicalStudyType ?? 'ECG',
      extraction: {
        ...currentExtraction,
        prompt: ECG_EXTRACTION_PROMPT,
        version: ECG_EXTRACTION_VERSION,
      },
    },
  }

  await prisma.medicalTest.update({
    where: { id: ecg.id },
    data: { options: updatedOptions as Prisma.InputJsonValue },
  })

  console.log('✓ Prompt de extracción ECG actualizado en catálogo.')
}

main()
  .catch((e: unknown) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
