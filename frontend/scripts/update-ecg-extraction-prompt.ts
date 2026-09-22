/**
 * Persiste prompt de extracción ECG en el catálogo (MedicalTest).
 *
 * USO:
 *   cd frontend && DATABASE_URL=... npx tsx scripts/update-ecg-extraction-prompt.ts
 */
import { Prisma, PrismaClient } from '@prisma/client'
import {
  ECG_EXTRACTION_PROMPT,
  ECG_EXTRACTION_VERSION,
} from '../src/lib/clinical/default-ai-calibration'

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
